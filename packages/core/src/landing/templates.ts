import { newSectionId, normalizeSettings, sectionDef, validatePage, type PageJson, type PageSection } from "../builder/registry";

/**
 * The landing page templates a merchant starts from (docs/46). Each one is a layout of the landing sections with original English and Bangla
 * starting text for a kind of product. Nothing here is a real customer's words: there is no review text in any template, because a review
 * must be something a customer actually wrote. Pictures are left empty for the merchant to add. The countdown starts without a date, so
 * it stays hidden until the merchant sets a date the offer truly ends on.
 */

export interface LandingTemplate {
  id: string;
  name: string;
  nameBn: string;
  blurb: string;
  page: PageJson;
}

type Pair = [en: string, bn: string];
interface Seed {
  id: string;
  name: Pair;
  blurb: string;
  badge: Pair;
  headline: Pair;
  subhead: Pair;
  benefitsTitle: Pair;
  benefits: [Pair, Pair][];
  split: { title: Pair; text: Pair; side?: "left" | "right" }[];
  faqs: [Pair, Pair][];
  /** Shows the price bar and the stock line before the order form (food, gadgets and combos usually want both). */
  urgency?: boolean;
}

const en = (p: Pair) => p[0];
const bn = (p: Pair) => p[1];

/** How a template looks and flows beyond its words: its colour style, its moving strip, and the order its blocks come in (docs/48). */
interface Style {
  palette: string;
  marquee: Pair[];
  layout: ("marquee" | "benefits" | "split0" | "split1" | "compare" | "steps" | "video" | "gallery" | "screens" | "urgency" | "faq")[];
  compare?: { title: Pair; bad: Pair; good: Pair; rows: [Pair, Pair][] };
  steps?: { title: Pair; items: [Pair, Pair][] };
}

const STEP_ORDER: Style["steps"] = {
  title: ["How to order", "কীভাবে অর্ডার করবেন"],
  items: [[["Fill the form", "ফর্ম পূরণ করুন"], ["Your name, number and address. It takes one minute.", "নাম, নম্বর ও ঠিকানা দিন। এক মিনিটও লাগে না।"]], [["We call you", "আমরা ফোন করি"], ["A short call to confirm your order.", "অর্ডার নিশ্চিত করতে ছোট একটি কল।"]], [["Pay on delivery", "হাতে পেয়ে টাকা দিন"], ["Check the parcel, then pay the courier.", "পণ্য দেখে তারপর কুরিয়ারকে টাকা দিন।"]]],
};

function build(seed: Seed): LandingTemplate {
  const st = STYLES[seed.id]!;
  const n = new Map<string, number>();
  const sec = (type: string, settings: Record<string, unknown>): PageSection => {
    const i = (n.get(type) ?? 0) + 1;
    n.set(type, i);
    return { id: `${type.replace(/-/g, "_")}_${i}`, type, settings: normalizeSettings(sectionDef(type)!, settings) };
  };
  const splitOf = (k: number): PageSection[] => (seed.split[k] ? [sec("lp-split", { title: en(seed.split[k]!.title), titleBn: bn(seed.split[k]!.title), text: en(seed.split[k]!.text), textBn: bn(seed.split[k]!.text), side: seed.split[k]!.side ?? (k % 2 === 0 ? "right" : "left"), ctaText: k === 0 ? "Order now" : "", ctaTextBn: k === 0 ? "অর্ডার করুন" : "" })] : []);
  const blocks: Record<string, () => PageSection[]> = {
    marquee: () => [sec("lp-marquee", { items: st.marquee.map((m) => ({ text: en(m), textBn: bn(m) })) })],
    benefits: () => [sec("lp-benefits", { title: en(seed.benefitsTitle), titleBn: bn(seed.benefitsTitle), items: seed.benefits.map(([t, x]) => ({ title: en(t), titleBn: bn(t), text: en(x), textBn: bn(x) })) })],
    split0: () => splitOf(0),
    split1: () => splitOf(1),
    compare: () => (st.compare ? [sec("lp-compare", { title: en(st.compare.title), titleBn: bn(st.compare.title), badTitle: en(st.compare.bad), badTitleBn: bn(st.compare.bad), goodTitle: en(st.compare.good), goodTitleBn: bn(st.compare.good), items: st.compare.rows.map(([b, g]) => ({ bad: en(b), badBn: bn(b), good: en(g), goodBn: bn(g) })) })] : []),
    steps: () => (st.steps ? [sec("lp-steps", { title: en(st.steps.title), titleBn: bn(st.steps.title), items: st.steps.items.map(([t, x]) => ({ title: en(t), titleBn: bn(t), text: en(x), textBn: bn(x) })) })] : []),
    video: () => [sec("lp-video", {})],
    gallery: () => [sec("lp-gallery", {})],
    // Room for the merchant's real customer messages. Empty, it is not shown: no template invents a review.
    screens: () => [sec("lp-screens", {})],
    urgency: () => [sec("lp-offer-bar", {}), sec("lp-stock", {}), sec("lp-countdown", {})],
    faq: () => [sec("lp-faq", { title: "Questions", titleBn: "প্রশ্ন", items: seed.faqs.map(([q, a]) => ({ q: en(q), qBn: bn(q), a: en(a), aBn: bn(a) })) })],
  };
  const sections: PageSection[] = [
    sec("lp-header", { palette: st.palette }),
    sec("lp-hero", { badge: en(seed.badge), badgeBn: bn(seed.badge), headline: en(seed.headline), headlineBn: bn(seed.headline), subhead: en(seed.subhead), subheadBn: bn(seed.subhead), ctaText: "Order now", ctaTextBn: "অর্ডার করতে চাই" }),
    ...st.layout.flatMap((k) => blocks[k]!()),
    sec("lp-order-form", {}),
    sec("lp-sticky-cta", {}),
  ];
  // Fail loudly in tests, never in a merchant's hands: a template that does not validate is a bug in this file.
  const page = validatePage("landing", { version: 1, sections });
  return { id: seed.id, name: en(seed.name), nameBn: bn(seed.name), blurb: seed.blurb, page };
}

const DELIVERY: [Pair, Pair] = [["How long does delivery take?", "ডেলিভারি পেতে কত সময় লাগে?"], ["1 to 2 days inside Dhaka and 3 to 4 days outside. We call you before we send it.", "ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ৩-৪ দিন। পাঠানোর আগে আমরা ফোন করি।"]];
const PAY: [Pair, Pair] = [["How do I pay?", "দাম কীভাবে দেব?"], ["Pay in cash when the parcel reaches your hand. You pay nothing now.", "পণ্য হাতে পেয়ে ক্যাশে দাম দিন। এখন কোনো টাকা দিতে হবে না।"]];
const RETURN: [Pair, Pair] = [["What if it is not what I ordered?", "অর্ডারের সাথে না মিললে কী হবে?"], ["Check the parcel when it arrives. If something is wrong, tell us the same day and we will sort it out.", "পণ্য পেয়ে দেখে নিন। কোনো সমস্যা হলে সেদিনই জানান, আমরা সমাধান করব।"]];

const SEEDS: Seed[] = [
  {
    id: "fashion", name: ["Clothing and fashion", "পোশাক ও ফ্যাশন"], blurb: "Panjabi, shirts, three-piece, bags. Pictures first, size and colour on the form.",
    badge: ["Cash on delivery", "ক্যাশ অন ডেলিভারি"], headline: ["Look good, feel easy, every day", "প্রতিদিন স্টাইলিশ, প্রতিদিন আরামদায়ক"],
    subhead: ["Soft fabric, a clean fit and a price that makes sense. See the pictures, pick your size, pay when it arrives.", "নরম কাপড়, সুন্দর ফিটিং, ন্যায্য দাম। ছবি দেখুন, সাইজ বেছে নিন, হাতে পেয়ে দাম দিন।"],
    benefitsTitle: ["Why you will like it", "কেন পছন্দ করবেন"],
    benefits: [[["Comfortable fabric", "আরামদায়ক কাপড়"], ["Breathable and soft on the skin, all day.", "সারাদিন পরার মতো নরম ও বাতাস চলাচলের কাপড়।"]], [["True to size", "সঠিক সাইজ"], ["Check the size chart before you order.", "অর্ডারের আগে সাইজ চার্ট দেখে নিন।"]], [["Neat stitching", "সুন্দর সেলাই"], ["Checked by hand before every parcel leaves.", "প্রতিটি পার্সেল পাঠানোর আগে হাতে দেখা হয়।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Open the parcel, then pay.", "পার্সেল দেখে তারপর টাকা দিন।"]]],
    split: [{ title: ["The details that matter", "যে বিষয়গুলো গুরুত্বপূর্ণ"], text: ["Write the fabric, the colours and the sizes you have, in two or three short lines.", "কাপড়ের ধরন, রঙ আর কোন কোন সাইজ আছে, দুই-তিন লাইনে লিখুন।"] }],
    faqs: [DELIVERY, PAY, [["Can I change the size?", "সাইজ বদলানো যাবে?"], ["Yes, tell us the same day it arrives.", "হ্যাঁ, পণ্য পাওয়ার দিনই জানান।"]], RETURN], urgency: true,
  },
  {
    id: "food", name: ["Food, honey and dates", "খাবার, মধু ও খেজুর"], blurb: "Pure food with a story: where it comes from, how it is made, how to use it.",
    badge: ["Fresh and pure", "খাঁটি ও তাজা"], headline: ["Pure taste, straight from the source", "খাঁটি স্বাদ, সরাসরি উৎস থেকে"],
    subhead: ["No mixing, no shortcuts. Order a jar, taste it, and you will order again.", "কোনো ভেজাল নয়, কোনো শর্টকাট নয়। একবার খেয়ে দেখুন, আবার অর্ডার করবেন।"],
    benefitsTitle: ["What makes it special", "কেন এটা আলাদা"],
    benefits: [[["Nothing added", "কিছু মেশানো নয়"], ["Just the food, as it should be.", "শুধু খাবারটাই, যেমন হওয়া উচিত।"]], [["Packed fresh", "তাজা প্যাকিং"], ["Sealed in clean packs before it ships.", "পাঠানোর আগে পরিষ্কারভাবে সিল করা।"]], [["Good for the family", "পুরো পরিবারের জন্য"], ["Every age at the table can enjoy it.", "টেবিলের সবাই খেতে পারেন।"]], [["See it, then pay", "দেখে তারপর টাকা"], ["Cash on delivery across Bangladesh.", "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["Where it comes from", "কোথা থেকে আসে"], text: ["Tell the story of the place and the people behind it. Customers trust food they can picture.", "কোথা থেকে আসে আর কারা বানায় সেই গল্প লিখুন। ক্রেতারা ভরসা করে যা তারা কল্পনা করতে পারে।"] }, { title: ["How to enjoy it", "কীভাবে খাবেন"], text: ["Give two or three ways to use it: with tea, in cooking, as a gift.", "দুই-তিনটি উপায় লিখুন: চায়ের সাথে, রান্নায়, উপহারে।"] }],
    faqs: [DELIVERY, PAY, [["How long does it stay good?", "কতদিন ভালো থাকে?"], ["Write the shelf life here and how to store it.", "এখানে মেয়াদ ও সংরক্ষণের নিয়ম লিখুন।"]]], urgency: true,
  },
  {
    id: "gadget", name: ["Electronics and gadgets", "ইলেকট্রনিক্স ও গ্যাজেট"], blurb: "Watches, earbuds, trimmers, fans. Features, a video and the warranty up front.",
    badge: ["Warranty included", "ওয়ারেন্টি সহ"], headline: ["Small gadget, big difference", "ছোট গ্যাজেট, বড় সুবিধা"],
    subhead: ["Does the job every day and lasts. See it work in the video, then order with cash on delivery.", "প্রতিদিনের কাজ সহজ করে, টেকসই। ভিডিওতে দেখুন, তারপর ক্যাশ অন ডেলিভারিতে অর্ডার করুন।"],
    benefitsTitle: ["Main features", "মূল সুবিধা"],
    benefits: [[["Easy to use", "ব্যবহার সহজ"], ["Works out of the box. No set-up needed.", "বক্স খুলেই চালানো যায়।"]], [["Built to last", "টেকসই"], ["Solid build for daily use.", "প্রতিদিন ব্যবহারের উপযোগী মজবুত গঠন।"]], [["Warranty", "ওয়ারেন্টি"], ["Write the warranty period and how to claim it.", "ওয়ারেন্টির সময় ও দাবি করার নিয়ম লিখুন।"]], [["Test, then pay", "পরীক্ষা করে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["What is in the box", "বক্সে কী কী আছে"], text: ["List everything the customer gets: the device, cable, charger, manual.", "ক্রেতা যা যা পাবেন তার তালিকা: ডিভাইস, ক্যাবল, চার্জার, ম্যানুয়াল।"] }, { title: ["Specifications", "বিস্তারিত তথ্য"], text: ["Size, battery, power and anything a careful buyer wants to check.", "সাইজ, ব্যাটারি, পাওয়ার, আর যা যা একজন সচেতন ক্রেতা জানতে চান।"] }],
    faqs: [PAY, DELIVERY, [["Is there a warranty?", "ওয়ারেন্টি আছে?"], ["Write the warranty here and the number to call.", "এখানে ওয়ারেন্টি আর ফোন নম্বর লিখুন।"]], RETURN], urgency: true,
  },
  {
    id: "beauty", name: ["Beauty and skin care", "বিউটি ও স্কিন কেয়ার"], blurb: "Serums, soaps, perfumes. Gentle, clean look with how-to-use steps.",
    badge: ["Gentle on skin", "ত্বকের জন্য কোমল"], headline: ["Care your skin deserves", "আপনার ত্বকের প্রাপ্য যত্ন"],
    subhead: ["A simple routine with ingredients you can read. Order today and start this week.", "পরিষ্কার উপাদানের সহজ রুটিন। আজই অর্ডার করুন, এই সপ্তাহেই শুরু করুন।"],
    benefitsTitle: ["What you get", "যা পাবেন"],
    benefits: [[["Simple ingredients", "সহজ উপাদান"], ["List the key ingredients in plain words.", "মূল উপাদানগুলো সহজ ভাষায় লিখুন।"]], [["Easy routine", "সহজ রুটিন"], ["A minute morning and night.", "সকাল-সন্ধ্যায় এক মিনিট।"]], [["Skin tested", "ত্বকে পরীক্ষিত"], ["Say only what is true for your product.", "আপনার পণ্য সম্পর্কে শুধু সত্য কথাই লিখুন।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["How to use", "ব্যবহারের নিয়ম"], text: ["Step 1, step 2, step 3. Short and clear.", "ধাপ ১, ধাপ ২, ধাপ ৩। ছোট ও পরিষ্কার।"] }],
    faqs: [[["Is it safe for sensitive skin?", "সংবেদনশীল ত্বকে ব্যবহার করা যাবে?"], ["Write what is true. If unsure, advise a small test first.", "যা সত্য তাই লিখুন। নিশ্চিত না হলে আগে অল্প জায়গায় পরীক্ষা করতে বলুন।"]], DELIVERY, PAY],
  },
  {
    id: "kitchen", name: ["Home and kitchen", "ঘর ও রান্নাঘর"], blurb: "Grinders, tables, organisers. Show the problem it solves, then the product.",
    badge: ["Makes work easier", "কাজ সহজ করে"], headline: ["The helper every home needs", "প্রতিটি ঘরের দরকারি সহায়ক"],
    subhead: ["Save time and effort every day. Look at the pictures, then order and pay at your door.", "প্রতিদিন সময় ও পরিশ্রম বাঁচান। ছবি দেখুন, অর্ডার করুন, দরজায় দাম দিন।"],
    benefitsTitle: ["Why families choose it", "কেন পরিবারগুলো এটা বেছে নেয়"],
    benefits: [[["Saves time", "সময় বাঁচায়"], ["What took ten minutes now takes one.", "যে কাজে দশ মিনিট লাগত এখন এক মিনিট।"]], [["Easy to clean", "পরিষ্কার করা সহজ"], ["Wipe it, rinse it, done.", "মুছে বা ধুয়ে নিলেই হলো।"]], [["Strong and safe", "মজবুত ও নিরাপদ"], ["Built for daily use.", "প্রতিদিন ব্যবহারের জন্য তৈরি।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["See it at work", "কাজ করতে দেখুন"], text: ["Describe one real situation where it helps, in your customer's words.", "ক্রেতার ভাষায় একটি বাস্তব পরিস্থিতি লিখুন যেখানে এটি কাজে লাগে।"] }, { title: ["Size and power", "সাইজ ও ক্ষমতা"], text: ["Give the measurements and what it can handle.", "মাপ আর কতটা কাজ সামলাতে পারে লিখুন।"] }],
    faqs: [PAY, DELIVERY, RETURN],
  },
  {
    id: "kids", name: ["Books and kids", "বই ও শিশু"], blurb: "Story books, toys, learning sets. Warm look, parents' questions answered.",
    badge: ["For little ones", "ছোটদের জন্য"], headline: ["Something good for your child", "আপনার সন্তানের জন্য ভালো কিছু"],
    subhead: ["Made for young minds. Safe, bright and easy to enjoy together.", "ছোট মনের জন্য তৈরি। নিরাপদ, রঙিন, একসাথে উপভোগ করার মতো।"],
    benefitsTitle: ["What parents like", "অভিভাবকরা যা পছন্দ করেন"],
    benefits: [[["Age-friendly", "বয়স উপযোগী"], ["Say which ages it is made for.", "কোন বয়সের জন্য তা লিখুন।"]], [["Safe materials", "নিরাপদ উপকরণ"], ["Only claim what is true.", "যা সত্য শুধু তাই লিখুন।"]], [["Learn while playing", "খেলতে খেলতে শেখা"], ["Say what a child learns.", "শিশু কী শিখবে লিখুন।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["What is inside", "ভেতরে কী আছে"], text: ["Number of pages, pieces or stories, and what makes it special.", "পৃষ্ঠা, টুকরো বা গল্পের সংখ্যা আর বিশেষত্ব।"] }],
    faqs: [[["What age is it for?", "কোন বয়সের জন্য?"], ["Write the age range.", "বয়সের সীমা লিখুন।"]], DELIVERY, PAY],
  },
  {
    id: "watch", name: ["Watches and accessories", "ঘড়ি ও অ্যাকসেসরিজ"], blurb: "Watches, belts, wallets, bags. A bold hero and close-up pictures.",
    badge: ["New in", "নতুন এসেছে"], headline: ["The finishing touch to every outfit", "প্রতিটি পোশাকের শেষ ছোঁয়া"],
    subhead: ["Clean design that goes with work, family and Eid. Look closely, then order.", "অফিস, পরিবার আর ঈদ, সবকিছুর সাথে মানানসই ডিজাইন। ভালো করে দেখুন, তারপর অর্ডার করুন।"],
    benefitsTitle: ["Good to know", "জেনে রাখুন"],
    benefits: [[["Looks premium", "দেখতে আভিজাত্যপূর্ণ"], ["Describe the finish and the colours.", "ফিনিশিং আর রঙের বর্ণনা দিন।"]], [["Comfortable to wear", "পরতে আরামদায়ক"], ["Light, adjustable, easy on the skin.", "হালকা, অ্যাডজাস্টেবল, ত্বকের জন্য আরামদায়ক।"]], [["Gift ready", "উপহারের জন্য তৈরি"], ["Arrives in clean packing.", "পরিষ্কার প্যাকিংয়ে আসে।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["Close up", "কাছ থেকে দেখুন"], text: ["Add large pictures from different angles and say what to look at.", "বিভিন্ন কোণ থেকে বড় ছবি দিন আর কী দেখবেন তা লিখুন।"] }],
    faqs: [PAY, DELIVERY, RETURN], urgency: true,
  },
  {
    id: "combo", name: ["Combo and family pack", "কম্বো ও ফ্যামিলি প্যাক"], blurb: "Sell packs of two, three or a family set at a better price per piece.",
    badge: ["Save more in a pack", "প্যাকে বেশি সাশ্রয়"], headline: ["Buy together, pay less", "একসাথে কিনুন, কম দিন"],
    subhead: ["The more you take, the more you save. Pick your pack below and we deliver it to your door.", "যত বেশি নেবেন, তত বেশি সাশ্রয়। নিচে আপনার প্যাক বেছে নিন, আমরা দরজায় পৌঁছে দেব।"],
    benefitsTitle: ["What is in the pack", "প্যাকে কী আছে"],
    benefits: [[["Better price per piece", "প্রতি পিসে কম দাম"], ["Set a deal on each pack in the offers.", "অফারে প্রতিটি প্যাকে ডিল দিন।"]], [["Everything together", "সব একসাথে"], ["One parcel, one delivery charge.", "একটি পার্সেল, একটি ডেলিভারি চার্জ।"]], [["Good for gifts", "উপহারের জন্য ভালো"], ["Share with family or friends.", "পরিবার বা বন্ধুদের সাথে ভাগ করুন।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["Choose your pack", "আপনার প্যাক বেছে নিন"], text: ["Explain the packs in plain words: what each one contains and who it suits.", "প্যাকগুলো সহজ ভাষায় বুঝিয়ে দিন: কোনটায় কী আছে আর কার জন্য উপযোগী।"] }],
    faqs: [DELIVERY, PAY, [["Can I mix products in a pack?", "প্যাকে আলাদা পণ্য মেশানো যাবে?"], ["Write what is possible and how to ask.", "কী সম্ভব আর কীভাবে জানাতে হবে লিখুন।"]]], urgency: true,
  },
  {
    id: "health", name: ["Health and herbal", "স্বাস্থ্য ও ভেষজ"], blurb: "Herbal powders, oils, supplements. Careful wording and honest use notes.",
    badge: ["Natural", "প্রাকৃতিক"], headline: ["Natural care for every day", "প্রতিদিনের জন্য প্রাকৃতিক যত্ন"],
    subhead: ["A natural product, prepared with care. Read how to use it and what to expect.", "যত্ন নিয়ে তৈরি একটি প্রাকৃতিক পণ্য। কীভাবে ব্যবহার করবেন আর কী আশা করবেন তা পড়ুন।"],
    benefitsTitle: ["About the product", "পণ্য সম্পর্কে"],
    benefits: [[["Natural source", "প্রাকৃতিক উৎস"], ["Say what it is made from.", "কী দিয়ে তৈরি তা লিখুন।"]], [["Clear directions", "পরিষ্কার নির্দেশনা"], ["How much, how often.", "কতটা, কতবার।"]], [["Clean packing", "পরিষ্কার প্যাকিং"], ["Sealed for freshness.", "তাজা রাখতে সিল করা।"]], [["Pay on delivery", "হাতে পেয়ে টাকা"], ["Cash on delivery.", "ক্যাশ অন ডেলিভারি।"]]],
    split: [{ title: ["How to use it", "ব্যবহারের নিয়ম"], text: ["Give clear directions. Do not promise a cure; say what it is and how people use it.", "পরিষ্কার নির্দেশনা দিন। রোগ সারানোর প্রতিশ্রুতি দেবেন না; এটি কী আর মানুষ কীভাবে ব্যবহার করে তা লিখুন।"] }],
    faqs: [[["Is it for everyone?", "এটা কি সবার জন্য?"], ["Add a note: ask a doctor if pregnant, on medicine, or unsure.", "নোট দিন: গর্ভবতী, ওষুধ সেবনরত বা অনিশ্চিত হলে ডাক্তারের পরামর্শ নিন।"]], DELIVERY, PAY],
  },
  {
    id: "minimal", name: ["Minimal, any product", "সাধারণ, যেকোনো পণ্য"], blurb: "The simplest page: headline, benefits, pictures and the order form.",
    badge: ["Cash on delivery", "ক্যাশ অন ডেলিভারি"], headline: ["Your product, clearly explained", "আপনার পণ্য, পরিষ্কারভাবে"],
    subhead: ["Say in one sentence what it is and who it is for.", "এক বাক্যে লিখুন এটি কী আর কার জন্য।"],
    benefitsTitle: ["Why buy", "কেন কিনবেন"],
    benefits: [[["Reason one", "প্রথম কারণ"], ["A short line.", "ছোট একটি লাইন।"]], [["Reason two", "দ্বিতীয় কারণ"], ["A short line.", "ছোট একটি লাইন।"]], [["Reason three", "তৃতীয় কারণ"], ["A short line.", "ছোট একটি লাইন।"]]],
    split: [],
    faqs: [DELIVERY, PAY],
  },
];

const STYLES: Record<string, Style> = {
  fashion: {
    palette: "navy", marquee: [["New arrivals every week", "প্রতি সপ্তাহে নতুন কালেকশন"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"], ["Size exchange available", "সাইজ বদলের সুবিধা"]],
    layout: ["marquee", "benefits", "split0", "gallery", "compare", "screens", "urgency", "faq"],
    compare: { title: ["Why you will like it", "কেন পছন্দ হবে"], bad: ["Ordinary", "সাধারণ"], good: ["Ours", "আমাদের"], rows: [[["Thin, rough fabric", "পাতলা, খসখসে কাপড়"], ["Soft, breathable fabric", "নরম, আরামদায়ক কাপড়"]], [["Loose stitches", "ঢিলে সেলাই"], ["Neat, strong stitching", "পরিপাটি, মজবুত সেলাই"]], [["Hard to exchange", "বদল করা কঠিন"], ["Easy size exchange", "সহজে সাইজ বদল"]]] },
  },
  food: {
    palette: "sunny", marquee: [["Fresh and pure", "খাঁটি ও তাজা"], ["Packed clean", "পরিষ্কারভাবে প্যাক করা"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"], ["Delivery all over Bangladesh", "সারা বাংলাদেশে ডেলিভারি"]],
    layout: ["marquee", "split0", "benefits", "split1", "steps", "screens", "urgency", "faq"], steps: STEP_ORDER,
  },
  gadget: {
    palette: "night", marquee: [["Warranty included", "ওয়ারেন্টি সহ"], ["Test it, then pay", "দেখে নিয়ে তারপর টাকা"], ["Fast delivery", "দ্রুত ডেলিভারি"]],
    layout: ["video", "benefits", "split0", "compare", "split1", "screens", "urgency", "faq"],
    compare: { title: ["Compare and see", "তুলনা করে দেখুন"], bad: ["Cheap copies", "নকল পণ্য"], good: ["Ours", "আমাদের"], rows: [[["Breaks in weeks", "কয়েক সপ্তাহেই নষ্ট"], ["Built for daily use", "প্রতিদিনের ব্যবহারের জন্য তৈরি"]], [["No warranty", "ওয়ারেন্টি নেই"], ["Warranty and support", "ওয়ারেন্টি ও সহায়তা"]], [["Pay first, hope later", "আগে টাকা, পরে ভরসা"], ["Pay when it arrives", "হাতে পেয়ে টাকা"]]] },
  },
  beauty: {
    palette: "rose", marquee: [["Gentle on skin", "ত্বকের জন্য কোমল"], ["Simple routine", "সহজ রুটিন"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "benefits", "steps", "split0", "gallery", "screens", "faq"],
    steps: { title: ["How to use", "ব্যবহারের নিয়ম"], items: [[["Clean", "পরিষ্কার করুন"], ["Wash your face and pat it dry.", "মুখ ধুয়ে শুকিয়ে নিন।"]], [["Apply", "লাগান"], ["A small amount, gently, morning and night.", "অল্প পরিমাণে, আলতো করে, সকাল-সন্ধ্যায়।"]], [["Be regular", "নিয়মিত থাকুন"], ["Use it every day to see the difference.", "প্রতিদিন ব্যবহার করুন, পার্থক্য বুঝবেন।"]]] },
  },
  kitchen: {
    palette: "teal", marquee: [["Makes work easier", "কাজ সহজ করে"], ["Strong and safe", "মজবুত ও নিরাপদ"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "split0", "benefits", "video", "compare", "split1", "screens", "faq"],
    compare: { title: ["Before and after", "আগে আর পরে"], bad: ["Without it", "এটা ছাড়া"], good: ["With it", "এটা থাকলে"], rows: [[["Ten minutes of effort", "দশ মিনিটের পরিশ্রম"], ["Done in one minute", "এক মিনিটেই শেষ"]], [["Messy to clean", "পরিষ্কার করা ঝামেলা"], ["Wipe and rinse", "মুছে বা ধুয়ে নিন"]]] },
  },
  kids: {
    palette: "purple", marquee: [["For little ones", "ছোটদের জন্য"], ["Safe and bright", "নিরাপদ ও রঙিন"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "benefits", "split0", "gallery", "steps", "screens", "faq"], steps: STEP_ORDER,
  },
  watch: {
    palette: "red", marquee: [["New in", "নতুন এসেছে"], ["Gift ready", "উপহারের জন্য তৈরি"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "gallery", "benefits", "split0", "compare", "screens", "urgency", "faq"],
    compare: { title: ["Look closer", "ভালো করে দেখুন"], bad: ["Ordinary", "সাধারণ"], good: ["Ours", "আমাদের"], rows: [[["Dull finish", "ম্লান ফিনিশ"], ["Clean, premium finish", "পরিষ্কার, আভিজাত্যপূর্ণ ফিনিশ"]], [["Uncomfortable strap", "অস্বস্তিকর স্ট্র্যাপ"], ["Light and comfortable", "হালকা ও আরামদায়ক"]]] },
  },
  combo: {
    palette: "fresh", marquee: [["Buy together, save more", "একসাথে কিনুন, বেশি সাশ্রয়"], ["One parcel, one delivery charge", "এক পার্সেল, এক ডেলিভারি চার্জ"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "benefits", "split0", "steps", "screens", "urgency", "faq"], steps: STEP_ORDER,
  },
  health: {
    palette: "teal", marquee: [["Natural", "প্রাকৃতিক"], ["Clear directions", "পরিষ্কার নির্দেশনা"], ["Cash on delivery", "ক্যাশ অন ডেলিভারি"]],
    layout: ["marquee", "benefits", "split0", "steps", "screens", "faq"],
    steps: { title: ["How to use it", "ব্যবহারের নিয়ম"], items: [[["Read the label", "লেবেল পড়ুন"], ["Use the amount written on the pack.", "প্যাকে লেখা পরিমাণে ব্যবহার করুন।"]], [["Take it regularly", "নিয়মিত নিন"], ["Same time each day works best.", "প্রতিদিন একই সময়ে নেওয়া ভালো।"]], [["Ask if unsure", "অনিশ্চিত হলে জিজ্ঞাসা করুন"], ["If you are pregnant or on medicine, ask a doctor first.", "গর্ভবতী বা ওষুধ সেবনরত হলে আগে ডাক্তারের পরামর্শ নিন।"]]] },
  },
  minimal: {
    palette: "fresh", marquee: [["Cash on delivery", "ক্যাশ অন ডেলিভারি"], ["Easy exchange", "সহজ বদল"]],
    layout: ["benefits", "gallery", "faq"],
  },
};

export const LANDING_TEMPLATES: LandingTemplate[] = SEEDS.map(build);

export const landingTemplate = (id: string | undefined | null): LandingTemplate | undefined => LANDING_TEMPLATES.find((t) => t.id === id);

/** A fresh copy of a template's layout with new section ids, so two pages never share ids by accident. */
export function pageFromTemplate(id: string | undefined | null): PageJson | null {
  const t = landingTemplate(id);
  if (!t) return null;
  const copy = structuredClone(t.page);
  return { ...copy, sections: copy.sections.map((s) => ({ ...s, id: newSectionId(s.type) })) };
}
