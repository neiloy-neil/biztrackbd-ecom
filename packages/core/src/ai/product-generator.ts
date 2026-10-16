import { z } from "zod";
import { assertCan, type StaffActor } from "../permissions";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_PRODUCT_WRITER, type AiTonePreset } from "./prompts";

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
  }).default({ facebookCaption: "" }),
});

export type GeneratedProductListing = z.infer<typeof GeneratedProductSchema>;

export interface ProductGenerateOptions {
  titleHint?: string;
  keywords?: string[];
  price?: number;
  categoryHint?: string;
  tone?: AiTonePreset;
  imageBase64?: { mimeType: string; data: string };
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

  const userPrompt = `
Generate a complete, high-converting product listing in JSON format based on the following input:
- Product Title / Concept Hint: ${options.titleHint || "Analyze the provided image"}
- Cultural Tone Preset: ${tone}
- Category: ${options.categoryHint || "Not specified, suggest the best one"}
- Target Keywords: ${options.keywords?.join(", ") || "None"}
- Target Selling Price: ${options.price ? `৳ ${options.price}` : "Not specified"}

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
    "facebookCaption": "Ready-to-post Facebook and Instagram caption with emojis, bullets, price placeholder and order instructions"
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
