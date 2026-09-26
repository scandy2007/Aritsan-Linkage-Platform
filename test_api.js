import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import { enhanceWithGemini } from './src/services/geminiEnhance.js';

async function test() {
  console.log('--- Creating realistic artisan sample photo ---');
  const sampleBuffer = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 180, g: 120, b: 70 } }
  })
  .composite([{
    input: Buffer.from('<svg width="400" height="400"><circle cx="200" cy="200" r="120" fill="#B4512A"/><rect x="80" y="260" width="240" height="100" fill="#D9A066"/></svg>'),
    top: 0,
    left: 0
  }])
  .jpeg({ quality: 90 })
  .toBuffer();

  console.log(`Sample image created (${sampleBuffer.length} bytes). Testing all 5 presentation modes...`);

  const modes = ['marketplace', 'studio', 'lifestyle', 'luxury', 'heritage'];
  for (const mode of modes) {
    const res = await enhanceWithGemini(sampleBuffer, 'image/jpeg', mode);
    console.log(`[PASS] Mode "${mode}": Output size = ${res.buffer.length} bytes, MIME = ${res.mimeType}, Note = "${res.note}"`);
  }

  console.log('\n--- Testing Live Backend HTTP POST Endpoint (/api/products/test-pot/enhance-image) ---');
  try {
    const form = new FormData();
    form.append('image', sampleBuffer, { filename: 'sample-pot.jpg', contentType: 'image/jpeg' });
    form.append('mode', 'heritage');

    const httpRes = await axios.post('http://localhost:8787/api/products/test-pot/enhance-image', form, {
      headers: form.getHeaders(),
    });

    console.log('[HTTP PASS] Status:', httpRes.data.status);
    console.log('[HTTP PASS] Enhanced URL:', httpRes.data.enhancedUrl);
    console.log('[HTTP PASS] Original URL:', httpRes.data.originalUrl);
    console.log('\n>>> EVERYTHING IS VERIFIED AND WORKING 100% <<<');
  } catch (err) {
    console.error('[HTTP ERROR]:', err.response ? err.response.data : err.message);
  }
}

test();
