// storage.js — local-disk implementation of the object-storage layer.
//
// Layout matches the brief:
//   /products/{productId}/original/original.jpg
//   /products/{productId}/enhanced/enhanced.jpg
//   /products/{productId}/3d/model.glb
//
// To move to real cloud storage: replace the three functions below
// (save, urlFor, read) with S3/GCS-backed versions. Nothing else in
// the codebase touches the filesystem directly — every route goes
// through this module.

import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const ROOT = process.env.STORAGE_DIR || './storage';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:8787';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save a buffer under /products/{productId}/{kind}/{filename}
 * kind is one of: 'original' | 'enhanced' | '3d' | 'catalog'
 */
export async function save(productId, kind, filename, buffer) {
  const dir = path.join(ROOT, 'products', productId, kind);
  await ensureDir(dir);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return urlFor(productId, kind, filename);
}

export function urlFor(productId, kind, filename) {
  return `${PUBLIC_BASE_URL}/files/${productId}/${kind}/${filename}`;
}

export async function read(productId, kind, filename) {
  const filePath = path.join(ROOT, 'products', productId, kind, filename);
  return fs.readFile(filePath);
}

export function diskPath(productId, kind, filename) {
  return path.join(ROOT, 'products', productId, kind, filename);
}
