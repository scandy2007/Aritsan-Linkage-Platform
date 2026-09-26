# ARTIZONE backend — real AI photo enhancement, image-to-3D, and product descriptions

This is a genuine, runnable Node/Express service for the three AI features
that matter most for the ARTIZONE prototype:

1. **Professional product-photo enhancement** — via Google's **Gemini 2.5
   Flash Image** ("nano banana"), which edits the photo (lighting,
   background, framing) while explicitly instructed to preserve the actual
   product — shape, pattern, colour, craft detail.
2. **Image-to-3D generation** — via **Meshy**, which reconstructs real
   geometry and textures from one photo (or 2–4 photos of different angles,
   for meaningfully better results) and returns an actual `.glb`.
3. **Structured, image-grounded product descriptions** — via Gemini's
   structured-output mode, producing an editable listing (name, category,
   material/colour/pattern with a stated/observed/uncertain confidence tag
   on each, key features, short/detailed/SEO copy in English and Hindi)
   that never states a fact the artisan didn't give it or the photo
   doesn't show.

It was written and smoke-tested in this session — server boots, all three
routes respond correctly, quality gates fire, files save to disk, and the
description endpoint was hit with both text-only and image+text requests —
but tested **without** real API keys, since none were provided. All three
integrations are built directly against each provider's current public
docs. **Before you rely on it, run one real request against each provider
and check the response shape still matches** — these are commercial APIs
Google and Meshy do change over time, most recently around the exact
`gemini-2.5-flash-image` model id.

## Why this exists

The ARTIZONE frontend (the claude.ai artifact) is a static page — it cannot
run a server, call arbitrary third-party AI APIs, or write to real cloud
storage. This backend is the piece that actually can. Deploy it somewhere
with a Node runtime, point the frontend at it, and the frontend's existing
mock fallback stops firing.

## Setup

```bash
npm install
cp .env.example .env
# then edit .env:
#   GEMINI_API_KEY=...   from https://aistudio.google.com/apikey
#   MESHY_API_KEY=...    from https://www.meshy.ai/api (free tier: 200 credits/mo)
npm run dev
```

Server starts on `http://localhost:8787` (override with `PORT`). Hit
`GET /health` to confirm both keys are picked up.

## Endpoints

```
POST /api/products/:id/enhance-image
  multipart/form-data: image=<file>, mode=studio|lifestyle|luxury|heritage|marketplace
  -> { status: UPLOADING|PROCESSING|COMPLETED|FAILED, stage, originalUrl, enhancedUrl, error? }

GET  /api/products/:id/enhance-status
  -> same shape, for polling if you make the call async on your side

POST /api/products/:id/generate-3d
  JSON: { imageUrls: string[] }   // 1 = single view, 2-4 = front/back/left/right
  -> { status: PENDING|IN_PROGRESS|SUCCEEDED|FAILED, taskId, stage, progress }

GET  /api/products/:id/3d-status
  -> polls Meshy live and returns current progress/stage

GET  /api/products/:id/3d-model
  -> { modelUrl, format: 'glb', disclaimer } once SUCCEEDED

POST /api/products/:id/generate-description
  multipart/form-data: image=<file, optional>, notes, category, craftType, artisanName
  -> { status: COMPLETED|FAILED, productName, category, craftType,
       attributes: { material, colour, pattern, dimensions, origin } — each
         { value, source: "stated"|"observed"|"uncertain" }, never hallucinated,
       keyFeatures: string[], descriptions: { shortEn, detailedEn, seoEn, shortHi, detailedHi },
       warnings: string[] — fields the artisan should confirm themselves }
```

Files are written under `./storage/products/{id}/{original|enhanced|3d}/`
and served back at `http://localhost:8787/files/{id}/{kind}/{filename}`.
Swap `src/storage.js` for an S3/GCS client when you're ready — every route
only calls `save()` / `urlFor()`, so nothing else needs to change.

## What's real vs. what you still need to decide

**Real and working, once you add keys:**
- Gemini image edit call, with a prompt engineered specifically to forbid
  inventing new decorations/patterns/handles (see `BASE_INSTRUCTION` in
  `src/services/geminiEnhance.js`) — this is the actual mechanism that
  satisfies the brief's "preserve the product" requirement, not a filter.
- Meshy image-to-3D call, returning real reconstructed geometry + textures
  as a `.glb`, with multi-view support for better fidelity.
- Gemini structured-description call (`src/services/geminiDescribe.js`),
  using Gemini's JSON output mode so parsing is reliable rather than
  regex-scraped. Every attribute the artisan didn't state and the model
  can't visually confirm comes back `null` with a `warnings` entry telling
  the artisan to fill it in themselves — this is the actual mechanism
  behind the brief's "don't hallucinate material/origin/dimensions" rule,
  not a disclaimer bolted on after the fact.
- Input and output quality gates (`basicQualityCheck`) so a bad result
  fails loudly instead of shipping silently.

**Deliberately left as your decision, because they cost money / require
infra choices:**
- Object storage (local disk here; S3/GCS/Cloudflare R2 all trivial swaps)
- A job queue for the 3D pipeline if you expect concurrent users (this
  version polls Meshy synchronously per status request, which is fine for
  a demo, not for scale)
- The optional `validateWithVision()` second-pass check in
  `geminiEnhance.js` — off by default because it doubles your API cost per
  enhancement; wire it into the route if you want stricter validation.
- Locking `cors()` down to your actual frontend origin before this is
  public.

## Wiring it to the ARTIZONE frontend artifact

In the frontend's `Api` object, set:

```js
const API_BASE = 'https://your-deployed-backend.example.com';
```

`Api.enhanceImage`, `Api.generate3D`, and `Api.generateDescription` all call
`fetch(API_BASE + '/api/products/...')` first and only fall back to the
mock on failure — so once this is deployed and `API_BASE` points at it, the
frontend is using all three real pipelines with no other code changes. The
Add Product flow's "AI product listing" panel (in the Details step) is
what calls `generate-description` — it's the field-by-field editable panel
with the "You said this / Seen in photo / Please confirm" tags per
attribute, matching the brief's human-review requirement.
