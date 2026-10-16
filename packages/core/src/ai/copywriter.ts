import { z } from "zod";
import { assertCan, type StaffActor } from "../permissions";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_COPYWRITER, type AiTonePreset } from "./prompts";

export const SocialPostSchema = z.object({
  captionBn: z.string().default(""),
  captionEn: z.string().default(""),
  hook: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
});
export type GeneratedSocialPost = z.infer<typeof SocialPostSchema>;

export const SmsCampaignSchema = z.object({
  englishSms: z.string().max(160).default(""),
  banglaSms: z.string().max(70).default(""),
  estimatedSmsParts: z.number().default(1),
  previewText: z.string().default(""),
});
export type GeneratedSmsCampaign = z.infer<typeof SmsCampaignSchema>;

export const BannerCopySchema = z.object({
  headlineBn: z.string().default(""),
  headlineEn: z.string().default(""),
  subheadlineBn: z.string().default(""),
  subheadlineEn: z.string().default(""),
  ctaTextBn: z.string().default("এখনই কিনুন"),
  ctaTextEn: z.string().default("Shop Now"),
});
export type GeneratedBannerCopy = z.infer<typeof BannerCopySchema>;

export interface CopywriterOptions {
  productName?: string;
  category?: string;
  keyPoints?: string;
  discountOffer?: string;
  couponCode?: string;
  tone?: AiTonePreset;
  fetchImpl?: typeof fetch;
}

/**
 * Generates ready-to-publish Facebook & Instagram ad captions.
 */
export async function generateSocialPost(
  tenantId: string,
  actor: StaffActor,
  options: CopywriterOptions
): Promise<GeneratedSocialPost> {
  assertCan(actor, "design", "edit");
  const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);

  const prompt = `
Generate a high-converting Facebook and Instagram post in JSON format for:
- Product/Topic: ${options.productName || "General Store Promo"}
- Offer / Discount: ${options.discountOffer || "Special Price"}
- Coupon Code: ${options.couponCode || "None"}
- Highlights / Notes: ${options.keyPoints || "High quality, Cash on Delivery available"}
- Cultural Tone: ${options.tone || "DHAKA_YOUTH_TRENDY"}

OUTPUT SCHEMA:
{
  "captionBn": "Engaging Bengali caption with emojis, bullets, price/order instructions",
  "captionEn": "English version of caption",
  "hook": "Attention-grabbing first line (১ম লাইন)",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"]
}
`;

  const rawJson = await callGemini({
    apiKey,
    model,
    prompt,
    systemInstruction: SYSTEM_PROMPT_COPYWRITER,
    responseMimeType: "application/json",
    temperature: 0.75,
    fetchImpl: options.fetchImpl,
  });

  const parsed = JSON.parse(rawJson);
  const result = SocialPostSchema.parse(parsed);
  await recordAiGeneration(tenantId, isCustom);
  return result;
}

/**
 * Generates single-part SMS campaigns adhering to GSM limits (160 English / 70 Bangla chars).
 */
export async function generateSmsCampaignCopy(
  tenantId: string,
  actor: StaffActor,
  options: CopywriterOptions
): Promise<GeneratedSmsCampaign> {
  assertCan(actor, "design", "edit");
  const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);

  const prompt = `
Generate single-message SMS marketing campaigns.
CRITICAL LIMITS:
- englishSms must be strictly 160 characters or less (single GSM-7 SMS part).
- banglaSms must be strictly 70 characters or less (single Unicode SMS part).

CAMPAIGN DETAILS:
- Subject / Offer: ${options.productName || "Exclusive Offer"}
- Discount: ${options.discountOffer || "Limited time deal"}
- Coupon: ${options.couponCode || "BIZ20"}
- Key note: ${options.keyPoints || "Free shipping on orders today"}

OUTPUT SCHEMA:
{
  "englishSms": "Message under 160 chars including link placeholder {link} and coupon",
  "banglaSms": "শুদ্ধ চলিত বাংলায় ৭০ অক্ষরের মধ্যে মেসেজ",
  "estimatedSmsParts": 1,
  "previewText": "Why this SMS converts"
}
`;

  const rawJson = await callGemini({
    apiKey,
    model,
    prompt,
    systemInstruction: SYSTEM_PROMPT_COPYWRITER,
    responseMimeType: "application/json",
    temperature: 0.7,
    fetchImpl: options.fetchImpl,
  });

  const parsed = JSON.parse(rawJson);
  const result = SmsCampaignSchema.parse(parsed);
  await recordAiGeneration(tenantId, isCustom);
  return result;
}

/**
 * Generates hero banner titles, subtitles, and CTA buttons.
 */
export async function generateBannerCopy(
  tenantId: string,
  actor: StaffActor,
  options: CopywriterOptions
): Promise<GeneratedBannerCopy> {
  assertCan(actor, "design", "edit");
  const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);

  const prompt = `
Generate catchy, punchy hero banner slogans for an online store in JSON format.
- Store / Collection Name: ${options.productName || "New Arrivals"}
- Season / Promo: ${options.discountOffer || "Festive Collection"}
- Notes: ${options.keyPoints || "Premium quality lifestyle goods"}
- Tone: ${options.tone || "TRADITIONAL_ELEGANT"}

OUTPUT SCHEMA:
{
  "headlineBn": "সংক্ষিপ্ত আকর্ষণীয় বাংলা হেডলাইন (৩-৬ শব্দ)",
  "headlineEn": "Catchy English Headline (3-6 words)",
  "subheadlineBn": "সহজ ও সুন্দর বাংলা সাব-হেডলাইন (১ বাক্য)",
  "subheadlineEn": "Engaging English Subheadline (1 sentence)",
  "ctaTextBn": "বাটন টেক্সট (যেমন: কালেকশন দেখুন / অর্ডার করুন)",
  "ctaTextEn": "Button Text (e.g. Shop Collection / Explore Now)"
}
`;

  const rawJson = await callGemini({
    apiKey,
    model,
    prompt,
    systemInstruction: SYSTEM_PROMPT_COPYWRITER,
    responseMimeType: "application/json",
    temperature: 0.7,
    fetchImpl: options.fetchImpl,
  });

  const parsed = JSON.parse(rawJson);
  const result = BannerCopySchema.parse(parsed);
  await recordAiGeneration(tenantId, isCustom);
  return result;
}
