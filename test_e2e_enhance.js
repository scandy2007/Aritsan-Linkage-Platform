import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import 'dotenv/config';

const REMOVEBG_KEY = process.env.REMOVEBG_KEY;

// Use a real uploaded product image
const INPUT_PATH = 'd:/Aritsan Linkage Platform/storage/products/draft-1790366428503/original/original-1790366438628.jpg';
const OUTPUT_DIR = 'd:/Aritsan Linkage Platform/storage/test-output';

async function run() {
  console.log('=== End-to-End Image Enhancement Test ===\n');

  // 0. Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Read the real input image
  console.log('[1] Reading input image:', INPUT_PATH);
  const inputBuffer = fs.readFileSync(INPUT_PATH);
  const inputMeta = await sharp(inputBuffer).metadata();
  console.log(`    Dimensions: ${inputMeta.width}x${inputMeta.height}, Format: ${inputMeta.format}, Size: ${inputBuffer.length} bytes`);

  // Save a copy of the input for comparison
  fs.writeFileSync(path.join(OUTPUT_DIR, '01_original.jpg'), inputBuffer);
  console.log('    Saved: 01_original.jpg\n');

  // 2. Auto-preprocess: rotate, upscale if small, sharpen
  console.log('[2] Auto-preprocessing (orient, upscale, sharpen)...');
  let pipeline = sharp(inputBuffer).rotate();
  const meta = await pipeline.metadata();
  const targetDim = 1024;
  if (meta.width && meta.height && (meta.width < targetDim || meta.height < targetDim)) {
    const scaleFactor = Math.max(targetDim / meta.width, targetDim / meta.height);
    const newW = Math.round(meta.width * scaleFactor);
    const newH = Math.round(meta.height * scaleFactor);
    pipeline = pipeline.resize(newW, newH, { kernel: 'lanczos3' }).sharpen({ sigma: 1.2 });
    console.log(`    Upscaled to ${newW}x${newH}`);
  }
  const preprocessed = await pipeline.jpeg({ quality: 92 }).toBuffer();
  fs.writeFileSync(path.join(OUTPUT_DIR, '02_preprocessed.jpg'), preprocessed);
  console.log(`    Preprocessed size: ${preprocessed.length} bytes`);
  console.log('    Saved: 02_preprocessed.jpg\n');

  // 3. Remove background with Remove.bg API
  console.log('[3] Removing background with Remove.bg API...');
  if (!REMOVEBG_KEY) {
    console.error('    ERROR: REMOVEBG_KEY not set in .env');
    return;
  }

  let cutoutBuffer;
  try {
    const formData = new FormData();
    formData.append('image_file', preprocessed, { filename: 'product.jpg', contentType: 'image/jpeg' });
    formData.append('size', 'auto');
    formData.append('format', 'png');

    const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVEBG_KEY,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    cutoutBuffer = Buffer.from(resp.data);
    const cutoutMeta = await sharp(cutoutBuffer).metadata();
    console.log(`    [SUCCESS] Cutout: ${cutoutMeta.width}x${cutoutMeta.height}, ${cutoutBuffer.length} bytes, hasAlpha: ${cutoutMeta.hasAlpha}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, '03_cutout.png'), cutoutBuffer);
    console.log('    Saved: 03_cutout.png\n');
  } catch (err) {
    console.error('    [ERROR] Remove.bg failed:', err.response ? `${err.response.status}: ${Buffer.from(err.response.data || '').toString()}` : err.message);
    console.log('    Falling back to local enhancement only...\n');
    cutoutBuffer = null;
  }

  // 4. Composite onto white studio background
  console.log('[4] Creating studio photoshoot composite...');
  const W = 1200, H = 1200;

  if (cutoutBuffer) {
    // Resize product to fit nicely centered
    const maxDim = Math.round(W * 0.72);
    const product = await sharp(cutoutBuffer)
      .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
      .sharpen({ sigma: 0.8 })
      .toBuffer();

    const pMeta = await sharp(product).metadata();
    const left = Math.round((W - pMeta.width) / 2);
    const topPos = Math.round(H * 0.82 - pMeta.height);

    // Build studio background SVG with gradient + soft shadow
    const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#F3F4F6" />
        </linearGradient>
        <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.18)" />
          <stop offset="60%" stop-color="rgba(0,0,0,0.06)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <ellipse cx="${W / 2}" cy="${H * 0.84}" rx="${W * 0.26}" ry="${H * 0.055}" fill="url(#shadow)" />
    </svg>`;

    const studioResult = await sharp(Buffer.from(bgSvg))
      .composite([{
        input: product,
        top: Math.max(40, topPos),
        left,
      }])
      .sharpen({ sigma: 0.6 })
      .jpeg({ quality: 96 })
      .toBuffer();

    fs.writeFileSync(path.join(OUTPUT_DIR, '04_studio_white.jpg'), studioResult);
    const finalMeta = await sharp(studioResult).metadata();
    console.log(`    [SUCCESS] Studio: ${finalMeta.width}x${finalMeta.height}, ${studioResult.length} bytes`);
    console.log('    Saved: 04_studio_white.jpg\n');
  } else {
    // Fallback: just enhance the original without background removal
    const fallback = await sharp(preprocessed)
      .modulate({ brightness: 1.07, saturation: 1.14 })
      .sharpen({ sigma: 1.2 })
      .jpeg({ quality: 95 })
      .toBuffer();

    fs.writeFileSync(path.join(OUTPUT_DIR, '04_enhanced_fallback.jpg'), fallback);
    console.log(`    [FALLBACK] Enhanced without BG removal: ${fallback.length} bytes`);
    console.log('    Saved: 04_enhanced_fallback.jpg\n');
  }

  // 5. Also create luxury and heritage variants if cutout available
  if (cutoutBuffer) {
    const variants = {
      luxury: { top: '#2D3136', bottom: '#16181A', shadowOp: 0.5 },
      heritage: { top: '#F6EFE6', bottom: '#DDC9B1', shadowOp: 0.30 },
    };

    for (const [name, theme] of Object.entries(variants)) {
      const maxDim = Math.round(W * 0.72);
      const product = await sharp(cutoutBuffer)
        .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
        .toBuffer();
      const pMeta = await sharp(product).metadata();
      const left = Math.round((W - pMeta.width) / 2);
      const topPos = Math.round(H * 0.82 - pMeta.height);

      const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${theme.top}" />
            <stop offset="100%" stop-color="${theme.bottom}" />
          </linearGradient>
          <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(0,0,0,${theme.shadowOp})" />
            <stop offset="60%" stop-color="rgba(0,0,0,${theme.shadowOp * 0.3})" />
            <stop offset="100%" stop-color="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <ellipse cx="${W / 2}" cy="${H * 0.84}" rx="${W * 0.26}" ry="${H * 0.055}" fill="url(#shadow)" />
      </svg>`;

      const result = await sharp(Buffer.from(bgSvg))
        .composite([{ input: product, top: Math.max(40, topPos), left }])
        .sharpen({ sigma: 0.6 })
        .jpeg({ quality: 96 })
        .toBuffer();

      fs.writeFileSync(path.join(OUTPUT_DIR, `05_studio_${name}.jpg`), result);
      console.log(`    [${name.toUpperCase()}] Saved: 05_studio_${name}.jpg (${result.length} bytes)`);
    }
  }

  console.log('\n=== ALL OUTPUTS SAVED TO:', OUTPUT_DIR, '===');
  console.log('Open the folder to visually compare the results!\n');
}

run().catch(err => console.error('Fatal:', err));
