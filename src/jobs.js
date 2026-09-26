// jobs.js — tracks the status of async pipelines (enhance / 3D) so the
// frontend can poll GET /:id/3d-status etc. This is in-memory, which is
// fine for a single-process prototype; swap for Redis or a Postgres
// table (see brief's schema) the moment you run more than one instance.

const jobs = new Map(); // key: `${productId}:${kind}` -> job object

export function setJob(productId, kind, patch) {
  const key = `${productId}:${kind}`;
  const existing = jobs.get(key) || {};
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(key, next);
  return next;
}

export function getJob(productId, kind) {
  return jobs.get(`${productId}:${kind}`) || null;
}
