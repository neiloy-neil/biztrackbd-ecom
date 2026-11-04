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
  section("rich-text", 1, { heading: "Size and fit guide", headingBn: "সাইজ ও ফিট গাইড", body: "Measure your chest, waist and hip in inches and compare with the sizes listed above. Between sizes, choose the larger for a relaxed fit. Not sure? Message us on WhatsApp with your measurements and we will recommend a size before you order.", bodyBn: "বুক, কোমর ও হিপ ইঞ্চিতে মেপে উপরের সাইজের সঙ্গে মিলিয়ে নিন। দুই সাইজের মাঝে হলে ঢিলেঢালা ফিটের জন্য বড়টি নিন। নিশ্চিত না হলে মাপসহ হোয়াটসঅ্যাপে জানান, অর্ডারের আগেই সাইজ বলে দেব।" }),
  section("product-reviews", 1),
  section("product-related", 1, { title: "Complete the look", titleBn: "লুক সম্পূর্ণ করুন", limit: 4 }),
]);

const VOLTEDGE_HOME = page([
  section("hero", 1, { eyebrow: "NEXT GENERATION", eyebrowBn: "পরবর্তী প্রজন্ম", title: "Power your everyday", titleBn: "প্রতিদিনের শক্তি", text: "Flagship audio, fast charging and smart wearables, each one tested before it ships.", textBn: "ফ্ল্যাগশিপ অডিও, ফাস্ট চার্জিং ও স্মার্ট ওয়্যারেবল, প্রতিটি পাঠানোর আগে পরীক্ষা করা।", ctaText: "Shop the drop", ctaTextBn: "নতুন ড্রপ দেখুন", ctaLink: "/search", align: "left" }),
  section("trust-strip", 1),
  section("featured-products", 1, { title: "Just landed", titleBn: "নতুন এসেছে", source: "new", limit: 8, columns: "4" }),
  section("banner", 1, { heading: "Charge once, go all week", headingBn: "একবার চার্জে পুরো সপ্তাহ", text: "20,000 mAh power banks with 65 W fast charging and a 1-year warranty.", textBn: "২০,০০০ mAh পাওয়ার ব্যাংক, ৬৫ ওয়াট ফাস্ট চার্জিং ও ১ বছরের ওয়ারেন্টি।", ctaText: "See power", ctaTextBn: "পাওয়ার দেখুন", ctaLink: "/search?sale=1", height: "tall" }),
  section("category-grid", 1, { title: "Shop by type", titleBn: "ধরন অনুযায়ী কিনুন", limit: 4 }),
  section("featured-products", 2, { title: "Best deals", titleBn: "সেরা অফার", source: "sale", limit: 4, columns: "4" }),
  section("rich-text", 1, { heading: "Warranty and instalments", headingBn: "ওয়ারেন্টি ও কিস্তি", body: "Every device carries a 1-year warranty and a 7-day replacement if it arrives faulty. Pay in 3 easy instalments with a card, or pay on delivery. Keep your receipt: it is your warranty.", bodyBn: "প্রতিটি ডিভাইসে ১ বছরের ওয়ারেন্টি এবং ত্রুটিপূর্ণ এলে ৭ দিনের রিপ্লেসমেন্ট। কার্ডে সহজ ৩ কিস্তিতে অথবা ক্যাশ অন ডেলিভারিতে পরিশোধ করুন। রসিদ রাখুন, সেটাই আপনার ওয়ারেন্টি।" }),
]);

const VOLTEDGE_PRODUCT = page([
  section("product-main", 1),
  section("rich-text", 1, { heading: "Specifications and warranty", headingBn: "স্পেসিফিকেশন ও ওয়ারেন্টি", body: "Battery life, charging speed, connectivity and in-the-box items are listed in the description above. Every device has a 1-year warranty from the date on your receipt and a 7-day replacement for a faulty unit. Need help choosing? Message us on WhatsApp and we will compare two models for you.", bodyBn: "ব্যাটারি লাইফ, চার্জিং গতি, কানেক্টিভিটি ও বক্সে কী কী আছে তা উপরের বিবরণে দেওয়া আছে। রসিদের তারিখ থেকে ১ বছরের ওয়ারেন্টি এবং ত্রুটিপূর্ণ হলে ৭ দিনের রিপ্লেসমেন্ট। বাছাইয়ে সাহায্য লাগলে হোয়াটসঅ্যাপে জানান, দুটি মডেলের তুলনা করে দেব।" }),
  section("product-reviews", 1),
  section("product-related", 1, { title: "Pairs well with", titleBn: "যার সাথে ভালো মানায়", limit: 4 }),
]);

const LUMIERE_HOME = page([
  section("hero", 1, { eyebrow: "THE GLOW EDIT", eyebrowBn: "গ্লো এডিট", title: "Skin that glows from within", titleBn: "ভেতর থেকে উজ্জ্বল ত্বক", text: "Skincare, makeup and fragrance, matched to your routine.", textBn: "ত্বকের যত্ন, মেকআপ ও সুগন্ধি, আপনার রুটিন অনুযায়ী বাছাই করা।", ctaText: "Find your routine", ctaTextBn: "আপনার রুটিন খুঁজুন", ctaLink: "/search", align: "left" }),
  section("category-grid", 1, { title: "Shop by ritual", titleBn: "রিচুয়াল অনুযায়ী কিনুন", limit: 4 }),
  section("featured-products", 1, { title: "New in", titleBn: "নতুন এসেছে", source: "new", limit: 8, columns: "4" }),
  section("banner", 1, { heading: "The 3-step glow routine", headingBn: "৩ ধাপের গ্লো রুটিন", text: "Cleanse, treat and protect: bundle all three and save 15%.", textBn: "পরিষ্কার, চিকিৎসা ও সুরক্ষা: তিনটি একসাথে নিলে ১৫% ছাড়।", ctaText: "Shop the routine", ctaTextBn: "রুটিন দেখুন", ctaLink: "/search?sale=1", height: "tall" }),
  section("featured-products", 2, { title: "Most loved", titleBn: "সবচেয়ে পছন্দের", source: "featured", limit: 4, columns: "4" }),
  section("rich-text", 1, { heading: "Ingredients you can read", headingBn: "যে উপাদান আপনি পড়তে পারেন", body: "Short ingredient lists, fragrance-light formulas and honest claims. Patch-test new products on your inner arm for 24 hours, and introduce one active at a time. Every order ships with a free sample.", bodyBn: "ছোট উপাদান তালিকা, কম সুগন্ধির ফর্মুলা ও সৎ দাবি। নতুন পণ্য ২৪ ঘণ্টা বাহুর ভেতরের দিকে প্যাচ-টেস্ট করুন এবং একবারে একটি অ্যাকটিভ শুরু করুন। প্রতিটি অর্ডারে একটি ফ্রি স্যাম্পল।" }),
  section("trust-strip", 1),
]);

const LUMIERE_PRODUCT = page([
  section("product-main", 1),
  section("rich-text", 1, { heading: "Ingredients and how to use", headingBn: "উপাদান ও ব্যবহারবিধি", body: "The key ingredients and the full list are in the description above. Apply to clean skin, morning or night as directed. Patch-test first, avoid the eye area, and use sun protection in the daytime. Not sure where to start? Message us on WhatsApp and we will build a routine for your skin.", bodyBn: "মূল উপাদান ও পূর্ণ তালিকা উপরের বিবরণে আছে। পরিষ্কার ত্বকে সকালে বা রাতে নির্দেশমতো লাগান। আগে প্যাচ-টেস্ট করুন, চোখের চারপাশ এড়িয়ে চলুন এবং দিনে সানস্ক্রিন ব্যবহার করুন। কোথা থেকে শুরু করবেন বুঝতে না পারলে হোয়াটসঅ্যাপে জানান, আপনার ত্বকের রুটিন সাজিয়ে দেব।" }),
  section("product-reviews", 1),
  section("product-related", 1, { title: "Complete the routine", titleBn: "রুটিন সম্পূর্ণ করুন", limit: 4 }),
]);

const HARVEST_HOME = page([
  section("hero", 1, { eyebrow: "FARM TO TABLE", eyebrowBn: "খামার থেকে টেবিলে", title: "Fresh food, on your schedule", titleBn: "তাজা খাবার, আপনার সময়মতো", text: "Honey, ghee, spices and pantry staples from trusted farms, delivered in the slot you choose.", textBn: "বিশ্বস্ত খামারের মধু, ঘি, মসলা ও মুদি পণ্য, আপনার বেছে নেওয়া সময়ে ডেলিভারি।", ctaText: "Fill your basket", ctaTextBn: "ঝুড়ি ভরুন", ctaLink: "/search", align: "left" }),
  section("trust-strip", 1),
  section("category-grid", 1, { title: "Shop the pantry", titleBn: "মুদি দেখুন", limit: 4 }),
  section("featured-products", 1, { title: "Fresh in", titleBn: "নতুন এসেছে", source: "new", limit: 8, columns: "4" }),
  section("banner", 1, { heading: "The weekly basket, 10% off", headingBn: "সাপ্তাহিক ঝুড়ি, ১০% ছাড়ে", text: "Choose your staples once and we deliver them every week. Pause or cancel any time.", textBn: "একবার পণ্য বেছে নিন, প্রতি সপ্তাহে পৌঁছে দেব। যেকোনো সময় থামান বা বাতিল করুন।", ctaText: "Build my basket", ctaTextBn: "আমার ঝুড়ি বানান", ctaLink: "/search", height: "tall" }),
  section("featured-products", 2, { title: "Pantry favourites", titleBn: "পছন্দের মুদি", source: "featured", limit: 4, columns: "4" }),
  section("rich-text", 1, { heading: "Delivery slots and freshness", headingBn: "ডেলিভারির সময় ও তাজাভাব", body: "Choose a morning or evening slot at checkout. Free delivery over 1,500 taka. Everything is packed in clean, sealed pouches, and anything that is not right gets replaced the same week.", bodyBn: "চেকআউটে সকাল বা সন্ধ্যার সময় বেছে নিন। ১,৫০০ টাকার উপরে ফ্রি ডেলিভারি। সবকিছু পরিষ্কার সিল করা প্যাকেটে আসে, কোনো সমস্যা হলে একই সপ্তাহে বদলে দেওয়া হয়।" }),
]);

const HARVEST_PRODUCT = page([
  section("product-main", 1),
  section("rich-text", 1, { heading: "Freshness, storage and delivery", headingBn: "তাজাভাব, সংরক্ষণ ও ডেলিভারি", body: "Weights and unit prices are shown on the options above. Store honey and spices in a cool, dry place and keep ghee sealed. We deliver in the morning or evening slot you pick at checkout, and replace anything that arrives damaged within the week.", bodyBn: "ওজন ও দাম উপরের অপশনে দেখানো আছে। মধু ও মসলা ঠান্ডা, শুকনো জায়গায় রাখুন এবং ঘি সিল করে রাখুন। চেকআউটে বেছে নেওয়া সকাল বা সন্ধ্যার সময়ে ডেলিভারি দিই, ক্ষতিগ্রস্ত হলে সপ্তাহের মধ্যে বদলে দিই।" }),
  section("product-reviews", 1),
  section("product-related", 1, { title: "Fill the basket", titleBn: "ঝুড়ি ভরুন", limit: 4 }),
]);

const PREMIUM_PAGES: Partial<Record<ThemeId, Partial<Record<PageKind, PageJson>>>> = {
  maison: { home: MAISON_HOME, product: MAISON_PRODUCT },
  voltedge: { home: VOLTEDGE_HOME, product: VOLTEDGE_PRODUCT },
  lumiere: { home: LUMIERE_HOME, product: LUMIERE_PRODUCT },
  harvest: { home: HARVEST_HOME, product: HARVEST_PRODUCT },
};

/** The layout a premium theme starts with, one entry per page kind. The pages it does not list use the standard layouts. */
export function premiumPagesFor(themeId: ThemeId): Partial<Record<PageKind, PageJson>> {
  const own = PREMIUM_PAGES[themeId];
  return { collection: defaultPageFor("collection"), cart: defaultPageFor("cart"), ...own };
}
