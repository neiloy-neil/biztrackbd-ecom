import { defaultPageFor, normalizeSettings, sectionDef, type PageJson, type PageKind } from "./registry";
import type { ThemeId } from "./theme";

/**
 * The page layouts a premium theme installs the first time a store switches to it. Each is built from the ordinary sections, so the owner can
 * keep editing it in the visual editor. They are written as the store's published pages for that theme; the store's other themes keep theirs.
 */

const section = (type: string, n: number, settings: Record<string, unknown> = {}) => ({ id: `${type.replace(/-/g, "_")}_${n}`, type, settings: normalizeSettings(sectionDef(type)!, settings) });
const page = (sections: ReturnType<typeof section>[]): PageJson => ({ version: 1, sections });

const MAISON_HOME = page([
  section("hero", 1, { eyebrow: "THE NEW EDIT", eyebrowBn: "নতুন সংগ্রহ", title: "Dressed for the occasion", titleBn: "প্রতিটি উপলক্ষের পোশাক", text: "Considered cuts and honest fabrics, from our atelier to your wardrobe.", textBn: "যত্নে কাটা পোশাক, খাঁটি কাপড়, আমাদের কারখানা থেকে আপনার ওয়ার্ডরোবে।", ctaText: "Shop the lookbook", ctaTextBn: "লুকবুক দেখুন", ctaLink: "/search", align: "left" }),
  section("category-grid", 1, { title: "Shop the collections", titleBn: "কালেকশন দেখুন", limit: 3 }),
  section("featured-products", 1, { title: "New this season", titleBn: "এই মৌসুমের নতুন", source: "new", limit: 8, columns: "4" }),
  section("banner", 1, { heading: "The festive edit", headingBn: "উৎসবের সংগ্রহ", text: "Pieces made to be worn, photographed and kept.", textBn: "পরার, ছবি তোলার এবং তুলে রাখার মতো পোশাক।", ctaText: "Explore the edit", ctaTextBn: "সংগ্রহ দেখুন", ctaLink: "/search?sale=1", height: "tall" }),
  section("featured-products", 2, { title: "Most loved", titleBn: "সবচেয়ে পছন্দের", source: "featured", limit: 4, columns: "4" }),
  section("trust-strip", 1),
]);

const MAISON_PRODUCT = page([
  section("product-main", 1),
  section("rich-text", 1, { heading: "Size and fit guide", headingBn: "সাইজ ও ফিট গাইড", body: "Measure your chest, waist and hip in inches and compare with the chart below. Between sizes, choose the larger for a relaxed fit. Not sure? Message us on WhatsApp with your measurements and we will recommend a size before you order.", bodyBn: "বুক, কোমর ও হিপ ইঞ্চিতে মেপে নিচের চার্টের সঙ্গে মিলিয়ে নিন। দুই সাইজের মাঝে হলে ঢিলেঢালা ফিটের জন্য বড়টি নিন। নিশ্চিত না হলে মাপসহ হোয়াটসঅ্যাপে জানান, অর্ডারের আগেই সাইজ বলে দেব।" }),
  section("product-reviews", 1),
  section("product-related", 1, { title: "Complete the look", titleBn: "লুক সম্পূর্ণ করুন", limit: 4 }),
]);

const PREMIUM_PAGES: Partial<Record<ThemeId, Partial<Record<PageKind, PageJson>>>> = {
  maison: { home: MAISON_HOME, product: MAISON_PRODUCT },
};

/** The layout a premium theme starts with, one entry per page kind. The pages it does not list use the standard layouts. */
export function premiumPagesFor(themeId: ThemeId): Partial<Record<PageKind, PageJson>> {
  const own = PREMIUM_PAGES[themeId];
  return { collection: defaultPageFor("collection"), cart: defaultPageFor("cart"), ...own };
}
