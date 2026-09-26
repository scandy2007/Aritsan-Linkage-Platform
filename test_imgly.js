import fs from 'fs';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

const INPUT_PATH = 'd:/Aritsan Linkage Platform/storage/products/draft-1790366428503/original/original-1790366438628.jpg';
const OUTPUT_DIR = 'd:/Aritsan Linkage Platform/storage/test-output';

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const inputBuffer = fs.readFileSync(INPUT_PATH);
  console.log(`Input: ${inputBuffer.length} bytes`);

  // Convert buffer to Blob for the library
  console.log('\n[1] Running @imgly/background-removal-node (local ONNX model)...');
  console.log('    This may take a minute on first run (downloads ~40MB model)...');
  const startTime = Date.now();

  try {
    const blob = new Blob([inputBuffer], { type: 'image/jpeg' });
    const resultBlob = await removeBackground(blob, {
      output: { format: 'image/png', quality: 0.9 },
    });

    const arrayBuffer = await resultBlob.arrayBuffer();
    const cutout = Buffer.from(arrayBuffer);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const meta = await sharp(cutout).metadata();
    console.log(`    [OK] Cutout: ${meta.width}x${meta.height}, hasAlpha: ${meta.hasAlpha}, size: ${cutout.length} bytes`);
    console.log(`    Time: ${elapsed}s`);

    // Check alpha quality
    const { channels } = await sharp(cutout).stats();
    if (meta.channels >= 4) {
      const alpha = channels[3];
      console.log(`    Alpha stats — min: ${alpha.min}, max: ${alpha.max}, mean: ${alpha.mean.toFixed(1)}`);
      if (alpha.min > 250) {
        console.log('    ⚠ Background NOT removed');
      } else {
        console.log('    ✓ Background removed successfully');
      }
    }

    fs.writeFileSync(`${OUTPUT_DIR}/imgly_cutout.png`, cutout);
    console.log('    Saved: imgly_cutout.png');

    // Composite onto white studio
    console.log('\n[2] Creating studio composite...');
    const W = 1200, H = 1200;
    const maxDim = Math.round(W * 0.68);

    const product = await sharp(cutout)
      .resize(maxDim, maxDim, { fit: 'inside', kernel: 'lanczos3' })
      .sharpen({ sigma: 0.9 })
      .toBuffer();

    const pMeta = await sharp(product).metadata();
    const left = Math.round((W - pMeta.width) / 2);
    const topPos = Math.round(H * 0.78 - pMeta.height);

    const shadowSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sh" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.14)" />
          <stop offset="50%" stop-color="rgba(0,0,0,0.05)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="${W/2}" cy="${H*0.82}" rx="${W*0.20}" ry="${H*0.035}" fill="url(#sh)" />
    </svg>`;

    const final = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
    })
    .composite([
      { input: Buffer.from(shadowSvg), top: 0, left: 0 },
      { input: product, top: Math.max(80, topPos), left },
    ])
    .jpeg({ quality: 96 })
    .toBuffer();

    fs.writeFileSync(`${OUTPUT_DIR}/imgly_studio.jpg`, final);
    console.log(`    Saved: imgly_studio.jpg (${final.length} bytes)`);

  } catch (err) {
    console.error('    [ERROR]', err.message);
    console.error(err.stack);
  }
}

run().catch(console.error);
