import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import 'dotenv/config';

const REMOVEBG_KEY = process.env.REMOVEBG_KEY;
const FAL_KEY = process.env.FAL_KEY;
const INPUT_PATH = 'd:/Aritsan Linkage Platform/storage/products/draft-1790366428503/original/original-1790366438628.jpg';
const OUTPUT_DIR = 'd:/Aritsan Linkage Platform/storage/test-output';

async function testRemoveBg(inputBuffer) {
  console.log('\n--- Test 1: Remove.bg with type=product ---');
  const formData = new FormData();
  formData.append('image_file', inputBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
  formData.append('size', 'auto');
  formData.append('type', 'product');  // Explicitly tell it this is a product
  formData.append('format', 'png');
  formData.append('crop', 'true');     // Auto-crop to content bounds
  formData.append('crop_margin', '10%');

  try {
    const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVEBG_KEY,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const cutout = Buffer.from(resp.data);
    const meta = await sharp(cutout).metadata();
    console.log(`  [OK] ${meta.width}x${meta.height}, hasAlpha: ${meta.hasAlpha}, channels: ${meta.channels}, size: ${cutout.length}`);
    
    // Check if the alpha channel is actually being used (not just fully opaque)
    const { channels } = await sharp(cutout).stats();
    if (meta.channels >= 4) {
      const alphaChannel = channels[3];
      console.log(`  Alpha stats — min: ${alphaChannel.min}, max: ${alphaChannel.max}, mean: ${alphaChannel.mean.toFixed(1)}`);
      if (alphaChannel.min > 250) {
        console.log('  ⚠ Alpha channel is nearly all-opaque — background was NOT actually removed!');
      } else {
        console.log('  ✓ Alpha channel has transparency — background WAS removed');
      }
    }

    fs.writeFileSync(`${OUTPUT_DIR}/test_removebg_product.png`, cutout);
    return cutout;
  } catch (err) {
    console.error('  [ERR]', err.response ? `${err.response.status}: ${Buffer.from(err.response.data || '').toString()}` : err.message);
    return null;
  }
}

async function testFalBiRefNet(inputBuffer) {
  console.log('\n--- Test 2: Fal.ai BiRefNet ---');
  if (!FAL_KEY) { console.log('  SKIP — no FAL_KEY'); return null; }

  const dataUri = `data:image/jpeg;base64,${inputBuffer.toString('base64')}`;
  try {
    const { data } = await axios.post(
      'https://fal.run/fal-ai/birefnet',
      { image_url: dataUri },
      {
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (data.image?.url) {
      console.log('  Got cutout URL:', data.image.url);
      const resp = await axios.get(data.image.url, { responseType: 'arraybuffer' });
      const cutout = Buffer.from(resp.data);
      const meta = await sharp(cutout).metadata();
      console.log(`  [OK] ${meta.width}x${meta.height}, hasAlpha: ${meta.hasAlpha}, channels: ${meta.channels}`);

      const { channels } = await sharp(cutout).stats();
      if (meta.channels >= 4) {
        const alphaChannel = channels[3];
        console.log(`  Alpha stats — min: ${alphaChannel.min}, max: ${alphaChannel.max}, mean: ${alphaChannel.mean.toFixed(1)}`);
      }

      fs.writeFileSync(`${OUTPUT_DIR}/test_fal_birefnet.png`, cutout);
      return cutout;
    } else {
      console.log('  No image URL in response:', JSON.stringify(data).substring(0, 200));
      return null;
    }
  } catch (err) {
    console.error('  [ERR]', err.response?.data?.detail || err.message);
    return null;
  }
}

async function compositeOnWhite(cutout, outputName) {
  const W = 1200, H = 1200;
  const maxDim = Math.round(W * 0.70);
  
  const product = await sharp(cutout)
    .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.8 })
    .toBuffer();

  const pMeta = await sharp(product).metadata();
  const left = Math.round((W - pMeta.width) / 2);
  const topPos = Math.round(H * 0.80 - pMeta.height);

  // Pure white background with subtle bottom gradient and shadow
  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="85%" stop-color="#FFFFFF" />
        <stop offset="100%" stop-color="#F0F0F0" />
      </linearGradient>
      <radialGradient id="sh" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(0,0,0,0.15)" />
        <stop offset="55%" stop-color="rgba(0,0,0,0.05)" />
        <stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <ellipse cx="${W / 2}" cy="${H * 0.83}" rx="${W * 0.22}" ry="${H * 0.04}" fill="url(#sh)" />
  </svg>`;

  const result = await sharp(Buffer.from(bgSvg))
    .composite([{ input: product, top: Math.max(40, topPos), left }])
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 96 })
    .toBuffer();

  fs.writeFileSync(`${OUTPUT_DIR}/${outputName}`, result);
  console.log(`  Saved: ${outputName} (${result.length} bytes)`);
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const inputBuffer = fs.readFileSync(INPUT_PATH);
  console.log('Input:', INPUT_PATH, `(${inputBuffer.length} bytes)`);

  // Test both APIs
  const removebgCutout = await testRemoveBg(inputBuffer);
  const falCutout = await testFalBiRefNet(inputBuffer);

  // Composite whichever succeeded
  if (removebgCutout) {
    console.log('\n--- Compositing Remove.bg result ---');
    await compositeOnWhite(removebgCutout, 'final_removebg_studio.jpg');
  }
  if (falCutout) {
    console.log('\n--- Compositing Fal.ai result ---');
    await compositeOnWhite(falCutout, 'final_fal_studio.jpg');
  }

  console.log('\n=== DONE ===');
}

run().catch(err => console.error('Fatal:', err));
