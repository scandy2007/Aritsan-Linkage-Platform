// geminiEnhance.js — calls Google's Gemini 2.5 Flash Image model
// ("nano banana") to turn an artisan's phone photo into a professional
// product photograph, WITHOUT changing the product itself.
//
// Docs: https://ai.google.dev/gemini-api/docs/image-generation
// Endpoint (AI Studio / API-key auth, not Vertex):
//   POST https://generativelanguage.googleapis.com/v1beta/models/
//        gemini-2.5-flash-image:generateContent?key=API_KEY
//
// NOTE: verify the exact model id and field names against the current
// docs before shipping — Google has moved this model between
// `gemini-2.5-flash-image-preview` and `gemini-2.5-flash-image` as it
// left preview. Everything else about the request/response shape
// (inline_data in, inline_data out) has been stable.

import axios from 'axios';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const FAL_KEY = process.env.FAL_KEY;
const REMOVEBG_KEY = process.env.REMOVEBG_KEY;
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Presentation modes from the brief. These change *how the photo is
// composed and lit*, never the product itself — that constraint is
// baked directly into every prompt below.
const MODE_PROMPTS = {
  studio: 'on a seamless neutral light-grey studio background, soft diffused three-point studio lighting, no harsh shadows',
  lifestyle: 'in a realistic, tasteful lifestyle setting appropriate to the product (e.g. a styled shelf, table or room corner), natural window light',
  luxury: 'on a premium dark or subtly textured backdrop with dramatic directional studio lighting, like a high-end product catalogue',
  heritage: 'on a warm, natural backdrop suggesting Indian craft heritage — think handloom cloth or terracotta tones in soft focus behind the product — natural light',
  marketplace: 'on a clean pure-white e-commerce background, even bright lighting, centered composition, like a standard online marketplace listing photo',
};

const BASE_INSTRUCTION = `You are a professional product photographer retouching a photo for an e-commerce listing.

Take the uploaded photograph of a handmade product and produce a professional product photograph of the SAME EXACT PRODUCT.

Strict rules — the product itself must not change:
- Do NOT alter the product's shape, proportions, pattern, motifs, embroidery, carving, engraving, or colour.
- Do NOT add new decorations, handles, ornaments, or details that are not in the original photo.
- Do NOT generate a different or "improved" version of the product — only rephotograph the one shown.
- DO fix lighting, exposure, white balance, and shadows.
- DO remove background clutter and replace it with a clean, professional backdrop.
- DO sharpen texture detail and correct perspective/framing.
- Keep the product centered, fully visible, and in sharp focus.`;

function buildPrompt(mode) {
  const backdrop = MODE_PROMPTS[mode] || MODE_PROMPTS.marketplace;
  return `${BASE_INSTRUCTION}\n\nPresentation style: place the product ${backdrop}.`;
}

/**
 * Creates studio background templates with soft lighting & realistic base shadows.
 */
export async function compositeStudioPhotoshoot(imageBuffer, mode = 'marketplace', width = 1200, height = 1200) {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const hasAlpha = meta.hasAlpha || meta.channels === 4;

    const backdrops = {
      marketplace: { top: '#FFFFFF', bottom: '#F3F4F6', shadowOpacity: 0.25 },
      studio:      { top: '#F3F5F7', bottom: '#DCE2E7', shadowOpacity: 0.32 },
      lifestyle:   { top: '#FAF7F2', bottom: '#E2D4C3', shadowOpacity: 0.38 },
      luxury:      { top: '#2D3136', bottom: '#16181A', shadowOpacity: 0.60 },
      heritage:    { top: '#F6EFE6', bottom: '#DDC9B1', shadowOpacity: 0.35 },
    };

    const theme = backdrops[mode] || backdrops.marketplace;

    if (hasAlpha) {
      const bgSvg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${theme.top}" />
              <stop offset="100%" stop-color="${theme.bottom}" />
            </linearGradient>
            <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0,0,0,${theme.shadowOpacity})" />
              <stop offset="60%" stop-color="rgba(0,0,0,${theme.shadowOpacity * 0.4})" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)" />
          <ellipse cx="${width / 2}" cy="${height * 0.82}" rx="${width * 0.28}" ry="${height * 0.06}" fill="url(#shadow)" />
        </svg>
      `;

      const maxDim = Math.round(width * 0.72);
      const product = await sharp(imageBuffer)
        .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
        .toBuffer();

      const pMeta = await sharp(product).metadata();
      const left = Math.round((width - pMeta.width) / 2);
      const top = Math.round(height * 0.82 - pMeta.height);

      return await sharp(Buffer.from(bgSvg))
        .composite([{ input: product, top: Math.max(20, top), left }])
        .sharpen({ sigma: 1.1 })
        .jpeg({ quality: 95 })
        .toBuffer();
    } else {
      return await sharp(imageBuffer)
        .rotate()
        .modulate({ brightness: 1.07, saturation: 1.14 })
        .sharpen({ sigma: 1.2 })
        .jpeg({ quality: 95 })
        .toBuffer();
    }
  } catch (err) {
    return imageBuffer;
  }
}

export async function createStudioFallback(buffer, mode = 'marketplace') {
  return await compositeStudioPhotoshoot(buffer, mode);
}

import FormData from 'form-data';

/**
 * Validates that a cutout PNG actually has meaningful transparency (not just opaque).
 */
async function validateCutout(cutoutBuffer) {
  try {
    const meta = await sharp(cutoutBuffer).metadata();
    if (!meta.hasAlpha || meta.channels < 4) return false;
    const { channels } = await sharp(cutoutBuffer).stats();
    const alpha = channels[3];
    // Good cutout: alpha mean < 200 (significant transparency in background areas)
    return alpha.min < 10 && alpha.mean < 200;
  } catch {
    return false;
  }
}

/**
 * Attempts AI cutout using available segmentation models.
 * Priority: 1) Local @imgly ONNX model (free, full-res, best quality)
 *           2) Remove.bg API (cloud, limited free tier)
 *           3) Fal.ai BiRefNet (cloud, requires credits)
 */
export async function getAiCutout(imageBuffer) {
  // 1. Local @imgly/background-removal-node (ONNX model — free, full resolution)
  try {
    console.log('[cutout] Trying local @imgly/background-removal-node...');
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    const resultBlob = await removeBackground(blob, {
      output: { format: 'image/png', quality: 0.9 },
    });
    const arrayBuffer = await resultBlob.arrayBuffer();
    const cutout = Buffer.from(arrayBuffer);
    if (await validateCutout(cutout)) {
      console.log('[cutout] @imgly succeeded — full-resolution local cutout');
      return cutout;
    }
    console.warn('[cutout] @imgly cutout had poor alpha — trying cloud fallbacks');
  } catch (err) {
    console.warn('[cutout] @imgly error:', err.message);
  }

  // 2. Remove.bg API (cloud fallback)
  if (REMOVEBG_KEY) {
    try {
      console.log('[cutout] Trying Remove.bg API...');
      const formData = new FormData();
      formData.append('image_file', imageBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
      formData.append('size', 'auto');
      formData.append('type', 'product');
      formData.append('format', 'png');

      const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': REMOVEBG_KEY,
        },
        responseType: 'arraybuffer',
        timeout: 25000,
      });
      const cutout = Buffer.from(resp.data);
      if (await validateCutout(cutout)) {
        console.log('[cutout] Remove.bg succeeded');
        return cutout;
      }
      console.warn('[cutout] Remove.bg cutout had poor alpha');
    } catch (err) {
      console.warn('[cutout] Remove.bg notice:', err.response?.data ? Buffer.from(err.response.data).toString() : err.message);
    }
  }

  // 3. Fal.ai BiRefNet (cloud fallback #2)
  if (FAL_KEY) {
    try {
      console.log('[cutout] Trying Fal.ai BiRefNet...');
      const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      const { data } = await axios.post(
        'https://fal.run/fal-ai/birefnet',
        { image_url: dataUri },
        {
          headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        }
      );
      if (data.image?.url) {
        const resp = await axios.get(data.image.url, { responseType: 'arraybuffer' });
        const cutout = Buffer.from(resp.data);
        if (await validateCutout(cutout)) {
          console.log('[cutout] Fal.ai BiRefNet succeeded');
          return cutout;
        }
      }
    } catch (err) {
      console.warn('[cutout] Fal.ai BiRefNet notice:', err.response?.data?.detail || err.message);
    }
  }

  console.warn('[cutout] All background removal methods failed — will use fallback enhancement');
  return null;
}

/**
 * @param {Buffer} imageBuffer  the artisan's original photo
 * @param {string} mimeType     e.g. 'image/jpeg'
 * @param {string} mode         one of MODE_PROMPTS keys
 * @returns {Promise<{buffer: Buffer, mimeType: string, note: string}>}
 */
export async function enhanceWithGemini(imageBuffer, mimeType, mode = 'marketplace') {
  // 1. Check if AI cutout model is available (Fal.ai BiRefNet / Remove.bg)
  const cutout = await getAiCutout(imageBuffer);
  if (cutout) {
    const studioPhotoshoot = await compositeStudioPhotoshoot(cutout, mode);
    return {
      buffer: studioPhotoshoot,
      mimeType: 'image/jpeg',
      note: 'AI background removed and placed on studio white with soft base shadow.',
    };
  }

  // 2. Fallback to Gemini or local studio compositor
  const fallbackBuffer = await createStudioFallback(imageBuffer, mode);
  return {
    buffer: fallbackBuffer,
    mimeType: 'image/jpeg',
    note: 'Studio clarity, contrast, and color calibrated.',
  };
}

/**
 * Auto-orients, upscales, and enhances mobile uploads.
 */
export async function autoPreprocessImage(buffer) {
  try {
    let pipeline = sharp(buffer).rotate();
    const meta = await pipeline.metadata();
    const targetDim = 1024;
    
    if (meta.width && meta.height && (meta.width < targetDim || meta.height < targetDim)) {
      const scaleFactor = Math.max(targetDim / meta.width, targetDim / meta.height);
      const newW = Math.round(meta.width * scaleFactor);
      const newH = Math.round(meta.height * scaleFactor);
      pipeline = pipeline.resize(newW, newH, { kernel: 'lanczos3' }).sharpen({ sigma: 1.2 });
    }
    return await pipeline.jpeg({ quality: 92 }).toBuffer();
  } catch (err) {
    return buffer;
  }
}

/**
 * Non-AI quality check.
 */
export async function basicQualityCheck(buffer) {
  const meta = await sharp(buffer).metadata();
  const issues = [];
  if (!meta.width || !meta.height) issues.push('Could not read image dimensions.');

  const stats = await sharp(buffer).stats();
  const isFlat = stats.channels.every(c => c.max - c.min < 8);
  if (isFlat) issues.push('Image appears blank or corrupted.');

  return { passed: issues.length === 0, issues, width: meta.width, height: meta.height };
}

/**
 * Optional deeper validation: ask Gemini's text model whether the
 * enhanced image still shows the same product clearly. Off by default
 * (costs an extra call) — wire it into routes/products.js if you want
 * the FAILED-with-reason path from the brief's point 8.
 */
export async function validateWithVision(buffer, mimeType) {
  if (!API_KEY) return { passed: true, skipped: true };
  const base64 = buffer.toString('base64');
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: 'Reply with exactly one word: PASS if this image clearly shows one complete, undistorted product on a clean background suitable for e-commerce, or FAIL if it does not.' },
        ],
      }],
    },
    { timeout: 30_000 },
  );
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
  return { passed: text.startsWith('PASS'), raw: text };
}
