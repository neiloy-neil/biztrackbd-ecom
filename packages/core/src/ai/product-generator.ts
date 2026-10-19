import { z } from "zod";
import { assertCan, type StaffActor } from "../permissions";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_PRODUCT_WRITER, SYSTEM_PROMPT_IMAGE_ALTS, type AiTonePreset } from "./prompts";

export const GeneratedImageAltItemSchema = z.object({
  index: z.number().default(0),
  altEn: z.string().default(""),
  altBn: z.string().default(""),
});
export type GeneratedImageAltItem = z.infer<typeof GeneratedImageAltItemSchema>;

export const GeneratedProductSchema = z.object({
  titleBn: z.string().default(""),
  titleEn: z.string().default(""),
  shortExcerptBn: z.string().default(""),
  descriptionHtml: z.string().default(""),
  categorySuggestion: z.string().default(""),
  tags: z.array(z.string()).default([]),
  seo: z.object({
    metaTitle: z.string().default(""),
    metaDescription: z.string().default(""),
  }).default({ metaTitle: "", metaDescription: "" }),
  adCopy: z.object({
    facebookCaption: z.string().default(""),
    whatsAppBroadcast: z.string().default(""),
  }).default({ facebookCaption: "", whatsAppBroadcast: "" }),
  imageAltTexts: z.array(GeneratedImageAltItemSchema).default([]),
  detectedAttributes: z.object({
    primaryColor: z.string().optional(),
    fabricOrMaterial: z.string().optional(),
    patternOrStyle: z.string().optional(),
  }).default({}),
});

export type GeneratedProductListing = z.infer<typeof GeneratedProductSchema>;

export interface ProductGenerateOptions {
  titleHint?: string;
  keywords?: string[];
  price?: number;
  categoryHint?: string;
  tone?: AiTonePreset;
  customBrandVoice?: string;
  imageBase64?: { mimeType: string; data: string };
  imagesBase64?: Array<{ mimeType: string; data: string }>;
  imageUrls?: string[];
  imageCount?: number;
  fetchImpl?: typeof fetch;
}

export async function generateProductListing(
  tenantId: string,
  actor: StaffActor,
  options: ProductGenerateOptions
): Promise<GeneratedProductListing> {
  assertCan(actor, "products", "edit");

  const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);
  const tone = options.tone ?? "DHAKA_YOUTH_TRENDY";
  const numImages = options.imagesBase64?.length || (options.imageBase64 ? 1 : 0) || options.imageUrls?.length || options.imageCount || 0;

  const userPrompt = `
Generate a complete, high-converting product listing in JSON format based on the following input:
- Product Title / Concept Hint: ${options.titleHint || "Analyze the provided product and photos"}
- Cultural Tone Preset: ${tone}
- Category: ${options.categoryHint || "Not specified, suggest the best one"}
- Target Keywords: ${options.keywords?.join(", ") || "None specified"}
- Target Selling Price: ${options.price ? `৳ ${options.price}` : "Not specified"}
- Number of Images: ${numImages}
- Custom Brand Voice / Store Policies: ${options.customBrandVoice || "Standard Bangladesh e-commerce guidelines (COD available, 100% authentic)"}

OUTPUT SCHEMA:
{
  "titleBn": "Attractive Bengali product title",
  "titleEn": "SEO friendly English product title",
  "shortExcerptBn": "1-2 sentence Bengali punchy summary",
  "descriptionHtml": "<p>Product intro...</p><ul><li>Feature 1</li><li>Feature 2</li><li>Care instruction</li></ul>",
  "categorySuggestion": "Recommended category name in English",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seo": {
    "metaTitle": "SEO title under 60 characters",
    "metaDescription": "SEO meta description with CTA under 160 characters"
  },
  "adCopy": {
    "facebookCaption": "Ready-to-post Facebook and Instagram caption with emojis, bullets, price placeholder and order instructions",
    "whatsAppBroadcast": "Personal, concise WhatsApp broadcast text with *bold* highlights, bullets, and order link placeholder"
  },
  "imageAltTexts": [
    ${Array.from({ length: Math.max(1, Math.min(numImages, 5)) })
      .map((_, i) => `{"index": ${i}, "altEn": "Descriptive English alt text for image ${i + 1}", "altBn": "ছবি ${i + 1}-এর বর্ণনা"}`)
      .join(",\n    ")}
  ],
  "detectedAttributes": {
    "primaryColor": "Color name in English",
    "fabricOrMaterial": "Fabric or build material",
    "patternOrStyle": "Design pattern or style"
  }
}
`;

  try {
    const rawJson = await callGemini({
      apiKey,
      model,
      prompt: userPrompt,
      systemInstruction: SYSTEM_PROMPT_PRODUCT_WRITER,
      imageBase64: options.imageBase64,
      imagesBase64: options.imagesBase64,
      responseMimeType: "application/json",
      temperature: 0.7,
      fetchImpl: options.fetchImpl,
    });

    const parsed = JSON.parse(rawJson);
    const result = GeneratedProductSchema.parse(parsed);

    // Record usage
    await recordAiGeneration(tenantId, isCustom);

    return result;
  } catch (err) {
    console.error("[ai product generator] error", err);
    throw err;
  }
}

export const GeneratedImageAltListSchema = z.object({
  altTexts: z.array(GeneratedImageAltItemSchema).default([]),
});
export type GeneratedImageAltList = z.infer<typeof GeneratedImageAltListSchema>;

export interface GenerateImageAltOptions {
  productTitle?: string;
  categoryHint?: string;
  imagesBase64?: Array<{ mimeType: string; data: string }>;
  imageUrls?: string[];
  imageCount?: number;
  tone?: AiTonePreset;
  fetchImpl?: typeof fetch;
}

/**
 * Generates descriptive, accessible, SEO-rich alt text for a list of product gallery images.
 */
export async function generateImageAltTags(
  tenantId: string,
  actor: StaffActor,
  options: GenerateImageAltOptions
): Promise<GeneratedImageAltList> {
  assertCan(actor, "products", "edit");

  const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);
  const totalCount = options.imagesBase64?.length || options.imageUrls?.length || options.imageCount || 1;

  const prompt = `
Generate concise, descriptive, and SEO-optimized image alt-tags (in English and natural Bengali) for ${totalCount} image(s) of this product:
- Product Title / Context: ${options.productTitle || "E-commerce product photo"}
- Category: ${options.categoryHint || "General Merchandise"}
- Number of Images to tag: ${totalCount}

OUTPUT SCHEMA:
{
  "altTexts": [
    ${Array.from({ length: totalCount })
      .map((_, i) => `{"index": ${i}, "altEn": "Descriptive English alt text for image ${i + 1}", "altBn": "ছবি ${i + 1}-এর বর্ণনা"}`)
      .join(",\n    ")}
  ]
}
`;

  try {
    const rawJson = await callGemini({
      apiKey,
      model,
      prompt,
      systemInstruction: SYSTEM_PROMPT_IMAGE_ALTS,
      imagesBase64: options.imagesBase64,
      responseMimeType: "application/json",
      temperature: 0.5,
      fetchImpl: options.fetchImpl,
    });

    const parsed = JSON.parse(rawJson);
    const result = GeneratedImageAltListSchema.parse(parsed);

    await recordAiGeneration(tenantId, isCustom);
    return result;
  } catch (err) {
    console.error("[generateImageAltTags] error", err);
    throw err;
  }
}
