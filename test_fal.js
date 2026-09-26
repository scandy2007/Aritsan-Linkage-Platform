import axios from 'axios';
import sharp from 'sharp';
import 'dotenv/config';

const FAL_KEY = process.env.FAL_KEY;

async function run() {
  try {
    console.log('--- Testing Fal.ai BiRefNet Cutout ---');
    console.log('Credentials configured:', Boolean(process.env.FAL_KEY));

    // Create a sample earthen pot image
    const sampleBuffer = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 180, g: 140, b: 90 } } // dirt background
    })
    .composite([{
      input: Buffer.from('<svg width="400" height="400"><ellipse cx="200" cy="200" rx="130" ry="110" fill="#B4512A"/><ellipse cx="200" cy="120" rx="100" ry="35" fill="#C4661C"/></svg>'),
      top: 0,
      left: 0
    }])
    .jpeg()
    .toBuffer();

    const dataUri = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

    console.log('Sending to fal-ai/birefnet via REST API...');
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

    console.log('BiRefNet API Response:', data);
    const imageUrl = data.image?.url;
    if (imageUrl) {
      console.log('Downloading transparent cutout from:', imageUrl);
      const resp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const cutoutBuf = Buffer.from(resp.data);
      console.log('Cutout downloaded successfully! Size:', cutoutBuf.length);

      // Composite onto pure white studio canvas
      const whiteStudio = await sharp({
        create: { width: 1200, height: 1200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
      })
      .composite([
        {
          input: Buffer.from('<svg width="1200" height="1200"><defs><radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.2)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></defs><ellipse cx="600" cy="980" rx="340" ry="70" fill="url(#s)"/></svg>'),
          top: 0,
          left: 0,
        },
        {
          input: await sharp(cutoutBuf).resize(860, 860, { fit: 'inside' }).toBuffer(),
          top: 160,
          left: 170,
        }
      ])
      .jpeg({ quality: 98 })
      .toBuffer();

      console.log('White studio photoshoot created! Output size:', whiteStudio.length, 'bytes');
      console.log('SUCCESS! Fal.ai BiRefNet is fully working!');
    }
  } catch (err) {
    console.error('Fal.ai error:', err.response?.data || err.message || err);
  }
}

run();
