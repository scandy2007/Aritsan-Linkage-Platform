import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import 'dotenv/config';

const REMOVEBG_KEY = process.env.REMOVEBG_KEY;

async function run() {
  console.log('--- Testing Remove.bg API with key ---');
  console.log('Key configured:', REMOVEBG_KEY ? REMOVEBG_KEY.substring(0, 6) + '...' : 'NONE');

  // Create an earthen pot sample with dirt background
  const testBuf = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 180, g: 140, b: 90 } } // dirt background
  })
  .composite([{
    input: Buffer.from('<svg width="400" height="400"><ellipse cx="200" cy="220" rx="130" ry="110" fill="#B4512A"/><ellipse cx="200" cy="130" rx="90" ry="30" fill="#C4661C"/><circle cx="200" cy="220" r="40" fill="#8B4513"/></svg>'),
    top: 0,
    left: 0
  }])
  .jpeg({ quality: 90 })
  .toBuffer();

  const formData = new FormData();
  formData.append('image_file', testBuf, { filename: 'product.jpg', contentType: 'image/jpeg' });
  formData.append('size', 'auto');
  formData.append('format', 'png');

  try {
    console.log('Sending request to https://api.remove.bg/v1.0/removebg ...');
    const resp = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVEBG_KEY,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const cutoutBuffer = Buffer.from(resp.data);
    console.log('[SUCCESS] Cutout received from Remove.bg! Size:', cutoutBuffer.length, 'bytes');

    // Composite the isolated pot onto a pure white studio background with soft base shadow
    const whiteStudio = await sharp({
      create: { width: 1200, height: 1200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
    .composite([
      // 1. Soft diffused base shadow
      {
        input: Buffer.from('<svg width="1200" height="1200"><defs><radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="60%" stop-color="rgba(0,0,0,0.08)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></defs><ellipse cx="600" cy="980" rx="360" ry="75" fill="url(#s)"/></svg>'),
        top: 0,
        left: 0,
      },
      // 2. High-definition centered pot
      {
        input: await sharp(cutoutBuffer).resize(880, 880, { fit: 'inside', kernel: 'lanczos3' }).toBuffer(),
        top: 150,
        left: 160,
      }
    ])
    .jpeg({ quality: 98 })
    .toBuffer();

    console.log('[SUCCESS] Pure White Studio Photoshoot created! Size:', whiteStudio.length, 'bytes');
    console.log('\n>>> REMOVE.BG API IS 100% WORKING AND VERIFIED! <<<');
  } catch (err) {
    console.error('[ERROR]', err.response ? `${err.response.status}: ${Buffer.from(err.response.data || '').toString()}` : err.message);
  }
}

run();
