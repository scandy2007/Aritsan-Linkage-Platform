// geminiDescribe.js — turns a product photo + the artisan's own voice/text
// notes into a structured, editable product listing: name, category,
// attributes (material/colour/pattern/craft), key features, and short +
// detailed descriptions in English and Hindi.
//
// The single most important constraint here (brief sections 16 & 18) is
// that the model must NOT invent facts the artisan never gave it —
// dimensions, region of origin, certifications, historical claims. Every
// attribute the model is not confident about must come back as null with
// a reason, not a guess, so the frontend can show it as "needs your
// input" rather than silently presenting it as fact.
//
// Uses Gemini's structured-output mode (responseMimeType: application/json)
// so parsing is reliable rather than regex-scraping prose.

import axios from 'axios';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

const SCHEMA_INSTRUCTION = `You are a product cataloguer for an Indian artisan marketplace. You are given a photo of a handmade product and the artisan's own notes about it (which may be informal, voice-transcribed, or partial).

Your job: produce a structured, editable product listing. The artisan will review and correct every field before it goes live, so it is far better to leave something null than to invent it.

STRICT RULES:
- Only state a material, region/origin, certification, dimension, or historical/cultural claim if the artisan's notes explicitly say it. If the notes don't mention it, set that field to null — do NOT infer it from how the product looks, even if you're fairly confident.
- Colour, pattern, and general craft type MAY be inferred visually from the photo, since those are directly observable — but mark them with confidence: "observed" (you can see it) vs "stated" (the artisan said it) vs "uncertain".
- Never invent decorative details, motifs, or features that aren't visible in the photo or mentioned in the notes.
- Descriptions must be grounded only in the attributes you've captured — don't pad with generic marketing language like "high quality materials" or "timeless elegance" that isn't tied to anything specific about this product.
- Write naturally, like a good product listing a real e-commerce team would write, not a template.

Respond with ONLY valid JSON matching this exact shape (no markdown fences, no commentary):
{
  "productName": string,
  "category": string,
  "craftType": string | null,
  "attributes": {
    "material": { "value": string | null, "source": "stated" | "observed" | "uncertain" },
    "colour": { "value": string | null, "source": "stated" | "observed" | "uncertain" },
    "pattern": { "value": string | null, "source": "stated" | "observed" | "uncertain" },
    "dimensions": { "value": string | null, "source": "stated" | "observed" | "uncertain" },
    "origin": { "value": string | null, "source": "stated" | "observed" | "uncertain" }
  },
  "keyFeatures": string[],
  "descriptions": {
    "shortEn": string,
    "detailedEn": string,
    "seoEn": string,
    "shortHi": string,
    "detailedHi": string
  },
  "warnings": string[]
}

"warnings" should list anything you were NOT able to determine confidently and that the artisan should fill in themselves (e.g. "Material not mentioned in notes or clearly visible in photo — please confirm.").`;

/**
 * @param {Buffer|null} imageBuffer  product photo (enhanced if available, else original)
 * @param {string} mimeType
 * @param {{notes?: string, category?: string, craftType?: string, artisanName?: string}} context
 */
export async function generateDescription(imageBuffer, mimeType, context = {}) {
  if (!API_KEY) {
    const err = new Error('GEMINI_API_KEY is not set — add it to .env');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const contextText = [
    context.artisanName ? `Artisan: ${context.artisanName}` : null,
    context.category ? `Category the artisan picked: ${context.category}` : null,
    context.craftType ? `Craft type: ${context.craftType}` : null,
    context.notes ? `Artisan's own notes (voice or text, may be informal): "${context.notes}"` : 'The artisan did not provide any notes — rely only on the photo, and mark everything not visually obvious as null.',
  ].filter(Boolean).join('\n');

  const parts = [{ text: `${SCHEMA_INSTRUCTION}\n\n---\n${contextText}` }];
  if (imageBuffer) {
    parts.unshift({ inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') } });
  }

  const { data } = await axios.post(
    `${ENDPOINT}?key=${API_KEY}`,
    {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    },
    { timeout: 45_000 },
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const err = new Error('Gemini returned no description text.');
    err.code = 'NO_TEXT_RETURNED';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const err = new Error('Gemini\u2019s response was not valid JSON — try again.');
    err.code = 'BAD_JSON';
    err.raw = text;
    throw err;
  }
  return parsed;
}
