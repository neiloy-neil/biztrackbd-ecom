import type { ThemeId } from "../builder/theme";
import type { ArtKind, Palette } from "./art";

/**
 * What each template's demo store contains (docs/38). The same data feeds the five public demo stores and the sample products a new
 * store gets at signup, so the two cannot drift apart. Prices are in taka. Bangla text is kept alongside the English.
 */

export interface DemoVariant { title: string; options: Record<string, string> }
export interface DemoProduct {
  slug: string;
  title: string;
  titleBn: string;
  /** One English and one Bangla paragraph. */
  text: string;
  textBn: string;
  price: number;
  compareAt?: number;
  cost: number;
  category: string;
  art: ArtKind;
  /** Which of the template's palette colours the drawing uses. */
  tone?: "main" | "accent";
  /** The garment own colour, for ranges sold in named colours (overrides tone). */
  colour?: { main: string; accent: string };
  variants: DemoVariant[];
  stock: number;
  featured?: boolean;
}
export interface DemoCategory { slug: string; name: string }
export interface DemoTemplate {
  id: ThemeId;
  /** The demo store's address: <host>.biztrack.bd */
  host: string;
  storeName: string;
  storeNameBn: string;
  tagline: string;
  palette: Palette;
  announcement: { text: string; textBn: string };
  hero: { eyebrow: string; eyebrowBn: string; title: string; titleBn: string; text: string; textBn: string; ctaText: string; ctaTextBn: string; art: ArtKind[] };
  banner: { heading: string; headingBn: string; text: string; textBn: string; ctaText: string; ctaTextBn: string; art: ArtKind[] };
  about: { heading: string; headingBn: string; body: string; bodyBn: string };
  /** A made-to-measure call-out with a banner, for tailoring brands. */
  bespoke?: { heading: string; headingBn: string; body: string; bodyBn: string; ctaText: string; ctaTextBn: string; bannerHeading: string; bannerHeadingBn: string; bannerText: string; bannerTextBn: string };
  categories: DemoCategory[];
  products: DemoProduct[];
}

const sizes = (list: string[]): DemoVariant[] => list.map((s) => ({ title: s, options: { Size: s } }));
const colours = (list: string[]): DemoVariant[] => list.map((s) => ({ title: s, options: { Colour: s } }));
const weights = (list: string[]): DemoVariant[] => list.map((s) => ({ title: s, options: { Weight: s } }));
const one: DemoVariant[] = [{ title: "Default", options: {} }];

// Berber range: three garments in four named colours, sizes in even inches (docs/38).
const BERBER_COLOURS = [
  { name: "Classic Black", bn: "ক্লাসিক ব্ল্যাক", slug: "classic-black", main: "#1B1B1F", accent: "#4A4A55" },
  { name: "Sand Beige", bn: "স্যান্ড বেইজ", slug: "sand-beige", main: "#CBB89A", accent: "#E6D8BF" },
  { name: "Petrol Blue", bn: "পেট্রোল ব্লু", slug: "petrol-blue", main: "#1F4E5F", accent: "#4F8A9C" },
  { name: "Silver Grey", bn: "সিলভার গ্রে", slug: "silver-grey", main: "#9EA3AA", accent: "#CDD1D6" },
] as const;
const BERBER_SIZES = ["34", "36", "38", "40", "42", "44"];
const berberRange = (kind: "blazer" | "trouser" | "waistcoat"): DemoProduct[] => {
  const spec = {
    blazer: { title: "Berber Student Blazer", bn: "বারবার স্টুডেন্ট ব্লেজার", art: "blazer" as const, price: 1750, compareAt: 2500, cost: 1000, category: "blazers", stock: 24, text: "A structured, half-lined student blazer with a clean notch lapel. Cut for a sharp fit that still moves.", textBn: "পরিষ্কার নচ ল্যাপেলসহ হাফ-লাইনড স্টুডেন্ট ব্লেজার। ধারালো ফিট, চলাফেরায় আরামদায়ক।" },
    trouser: { title: "Berber Student Trouser", bn: "বারবার স্টুডেন্ট ট্রাউজার", art: "pants" as const, price: 800, compareAt: 1143, cost: 450, category: "trousers", stock: 36, text: "A flat-front trouser with a clean crease and a comfortable mid rise. Pairs with the matching blazer.", textBn: "ফ্ল্যাট-ফ্রন্ট ট্রাউজার, পরিষ্কার ক্রিজ ও আরামদায়ক রাইজ। ম্যাচিং ব্লেজারের সাথে মানানসই।" },
    waistcoat: { title: "Berber Student Waistcoat", bn: "বারবার স্টুডেন্ট ওয়েস্টকোট", art: "waistcoat" as const, price: 700, compareAt: 1000, cost: 380, category: "waistcoats", stock: 30, text: "A fitted five-button waistcoat that finishes a suit or lifts a shirt on its own.", textBn: "পাঁচ বোতামের ফিটেড ওয়েস্টকোট, স্যুট সম্পূর্ণ করে বা একা শার্টকে আলাদা করে।" },
  }[kind];
  return BERBER_COLOURS.map((c, i): DemoProduct => ({
    slug: `berber-student-${kind}-${c.slug}`, title: `${spec.title} – ${c.name}`, titleBn: `${spec.bn} – ${c.bn}`, text: spec.text, textBn: spec.textBn,
    price: spec.price, compareAt: spec.compareAt, cost: spec.cost, category: spec.category, art: spec.art, colour: { main: c.main, accent: c.accent },
    variants: sizes(BERBER_SIZES), stock: spec.stock, featured: (kind === "blazer" && i < 3) || (kind === "waistcoat" && i === 0),
  }));
};

export const DEMO_TEMPLATES: readonly DemoTemplate[] = [
  {
    id: "kapor", host: "kapor", storeName: "Kapor", storeNameBn: "কাপড়", tagline: "Warm, handmade clothing from Dhaka",
    palette: { bg: "#F3EADF", main: "#8C5A3C", accent: "#C79A6B", ink: "#2B2118" },
    announcement: { text: "Demo store: free delivery in Dhaka over ৳ 3,000", textBn: "ডেমো স্টোর: ঢাকায় ৳ ৩,০০০ এর উপরে ফ্রি ডেলিভারি" },
    hero: { eyebrow: "NEW COLLECTION", eyebrowBn: "নতুন কালেকশন", title: "Eid collection is here", titleBn: "ঈদ কালেকশন এসে গেছে", text: "Handloom cotton panjabi, made for Dhaka summers.", textBn: "ঢাকার গরমের জন্য হাতে বোনা সুতির পাঞ্জাবি।", ctaText: "Shop the collection", ctaTextBn: "কালেকশন দেখুন", art: ["kurta", "shirt"] },
    banner: { heading: "Kurtis for every day", headingBn: "প্রতিদিনের কুর্তি", text: "Light, soft and easy to wash.", textBn: "হালকা, নরম, ধোয়া সহজ।", ctaText: "See kurtis", ctaTextBn: "কুর্তি দেখুন", art: ["dress", "scarf", "bag"] },
    about: { heading: "Made in small batches", headingBn: "অল্প অল্প করে তৈরি", body: "Every piece is cut and stitched by a small team in Narayanganj. This is a demo store: products are samples.", bodyBn: "প্রতিটি পোশাক নারায়ণগঞ্জের ছোট একটি দল কাটে ও সেলাই করে। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    categories: [{ slug: "panjabi", name: "Panjabi" }, { slug: "shirts", name: "Shirts" }, { slug: "womens", name: "Women's wear" }, { slug: "accessories", name: "Accessories" }],
    products: [
      { slug: "cotton-panjabi-off-white", title: "Cotton Panjabi, Off-white", titleBn: "সুতির পাঞ্জাবি, অফ-হোয়াইট", text: "Breathable handloom cotton with a relaxed fit and wooden buttons.", textBn: "আরামদায়ক ফিটের হাতে বোনা সুতি, কাঠের বোতামসহ।", price: 1150, compareAt: 1450, cost: 620, category: "panjabi", art: "kurta", variants: sizes(["M", "L", "XL"]), stock: 40, featured: true },
      { slug: "eid-special-fatua", title: "Eid Special Fatua", titleBn: "ঈদ স্পেশাল ফতুয়া", text: "Embroidered neckline, soft inside, easy to pair with jeans.", textBn: "নেকলাইনে এমব্রয়ডারি, ভেতরে নরম, জিন্সের সাথে মানানসই।", price: 1890, cost: 980, category: "panjabi", art: "kurta", tone: "accent", variants: sizes(["M", "L", "XL"]), stock: 30, featured: true },
      { slug: "linen-shirt-sage", title: "Linen Shirt, Sage", titleBn: "লিনেন শার্ট, সেজ", text: "A cool linen shirt for long days. Gets softer with every wash.", textBn: "দীর্ঘ দিনের জন্য ঠান্ডা লিনেন শার্ট। প্রতি ধোয়ায় আরও নরম হয়।", price: 850, cost: 440, category: "shirts", art: "shirt", variants: sizes(["M", "L", "XL"]), stock: 35 , featured: true },
      { slug: "oxford-shirt-blue", title: "Oxford Shirt, Sky Blue", titleBn: "অক্সফোর্ড শার্ট, আকাশি", text: "Classic oxford weave with a button-down collar.", textBn: "ক্লাসিক অক্সফোর্ড বুনন, বাটন-ডাউন কলার।", price: 1290, cost: 700, category: "shirts", art: "shirt", tone: "accent", variants: sizes(["M", "L", "XL"]), stock: 28 },
      { slug: "slim-chino-navy", title: "Slim Chino, Navy", titleBn: "স্লিম চিনো, নেভি", text: "Stretch cotton chino that holds its shape.", textBn: "স্ট্রেচ সুতির চিনো, আকার ঠিক থাকে।", price: 1290, cost: 690, category: "shirts", art: "pants", variants: sizes(["30", "32", "34"]), stock: 36 },
      { slug: "printed-kurti-rose", title: "Printed Kurti, Rose", titleBn: "প্রিন্টেড কুর্তি, রোজ", text: "Block-print cotton kurti with side pockets.", textBn: "ব্লক-প্রিন্ট সুতির কুর্তি, পাশে পকেট।", price: 1480, compareAt: 1780, cost: 780, category: "womens", art: "dress", variants: sizes(["S", "M", "L"]), stock: 24, featured: true },
      { slug: "cotton-shawl-camel", title: "Cotton Shawl, Camel", titleBn: "সুতির শাল, ক্যামেল", text: "A light shawl for cool evenings and air-conditioned rooms.", textBn: "ঠান্ডা সন্ধ্যা ও এসি রুমের জন্য হালকা শাল।", price: 950, cost: 480, category: "accessories", art: "scarf", variants: one, stock: 45 },
      { slug: "jute-tote-bag", title: "Jute Tote Bag", titleBn: "পাটের টোট ব্যাগ", text: "Sturdy jute with a cotton lining. Holds a laptop and lunch.", textBn: "মজবুত পাট, ভেতরে সুতির আস্তর। ল্যাপটপ ও টিফিন ধরে।", price: 650, cost: 300, category: "accessories", art: "bag", tone: "accent", variants: one, stock: 50 },
    ],
  },
  {
    id: "gadgetstudio", host: "gadgetstudio", storeName: "Gadget Studio", storeNameBn: "গ্যাজেট স্টুডিও", tagline: "Everyday tech, honest prices",
    palette: { bg: "#EAF0FB", main: "#155EEF", accent: "#7AA7FF", ink: "#101828" },
    announcement: { text: "Demo store: 7-day replacement on every gadget", textBn: "ডেমো স্টোর: প্রতিটি গ্যাজেটে ৭ দিনের রিপ্লেসমেন্ট" },
    hero: { eyebrow: "NEW ARRIVALS", eyebrowBn: "নতুন এসেছে", title: "Tech that just works", titleBn: "যে প্রযুক্তি ঠিকঠাক কাজ করে", text: "Earbuds, chargers and smart watches, tested before they ship.", textBn: "ইয়ারবাডস, চার্জার ও স্মার্ট ওয়াচ, পাঠানোর আগে পরীক্ষা করা।", ctaText: "Shop gadgets", ctaTextBn: "গ্যাজেট দেখুন", art: ["earbuds", "watch", "powerbank"] },
    banner: { heading: "Never run out of charge", headingBn: "চার্জ যেন কখনো শেষ না হয়", text: "Power banks and fast chargers with warranty.", textBn: "ওয়ারেন্টিসহ পাওয়ার ব্যাংক ও ফাস্ট চার্জার।", ctaText: "See power", ctaTextBn: "পাওয়ার দেখুন", art: ["powerbank", "cable"] },
    about: { heading: "Tested before it ships", headingBn: "পাঠানোর আগে পরীক্ষা করা", body: "We check every device and keep the receipt for your warranty. This is a demo store: products are samples.", bodyBn: "আমরা প্রতিটি ডিভাইস পরীক্ষা করি এবং ওয়ারেন্টির জন্য রসিদ রাখি। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    categories: [{ slug: "audio", name: "Audio" }, { slug: "power", name: "Power and cables" }, { slug: "wearables", name: "Wearables" }, { slug: "desk", name: "Desk and phone" }],
    products: [
      { slug: "wireless-earbuds-pro", title: "Wireless Earbuds Pro", titleBn: "ওয়্যারলেস ইয়ারবাডস প্রো", text: "Bluetooth 5.3, 28 hours with the case, touch controls.", textBn: "ব্লুটুথ ৫.৩, কেসসহ ২৮ ঘণ্টা, টাচ কন্ট্রোল।", price: 2490, compareAt: 2990, cost: 1500, category: "audio", art: "earbuds", variants: colours(["Black", "White"]), stock: 60, featured: true },
      { slug: "bluetooth-speaker-mini", title: "Bluetooth Speaker Mini", titleBn: "ব্লুটুথ স্পিকার মিনি", text: "Pocket speaker with a clear sound and 12 hours of play.", textBn: "পকেট সাইজ স্পিকার, স্পষ্ট শব্দ, ১২ ঘণ্টা চলে।", price: 1890, cost: 1100, category: "audio", art: "speaker", tone: "accent", variants: colours(["Blue", "Black"]), stock: 40 , featured: true },
      { slug: "power-bank-10000", title: "Power Bank 10,000 mAh", titleBn: "পাওয়ার ব্যাংক ১০,০০০ mAh", text: "Slim body, fast charging and a battery level display.", textBn: "স্লিম বডি, ফাস্ট চার্জিং ও ব্যাটারি লেভেল ডিসপ্লে।", price: 1790, cost: 980, category: "power", art: "powerbank", variants: one, stock: 55, featured: true },
      { slug: "fast-charge-cable-usb-c", title: "USB-C Fast Charge Cable", titleBn: "ইউএসবি-সি ফাস্ট চার্জ ক্যাবল", text: "Braided 1.5 m cable that survives being bent in a bag.", textBn: "ব্যাগে বাঁকালেও টেকে এমন ১.৫ মিটার ব্রেইডেড ক্যাবল।", price: 450, cost: 190, category: "power", art: "cable", variants: one, stock: 120 },
      { slug: "smart-watch-active", title: "Smart Watch Active", titleBn: "স্মার্ট ওয়াচ অ্যাকটিভ", text: "Heart rate, sleep, steps and call alerts. Lasts a week.", textBn: "হার্ট রেট, ঘুম, স্টেপ ও কল অ্যালার্ট। এক সপ্তাহ চলে।", price: 3290, compareAt: 3790, cost: 2000, category: "wearables", art: "watch", variants: colours(["Black", "Rose"]), stock: 30, featured: true },
      { slug: "fitness-band-lite", title: "Fitness Band Lite", titleBn: "ফিটনেস ব্যান্ড লাইট", text: "A light band that counts steps and tracks sleep.", textBn: "হালকা ব্যান্ড, স্টেপ গোনে ও ঘুম মাপে।", price: 1490, cost: 800, category: "wearables", art: "watch", tone: "accent", variants: colours(["Black", "Blue"]), stock: 45 },
      { slug: "foldable-phone-stand", title: "Foldable Phone Stand", titleBn: "ভাঁজযোগ্য ফোন স্ট্যান্ড", text: "Folds flat, holds phones and small tablets at any angle.", textBn: "চ্যাপ্টা ভাঁজ হয়, যেকোনো কোণে ফোন ও ছোট ট্যাব ধরে।", price: 390, cost: 150, category: "desk", art: "phonestand", variants: one, stock: 80 },
      { slug: "gan-charger-65w", title: "65W GaN Charger", titleBn: "৬৫ ওয়াট GaN চার্জার", text: "One small charger for your laptop, phone and earbuds.", textBn: "ল্যাপটপ, ফোন ও ইয়ারবাডসের জন্য একটি ছোট চার্জার।", price: 2190, cost: 1250, category: "power", art: "powerbank", tone: "accent", variants: one, stock: 35 },
    ],
  },
  {
    id: "mini-bunny", host: "minibunny", storeName: "Mini Bunny", storeNameBn: "মিনি বানি", tagline: "Soft, safe and playful for little ones",
    palette: { bg: "#FFF1E8", main: "#C24173", accent: "#F2A7C3", ink: "#3D2932" },
    announcement: { text: "Demo store: gift wrap is free on every order", textBn: "ডেমো স্টোর: প্রতিটি অর্ডারে গিফট র‍্যাপ ফ্রি" },
    hero: { eyebrow: "FOR LITTLE ONES", eyebrowBn: "ছোটদের জন্য", title: "Toys they will keep", titleBn: "যে খেলনা ওরা আগলে রাখবে", text: "Soft toys, puzzles and baby clothes that are gentle on skin.", textBn: "নরম খেলনা, পাজল ও ত্বকের জন্য আরামদায়ক বেবি পোশাক।", ctaText: "Shop toys", ctaTextBn: "খেলনা দেখুন", art: ["teddy", "blocks", "toycar"] },
    banner: { heading: "Baby basics", headingBn: "বেবির প্রয়োজনীয় জিনিস", text: "Soft cotton onesies in sizes from newborn.", textBn: "নবজাতক থেকে শুরু, নরম সুতির অনসি।", ctaText: "See baby wear", ctaTextBn: "বেবি পোশাক দেখুন", art: ["onesie", "bottle"] },
    about: { heading: "Safe by choice", headingBn: "নিরাপত্তাই আমাদের পছন্দ", body: "We pick toys with rounded edges and non-toxic paint, and clothes without scratchy tags. This is a demo store: products are samples.", bodyBn: "আমরা গোলাকার কোণ ও বিষমুক্ত রঙের খেলনা এবং খোঁচা না দেওয়া ট্যাগের পোশাক বেছে নিই। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    categories: [{ slug: "soft-toys", name: "Soft toys" }, { slug: "learning", name: "Learning and play" }, { slug: "baby-wear", name: "Baby wear" }, { slug: "gear", name: "Bottles and gear" }],
    products: [
      { slug: "plush-teddy-bear", title: "Plush Teddy Bear", titleBn: "প্লাশ টেডি বিয়ার", text: "A huggable bear with a washable cover. About 35 cm tall.", textBn: "জড়িয়ে ধরার মতো ভালুক, ধোয়া যায় এমন কভার। প্রায় ৩৫ সেমি লম্বা।", price: 1250, compareAt: 1550, cost: 640, category: "soft-toys", art: "teddy", variants: colours(["Brown", "Pink"]), stock: 40, featured: true },
      { slug: "bunny-soft-toy", title: "Bunny Soft Toy", titleBn: "বানি সফট টয়", text: "Our namesake bunny, soft enough for a newborn's cot.", textBn: "আমাদের নামের খরগোশ, নবজাতকের খাটেও রাখার মতো নরম।", price: 950, cost: 480, category: "soft-toys", art: "teddy", tone: "accent", variants: colours(["Cream", "Pink"]), stock: 45 , featured: true },
      { slug: "wooden-building-blocks", title: "Wooden Building Blocks", titleBn: "কাঠের বিল্ডিং ব্লক", text: "36 painted blocks in a cotton bag. Non-toxic colours.", textBn: "সুতির ব্যাগে ৩৬টি রঙিন ব্লক। বিষমুক্ত রঙ।", price: 1490, cost: 800, category: "learning", art: "blocks", variants: one, stock: 30, featured: true },
      { slug: "animal-jigsaw-puzzle", title: "Animal Jigsaw Puzzle", titleBn: "প্রাণীর জিগস পাজল", text: "24 thick pieces that are easy for small hands.", textBn: "ছোট হাতের জন্য সহজ ২৪টি মোটা টুকরো।", price: 690, cost: 330, category: "learning", art: "puzzle", variants: one, stock: 50 },
      { slug: "pull-back-toy-car", title: "Pull-back Toy Car", titleBn: "পুল-ব্যাক খেলনা গাড়ি", text: "Pull it back, let go and watch it race across the floor.", textBn: "পেছনে টানুন, ছেড়ে দিন, মেঝেতে ছুটে যাবে।", price: 520, cost: 230, category: "learning", art: "toycar", variants: colours(["Red", "Blue"]), stock: 70 },
      { slug: "cotton-baby-onesie", title: "Cotton Baby Onesie", titleBn: "সুতির বেবি অনসি", text: "Snap buttons and a tagless neck for sensitive skin.", textBn: "স্ন্যাপ বোতাম ও ট্যাগবিহীন গলা, সংবেদনশীল ত্বকের জন্য।", price: 590, cost: 280, category: "baby-wear", art: "onesie", variants: sizes(["0-3m", "3-6m", "6-12m"]), stock: 60, featured: true },
      { slug: "sleepsuit-two-pack", title: "Sleepsuit, 2 pack", titleBn: "স্লিপসুট, ২ পিস", text: "Two soft sleepsuits with fold-over mittens.", textBn: "ভাঁজ করা গ্লাভসসহ দুটি নরম স্লিপসুট।", price: 990, cost: 520, category: "baby-wear", art: "onesie", tone: "accent", variants: sizes(["0-3m", "3-6m", "6-12m"]), stock: 40 },
      { slug: "leak-proof-bottle", title: "Leak-proof Water Bottle", titleBn: "লিক-প্রুফ পানির বোতল", text: "BPA-free bottle with a spill-proof spout. 350 ml.", textBn: "বিপিএ-মুক্ত বোতল, পানি পড়ে না। ৩৫০ মিলি।", price: 480, cost: 210, category: "gear", art: "bottle", variants: colours(["Pink", "Blue"]), stock: 65 },
    ],
  },
  {
    id: "axionwear", host: "axionwear", storeName: "Axion Wear", storeNameBn: "অ্যাক্সিয়ন ওয়্যার", tagline: "Streetwear built to move",
    palette: { bg: "#E9ECEF", main: "#1B1F24", accent: "#9BBE12", ink: "#0B0D0F" },
    announcement: { text: "Demo store: new drop every Friday", textBn: "ডেমো স্টোর: প্রতি শুক্রবার নতুন ড্রপ" },
    hero: { eyebrow: "SEASON DROP", eyebrowBn: "সিজন ড্রপ", title: "Move like you mean it", titleBn: "চলুন আত্মবিশ্বাসে", text: "Tees, hoodies and joggers cut for the gym and the street.", textBn: "জিম ও রাস্তা, দুই জায়গার জন্য কাটা টি, হুডি ও জগার।", ctaText: "Shop the drop", ctaTextBn: "ড্রপ দেখুন", art: ["hoodie", "sneaker", "cap"] },
    banner: { heading: "Train in comfort", headingBn: "আরামে ট্রেনিং", text: "Quick-dry shorts and tees that stay light.", textBn: "দ্রুত শুকায় এমন শর্টস ও টি, হালকা থাকে।", ctaText: "See training wear", ctaTextBn: "ট্রেনিং পোশাক দেখুন", art: ["shorts", "tee"] },
    about: { heading: "Built for movement", headingBn: "চলার জন্য তৈরি", body: "Heavy cotton, flat seams and fits tested on real athletes. This is a demo store: products are samples.", bodyBn: "মোটা সুতি, সমতল সেলাই এবং প্রকৃত অ্যাথলেটদের উপর পরীক্ষা করা ফিট। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    categories: [{ slug: "tops", name: "Tees and hoodies" }, { slug: "bottoms", name: "Joggers and shorts" }, { slug: "footwear", name: "Footwear" }, { slug: "headwear", name: "Caps" }],
    products: [
      { slug: "heavy-cotton-tee-black", title: "Heavy Cotton Tee, Black", titleBn: "হেভি কটন টি, কালো", text: "240 gsm cotton with a boxy fit that holds its shape.", textBn: "২৪০ জিএসএম সুতি, বক্সি ফিট, আকার ঠিক থাকে।", price: 890, cost: 400, category: "tops", art: "tee", variants: sizes(["M", "L", "XL"]), stock: 80, featured: true },
      { slug: "oversized-tee-lime", title: "Oversized Tee, Lime", titleBn: "ওভারসাইজড টি, লাইম", text: "Drop-shoulder oversized tee in a loud lime.", textBn: "ড্রপ-শোল্ডার ওভারসাইজড টি, উজ্জ্বল লাইম রঙে।", price: 990, cost: 450, category: "tops", art: "tee", tone: "accent", variants: sizes(["M", "L", "XL"]), stock: 60 },
      { slug: "core-hoodie-charcoal", title: "Core Hoodie, Charcoal", titleBn: "কোর হুডি, চারকোল", text: "Brushed fleece inside, kangaroo pocket, heavyweight hood.", textBn: "ভেতরে ব্রাশড ফ্লিস, ক্যাঙ্গারু পকেট, পুরু হুড।", price: 2290, compareAt: 2790, cost: 1200, category: "tops", art: "hoodie", variants: sizes(["M", "L", "XL"]), stock: 40, featured: true },
      { slug: "training-joggers-black", title: "Training Joggers, Black", titleBn: "ট্রেনিং জগার, কালো", text: "Tapered joggers with zip pockets and a stretch waist.", textBn: "জিপ পকেট ও স্ট্রেচ কোমরের টেপার্ড জগার।", price: 1690, cost: 880, category: "bottoms", art: "joggers", variants: sizes(["M", "L", "XL"]), stock: 50, featured: true },
      { slug: "quick-dry-shorts", title: "Quick-dry Shorts", titleBn: "কুইক-ড্রাই শর্টস", text: "Lightweight shorts that dry fast after a heavy session.", textBn: "ভারী সেশনের পর দ্রুত শুকায় এমন হালকা শর্টস।", price: 990, cost: 470, category: "bottoms", art: "shorts", tone: "accent", variants: sizes(["M", "L", "XL"]), stock: 55 },
      { slug: "runner-sneakers", title: "Runner Sneakers", titleBn: "রানার স্নিকার্স", text: "Cushioned daily trainers with a grippy outsole.", textBn: "কুশনযুক্ত ডেইলি ট্রেনার, গ্রিপি সোল।", price: 3490, compareAt: 3990, cost: 2000, category: "footwear", art: "sneaker", variants: sizes(["41", "42", "43", "44"]), stock: 35 , featured: true },
      { slug: "six-panel-cap", title: "Six-panel Cap", titleBn: "ছয় প্যানেলের ক্যাপ", text: "Adjustable cotton cap with a curved brim.", textBn: "অ্যাডজাস্টেবল সুতির ক্যাপ, বাঁকা ব্রিম।", price: 590, cost: 260, category: "headwear", art: "cap", variants: colours(["Black", "Lime"]), stock: 70 },
      { slug: "gym-sneaker-low", title: "Court Low Sneakers", titleBn: "কোর্ট লো স্নিকার্স", text: "Low-profile everyday sneakers in clean leather-look.", textBn: "চামড়ার মতো দেখতে পরিষ্কার লো-প্রোফাইল স্নিকার্স।", price: 2890, cost: 1600, category: "footwear", art: "sneaker", tone: "accent", variants: sizes(["41", "42", "43", "44"]), stock: 30 },
    ],
  },
  {
    id: "bindu", host: "bindu", storeName: "Bindu", storeNameBn: "বিন্দু", tagline: "Calm, honest beauty",
    palette: { bg: "#FBEFEA", main: "#8A2855", accent: "#D89AB5", ink: "#321E28" },
    announcement: { text: "Demo store: free sample with every order", textBn: "ডেমো স্টোর: প্রতিটি অর্ডারে ফ্রি স্যাম্পল" },
    hero: { eyebrow: "SKIN CARE", eyebrowBn: "স্কিন কেয়ার", title: "Simple routines, real results", titleBn: "সহজ রুটিন, সত্যিকারের ফল", text: "Gentle cleansers, serums and creams for Bangladeshi weather.", textBn: "বাংলাদেশের আবহাওয়ার জন্য মৃদু ক্লিনজার, সিরাম ও ক্রিম।", ctaText: "Shop skin care", ctaTextBn: "স্কিন কেয়ার দেখুন", art: ["serum", "jar", "tube"] },
    banner: { heading: "Colour for every mood", headingBn: "প্রতি মুডের জন্য রঙ", text: "Lipsticks and palettes that suit warm skin tones.", textBn: "উষ্ণ ত্বকের রঙে মানানসই লিপস্টিক ও প্যালেট।", ctaText: "See makeup", ctaTextBn: "মেকআপ দেখুন", art: ["lipstick", "palette"] },
    about: { heading: "Ingredients you can read", headingBn: "যে উপাদান আপনি পড়তে পারেন", body: "Short ingredient lists, fragrance-light formulas and honest claims. This is a demo store: products are samples.", bodyBn: "ছোট উপাদান তালিকা, হালকা সুগন্ধ ও সৎ দাবি। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    categories: [{ slug: "skincare", name: "Skin care" }, { slug: "makeup", name: "Makeup" }, { slug: "fragrance", name: "Fragrance" }],
    products: [
      { slug: "vitamin-c-serum", title: "Vitamin C Serum", titleBn: "ভিটামিন সি সিরাম", text: "A bright, light serum for dull skin. 30 ml.", textBn: "নিস্তেজ ত্বকের জন্য হালকা উজ্জ্বলতার সিরাম। ৩০ মিলি।", price: 1450, compareAt: 1750, cost: 700, category: "skincare", art: "serum", variants: one, stock: 50, featured: true },
      { slug: "hyaluronic-serum", title: "Hyaluronic Hydration Serum", titleBn: "হায়ালুরনিক হাইড্রেশন সিরাম", text: "Deep hydration that sits well under makeup.", textBn: "মেকআপের নিচে মানানসই গভীর হাইড্রেশন।", price: 1290, cost: 620, category: "skincare", art: "serum", tone: "accent", variants: one, stock: 45 },
      { slug: "rose-day-cream", title: "Rose Day Cream", titleBn: "রোজ ডে ক্রিম", text: "A light day cream with SPF 30 and a soft rose scent.", textBn: "এসপিএফ ৩০ ও নরম গোলাপের গন্ধের হালকা ডে ক্রিম।", price: 1190, cost: 560, category: "skincare", art: "jar", variants: one, stock: 55, featured: true },
      { slug: "gentle-face-wash", title: "Gentle Face Wash", titleBn: "জেন্টল ফেস ওয়াশ", text: "A soap-free wash that cleans without stripping. 100 ml.", textBn: "সাবানমুক্ত ওয়াশ, পরিষ্কার করে কিন্তু শুষ্ক করে না। ১০০ মিলি।", price: 690, cost: 300, category: "skincare", art: "tube", variants: one, stock: 80 },
      { slug: "matte-lipstick-berry", title: "Matte Lipstick, Berry", titleBn: "ম্যাট লিপস্টিক, বেরি", text: "Comfortable matte colour that lasts through lunch.", textBn: "আরামদায়ক ম্যাট রঙ, দুপুরের খাবারেও টেকে।", price: 790, cost: 340, category: "makeup", art: "lipstick", variants: colours(["Berry", "Rosewood", "Coral"]), stock: 65, featured: true },
      { slug: "eyeshadow-palette-warm", title: "Eyeshadow Palette, Warm", titleBn: "আইশ্যাডো প্যালেট, ওয়ার্ম", text: "Four buttery shades from soft peach to deep plum.", textBn: "নরম পীচ থেকে গাঢ় প্লাম, চারটি মোলায়েম শেড।", price: 1590, cost: 800, category: "makeup", art: "palette", variants: one, stock: 35 },
      { slug: "night-repair-cream", title: "Night Repair Cream", titleBn: "নাইট রিপেয়ার ক্রিম", text: "A richer cream that works while you sleep.", textBn: "ঘুমের সময় কাজ করে এমন ঘন ক্রিম।", price: 1590, cost: 780, category: "skincare", art: "jar", tone: "accent", variants: one, stock: 40 },
      { slug: "bindu-eau-de-parfum", title: "Bindu Eau de Parfum", titleBn: "বিন্দু ইউ দ্য পারফিউম", text: "Jasmine and sandalwood, 50 ml. Soft enough for every day.", textBn: "জুঁই ও চন্দন, ৫০ মিলি। প্রতিদিনের জন্য নরম গন্ধ।", price: 2490, compareAt: 2990, cost: 1300, category: "fragrance", art: "perfume", variants: one, stock: 30 , featured: true },
    ],
  },
  {
    id: "berber", host: "berber", storeName: "Berber Clothing", storeNameBn: "বারবার ক্লোদিং", tagline: "Modern formalwear, tailored in Bangladesh",
    palette: { bg: "#E8E4DB", main: "#1B2A4A", accent: "#C9A24B", ink: "#12182B" },
    announcement: { text: "Demo store: free returns within 7 days. Cash on delivery nationwide.", textBn: "ডেমো স্টোর: ৭ দিনের মধ্যে ফ্রি রিটার্ন। সারা দেশে ক্যাশ অন ডেলিভারি।" },
    hero: { eyebrow: "NEW COLLECTION", eyebrowBn: "নতুন কালেকশন", title: "Wear Your Story", titleBn: "পরুন আপনার গল্প", text: "Modern formalwear for the unapologetic individual. Blazers, trousers and waistcoats, ready to wear.", textBn: "আত্মবিশ্বাসী মানুষের জন্য আধুনিক ফরমালওয়্যার। ব্লেজার, ট্রাউজার ও ওয়েস্টকোট, পরার জন্য প্রস্তুত।", ctaText: "Shop now", ctaTextBn: "এখনই কিনুন", art: ["blazer", "waistcoat", "tie"] },
    banner: { heading: "The student collection: 30% off", headingBn: "স্টুডেন্ট কালেকশন: ৩০% ছাড়", text: "Blazers, trousers and waistcoats in four colours, sizes 34 to 44.", textBn: "চার রঙে ব্লেজার, ট্রাউজার ও ওয়েস্টকোট, সাইজ ৩৪ থেকে ৪৪।", ctaText: "Shop the sale", ctaTextBn: "ছাড়ের পণ্য দেখুন", art: ["blazer", "pants", "waistcoat"] },
    about: { heading: "Rooted in artisanal tailoring", headingBn: "কারুশিল্পী দর্জির ঐতিহ্যে গড়া", body: "Clean cuts, honest cloth and a fit you can feel. This is a demo store: products are samples.", bodyBn: "পরিচ্ছন্ন কাট, সৎ কাপড় ও অনুভব করার মতো ফিট। এটি একটি ডেমো স্টোর, পণ্যগুলো নমুনা।" },
    bespoke: {
      heading: "Made to measure", headingBn: "মাপ অনুযায়ী তৈরি",
      body: "Custom craft a one-of-a-kind suit: 30+ precise measurements, 500+ European mill cloths, a full floating canvas, and a private fitting with a master tailor.",
      bodyBn: "আপনার জন্য একমাত্র স্যুট: ৩০+ সুনির্দিষ্ট মাপ, ৫০০+ ইউরোপীয় মিলের কাপড়, ফুল ফ্লোটিং ক্যানভাস এবং মাস্টার টেইলরের সাথে একান্ত ফিটিং।",
      ctaText: "Book a fitting", ctaTextBn: "ফিটিং বুক করুন", bannerHeading: "Book a private fitting", bannerHeadingBn: "একান্ত ফিটিং বুক করুন",
      bannerText: "A complimentary 45-minute session with a master tailor. Demo store: bookings are not taken.", bannerTextBn: "মাস্টার টেইলরের সাথে বিনামূল্যে ৪৫ মিনিটের সেশন। ডেমো স্টোর: বুকিং নেওয়া হয় না।",
    },
    categories: [{ slug: "blazers", name: "Blazers" }, { slug: "trousers", name: "Trousers" }, { slug: "waistcoats", name: "Waistcoats" }, { slug: "essentials", name: "Shirts and ties" }],
    products: [
      ...berberRange("blazer"), ...berberRange("trouser"), ...berberRange("waistcoat"),
      { slug: "classic-white-formal-shirt", title: "Classic White Formal Shirt", titleBn: "ক্লাসিক হোয়াইট ফরমাল শার্ট", text: "A crisp cotton shirt with a semi-spread collar. The base of every outfit.", textBn: "ক্রিস্প সুতির শার্ট, সেমি-স্প্রেড কলার। প্রতিটি পোশাকের ভিত্তি।", price: 1450, cost: 760, category: "essentials", art: "shirt", colour: { main: "#F4F2EC", accent: "#CFC9B8" }, variants: sizes(["S", "M", "L", "XL"]), stock: 40 },
      { slug: "midnight-navy-silk-tie", title: "Silk Tie, Midnight Navy", titleBn: "সিল্ক টাই, মিডনাইট নেভি", text: "A woven silk tie with a fine texture. 7 cm blade.", textBn: "সূক্ষ্ম টেক্সচারের বোনা সিল্ক টাই। ৭ সেমি চওড়া।", price: 650, cost: 280, category: "essentials", art: "tie", colour: { main: "#1B2A4A", accent: "#C9A24B" }, variants: one, stock: 50 },
    ],
  },
  {
    id: "freshbasket", host: "freshbasket", storeName: "Fresh Basket", storeNameBn: "ফ্রেশ বাস্কেট", tagline: "Honest food from trusted farms",
    palette: { bg: "#FBEBCB", main: "#B4421C", accent: "#E3A93B", ink: "#2E2218" },
    announcement: { text: "Demo store: free delivery in Dhaka over ৳ 1,500", textBn: "ডেমো স্টোর: ঢাকায় ৳ ১,৫০০ এর উপরে ফ্রি ডেলিভারি" },
    hero: { eyebrow: "FRESH FROM THE SOURCE", eyebrowBn: "সরাসরি উৎস থেকে", title: "Honest food, packed with care", titleBn: "খাঁটি খাবার, যত্নে প্যাক করা", text: "Honey, ghee, spices and pantry staples with the weight and price in plain sight.", textBn: "মধু, ঘি, মসলা ও মুদি পণ্য, ওজন ও দাম স্পষ্ট করে লেখা।", ctaText: "Fill your basket", ctaTextBn: "ঝুড়ি ভরুন", art: ["jar", "sack", "bottle"] },
    banner: { heading: "Winter honey is in", headingBn: "শীতের মধু এসেছে", text: "Mustard flower and litchi honey, bottled where it was made.", textBn: "সরিষা ফুল ও লিচুর মধু, যেখানে তৈরি সেখানেই বোতলবন্দী।", ctaText: "See honey", ctaTextBn: "মধু দেখুন", art: ["jar", "bottle"] },
    about: { heading: "Know where it comes from", headingBn: "জানুন কোথা থেকে আসে", body: "We buy from small farms and pack in clean, sealed pouches. This is a demo store: products are samples.", bodyBn: "আমরা ছোট খামার থেকে কিনি এবং পরিষ্কার সিল করা প্যাকেটে দিই। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "honey-ghee", name: "Honey" }, { slug: "spices", name: "Spices" }, { slug: "staples", name: "Staples" }, { slug: "tea-snacks", name: "Tea" }],
    products: [
      { slug: "mustard-flower-honey", title: "Mustard Flower Honey", titleBn: "সরিষা ফুলের মধু", text: "Light, sweet honey from Sirajganj mustard fields.", textBn: "সিরাজগঞ্জের সরিষা ক্ষেতের হালকা মিষ্টি মধু।", price: 650, compareAt: 780, cost: 380, category: "honey-ghee", art: "jar", variants: weights(["250 g", "500 g"]), stock: 40, featured: true },
      { slug: "sundarban-honey", title: "Sundarban Wild Honey", titleBn: "সুন্দরবনের খাঁটি মধু", text: "Dark, rich wild honey with a gentle smoky note.", textBn: "গাঢ়, ঘন বুনো মধু, হালকা ধোঁয়াটে স্বাদ।", price: 980, cost: 600, category: "honey-ghee", art: "jar", tone: "accent", variants: weights(["250 g", "500 g"]), stock: 28, featured: true },
      { slug: "desi-ghee", title: "Desi Cow Ghee", titleBn: "দেশি গরুর ঘি", text: "Slow-cooked ghee with a warm, nutty aroma.", textBn: "ধীরে জ্বালানো ঘি, উষ্ণ ও বাদামি সুবাস।", price: 1350, cost: 900, category: "honey-ghee", art: "jar", variants: weights(["250 g", "500 g"]), stock: 30 },
      { slug: "turmeric-powder", title: "Turmeric Powder", titleBn: "হলুদ গুঁড়া", text: "Stone-ground turmeric with deep colour and no added dye.", textBn: "পাথরে পেষা হলুদ, গাঢ় রঙ, কোনো রং মেশানো নেই।", price: 180, cost: 95, category: "spices", art: "box", tone: "accent", variants: weights(["200 g", "500 g"]), stock: 80, featured: true },
      { slug: "red-chilli-powder", title: "Red Chilli Powder", titleBn: "লাল মরিচ গুঁড়া", text: "Bright, hot and freshly ground in small batches.", textBn: "ঝাল ও উজ্জ্বল, অল্প অল্প করে তাজা পেষা।", price: 220, compareAt: 260, cost: 120, category: "spices", art: "box", variants: weights(["200 g", "500 g"]), stock: 70 },
      { slug: "miniket-rice", title: "Miniket Rice", titleBn: "মিনিকেট চাল", text: "Polished, even grains that cook fluffy and separate.", textBn: "পরিষ্কার, সমান দানা, রান্নায় ঝরঝরে।", price: 1450, cost: 1180, category: "staples", art: "sack", variants: weights(["5 kg", "10 kg"]), stock: 55, featured: true },
      { slug: "masoor-dal", title: "Masoor Dal", titleBn: "মসুর ডাল", text: "Clean red lentils that cook down in twenty minutes.", textBn: "পরিষ্কার লাল মসুর, বিশ মিনিটে সেদ্ধ।", price: 150, cost: 105, category: "staples", art: "sack", tone: "accent", variants: weights(["1 kg", "2 kg"]), stock: 90 },
      { slug: "sylhet-black-tea", title: "Sylhet Black Tea", titleBn: "সিলেটের কালো চা", text: "Strong, brisk leaf tea from Sylhet gardens.", textBn: "সিলেটের বাগানের কড়া, তাজা পাতার চা।", price: 320, cost: 190, category: "tea-snacks", art: "bag", variants: weights(["200 g", "500 g"]), stock: 60 },
    ],
  },
  {
    id: "bazaar", host: "bazaar", storeName: "Bazaar", storeNameBn: "বাজার", tagline: "Everything you need, one bazaar",
    palette: { bg: "#FFE4CC", main: "#14213D", accent: "#C2410C", ink: "#14213D" },
    announcement: { text: "Demo store: cash on delivery and 7-day returns", textBn: "ডেমো স্টোর: ক্যাশ অন ডেলিভারি ও ৭ দিনের রিটার্ন" },
    hero: { eyebrow: "TODAY'S DEALS", eyebrowBn: "আজকের অফার", title: "Everything you need, one bazaar", titleBn: "যা দরকার সবই, এক বাজারে", text: "Daily essentials, gadgets, home and gifts at prices that make sense.", textBn: "দৈনন্দিন প্রয়োজন, গ্যাজেট, ঘর ও উপহার, ন্যায্য দামে।", ctaText: "Browse the deals", ctaTextBn: "অফার দেখুন", art: ["bag", "speaker", "bottle"] },
    banner: { heading: "Home picks under ৳ 999", headingBn: "৳ ৯৯৯ এর নিচে ঘরের সেরা বাছাই", text: "Bottles, storage and kitchen helpers for every room.", textBn: "প্রতিটি ঘরের জন্য বোতল, স্টোরেজ ও রান্নাঘরের সহায়ক।", ctaText: "Shop home", ctaTextBn: "ঘর দেখুন", art: ["bottle", "box"] },
    about: { heading: "A little of everything", headingBn: "সবকিছু একটু একটু", body: "One shop for the things a household actually buys, with honest prices. This is a demo store: products are samples.", bodyBn: "ঘরের আসলে যা দরকার, তার জন্য একটি দোকান, ন্যায্য দামে। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "home", name: "Home" }, { slug: "gadgets", name: "Gadgets" }, { slug: "everyday", name: "Wear" }, { slug: "gifts", name: "Gifts" }],
    products: [
      { slug: "steel-water-bottle", title: "Steel Water Bottle, 750 ml", titleBn: "স্টিলের পানির বোতল, ৭৫০ মি.লি.", text: "Keeps drinks cold for twelve hours. Leak-proof lid.", textBn: "বারো ঘণ্টা ঠান্ডা রাখে। লিক-প্রুফ ঢাকনা।", price: 690, compareAt: 890, cost: 380, category: "home", art: "bottle", variants: colours(["Navy", "Orange"]), stock: 60, featured: true },
      { slug: "storage-box-set", title: "Storage Box Set of 3", titleBn: "স্টোরেজ বক্স সেট (৩টি)", text: "Stackable boxes with snap lids for the kitchen and wardrobe.", textBn: "রান্নাঘর ও আলমারির জন্য ঢাকনাসহ স্ট্যাক করা বক্স।", price: 540, cost: 290, category: "home", art: "box", tone: "accent", variants: one, stock: 45 },
      { slug: "glass-jar-set", title: "Glass Jar Set", titleBn: "কাচের জার সেট", text: "Airtight jars for spices, tea and dry food.", textBn: "মসলা, চা ও শুকনো খাবারের জন্য বায়ুনিরোধী জার।", price: 780, cost: 430, category: "home", art: "jar", variants: one, stock: 38 },
      { slug: "bluetooth-speaker-mini", title: "Mini Bluetooth Speaker", titleBn: "মিনি ব্লুটুথ স্পিকার", text: "Loud for its size, with eight hours of battery.", textBn: "ছোট হলেও জোরালো, আট ঘণ্টা ব্যাটারি।", price: 1190, compareAt: 1490, cost: 700, category: "gadgets", art: "speaker", variants: colours(["Black", "Blue"]), stock: 34, featured: true },
      { slug: "fast-charging-cable", title: "Fast Charging Cable", titleBn: "ফাস্ট চার্জিং ক্যাবল", text: "Braided, 1.5 metres, with a six-month warranty.", textBn: "বেণি করা, ১.৫ মিটার, ছয় মাসের ওয়ারেন্টি।", price: 320, cost: 150, category: "gadgets", art: "cable", variants: one, stock: 120 },
      { slug: "everyday-cotton-tee", title: "Everyday Cotton Tee", titleBn: "এভরিডে সুতির টি-শার্ট", text: "Soft combed cotton in a regular fit.", textBn: "নরম কম্বড সুতি, রেগুলার ফিট।", price: 490, cost: 250, category: "everyday", art: "tee", tone: "accent", variants: sizes(["M", "L", "XL"]), stock: 70, featured: true },
      { slug: "canvas-tote", title: "Canvas Tote Bag", titleBn: "ক্যানভাস টোট ব্যাগ", text: "A sturdy shopping bag that folds flat.", textBn: "মজবুত শপিং ব্যাগ, ভাঁজ করা যায়।", price: 390, cost: 190, category: "everyday", art: "bag", variants: one, stock: 80, featured: true },
      { slug: "wooden-puzzle", title: "Wooden Puzzle", titleBn: "কাঠের পাজল", text: "A 48-piece puzzle, smooth-edged and child-safe.", textBn: "৪৮ টুকরার পাজল, মসৃণ কিনারা, শিশুদের জন্য নিরাপদ।", price: 450, compareAt: 560, cost: 240, category: "gifts", art: "puzzle", variants: one, stock: 42 },
    ],
  },
  {
    id: "nakshi", host: "nakshi", storeName: "Nakshi", storeNameBn: "নকশী", tagline: "Sarees and festive wear, woven with heritage",
    palette: { bg: "#F3E4D6", main: "#7A1F2E", accent: "#B8893A", ink: "#2B1418" },
    announcement: { text: "Demo store: free delivery on festive orders over ৳ 5,000", textBn: "ডেমো স্টোর: ৳ ৫,০০০ এর উপরে উৎসবের অর্ডারে ফ্রি ডেলিভারি" },
    hero: { eyebrow: "FESTIVE EDIT", eyebrowBn: "উৎসবের সংগ্রহ", title: "Woven with heritage", titleBn: "ঐতিহ্যে বোনা", text: "Sarees, three-pieces and dupattas for weddings, Eid and every celebration.", textBn: "বিয়ে, ঈদ ও প্রতিটি উৎসবের জন্য শাড়ি, থ্রি-পিস ও ওড়না।", ctaText: "Explore the edit", ctaTextBn: "কালেকশন দেখুন", art: ["saree", "dress", "scarf"] },
    banner: { heading: "Jamdani, handwoven", headingBn: "জামদানি, হাতে বোনা", text: "Each saree takes weeks on the loom in Rupganj.", textBn: "রূপগঞ্জের তাঁতে প্রতিটি শাড়ি বুনতে কয়েক সপ্তাহ লাগে।", ctaText: "See sarees", ctaTextBn: "শাড়ি দেখুন", art: ["saree", "scarf"] },
    about: { heading: "Cloth with a story", headingBn: "গল্প বোনা কাপড়", body: "We work with weaving families and embroiderers, and pay them fairly. This is a demo store: products are samples.", bodyBn: "আমরা তাঁতি ও নকশা শিল্পী পরিবারের সঙ্গে কাজ করি এবং ন্যায্য মজুরি দিই। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "sarees", name: "Sarees" }, { slug: "three-piece", name: "Three-piece" }, { slug: "dupattas", name: "Dupattas" }, { slug: "accessories", name: "Accessories" }],
    products: [
      { slug: "jamdani-saree-maroon", title: "Jamdani Saree, Maroon", titleBn: "জামদানি শাড়ি, মেরুন", text: "Fine handwoven cotton jamdani with a gold border.", textBn: "সোনালি পাড়সহ সূক্ষ্ম হাতে বোনা সুতি জামদানি।", price: 6800, compareAt: 7800, cost: 4400, category: "sarees", art: "saree", variants: one, stock: 12, featured: true },
      { slug: "tangail-saree-gold", title: "Tangail Saree, Gold", titleBn: "টাঙ্গাইল শাড়ি, গোল্ড", text: "Soft Tangail cotton with a woven buti pattern.", textBn: "বুটি নকশার নরম টাঙ্গাইল সুতি।", price: 3200, cost: 1900, category: "sarees", art: "saree", tone: "accent", variants: one, stock: 20, featured: true },
      { slug: "silk-saree-ivory", title: "Katan Silk Saree, Ivory", titleBn: "কাতান সিল্ক শাড়ি, আইভরি", text: "A graceful katan silk saree for weddings.", textBn: "বিয়ের জন্য মার্জিত কাতান সিল্ক শাড়ি।", price: 9800, cost: 6500, category: "sarees", art: "saree", colour: { main: "#F1E6D2", accent: "#B8893A" }, variants: one, stock: 8 },
      { slug: "block-print-three-piece", title: "Block Print Three-piece", titleBn: "ব্লক প্রিন্ট থ্রি-পিস", text: "Cotton kameez, salwar and dupatta in a hand block print.", textBn: "হাতে ব্লক প্রিন্ট করা সুতির কামিজ, সালোয়ার ও ওড়না।", price: 2850, compareAt: 3400, cost: 1650, category: "three-piece", art: "dress", variants: sizes(["S", "M", "L"]), stock: 26, featured: true },
      { slug: "embroidered-three-piece", title: "Embroidered Festive Three-piece", titleBn: "এমব্রয়ডারি উৎসবের থ্রি-পিস", text: "Thread embroidery on soft georgette.", textBn: "নরম জর্জেটে সুতার এমব্রয়ডারি।", price: 4600, cost: 2900, category: "three-piece", art: "dress", tone: "accent", variants: sizes(["S", "M", "L"]), stock: 18 },
      { slug: "muslin-dupatta", title: "Muslin Dupatta", titleBn: "মসলিন ওড়না", text: "A light, sheer dupatta with a fine woven edge.", textBn: "সূক্ষ্ম বোনা পাড়ের হালকা স্বচ্ছ ওড়না।", price: 1450, cost: 780, category: "dupattas", art: "scarf", variants: one, stock: 30, featured: true },
      { slug: "nakshi-kantha-shawl", title: "Nakshi Kantha Shawl", titleBn: "নকশী কাঁথা শাল", text: "Hand-stitched kantha shawl for cool evenings.", textBn: "ঠান্ডা সন্ধ্যার জন্য হাতে সেলাই করা কাঁথা শাল।", price: 2400, cost: 1400, category: "dupattas", art: "scarf", tone: "accent", variants: one, stock: 22 },
      { slug: "embroidered-clutch", title: "Embroidered Clutch", titleBn: "এমব্রয়ডারি ক্লাচ", text: "A small festive clutch with zari work.", textBn: "জরির কাজ করা ছোট উৎসবের ক্লাচ।", price: 1250, cost: 640, category: "accessories", art: "bag", variants: one, stock: 28 },
    ],
  },
  {
    id: "maison", host: "maison", storeName: "Maison", storeNameBn: "মেইজন", tagline: "Considered fashion, made in Dhaka",
    palette: { bg: "#EFE6DA", main: "#1C1917", accent: "#8F4A2B", ink: "#1C1917" },
    announcement: { text: "Demo store: free delivery over ৳ 3,000. Easy 7-day exchange.", textBn: "ডেমো স্টোর: ৳ ৩,০০০ এর উপরে ফ্রি ডেলিভারি। ৭ দিনের সহজ এক্সচেঞ্জ।" },
    hero: { eyebrow: "THE NEW EDIT", eyebrowBn: "নতুন সংগ্রহ", title: "Dressed for the occasion", titleBn: "প্রতিটি উপলক্ষের পোশাক", text: "Considered cuts and honest fabrics, from our atelier to your wardrobe.", textBn: "যত্নে কাটা পোশাক, খাঁটি কাপড়, আমাদের কারখানা থেকে আপনার ওয়ার্ডরোবে।", ctaText: "Shop the lookbook", ctaTextBn: "লুকবুক দেখুন", art: ["blazer", "dress", "shirt"] },
    banner: { heading: "The festive edit", headingBn: "উৎসবের সংগ্রহ", text: "Pieces made to be worn, photographed and kept.", textBn: "পরার, ছবি তোলার এবং তুলে রাখার মতো পোশাক।", ctaText: "Explore the edit", ctaTextBn: "সংগ্রহ দেখুন", art: ["kurta", "scarf"] },
    about: { heading: "Made with intent", headingBn: "ভাবনা নিয়ে তৈরি", body: "Small runs, careful fitting and fabrics we would wear ourselves. This is a demo store: products are samples.", bodyBn: "অল্প সংখ্যায় তৈরি, যত্নের ফিটিং এবং নিজেরা পরতে চাইব এমন কাপড়। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "women", name: "Women" }, { slug: "men", name: "Men" }, { slug: "festive", name: "Festive" }, { slug: "accessories", name: "Accessories" }],
    products: [
      { slug: "tailored-blazer-ink", title: "Tailored Blazer, Ink", titleBn: "টেইলর্ড ব্লেজার, কালি", text: "A structured blazer with a half-canvas front.", textBn: "হাফ-ক্যানভাস ফ্রন্টের গড়নওয়ালা ব্লেজার।", price: 7800, compareAt: 8900, cost: 4600, category: "men", art: "blazer", variants: sizes(["S", "M", "L", "XL"]), stock: 18, featured: true },
      { slug: "linen-shirt-sand", title: "Linen Shirt, Sand", titleBn: "লিনেন শার্ট, স্যান্ড", text: "Washed linen that softens with every wear.", textBn: "ধোয়া লিনেন, প্রতিবার পরার সাথে নরম হয়।", price: 2900, cost: 1500, category: "men", art: "shirt", tone: "accent", variants: sizes(["S", "M", "L", "XL"]), stock: 30, featured: true },
      { slug: "wrap-dress-copper", title: "Wrap Dress, Copper", titleBn: "র‍্যাপ ড্রেস, কপার", text: "A fluid wrap dress that moves well and travels light.", textBn: "ঝরঝরে র‍্যাপ ড্রেস, চলাফেরায় আরামদায়ক, ভ্রমণে হালকা।", price: 4600, compareAt: 5400, cost: 2500, category: "women", art: "dress", tone: "accent", variants: sizes(["S", "M", "L"]), stock: 22, featured: true },
      { slug: "pleated-trouser-black", title: "Pleated Trouser, Black", titleBn: "প্লিটেড ট্রাউজার, কালো", text: "A high-waisted pleated trouser with a clean drape.", textBn: "উঁচু কোমরের প্লিটেড ট্রাউজার, পরিচ্ছন্ন ঝুল।", price: 3400, cost: 1800, category: "women", art: "pants", variants: sizes(["S", "M", "L"]), stock: 26 },
      { slug: "festive-kurta-ivory", title: "Festive Kurta, Ivory", titleBn: "উৎসবের কুর্তা, আইভরি", text: "Hand-embroidered neckline on soft cotton silk.", textBn: "নরম কটন সিল্কে হাতে এমব্রয়ডারি করা গলা।", price: 5200, cost: 2900, category: "festive", art: "kurta", colour: { main: "#F1E6D2", accent: "#8F4A2B" }, variants: sizes(["S", "M", "L", "XL"]), stock: 20, featured: true },
      { slug: "silk-scarf-rust", title: "Silk Scarf, Rust", titleBn: "সিল্ক স্কার্ফ, রাস্ট", text: "A printed silk twill scarf, hand-rolled edges.", textBn: "প্রিন্টেড সিল্ক টুইল স্কার্ফ, হাতে গোটানো কিনারা।", price: 1850, cost: 900, category: "festive", art: "scarf", tone: "accent", variants: one, stock: 34 },
      { slug: "leather-tote-tan", title: "Leather Tote, Tan", titleBn: "চামড়ার টোট, ট্যান", text: "A roomy vegetable-tanned leather tote.", textBn: "প্রশস্ত, উদ্ভিজ্জ ট্যান করা চামড়ার টোট।", price: 6400, compareAt: 7200, cost: 3600, category: "accessories", art: "bag", tone: "accent", variants: one, stock: 14 },
      { slug: "everyday-tee-bone", title: "Everyday Tee, Bone", titleBn: "এভরিডে টি, বোন", text: "A heavyweight cotton tee with a relaxed shoulder.", textBn: "ভারী সুতির টি-শার্ট, ঢিলেঢালা কাঁধ।", price: 1250, cost: 600, category: "men", art: "tee", colour: { main: "#E9E2D3", accent: "#8F4A2B" }, variants: sizes(["S", "M", "L", "XL"]), stock: 60 },
    ],
  },
  {
    id: "voltedge", host: "voltedge", storeName: "Voltedge", storeNameBn: "ভোল্টএজ", tagline: "Premium gadgets, tested and warranted",
    palette: { bg: "#16224A", main: "#38BDF8", accent: "#A78BFA", ink: "#0B1B3A" },
    announcement: { text: "Demo store: 1-year warranty on every device. Pay in 3 easy instalments.", textBn: "ডেমো স্টোর: প্রতিটি ডিভাইসে ১ বছরের ওয়ারেন্টি। সহজ ৩ কিস্তিতে পরিশোধ।" },
    hero: { eyebrow: "NEXT GENERATION", eyebrowBn: "পরবর্তী প্রজন্ম", title: "Power your everyday", titleBn: "প্রতিদিনের শক্তি", text: "Flagship audio, fast charging and smart wearables, each one tested before it ships.", textBn: "ফ্ল্যাগশিপ অডিও, ফাস্ট চার্জিং ও স্মার্ট ওয়্যারেবল, প্রতিটি পাঠানোর আগে পরীক্ষা করা।", ctaText: "Shop the drop", ctaTextBn: "নতুন ড্রপ দেখুন", art: ["earbuds", "watch", "powerbank"] },
    banner: { heading: "Charge once, go all week", headingBn: "একবার চার্জে পুরো সপ্তাহ", text: "20,000 mAh power banks with 65 W fast charging and a 1-year warranty.", textBn: "২০,০০০ mAh পাওয়ার ব্যাংক, ৬৫ ওয়াট ফাস্ট চার্জিং ও ১ বছরের ওয়ারেন্টি।", ctaText: "See power", ctaTextBn: "পাওয়ার দেখুন", art: ["powerbank", "cable"] },
    about: { heading: "Tested before it ships", headingBn: "পাঠানোর আগে পরীক্ষা করা", body: "We open, test and seal every device, and keep the receipt for your warranty. This is a demo store: products are samples.", bodyBn: "আমরা প্রতিটি ডিভাইস খুলে পরীক্ষা করে সিল করি এবং ওয়ারেন্টির জন্য রসিদ রাখি। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "audio", name: "Audio" }, { slug: "power", name: "Power" }, { slug: "wearables", name: "Wearables" }, { slug: "accessories", name: "Add-ons" }],
    products: [
      { slug: "aero-anc-earbuds", title: "Aero ANC Earbuds", titleBn: "অ্যারো এএনসি ইয়ারবাডস", text: "Active noise cancelling, 32 hours with the case, IPX5.", textBn: "অ্যাকটিভ নয়েজ ক্যানসেলিং, কেসসহ ৩২ ঘণ্টা, IPX5।", price: 4290, compareAt: 4990, cost: 2600, category: "audio", art: "earbuds", variants: colours(["Black", "Silver"]), stock: 40, featured: true },
      { slug: "pulse-smartwatch", title: "Pulse Smartwatch", titleBn: "পালস স্মার্টওয়াচ", text: "AMOLED display, heart-rate and sleep tracking, 10-day battery.", textBn: "অ্যামোলেড ডিসপ্লে, হার্ট-রেট ও ঘুম ট্র্যাকিং, ১০ দিনের ব্যাটারি।", price: 5990, compareAt: 6990, cost: 3700, category: "wearables", art: "watch", variants: colours(["Graphite", "Silver"]), stock: 26, featured: true },
      { slug: "titan-powerbank-20000", title: "Titan Power Bank 20,000 mAh", titleBn: "টাইটান পাওয়ার ব্যাংক ২০,০০০ mAh", text: "65 W fast charging for phones and laptops, with a digital display.", textBn: "ফোন ও ল্যাপটপের জন্য ৬৫ ওয়াট ফাস্ট চার্জিং, ডিজিটাল ডিসপ্লেসহ।", price: 3490, cost: 2100, category: "power", art: "powerbank", tone: "accent", variants: one, stock: 32, featured: true },
      { slug: "braided-usb-c-cable", title: "Braided USB-C Cable, 1.5 m", titleBn: "ব্রেইডেড ইউএসবি-সি ক্যাবল, ১.৫ মি.", text: "100 W rated, braided nylon, bends 10,000 times.", textBn: "১০০ ওয়াট রেটেড, ব্রেইডেড নাইলন, ১০,০০০ বার বাঁকানো যায়।", price: 650, cost: 280, category: "accessories", art: "cable", variants: one, stock: 150 },
      { slug: "orbit-speaker", title: "Orbit Bluetooth Speaker", titleBn: "অরবিট ব্লুটুথ স্পিকার", text: "360-degree sound, 14 hours of playtime, waterproof.", textBn: "৩৬০ ডিগ্রি সাউন্ড, ১৪ ঘণ্টা প্লেটাইম, ওয়াটারপ্রুফ।", price: 3890, compareAt: 4490, cost: 2300, category: "audio", art: "speaker", tone: "accent", variants: colours(["Midnight", "Sand"]), stock: 22, featured: true },
      { slug: "magsafe-phone-stand", title: "Magnetic Phone Stand", titleBn: "ম্যাগনেটিক ফোন স্ট্যান্ড", text: "Aluminium stand with a magnetic grip and adjustable angle.", textBn: "ম্যাগনেটিক গ্রিপ ও অ্যাডজাস্টেবল অ্যাঙ্গেলসহ অ্যালুমিনিয়াম স্ট্যান্ড।", price: 1190, cost: 520, category: "accessories", art: "phonestand", variants: one, stock: 55 },
      { slug: "slim-powerbank-10000", title: "Slim Power Bank 10,000 mAh", titleBn: "স্লিম পাওয়ার ব্যাংক ১০,০০০ mAh", text: "Pocket-slim, 30 W fast charging, two ports.", textBn: "পকেট-স্লিম, ৩০ ওয়াট ফাস্ট চার্জিং, দুটি পোর্ট।", price: 1990, cost: 1050, category: "power", art: "powerbank", variants: colours(["Black", "Blue"]), stock: 48 },
      { slug: "fit-band-lite", title: "Fit Band Lite", titleBn: "ফিট ব্যান্ড লাইট", text: "Steps, heart rate and sleep in a featherweight band.", textBn: "হালকা ব্যান্ডে স্টেপ, হার্ট-রেট ও ঘুমের হিসাব।", price: 2290, cost: 1300, category: "wearables", art: "watch", tone: "accent", variants: colours(["Black", "Navy"]), stock: 38 },
    ],
  },
  {
    id: "lumiere", host: "lumiere", storeName: "Lumière", storeNameBn: "লুমিয়ের", tagline: "Glow, considered",
    palette: { bg: "#F6E7F1", main: "#7B3FA0", accent: "#E9A8C8", ink: "#2D1B3A" },
    announcement: { text: "Demo store: free sample with every order. Free delivery over ৳ 2,000.", textBn: "ডেমো স্টোর: প্রতিটি অর্ডারে ফ্রি স্যাম্পল। ৳ ২,০০০ এর উপরে ফ্রি ডেলিভারি।" },
    hero: { eyebrow: "THE GLOW EDIT", eyebrowBn: "গ্লো এডিট", title: "Skin that glows from within", titleBn: "ভেতর থেকে উজ্জ্বল ত্বক", text: "Clinically considered skincare, makeup and fragrance, matched to your routine.", textBn: "ত্বকের যত্ন, মেকআপ ও সুগন্ধি, আপনার রুটিন অনুযায়ী বাছাই করা।", ctaText: "Find your routine", ctaTextBn: "আপনার রুটিন খুঁজুন", art: ["serum", "lipstick", "perfume"] },
    banner: { heading: "The 3-step glow routine", headingBn: "৩ ধাপের গ্লো রুটিন", text: "Cleanse, treat and protect, bundled and 15% off.", textBn: "পরিষ্কার, চিকিৎসা ও সুরক্ষা, একসাথে ১৫% ছাড়ে।", ctaText: "Shop the routine", ctaTextBn: "রুটিন দেখুন", art: ["tube", "serum", "jar"] },
    about: { heading: "Ingredients you can read", headingBn: "যে উপাদান আপনি পড়তে পারেন", body: "Short ingredient lists, fragrance-light formulas and honest claims. This is a demo store: products are samples.", bodyBn: "ছোট উপাদান তালিকা, কম সুগন্ধির ফর্মুলা ও সৎ দাবি। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "skincare", name: "Skin" }, { slug: "makeup", name: "Makeup" }, { slug: "fragrance", name: "Scent" }, { slug: "body", name: "Body" }],
    products: [
      { slug: "glow-vitamin-c-serum", title: "Glow Vitamin C Serum", titleBn: "গ্লো ভিটামিন সি সিরাম", text: "A brightening 10% vitamin C serum for dull skin. 30 ml.", textBn: "নিস্তেজ ত্বকের জন্য ১০% ভিটামিন সি উজ্জ্বলতার সিরাম। ৩০ মি.লি.।", price: 1890, compareAt: 2290, cost: 900, category: "skincare", art: "serum", variants: one, stock: 36, featured: true },
      { slug: "barrier-night-cream", title: "Barrier Night Cream", titleBn: "ব্যারিয়ার নাইট ক্রিম", text: "A rich ceramide night cream that repairs while you sleep. 50 ml.", textBn: "ঘুমের সময় মেরামত করে এমন ঘন সিরামাইড নাইট ক্রিম। ৫০ মি.লি.।", price: 1590, cost: 780, category: "skincare", art: "jar", tone: "accent", variants: one, stock: 30, featured: true },
      { slug: "gentle-gel-cleanser", title: "Gentle Gel Cleanser", titleBn: "জেন্টল জেল ক্লিনজার", text: "A soap-free gel that cleans without tightness. 150 ml.", textBn: "টান না ধরানো সাবানমুক্ত জেল। ১৫০ মি.লি.।", price: 990, cost: 420, category: "skincare", art: "tube", variants: one, stock: 60 },
      { slug: "velvet-matte-lipstick", title: "Velvet Matte Lipstick, Orchid", titleBn: "ভেলভেট ম্যাট লিপস্টিক, অর্কিড", text: "A comfortable matte lipstick that lasts through lunch.", textBn: "দুপুরের খাবার পর্যন্ত টেকে এমন আরামদায়ক ম্যাট লিপস্টিক।", price: 1190, compareAt: 1390, cost: 520, category: "makeup", art: "lipstick", tone: "accent", variants: [{ title: "Orchid", options: { Shade: "Orchid" } }, { title: "Rose", options: { Shade: "Rose" } }, { title: "Berry", options: { Shade: "Berry" } }], stock: 44, featured: true },
      { slug: "pearl-eyeshadow-palette", title: "Pearl Eyeshadow Palette", titleBn: "পার্ল আইশ্যাডো প্যালেট", text: "Four pearlescent shades from champagne to plum.", textBn: "শ্যাম্পেন থেকে প্লাম, চারটি পার্ল শেড।", price: 1790, cost: 860, category: "makeup", art: "palette", variants: one, stock: 28, featured: true },
      { slug: "lumiere-eau-de-parfum", title: "Lumière Eau de Parfum", titleBn: "লুমিয়ের ইউ দ্য পারফিউম", text: "Iris, pear and white musk, 50 ml. Soft enough for every day.", textBn: "আইরিস, পিয়ার ও হোয়াইট মাস্ক, ৫০ মি.লি.। প্রতিদিনের জন্য নরম।", price: 3290, cost: 1700, category: "fragrance", art: "perfume", variants: one, stock: 20 },
      { slug: "silk-body-lotion", title: "Silk Body Lotion", titleBn: "সিল্ক বডি লোশন", text: "A fast-absorbing lotion with shea and almond oil. 250 ml.", textBn: "শিয়া ও আমন্ড অয়েলের দ্রুত শোষিত লোশন। ২৫০ মি.লি.।", price: 890, cost: 380, category: "body", art: "tube", tone: "accent", variants: one, stock: 54 },
      { slug: "rose-hand-balm", title: "Rose Hand Balm", titleBn: "রোজ হ্যান্ড বাম", text: "A rich hand balm in a travel jar. 40 ml.", textBn: "ট্রাভেল জারে ঘন হ্যান্ড বাম। ৪০ মি.লি.।", price: 650, cost: 270, category: "body", art: "jar", variants: one, stock: 70 },
    ],
  },
  {
    id: "harvest", host: "harvest", storeName: "Harvest", storeNameBn: "হারভেস্ট", tagline: "Farm-fresh food, delivered in your slot",
    palette: { bg: "#FDE9B8", main: "#B45309", accent: "#FBBF24", ink: "#231A0F" },
    announcement: { text: "Demo store: pick your delivery slot at checkout. Free delivery over ৳ 1,500.", textBn: "ডেমো স্টোর: চেকআউটে ডেলিভারির সময় বেছে নিন। ৳ ১,৫০০ এর উপরে ফ্রি ডেলিভারি।" },
    hero: { eyebrow: "FARM TO TABLE", eyebrowBn: "খামার থেকে টেবিলে", title: "Fresh food, on your schedule", titleBn: "তাজা খাবার, আপনার সময়মতো", text: "Honey, ghee, spices and pantry staples from trusted farms, delivered in the slot you choose.", textBn: "বিশ্বস্ত খামারের মধু, ঘি, মসলা ও মুদি পণ্য, আপনার বেছে নেওয়া সময়ে ডেলিভারি।", ctaText: "Fill your basket", ctaTextBn: "ঝুড়ি ভরুন", art: ["jar", "sack", "bottle"] },
    banner: { heading: "The weekly basket, 10% off", headingBn: "সাপ্তাহিক ঝুড়ি, ১০% ছাড়ে", text: "Subscribe to your staples and we deliver them every week. Pause or cancel any time.", textBn: "নিয়মিত পণ্যে সাবস্ক্রাইব করুন, প্রতি সপ্তাহে পৌঁছে দেব। যেকোনো সময় থামান বা বাতিল করুন।", ctaText: "Build my basket", ctaTextBn: "আমার ঝুড়ি বানান", art: ["sack", "jar"] },
    about: { heading: "Know your farmer", headingBn: "আপনার কৃষককে চিনুন", body: "We buy directly from small farms and pack in clean, sealed pouches. This is a demo store: products are samples.", bodyBn: "আমরা ছোট খামার থেকে সরাসরি কিনি এবং পরিষ্কার সিল করা প্যাকেটে দিই। এটি একটি ডেমো স্টোর: পণ্যগুলো নমুনা।" },
    categories: [{ slug: "honey-ghee", name: "Honey" }, { slug: "spices", name: "Spices" }, { slug: "staples", name: "Staples" }, { slug: "oils-tea", name: "Oils" }],
    products: [
      { slug: "litchi-blossom-honey", title: "Litchi Blossom Honey", titleBn: "লিচু ফুলের মধু", text: "Light, floral honey from Dinajpur orchards.", textBn: "দিনাজপুরের বাগানের হালকা, ফুলেল মধু।", price: 720, compareAt: 850, cost: 420, category: "honey-ghee", art: "jar", variants: weights(["250 g", "500 g"]), stock: 40, featured: true },
      { slug: "forest-wild-honey", title: "Forest Wild Honey", titleBn: "বনের খাঁটি মধু", text: "Dark, rich honey with a gentle smoky note.", textBn: "গাঢ়, ঘন মধু, হালকা ধোঁয়াটে স্বাদ।", price: 1050, cost: 640, category: "honey-ghee", art: "jar", tone: "accent", variants: weights(["250 g", "500 g"]), stock: 26, featured: true },
      { slug: "a2-desi-ghee", title: "A2 Desi Ghee", titleBn: "এ২ দেশি ঘি", text: "Slow-cooked ghee from grass-fed cows.", textBn: "ঘাস খাওয়া গরুর দুধের ধীরে জ্বালানো ঘি।", price: 1480, cost: 980, category: "honey-ghee", art: "jar", variants: weights(["250 g", "500 g"]), stock: 30 },
      { slug: "kashmiri-chilli-powder", title: "Kashmiri Chilli Powder", titleBn: "কাশ্মীরি মরিচ গুঁড়া", text: "Deep red colour with a mild heat. Stone-ground.", textBn: "গাঢ় লাল রঙ, মৃদু ঝাল। পাথরে পেষা।", price: 260, cost: 140, category: "spices", art: "box", tone: "accent", variants: weights(["100 g", "250 g"]), stock: 80, featured: true },
      { slug: "whole-cumin", title: "Whole Cumin", titleBn: "আস্ত জিরা", text: "Aromatic whole cumin, cleaned and sun-dried.", textBn: "সুগন্ধি আস্ত জিরা, পরিষ্কার ও রোদে শুকানো।", price: 210, compareAt: 250, cost: 120, category: "spices", art: "box", variants: weights(["100 g", "250 g"]), stock: 90 },
      { slug: "basmati-rice-premium", title: "Premium Basmati Rice", titleBn: "প্রিমিয়াম বাসমতি চাল", text: "Long, fragrant grains aged for a year.", textBn: "এক বছর পুরোনো লম্বা সুগন্ধি দানা।", price: 1250, cost: 980, category: "staples", art: "sack", variants: weights(["2 kg", "5 kg"]), stock: 50, featured: true },
      { slug: "moong-dal-split", title: "Split Moong Dal", titleBn: "মুগ ডাল", text: "Clean, quick-cooking and easy to digest.", textBn: "পরিষ্কার, দ্রুত সেদ্ধ ও সহজে হজম।", price: 190, cost: 130, category: "staples", art: "sack", tone: "accent", variants: weights(["1 kg", "2 kg"]), stock: 90 },
      { slug: "cold-pressed-mustard-oil", title: "Cold-pressed Mustard Oil", titleBn: "কোল্ড-প্রেসড সরিষার তেল", text: "Pungent, single-pressed mustard oil. 1 litre.", textBn: "ঝাঁঝালো, একবার ঘানিতে পেষা সরিষার তেল। ১ লিটার।", price: 520, cost: 340, category: "oils-tea", art: "bottle", variants: one, stock: 60 },
    ],
  },
] as const;

export const demoTemplate = (id: string): DemoTemplate | undefined =>
  DEMO_TEMPLATES.find((t) => t.id === id || t.host === id || t.id.replace(/-/g, "") === id.replace(/-/g, ""));
