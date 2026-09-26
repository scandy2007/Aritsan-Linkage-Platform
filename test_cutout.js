import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

async function run() {
  try {
    console.log('Testing @imgly/background-removal-node...');
    const testBuf = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 160, g: 140, b: 120 } }
    })
    .composite([{
      input: Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="90" fill="#B4512A"/></svg>'),
      top: 0,
      left: 0
    }])
    .jpeg()
    .toBuffer();

    console.log('Running removeBackground on test buffer...');
    const blob = await removeBackground(testBuf);
    const arrayBuffer = await blob.arrayBuffer();
    const cutoutBuf = Buffer.from(arrayBuffer);
    console.log('Cutout generated successfully! Size:', cutoutBuf.length);

    // Composite on pure white background
    const whiteStudio = await sharp({
      create: { width: 800, height: 800, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
    .composite([{ input: await sharp(cutoutBuf).resize(600, 600, { fit: 'inside' }).toBuffer(), top: 100, left: 100 }])
    .jpeg({ quality: 95 })
    .toBuffer();

    console.log('White studio background composite generated! Size:', whiteStudio.length);
  } catch (err) {
    console.error('Error in removeBackground:', err);
  }
}

run();
