import axios from 'axios';
import sharp from 'sharp';

async function testHF() {
  try {
    console.log('Testing Hugging Face RMBG-1.4 / BiRefNet free inference...');
    const testBuf = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 180, g: 140, b: 90 } }
    })
    .composite([{
      input: Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="80" fill="#B4512A"/></svg>'),
      top: 0,
      left: 0
    }])
    .jpeg()
    .toBuffer();

    const res = await axios.post(
      'https://api-inference.huggingface.co/models/briaai/RMBG-1.4',
      testBuf,
      {
        headers: { 'Content-Type': 'image/jpeg' },
        responseType: 'arraybuffer',
        timeout: 20000,
      }
    );

    console.log('SUCCESS! HuggingFace RMBG returned cutout! Size:', res.data.byteLength);
  } catch (err) {
    console.log('HF Error:', err.response ? err.response.status + ' ' + (Buffer.from(err.response.data || '').toString()) : err.message);
  }
}

testHF();
