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
  
  // Check account status first
  console.log('=== Remove.bg Account Check ===');
  try {
    const accountResp = await axios.get('https://api.remove.bg/v1.0/account', {
      headers: { 'X-Api-Key': REMOVEBG_KEY },
    });
    console.log('Account info:', JSON.stringify(accountResp.data, null, 2));
  } catch (err) {
    console.log('Account check error:', err.response?.status, err.response?.data);
  }

  // Try with "full" size (requires paid plan, falls back to preview)
  console.log('\n=== Test: Remove.bg with size=full ===');
  const formData = new FormData();
  formData.append('image_file', inputBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
  formData.append('size', 'full');       // Request full resolution
  formData.append('type', 'product');
  formData.append('format', 'png');

  try {
    const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVEBG_KEY,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    // Check response headers for credit usage, resolution, etc.
    console.log('Response headers:');
    console.log('  X-Credits-Charged:', resp.headers['x-credits-charged']);
    console.log('  X-Foreground-Top:', resp.headers['x-foreground-top']);
    console.log('  X-Foreground-Left:', resp.headers['x-foreground-left']);
    console.log('  X-Width:', resp.headers['x-width']);
    console.log('  X-Height:', resp.headers['x-height']);
    console.log('  X-Type:', resp.headers['x-type']);
    console.log('  Content-Length:', resp.headers['content-length']);

    const cutout = Buffer.from(resp.data);
    const meta = await sharp(cutout).metadata();
    console.log(`\nResult: ${meta.width}x${meta.height}, hasAlpha: ${meta.hasAlpha}`);
    
    if (meta.width <= 625) {
      console.log('\n⚠️  LOW RESOLUTION OUTPUT — this is a FREE TIER preview (max ~625px)');
      console.log('   Full resolution requires a paid plan or API credits.');
    }

    fs.writeFileSync(`${OUTPUT_DIR}/removebg_full.png`, cutout);

    // Now composite — even with low-res, let's make it look good
    const W = 1200, H = 1200;
    const maxDim = Math.round(W * 0.68);
    
    // Upscale the cutout with lanczos3 for better quality
    const product = await sharp(cutout)
      .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
      .sharpen({ sigma: 1.0 })
      .toBuffer();

    const pMeta = await sharp(product).metadata();
    const left = Math.round((W - pMeta.width) / 2);
    const topPos = Math.round(H * 0.78 - pMeta.height);

    // Clean white studio with very subtle shadow
    const result = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
    .composite([
      {
        input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="sh" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0,0,0,0.12)" />
              <stop offset="50%" stop-color="rgba(0,0,0,0.04)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <ellipse cx="${W/2}" cy="${H*0.82}" rx="${W*0.20}" ry="${H*0.035}" fill="url(#sh)" />
        </svg>`),
        top: 0, left: 0,
      },
      {
        input: product,
        top: Math.max(60, topPos),
        left,
      }
    ])
    .jpeg({ quality: 96 })
    .toBuffer();

    fs.writeFileSync(`${OUTPUT_DIR}/final_studio_v2.jpg`, result);
    console.log(`\nFinal studio image saved: final_studio_v2.jpg (${result.length} bytes)`);

  } catch (err) {
    if (err.response?.data) {
      console.log('Error:', Buffer.from(err.response.data).toString());
    } else {
      console.log('Error:', err.message);
    }
  }
}

run().catch(console.error);
