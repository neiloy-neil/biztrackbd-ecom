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
] as const;

export const demoTemplate = (id: string): DemoTemplate | undefined => DEMO_TEMPLATES.find((t) => t.id === id);
