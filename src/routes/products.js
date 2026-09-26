import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { save, urlFor } from '../storage.js';
import { setJob, getJob } from '../jobs.js';
import { enhanceWithGemini, basicQualityCheck, autoPreprocessImage } from '../services/geminiEnhance.js';
import { generateDescription } from '../services/geminiDescribe.js';
import { createImageTo3DJob, getJobStatus, stageForProgress } from '../services/meshy3d.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router();

/* ============================================================
   IMAGE ENHANCEMENT
   POST /api/products/:id/enhance-image   (multipart: image, mode)
   GET  /api/products/:id/enhance-status  (poll while PROCESSING)
   ============================================================ */

router.post('/:id/enhance-image', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const mode = req.body.mode || 'marketplace';

  if (!req.file) return res.status(400).json({ error: 'No image file uploaded (field name: "image").' });
  if (!/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Uploaded file is not an image.' });

  setJob(id, 'enhance', { status: 'UPLOADING', stage: 'Uploading your photo…' });

  try {
    // Auto-upscale low-resolution mobile photos (WhatsApp / low-end phone uploads)
    const processedBuffer = await autoPreprocessImage(req.file.buffer);

    // 1. Original goes to storage first — it must always remain available (point 6 of the brief).
    const originalName = `original-${Date.now()}.jpg`;
    const originalUrl = await save(id, 'original', originalName, processedBuffer);

    setJob(id, 'enhance', { status: 'PROCESSING', stage: 'Analyzing product…', originalUrl });

    // 2. Basic quality gate on the INPUT
    const inputCheck = await basicQualityCheck(processedBuffer);
    if (!inputCheck.passed) {
      setJob(id, 'enhance', { status: 'FAILED', stage: null, error: inputCheck.issues.join(' ') });
      return res.status(200).json(getJob(id, 'enhance'));
    }

    setJob(id, 'enhance', { stage: 'Removing background & correcting lighting…' });

    // 3. The actual AI edit.
    const result = await enhanceWithGemini(processedBuffer, req.file.mimetype, mode);

    setJob(id, 'enhance', { stage: 'Validating result quality…' });

    // 4. Quality gate on the OUTPUT — never silently ship a bad result (point 8 of the brief).
    const outputCheck = await basicQualityCheck(result.buffer);
    if (!outputCheck.passed) {
      setJob(id, 'enhance', {
        status: 'FAILED',
        stage: null,
        error: 'Enhancement could not be completed reliably. ' + outputCheck.issues.join(' '),
      });
      return res.status(200).json(getJob(id, 'enhance'));
    }

    setJob(id, 'enhance', { stage: 'Finalizing…' });
    const ext = result.mimeType.includes('png') ? 'png' : 'jpg';
    const enhancedName = `enhanced-${Date.now()}.${ext}`;
    const enhancedUrl = await save(id, 'enhanced', enhancedName, result.buffer);

    const finalJob = setJob(id, 'enhance', {
      status: 'COMPLETED',
      stage: null,
      enhancedUrl,
      mode,
      modelNote: result.note,
    });
    return res.status(200).json(finalJob);
  } catch (err) {
    const message = err.code === 'NO_API_KEY'
      ? 'Image enhancement is not configured — set GEMINI_API_KEY in .env.'
      : (err.modelNote || err.message || 'Enhancement failed.');
    setJob(id, 'enhance', { status: 'FAILED', stage: null, error: message });
    return res.status(err.code === 'NO_API_KEY' ? 501 : 200).json(getJob(id, 'enhance'));
  }
});

router.get('/:id/enhance-status', (req, res) => {
  const job = getJob(req.params.id, 'enhance');
  if (!job) return res.status(404).json({ status: 'NOT_FOUND' });
  res.json(job);
});

/* ============================================================
   3D GENERATION
   POST /api/products/:id/generate-3d   { imageUrls: string[] }
   GET  /api/products/:id/3d-status
   GET  /api/products/:id/3d-model
   ============================================================ */

router.post('/:id/generate-3d', async (req, res) => {
  const { id } = req.params;
  const imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [];
  const craftType = req.body.craftType || 'pot';

  setJob(id, '3d', { status: 'PENDING', stage: 'Preparing images…', multi: imageUrls.length > 1 });

  try {
    const { taskId, modelUrl } = await createImageTo3DJob(id, imageUrls, craftType);
    setJob(id, '3d', {
      status: 'IN_PROGRESS',
      stage: 'Understanding product…',
      taskId,
      modelUrls: modelUrl ? { glb: modelUrl } : undefined,
    });
    return res.status(202).json(getJob(id, '3d'));
  } catch (err) {
    const message = err.message || '3D job could not be created.';
    setJob(id, '3d', { status: 'FAILED', stage: null, error: message });
    return res.status(200).json(getJob(id, '3d'));
  }
});

router.get('/:id/3d-status', async (req, res) => {
  const job = getJob(req.params.id, '3d');
  if (!job) return res.status(404).json({ status: 'NOT_FOUND' });
  if (!job.taskId || job.status === 'SUCCEEDED' || job.status === 'FAILED') return res.json(job);

  try {
    const live = await getJobStatus(job.taskId, job.multi);
    const updated = setJob(req.params.id, '3d', {
      status: live.status,
      progress: live.progress,
      stage: live.status === 'SUCCEEDED' ? null : stageForProgress(live.progress),
      modelUrls: live.modelUrls,
      thumbnailUrl: live.thumbnailUrl,
      error: live.taskError,
    });
    res.json(updated);
  } catch (err) {
    res.json(job); // return last known state rather than erroring the poll loop
  }
});

router.get('/:id/3d-model', (req, res) => {
  const job = getJob(req.params.id, '3d');
  if (!job || job.status !== 'SUCCEEDED' || !job.modelUrls?.glb) {
    return res.status(409).json({ error: 'Model is not ready yet — poll /3d-status first.' });
  }
  res.json({
    modelUrl: job.modelUrls.glb,
    format: 'glb',
    generatedFrom: job.multi ? 'multi-view (front/back/left/right)' : 'single image',
    disclaimer: 'AI-generated 3D preview — not measurement-grade accuracy.',
  });
});

/* Upload endpoint for extra angles (back/left/right) before calling
   generate-3d, so the frontend has public URLs to pass in imageUrls. */
router.post('/:id/upload-view', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded (field name: "image").' });
  const name = `view-${req.body.angle || 'extra'}-${Date.now()}.jpg`;
  const url = await save(req.params.id, 'original', name, req.file.buffer);
  res.json({ url });
});

/* ============================================================
   AI PRODUCT DESCRIPTION
   POST /api/products/:id/generate-description
   multipart: image (optional — use the enhanced photo if you have one),
              notes, category, craftType, artisanName
   ============================================================ */
router.post('/:id/generate-description', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { notes, category, craftType, artisanName } = req.body;

  try {
    const result = await generateDescription(
      req.file ? req.file.buffer : null,
      req.file ? req.file.mimetype : null,
      { notes, category, craftType, artisanName },
    );
    return res.status(200).json({ status: 'COMPLETED', ...result });
  } catch (err) {
    const message = err.code === 'NO_API_KEY'
      ? 'Description generation is not configured — set GEMINI_API_KEY in .env.'
      : (err.message || 'Could not generate a description.');
    return res.status(err.code === 'NO_API_KEY' ? 501 : 200).json({ status: 'FAILED', error: message });
  }
});

export default router;
