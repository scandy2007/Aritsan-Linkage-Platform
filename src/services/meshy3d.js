// meshy3d.js — calls Meshy's Image-to-3D API to turn one or more product
// photos into an actual textured .glb — real geometry reconstructed
// from the photo, not a primitive shape with the photo pasted on.
//
// Docs: https://docs.meshy.ai/en/api/image-to-3d
//       https://docs.meshy.ai/en/api/multi-image-to-3d  (2–4 views)
//
// Flow:
//   1. POST /openapi/v1/image-to-3d          -> { result: taskId }
//   2. GET  /openapi/v1/image-to-3d/:taskId   -> poll until SUCCEEDED
//      response includes progress (0-100) and, once done, model_urls.glb

import axios from 'axios';
import 'dotenv/config';

const API_KEY = process.env.MESHY_API_KEY;
const BASE = 'https://api.meshy.ai/openapi/v1';

const client = axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${API_KEY}` },
  timeout: 30_000,
});

/**
 * Kick off a 3D generation job.
 * @param {string[]} imageUrls  1 image = single-view job, 2-4 = multi-view
 *   (front/back/left/right) for meaningfully better geometry — see
 *   point 12 of the brief. Meshy needs URLs it can fetch, OR a
 *   data:image/...;base64,... URI for a single image — see docs for
 *   multi-image data-URI support.
 * @returns {Promise<string>} taskId
 */
export async function createImageTo3DJob(imageUrls) {
  if (!API_KEY) {
    const err = new Error('MESHY_API_KEY is not set — add it to .env');
    err.code = 'NO_API_KEY';
    throw err;
  }

  if (imageUrls.length <= 1) {
    const { data } = await client.post('/image-to-3d', {
      image_url: imageUrls[0],
      ai_model: 'meshy-7',
      texture_resolution: '2k',
      should_texture: true,
    });
    return data.result;
  }

  // 2-4 views -> meaningfully better reconstructed geometry
  const { data } = await client.post('/multi-image-to-3d', {
    image_urls: imageUrls.slice(0, 4),
    ai_model: 'meshy-7',
    texture_resolution: '2k',
  });
  return data.result;
}

/**
 * @returns {Promise<{status: 'PENDING'|'IN_PROGRESS'|'SUCCEEDED'|'FAILED',
 *   progress: number, modelUrls: {glb?, fbx?, usdz?, obj?}, thumbnailUrl?: string,
 *   taskError?: string}>}
 */
export async function getJobStatus(taskId, multi = false) {
  const path = multi ? `/multi-image-to-3d/${taskId}` : `/image-to-3d/${taskId}`;
  const { data } = await client.get(path);
  return {
    status: data.status,
    progress: data.progress ?? 0,
    modelUrls: data.model_urls || {},
    thumbnailUrl: data.thumbnail_url,
    taskError: data.task_error?.message,
  };
}

/** Human-readable stage text for the frontend's progress messages,
 * derived from Meshy's numeric progress (point 17 of the brief). */
export function stageForProgress(progress) {
  if (progress < 15) return 'Understanding product…';
  if (progress < 45) return 'Reconstructing geometry…';
  if (progress < 75) return 'Generating textures…';
  if (progress < 95) return 'Optimizing 3D model…';
  return 'Finalizing…';
}
