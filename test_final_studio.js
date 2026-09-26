import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import 'dotenv/config';

const REMOVEBG_KEY = process.env.REMOVEBG_KEY;
const INPUT_PATH = 'd:/Aritsan Linkage Platform/storage/products/draft-1790366428503/original/original-1790366438628.jpg';
const OUTPUT_DIR = 'd:/Aritsan Linkage Platform/storage/test-output';

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const inputBuffer = fs.readFileSync(INPUT_PATH);
  
  // Use free-tier compatible parameters
  const formData = new FormData();
  formData.append('image_file', inputBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
  formData.append('size', 'auto');        // Falls back to preview on free tier
  formData.append('type', 'product');     // Product-specific AI model
  formData.append('format', 'png');

  console.log('Sending to Remove.bg (size=auto, type=product)...');
  const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
    headers: { ...formData.getHeaders(), 'X-Api-Key': REMOVEBG_KEY },
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const cutout = Buffer.from(resp.data);
  const meta = await sharp(cutout).metadata();
  console.log(`Cutout: ${meta.width}x${meta.height}, hasAlpha: ${meta.hasAlpha}`);
  fs.writeFileSync(`${OUTPUT_DIR}/cutout_clean.png`, cutout);

  // Composite onto white studio background at 1200x1200
  const W = 1200, H = 1200;
  
  // Upscale the cutout to fill the canvas nicely
  const maxDim = Math.round(W * 0.65);
  const product = await sharp(cutout)
    .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
    .sharpen({ sigma: 1.0 })
    .toBuffer();

  const pMeta = await sharp(product).metadata();
  const left = Math.round((W - pMeta.width) / 2);
  const topPos = Math.round(H * 0.78 - pMeta.height);

  // Method: Create white base, then composite product on top
  const studioResult = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
  })
  .png()
  .toBuffer();

  const shadowSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sh" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(0,0,0,0.12)" />
        <stop offset="50%" stop-color="rgba(0,0,0,0.04)" />
        <stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>
    <ellipse cx="${W/2}" cy="${H*0.82}" rx="${W*0.18}" ry="${H*0.03}" fill="url(#sh)" />
  </svg>`;

  const final = await sharp(studioResult)
    .composite([
      { input: Buffer.from(shadowSvg), top: 0, left: 0 },
      { input: product, top: Math.max(80, topPos), left },
    ])
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 96 })
    .toBuffer();

  fs.writeFileSync(`${OUTPUT_DIR}/final_clean_studio.jpg`, final);
  const finalMeta = await sharp(final).metadata();
  console.log(`Final: ${finalMeta.width}x${finalMeta.height}, ${final.length} bytes`);
  console.log(`Saved: final_clean_studio.jpg`);
}

run().catch(console.error);
