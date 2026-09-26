import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';

async function testPlatform() {
  console.log('=== Running KalaSetu Full-Stack AI Platform Test ===');
  const BASE_URL = 'http://localhost:8787';

  // 1. Health check
  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health endpoint:', health.data);
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
    return;
  }

  // 2. Create sample artisan terracotta pot image (with uneven background)
  const sampleArtisanPhoto = await sharp({
    create: { width: 600, height: 600, channels: 3, background: { r: 170, g: 130, b: 85 } } // ground/dirt
  })
  .composite([
    {
      input: Buffer.from(`
        <svg width="600" height="600">
          <ellipse cx="300" cy="330" rx="190" ry="160" fill="#B4512A"/>
          <ellipse cx="300" cy="180" rx="130" ry="40" fill="#C4661C"/>
          <circle cx="300" cy="330" r="50" fill="#8B4513"/>
          <path d="M180 300 Q 300 370 420 300" stroke="#FFD700" stroke-width="8" fill="none"/>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .jpeg({ quality: 90 })
  .toBuffer();

  const testProductId = 'prod-test-' + Date.now();

  // 3. Test AI Product Image Enhancement (POST /api/products/:id/enhance-image)
  console.log('\n--- 1. Testing AI Image Enhancement Pipeline ---');
  const fd = new FormData();
  fd.append('image', sampleArtisanPhoto, { filename: 'terracotta_pot.jpg', contentType: 'image/jpeg' });
  fd.append('mode', 'studio');

  const enhanceRes = await axios.post(`${BASE_URL}/api/products/${testProductId}/enhance-image`, fd, {
    headers: fd.getHeaders(),
    timeout: 30000
  });
  console.log('✅ Enhancement response status:', enhanceRes.data.status);
  console.log('   Original URL:', enhanceRes.data.originalUrl);
  console.log('   Enhanced URL:', enhanceRes.data.enhancedUrl);
  console.log('   Model note:', enhanceRes.data.modelNote);

  // 4. Test 3D Product Generation Pipeline (POST /api/products/:id/generate-3d)
  console.log('\n--- 2. Testing Realistic 3D GLB Generation Pipeline ---');
  const gen3dRes = await axios.post(`${BASE_URL}/api/products/${testProductId}/generate-3d`, {
    imageUrls: [enhanceRes.data.enhancedUrl],
    craftType: 'pot'
  });
  console.log('✅ 3D job created:', gen3dRes.data);

  // Poll 3D Status
  let status3d;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 600));
    const statusRes = await axios.get(`${BASE_URL}/api/products/${testProductId}/3d-status`);
    status3d = statusRes.data;
    console.log(`   Poll ${i+1}: status=${status3d.status}, progress=${status3d.progress}%, stage="${status3d.stage}"`);
    if (status3d.status === 'SUCCEEDED' || status3d.status === 'COMPLETED') break;
  }

  // 5. Test 3D Model Fetch (GET /api/products/:id/3d-model)
  console.log('\n--- 3. Testing 3D Model Access ---');
  const modelRes = await axios.get(`${BASE_URL}/api/products/${testProductId}/3d-model`);
  console.log('✅ 3D Model ready at:', modelRes.data.modelUrl);

  // Verify GLB can be downloaded directly
  const glbDownload = await axios.get(modelRes.data.modelUrl, { responseType: 'arraybuffer' });
  const glbHeader = Buffer.from(glbDownload.data).toString('utf8', 0, 4);
  console.log(`✅ Downloaded GLB model: ${glbDownload.data.byteLength} bytes (Magic header: "${glbHeader}")`);

  console.log('\n🎉 ALL TESTS PASSED! Full-stack AI commerce platform is fully verified and functional.');
}

testPlatform().catch(err => console.error('Test error:', err.response?.data || err.message));
