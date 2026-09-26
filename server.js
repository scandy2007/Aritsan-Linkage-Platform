import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import productsRouter from './src/routes/products.js';

const app = express();
const PORT = process.env.PORT || 8787;
const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

app.use(cors()); // lock this down to your frontend's origin in production
app.use(express.json({ limit: '2mb' }));

// Serves everything saved via storage.js at the same URLs storage.urlFor() builds.
app.use('/files', express.static(path.resolve(STORAGE_DIR, 'products')));

app.use('/api/products', productsRouter);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    removeBgConfigured: Boolean(process.env.REMOVEBG_KEY || process.env.REMOVE_BG_API_KEY),
    falConfigured: Boolean(process.env.FAL_KEY),
    meshyConfigured: Boolean(process.env.MESHY_API_KEY),
  });
});

// Serve frontend application
app.get('/', (req, res) => {
  res.sendFile(path.resolve('./KalaSetu — artisan market linkage platform.html'));
});
app.use(express.static(path.resolve('.')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`KalaSetu backend listening on http://localhost:${PORT}`);
  console.log(`  GET  /health                             — check API-key configuration`);
  console.log(`  POST /api/products/:id/enhance-image      — multipart 'image' + 'mode'`);
  console.log(`  GET  /api/products/:id/enhance-status`);
  console.log(`  POST /api/products/:id/generate-3d        — JSON { imageUrls: [...] }`);
  console.log(`  GET  /api/products/:id/3d-status`);
  console.log(`  GET  /api/products/:id/3d-model`);
  console.log(`  POST /api/products/:id/generate-description — multipart 'image'(optional) + notes/category/craftType/artisanName`);
});
