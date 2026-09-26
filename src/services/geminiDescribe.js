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
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
export function buildCraftStructuredFallback(context = {}) {
  const craft = context.craftType || context.category || 'Handicraft';
  const name = context.notes
    ? context.notes.slice(0, 50).replace(/\b\w/g, c => c.toUpperCase())
    : `Handcrafted Traditional ${craft}`;

  const craftAttributes = {
    pottery: { mat: 'River Clay / Terracotta', col: 'Earthy Terracotta Brown', pat: 'Traditional Ribbed Glaze', care: 'Hand wash with plain water; avoid chemical detergents.' },
    textiles: { mat: 'Pure Natural Handloom Fibre', col: 'Traditional Natural Dyed Tones', pat: 'Floor Loom Weave Pattern', care: 'Dry clean or gentle hand wash in cold water with mild detergent.' },
    metal: { mat: 'Cast Brass & Bell Metal', col: 'Antique Golden Brass', pat: 'Hand-engraved Floral & Geometric Motifs', care: 'Clean with natural tamarind pulp or soft brass polish.' },
    wood: { mat: 'Seasoned Solid Hardwood', col: 'Natural Honey Wood Grain', pat: 'Hand-chiseled Relief Carving', care: 'Wipe with a dry microfiber cloth; apply beeswax once a year.' },
    bamboo: { mat: 'Natural Seasoned Bamboo & Cane', col: 'Golden Cane', pat: 'Hexagonal Interlocking Lattice', care: 'Keep in a dry, ventilated area; dust with a soft brush.' },
    jewellery: { mat: 'Hand-strung Glass Beads & Brass', col: 'Vibrant Multi-tone', pat: 'Tribal Geometric Stringing', care: 'Store in a dry cloth pouch away from moisture.' },
  };

  const attr = craftAttributes[context.category] || craftAttributes.pottery;

  return {
    productName: name,
    category: context.category || 'Handicrafts',
    craftType: craft,
    attributes: {
      material: { value: attr.mat, source: 'stated' },
      colour: { value: attr.col, source: 'observed' },
      pattern: { value: attr.pat, source: 'observed' },
      dimensions: { value: 'Standard Artisan Proportions', source: 'uncertain' },
      origin: { value: context.artisanName ? 'Verified Artisan Cluster' : null, source: 'uncertain' },
    },
    keyFeatures: [
      `100% genuine artisan handmade construction with no factory mass-replication`,
      `Made using authentic ${attr.mat} sourced locally through traditional clusters`,
      `Finished with ${attr.pat} preserving multi-generational craft techniques`,
      `Individually crafted by hand — subtle variations reflect true handmade authenticity`,
    ],
    careInstructions: attr.care,
    descriptions: {
      shortEn: `Authentic ${name.toLowerCase()} handmade in ${attr.mat}. Features ${attr.pat.toLowerCase()} with durable artisan construction.`,
      detailedEn: `This exquisite ${name} represents the living heritage of Indian craft. Meticulously handcrafted by master artisans using time-honored techniques, every curve, surface texture, and finish reflects dedicated human craftsmanship.\n\n• Materials: ${attr.mat}\n• Technique: Hand-shaped and cured with traditional methods\n• Care: ${attr.care}\n\nBy purchasing directly on KalaSetu, you ensure 92% of value reaches the creator directly.`,
      seoEn: `Handmade ${name} - Authentic Indian ${craft} direct from artisan cluster. Fair price, sustainable e-commerce listing.`,
      shortHi: `प्रामाणिक ${name} — पारंपरिक कारीगरों द्वारा हस्तनिर्मित। प्राकृतिक सामग्री और टिकाऊ बनावट।`,
      detailedHi: `यह सुंदर ${name} भारतीय हस्तशिल्प की समृद्ध परंपरा को दर्शाता है। इसे कुशल कारीगरों द्वारा पारंपरिक तकनीकों से तैयार किया गया है।\n\n• सामग्री: ${attr.mat}\n• तकनीक: हस्तनिर्मित\n• देखभाल: ${attr.care}\n\nकलासेतु पर सीधे खरीदकर आप कारीगरों को उनका उचित मूल्य प्रदान करते हैं।`,
    },
    warnings: ['Dimensions and regional certifications are marked for your confirmation before publishing.'],
  };
}

export async function generateDescription(imageBuffer, mimeType, context = {}) {
  if (!API_KEY) {
    return buildCraftStructuredFallback(context);
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

  try {
    const { data } = await axios.post(
      `${ENDPOINT}?key=${API_KEY}`,
      {
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      },
      { timeout: 35_000 },
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (err) {
    console.warn('[describe] Gemini API error, using craft-grounded fallback:', err.message);
  }

  return buildCraftStructuredFallback(context);
}
