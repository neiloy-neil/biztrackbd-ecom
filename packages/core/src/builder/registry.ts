import { ValidationError } from "../errors";

/**
 * The sections a page can be built from (docs/06). One definition drives three things, so they cannot drift apart:
 * the editor's form, the validation of what gets saved, and the defaults a new section starts with.
 *
 * Settings are plain strings, numbers and booleans. Nothing here is HTML or script: text is shown as text, links must be
 * `https://` or start with `/`, colours must be hex, images must be `https://` or one of the store's own `/media/` paths.
 */

/** The pages the editor can build. product, collection and cart are one layout per store (docs/39); home and landing existed first. */
export type PageKind = "home" | "landing" | "product" | "collection" | "cart" | "custom";
export const STORE_PAGE_KINDS: readonly PageKind[] = ["home", "product", "collection", "cart"];

export interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "color" | "select" | "number" | "checkbox" | "image";
  max?: number;
  min?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  /** The Bangla twin of another field: shown beside it, optional. */
  bn?: boolean;
}

export interface ListSpec {
  key: string;
  label: string;
  itemLabel: string;
  min: number;
  max: number;
  fields: Field[];
  defaultItem: Record<string, unknown>;
}

export interface SectionDef {
  type: string;
  label: string;
  description: string;
  /** The page this section was made for. */
  page: PageKind;
  /** Other pages it may also be placed on. */
  pages?: PageKind[];
  /** The page does not work without it: it cannot be removed or hidden (the product, the product grid, the cart). */
  required?: boolean;
  /** At most this many of the section on one page. */
  max?: number;
  fields: Field[];
  list?: ListSpec;
  defaults: Record<string, unknown>;
  /** Extra rule on the cleaned settings: a plain message when they are not usable, else null. */
  check?: (settings: Record<string, unknown>) => string | null;
}

const t = (key: string, label: string, max = 120, more: Partial<Field> = {}): Field => ({ key, label, type: "text", max, ...more });
const tb = (key: string, label: string, max = 120): Field => ({ key: `${key}Bn`, label: `${label} (Bangla)`, type: "text", max, bn: true });
const area = (key: string, label: string, max = 600): Field => ({ key, label, type: "textarea", max });
const areab = (key: string, label: string, max = 600): Field => ({ key: `${key}Bn`, label: `${label} (Bangla)`, type: "textarea", max, bn: true });
const link = (key: string, label: string): Field => ({ key, label, type: "url", max: 300, hint: "A page on your store, like /search?sale=1, or a full https:// address" });
const image = (key: string, label: string): Field => ({ key, label, type: "image", max: 400 });

export const SECTIONS: SectionDef[] = [
  // ---- Home page
  {
    type: "announcement-bar", label: "Announcement bar", description: "A thin line above the header: delivery offers, Eid hours.", page: "home", max: 1,
    fields: [t("text", "Message", 140), tb("text", "Message", 140), { key: "bgColor", label: "Background", type: "color" }, { key: "textColor", label: "Text colour", type: "color" }, link("link", "Link (optional)")],
    defaults: { text: "Free delivery on orders over ৳ 3,000", textBn: "", bgColor: "#2B2118", textColor: "#FFFFFF", link: "" },
  },
  {
    type: "hero", label: "Hero", description: "The big first impression: a headline, a line of text and one button.", page: "home", max: 3,
    fields: [
      t("eyebrow", "Small heading", 40), tb("eyebrow", "Small heading", 40), t("title", "Headline", 100), tb("title", "Headline", 100), area("text", "Text", 240), areab("text", "Text", 240),
      t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30), link("ctaLink", "Button link"), image("image", "Picture (optional)"),
      { key: "align", label: "Text position", type: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }] },
    ],
    defaults: { eyebrow: "NEW COLLECTION", eyebrowBn: "নতুন কালেকশন", title: "Made well. Delivered across Bangladesh.", titleBn: "যত্নে তৈরি। সারা বাংলাদেশে পৌঁছে দিই।", text: "Shop our latest pieces and pay the way you like.", textBn: "নতুন পণ্য দেখুন, পছন্দের উপায়ে দাম দিন।", ctaText: "Shop the collection", ctaTextBn: "কালেকশন দেখুন", ctaLink: "/search?sort=newest", image: "", align: "left" },
  },
  {
    type: "featured-products", label: "Product grid", description: "A row of products: newest, on sale, featured, or one category.", page: "home", pages: ["custom", "product", "collection", "cart"], max: 8,
    fields: [
      t("title", "Heading", 60), tb("title", "Heading", 60),
      { key: "source", label: "Show", type: "select", options: [{ value: "new", label: "Newest products" }, { value: "sale", label: "Products on sale" }, { value: "featured", label: "Featured products" }, { value: "category", label: "One category" }] },
      t("categorySlug", "Category (when showing one category)", 80, { hint: "The last part of the category's address, like panjabi" }),
      { key: "limit", label: "How many", type: "number", min: 2, max: 12 },
      { key: "columns", label: "Columns on a computer", type: "select", options: [{ value: "3", label: "3" }, { value: "4", label: "4" }] },
    ],
    defaults: { title: "New arrivals", titleBn: "নতুন পণ্য", source: "new", categorySlug: "", limit: 8, columns: "4" },
  },
  {
    type: "category-grid", label: "Categories", description: "Big tappable tiles for your categories.", page: "home", pages: ["custom", "product", "collection", "cart"], max: 2,
    fields: [t("title", "Heading", 60), tb("title", "Heading", 60), { key: "limit", label: "How many", type: "number", min: 1, max: 6 }],
    defaults: { title: "Shop by category", titleBn: "ক্যাটাগরি অনুযায়ী কিনুন", limit: 3 },
  },
  {
    type: "banner", label: "Picture banner", description: "A wide picture with a line of text and a button, for a sale or a new arrival.", page: "home", pages: ["custom", "product", "collection", "cart"], max: 6,
    fields: [
      image("image", "Picture"), t("heading", "Heading", 80), tb("heading", "Heading", 80), area("text", "Text", 200), areab("text", "Text", 200),
      t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30), link("ctaLink", "Button link"),
      { key: "height", label: "Height", type: "select", options: [{ value: "short", label: "Short" }, { value: "tall", label: "Tall" }] },
    ],
    defaults: { image: "", heading: "Eid collection", headingBn: "ঈদ কালেকশন", text: "", textBn: "", ctaText: "Shop now", ctaTextBn: "এখনই কিনুন", ctaLink: "/search?sale=1", height: "short" },
  },
  {
    type: "rich-text", label: "Text block", description: "A heading and a few paragraphs: your story, a delivery note, a size guide.", page: "home", pages: ["custom", "product", "collection", "cart"], max: 6,
    fields: [t("heading", "Heading", 80), tb("heading", "Heading", 80), area("body", "Text", 1200), areab("body", "Text", 1200)],
    defaults: { heading: "About us", headingBn: "আমাদের কথা", body: "Tell your customers who you are and why they can trust you.", bodyBn: "" },
  },
  {
    type: "trust-strip", label: "Trust strip", description: "Cash on delivery, bKash and Nagad, delivery time and easy exchange, in four short lines.", page: "home", pages: ["custom", "product", "collection", "cart", "landing"], max: 1,
    fields: [], defaults: {},
  },

  // ---- Product page (docs/39)
  {
    type: "product-main", label: "Product details", description: "The pictures, name, price, size choice, add to cart and the description. Every product page needs it.", page: "product", required: true, max: 1,
    fields: [
      { key: "showRating", label: "Show the star rating", type: "checkbox" },
      { key: "showAssurance", label: "Show delivery, payment and exchange notes", type: "checkbox" },
      { key: "showDescription", label: "Show the description", type: "checkbox" },
    ],
    defaults: { showRating: true, showAssurance: true, showDescription: true },
  },
  {
    type: "product-reviews", label: "Customer reviews", description: "What buyers said about this product.", page: "product", max: 1,
    fields: [t("title", "Heading", 60), tb("title", "Heading", 60)],
    defaults: { title: "Customer reviews", titleBn: "ক্রেতাদের রিভিউ" },
  },
  {
    type: "product-related", label: "Goes well with", description: "A row of other products from the same category.", page: "product", max: 1,
    fields: [t("title", "Heading", 60), tb("title", "Heading", 60), { key: "limit", label: "How many", type: "number", min: 2, max: 8 }],
    defaults: { title: "Goes well with", titleBn: "এর সাথে মানানসই", limit: 4 },
  },

  // ---- Collection (category) page
  {
    type: "collection-header", label: "Collection heading", description: "The collection name, with its description and how many products it has.", page: "collection", max: 1,
    fields: [
      { key: "showDescription", label: "Show the description", type: "checkbox" },
      { key: "showCount", label: "Show how many products", type: "checkbox" },
    ],
    defaults: { showDescription: true, showCount: true },
  },
  {
    type: "collection-products", label: "Product grid with sorting", description: "The products in this collection, with sorting and pages. Every collection page needs it.", page: "collection", required: true, max: 1,
    fields: [{ key: "showSort", label: "Show the sort choice", type: "checkbox" }],
    defaults: { showSort: true },
  },

  // ---- Cart page
  {
    type: "cart-main", label: "Cart", description: "The items, the totals and the checkout button. The cart page needs it.", page: "cart", required: true, max: 1,
    fields: [t("title", "Heading", 60), tb("title", "Heading", 60)],
    defaults: { title: "Your cart", titleBn: "আপনার কার্ট" },
  },

  // ---- Landing page
  {
    type: "lp-hero", label: "Top of the page", description: "The headline your ad promised, one picture and a button that jumps to the order form.", page: "landing", pages: ["custom"], max: 1,
    fields: [
      t("badge", "Small badge", 30), tb("badge", "Small badge", 30), t("headline", "Headline", 110), tb("headline", "Headline", 110), area("subhead", "Line under it", 260), areab("subhead", "Line under it", 260),
      image("image", "Picture"), t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30),
      { key: "showPrice", label: "Show the price, old price and saving", type: "checkbox", hint: "Taken from the product, so it is always right" },
      t("tick1", "Reassurance 1", 40), tb("tick1", "Reassurance 1", 40), t("tick2", "Reassurance 2", 40), tb("tick2", "Reassurance 2", 40), t("tick3", "Reassurance 3", 40), tb("tick3", "Reassurance 3", 40),
    ],
    defaults: { showPrice: true, tick1: "Cash on delivery", tick1Bn: "ক্যাশ অন ডেলিভারি", tick2: "Delivery in 1 to 3 days", tick2Bn: "১-৩ দিনে ডেলিভারি", tick3: "Easy exchange", tick3Bn: "সহজ বদল", badge: "Cash on delivery", badgeBn: "ক্যাশ অন ডেলিভারি", headline: "The panjabi that stays cool in the heat", headlineBn: "গরমে আরামের পাঞ্জাবি", subhead: "100% cotton, stitched in Narayanganj. Pay when it arrives.", subheadBn: "", image: "", ctaText: "Order now", ctaTextBn: "অর্ডার করুন" },
  },
  {
    type: "lp-benefits", label: "Why buy", description: "Three to eight short reasons.", page: "landing", pages: ["custom"], max: 2,
    fields: [t("title", "Heading", 70), tb("title", "Heading", 70)],
    list: { key: "items", label: "Reasons", itemLabel: "Reason", min: 1, max: 8, fields: [t("title", "Short title", 60), tb("title", "Short title", 60), area("text", "A sentence", 160), areab("text", "A sentence", 160)], defaultItem: { title: "Soft cotton", titleBn: "", text: "Breathable fabric for hot days.", textBn: "" } },
    defaults: { title: "Why you will love it", titleBn: "কেন পছন্দ করবেন", items: [{ title: "Soft cotton", titleBn: "", text: "Breathable fabric for hot days.", textBn: "" }, { title: "Cash on delivery", titleBn: "", text: "Pay only when it arrives.", textBn: "" }, { title: "Easy exchange", titleBn: "", text: "Wrong size? We swap it.", textBn: "" }] },
  },
  {
    type: "lp-gallery", label: "Pictures", description: "Up to eight pictures of the product.", page: "landing", pages: ["custom"], max: 2,
    fields: [t("title", "Heading (optional)", 70), tb("title", "Heading (optional)", 70)],
    list: { key: "items", label: "Pictures", itemLabel: "Picture", min: 1, max: 8, fields: [image("image", "Picture"), t("alt", "What it shows", 100)], defaultItem: { image: "", alt: "" } },
    defaults: { title: "", titleBn: "", items: [{ image: "", alt: "" }] },
  },
  {
    type: "lp-reviews", label: "Customer words", description: "Real things your customers said. Only add words they actually wrote.", page: "landing", max: 1,
    fields: [t("title", "Heading", 70), tb("title", "Heading", 70)],
    list: { key: "items", label: "Reviews", itemLabel: "Review", min: 1, max: 6, fields: [t("name", "Name", 50), area("text", "What they said", 240), { key: "rating", label: "Stars", type: "number", min: 1, max: 5 }], defaultItem: { name: "", text: "", rating: 5 } },
    defaults: { title: "What customers say", titleBn: "ক্রেতারা কী বলছেন", items: [{ name: "Customer name", text: "Write what they said here.", rating: 5 }] },
  },
  {
    type: "lp-faq", label: "Questions", description: "The questions people ask before they order.", page: "landing", pages: ["custom"], max: 1,
    fields: [t("title", "Heading", 70), tb("title", "Heading", 70)],
    list: { key: "items", label: "Questions", itemLabel: "Question", min: 1, max: 8, fields: [t("q", "Question", 120), tb("q", "Question", 120), area("a", "Answer", 300), areab("a", "Answer", 300)], defaultItem: { q: "", qBn: "", a: "", aBn: "" } },
    defaults: { title: "Questions", titleBn: "প্রশ্ন", items: [{ q: "How long does delivery take?", qBn: "", a: "1 to 2 days inside Dhaka, 3 to 4 days outside.", aBn: "" }] },
  },
  {
    type: "lp-order-form", label: "Order form", description: "The cash on delivery form. Customers order without an account or a cart.", page: "landing", max: 1,
    fields: [t("title", "Heading", 70), tb("title", "Heading", 70), area("intro", "Line above the form", 200), areab("intro", "Line above the form", 200), t("buttonText", "Button text", 40), tb("buttonText", "Button text", 40)],
    defaults: { title: "Order now. Pay when it arrives.", titleBn: "অর্ডার করুন। হাতে পেয়ে দাম দিন।", intro: "Fill in your details and we will call you to confirm.", introBn: "", buttonText: "Place my order", buttonTextBn: "অর্ডার করুন" },
  },
  {
    type: "lp-video", label: "Video", description: "A YouTube video: the product in use, a review, an unboxing.", page: "landing", pages: ["custom"], max: 2,
    fields: [t("title", "Heading (optional)", 70), tb("title", "Heading (optional)", 70), { key: "videoUrl", label: "YouTube address", type: "url", max: 200, hint: "Paste the address of the video from YouTube, like https://youtu.be/…" }],
    defaults: { title: "", titleBn: "", videoUrl: "" },
    check: (s) => (s.videoUrl && !youtubeId(String(s.videoUrl)) ? "use a YouTube address (youtube.com or youtu.be)" : null),
  },
  {
    type: "lp-split", label: "Picture and text", description: "A picture beside a few lines: how to use it, what is inside, why it is different.", page: "landing", pages: ["custom"], max: 4,
    fields: [
      t("title", "Heading", 80), tb("title", "Heading", 80), area("text", "Text", 500), areab("text", "Text", 500), image("image", "Picture"),
      { key: "side", label: "Picture on", type: "select", options: [{ value: "right", label: "The right" }, { value: "left", label: "The left" }] },
      t("ctaText", "Button text (optional)", 30), tb("ctaText", "Button text (optional)", 30),
    ],
    defaults: { title: "How to use it", titleBn: "ব্যবহারের নিয়ম", text: "Explain in two or three short lines how your customer uses the product and what they get.", textBn: "", image: "", side: "right", ctaText: "", ctaTextBn: "" },
  },
  {
    type: "lp-text", label: "Text and button", description: "A heading, a paragraph and an order button. Good for a promise, a guarantee or a story.", page: "landing", pages: ["custom"], max: 4,
    fields: [t("title", "Heading", 80), tb("title", "Heading", 80), area("text", "Text", 600), areab("text", "Text", 600), t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30)],
    defaults: { title: "Our promise", titleBn: "আমাদের প্রতিশ্রুতি", text: "If the product is not what you saw, tell us when it arrives and we will make it right.", textBn: "", ctaText: "Order now", ctaTextBn: "অর্ডার করুন" },
  },
  {
    type: "lp-countdown", label: "Countdown", description: "A timer to the day your offer really ends. It disappears by itself when the time is up. Leave the date empty to hide it.", page: "landing", max: 1,
    fields: [
      t("title", "Heading", 70), tb("title", "Heading", 70),
      { key: "endsAt", label: "Offer ends", type: "text", max: 16, hint: "Bangladesh time, like 2026-12-20 23:59. Only set a date your offer truly ends on." },
    ],
    defaults: { title: "This offer ends in", titleBn: "অফার শেষ হতে বাকি", endsAt: "" },
    check: (s) => (s.endsAt && parseEndsAt(String(s.endsAt)) === null ? "write the end as a date and time, like 2026-12-20 23:59" : null),
  },
  {
    type: "lp-stock", label: "Stock left", description: "Shows how many are left, using your real stock, and only once it is low.", page: "landing", max: 1,
    fields: [t("text", "Message", 80, { hint: "Use {n} where the number goes" }), tb("text", "Message", 80), { key: "threshold", label: "Show when this many or fewer are left", type: "number", min: 1, max: 500 }],
    defaults: { text: "Only {n} left in stock", textBn: "মাত্র {n}টি স্টকে আছে", threshold: 20 },
  },
  {
    type: "lp-offer-bar", label: "Price and button", description: "Today's price (and the old price if you set one on the product) with a button to the order form.", page: "landing", max: 2,
    fields: [t("text", "Line above the price", 60), tb("text", "Line above the price", 60), t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30)],
    defaults: { text: "Today's price", textBn: "আজকের দাম", ctaText: "Order now", ctaTextBn: "অর্ডার করুন" },
  },
  {
    type: "contact-block", label: "Contact details", description: "Your phone, WhatsApp and address from your store settings. Change them in Settings.", page: "custom", max: 1,
    fields: [t("title", "Heading", 70), tb("title", "Heading", 70), area("text", "Line above the details", 240), areab("text", "Line above the details", 240)],
    defaults: { title: "Get in touch", titleBn: "যোগাযোগ করুন", text: "We answer messages every day.", textBn: "" },
  },
  {
    type: "lp-header", label: "Header and style", description: "Your logo, ways to call you, and the colours of the whole page. Pick a colour style that suits the product.", page: "landing", max: 1,
    fields: [
      { key: "palette", label: "Colour style", type: "select", options: [
        { value: "fresh", label: "Fresh green" }, { value: "red", label: "Bold red on charcoal" }, { value: "navy", label: "Navy and gold" }, { value: "sunny", label: "Sunny orange" },
        { value: "purple", label: "Purple pop" }, { value: "teal", label: "Deep teal and amber" }, { value: "night", label: "Night and lime" }, { value: "rose", label: "Rose" },
      ] },
      image("logo", "Your logo (leave empty to use your store logo or name)"),
      { key: "showPhone", label: "Show a call button", type: "checkbox", hint: "Uses the phone number in your store settings" },
      { key: "showWhatsapp", label: "Show a WhatsApp button", type: "checkbox" },
      { key: "showOrder", label: "Show an order button in the header", type: "checkbox" },
      t("orderText", "Header button text", 24), tb("orderText", "Header button text", 24),
      { key: "showLanguage", label: "Show the English / Bangla switch", type: "checkbox" },
      { key: "floatWhatsapp", label: "Show a round WhatsApp button on the page", type: "checkbox" },
    ],
    defaults: { palette: "fresh", logo: "", showPhone: true, showWhatsapp: true, showOrder: true, orderText: "Order now", orderTextBn: "অর্ডার করুন", showLanguage: false, floatWhatsapp: true },
  },
  {
    type: "lp-marquee", label: "Moving strip", description: "A slim coloured strip of short phrases that slides across: free delivery, cash on delivery, 7 days exchange.", page: "landing", max: 2,
    fields: [],
    list: { key: "items", label: "Phrases", itemLabel: "Phrase", min: 2, max: 8, fields: [t("text", "Phrase", 40), tb("text", "Phrase", 40)], defaultItem: { text: "", textBn: "" } },
    defaults: { items: [{ text: "Free delivery on big orders", textBn: "বড় অর্ডারে ফ্রি ডেলিভারি" }, { text: "Cash on delivery", textBn: "ক্যাশ অন ডেলিভারি" }, { text: "Easy exchange", textBn: "সহজ বদল" }] },
  },
  {
    type: "lp-compare", label: "Ordinary or ours", description: "Two columns: what people get elsewhere, and what they get from you. Or before and after.", page: "landing", max: 1,
    fields: [t("title", "Heading", 80), tb("title", "Heading", 80), t("badTitle", "Left column heading", 40), tb("badTitle", "Left column heading", 40), t("goodTitle", "Right column heading", 40), tb("goodTitle", "Right column heading", 40)],
    list: { key: "items", label: "Rows", itemLabel: "Row", min: 1, max: 6, fields: [t("bad", "Left", 80), tb("bad", "Left", 80), t("good", "Right", 80), tb("good", "Right", 80)], defaultItem: { bad: "", badBn: "", good: "", goodBn: "" } },
    defaults: { title: "Why ours is different", titleBn: "কেন আমাদেরটা আলাদা", badTitle: "Ordinary", badTitleBn: "সাধারণ", goodTitle: "Ours", goodTitleBn: "আমাদের", items: [{ bad: "Fades after a few washes", badBn: "কয়েকবার ধুলেই রঙ চটে যায়", good: "Colour stays bright", goodBn: "রঙ থাকে উজ্জ্বল" }, { bad: "Hard to return", badBn: "ফেরত দেওয়া কঠিন", good: "Easy exchange", goodBn: "সহজ বদল" }] },
  },
  {
    type: "lp-steps", label: "Steps", description: "Numbered steps: how to order, or how to use it.", page: "landing", max: 2,
    fields: [t("title", "Heading", 80), tb("title", "Heading", 80)],
    list: { key: "items", label: "Steps", itemLabel: "Step", min: 2, max: 6, fields: [t("title", "Step", 60), tb("title", "Step", 60), area("text", "A line about it", 140), areab("text", "A line about it", 140)], defaultItem: { title: "", titleBn: "", text: "", textBn: "" } },
    defaults: { title: "How to order", titleBn: "কীভাবে অর্ডার করবেন", items: [{ title: "Fill the form", titleBn: "ফর্ম পূরণ করুন", text: "Your name, number and address.", textBn: "নাম, নম্বর ও ঠিকানা।" }, { title: "We call you", titleBn: "আমরা ফোন করি", text: "To confirm your order.", textBn: "অর্ডার নিশ্চিত করতে।" }, { title: "Pay on delivery", titleBn: "হাতে পেয়ে টাকা দিন", text: "Check the parcel, then pay.", textBn: "পণ্য দেখে তারপর দাম দিন।" }] },
  },
  {
    type: "lp-screens", label: "Customer message pictures", description: "Screenshots of real customer messages and comments. Only add ones that are real.", page: "landing", max: 1,
    fields: [t("title", "Heading", 80), tb("title", "Heading", 80)],
    list: { key: "items", label: "Pictures", itemLabel: "Picture", min: 1, max: 12, fields: [image("image", "Picture"), t("alt", "What it shows", 100)], defaultItem: { image: "", alt: "" } },
    defaults: { title: "What our customers say", titleBn: "ক্রেতারা কী বলছেন", items: [{ image: "", alt: "" }] },
  },
  {
    type: "lp-sticky-cta", label: "Sticky button", description: "A button that stays at the bottom of a phone screen and jumps to the order form.", page: "landing", max: 1,
    fields: [t("text", "Button text", 40), tb("text", "Button text", 40)],
    defaults: { text: "Order now", textBn: "অর্ডার করুন" },
  },
  {
    type: "lp-guarantee-strip", label: "Risk-reversal guarantee strip", description: "4-badge trust banner: Cash on Delivery, fast delivery, 3-day return, and 100% genuine guarantee.", page: "landing", pages: ["custom"], max: 2,
    fields: [
      t("title", "Heading (optional)", 80), tb("title", "Heading (optional)", 80),
      t("badge1", "Badge 1 title", 40), tb("badge1", "Badge 1 title", 40),
      t("sub1", "Badge 1 subtitle", 80), tb("sub1", "Badge 1 subtitle", 80),
      t("badge2", "Badge 2 title", 40), tb("badge2", "Badge 2 title", 40),
      t("sub2", "Badge 2 subtitle", 80), tb("sub2", "Badge 2 subtitle", 80),
      t("badge3", "Badge 3 title", 40), tb("badge3", "Badge 3 title", 40),
      t("sub3", "Badge 3 subtitle", 80), tb("sub3", "Badge 3 subtitle", 80),
      t("badge4", "Badge 4 title", 40), tb("badge4", "Badge 4 title", 40),
      t("sub4", "Badge 4 subtitle", 80), tb("sub4", "Badge 4 subtitle", 80),
    ],
    defaults: {
      title: "Our Trust Guarantee", titleBn: "আমাদের বিশ্বস্ত সেবা",
      badge1: "Cash on Delivery", badge1Bn: "ক্যাশ অন ডেলিভারি",
      sub1: "Inspect & pay at your door", sub1Bn: "পণ্য দেখে মূল্য পরিশোধ",
      badge2: "Fast 24-48h Delivery", badge2Bn: "দ্রুত ২৪-৪৮ ঘণ্টা ডেলিভারি",
      sub2: "Express delivery across BD", sub2Bn: "সারা বাংলাদেশে দ্রুত হোম ডেলিভারি",
      badge3: "3-Day Easy Return", badge3Bn: "৩ দিনে সহজ রিটার্ন",
      sub3: "Hassle-free size & product exchange", sub3Bn: "সহজ রিটার্ন ও এক্সচেঞ্জ সুবিধা",
      badge4: "100% Original Quality", badge4Bn: "১০০% আসল ও সেরা মান",
      sub4: "Direct from verified authentic suppliers", sub4Bn: "শতভাগ আসল এবং প্রিমিয়াম মানের নিশ্চয়তা",
    },
  },
  {
    type: "lp-social-proof", label: "Live recent purchase ticker", description: "Floating popup toast showing simulated/real recent customer orders across Bangladesh.", page: "landing", max: 1,
    fields: [
      { key: "enabled", label: "Enable recent order popups", type: "checkbox" },
      { key: "interval", label: "Seconds between notifications", type: "number", min: 8, max: 60 },
      t("customNote", "Custom order text (optional)", 100), tb("customNote", "Custom order text (optional)", 100),
    ],
    defaults: { enabled: true, interval: 14, customNote: "", customNoteBn: "" },
  },
  {
    type: "lp-reviews-carousel", label: "Customer reviews carousel", description: "Interactive touch slider for customer reviews with star ratings and verified buyer badges.", page: "landing", max: 1,
    fields: [t("title", "Heading", 80), tb("title", "Heading", 80)],
    list: {
      key: "items", label: "Reviews", itemLabel: "Review", min: 1, max: 8,
      fields: [
        t("name", "Customer Name", 60),
        t("location", "City / Area (e.g. Mirpur, Dhaka)", 60),
        area("text", "Customer Review", 280),
        { key: "rating", label: "Stars", type: "number", min: 1, max: 5 },
        image("photo", "Customer photo / unboxing (optional)"),
      ],
      defaultItem: { name: "Tanvir Ahmed", location: "Uttara, Dhaka", text: "পণ্যটি সত্যিই অসাধারণ! ছবির সাথে মিল আছে এবং ডেলিভারিও খুব দ্রুত পেয়েছি।", rating: 5, photo: "" },
    },
    defaults: {
      title: "Real Verified Customer Feedback",
      titleBn: "গ্রাহকদের আসল মতামত ও রিভিউ",
      items: [
        { name: "Tanvir Ahmed", location: "Uttara, Dhaka", text: "পণ্যটি সত্যিই অসাধারণ! ছবির সাথে হুবহু মিল আছে এবং ২৪ ঘণ্টার মধ্যে ডেলিভারি পেয়েছি।", rating: 5, photo: "" },
        { name: "Nusrat Jahan", location: "Chittagong", text: "খুব সুন্দর কোয়ালিটি এবং কাপড়ের ফিনিশিং দুর্দান্ত। ক্যাশ অন ডেলিভারিতে চেক করে নিতে পেরে নিশ্চিন্ত হয়েছি।", rating: 5, photo: "" },
        { name: "Kamrul Hasan", location: "Mirpur, Dhaka", text: "সরাসরি হাতে পেয়ে টাকা দিয়েছি। প্যাকেজিং ও প্রডাক্ট কোয়ালিটি ১০০ তে ১০০!", rating: 5, photo: "" },
      ],
    },
  },

  // ---- Modern High-Converting Sections (Store-wide: home, custom, product, collection, cart)
  {
    type: "countdown-timer",
    label: "Flash Sale Countdown",
    description: "Urgency countdown clock for seasonal sales, Eid discounts, and flash deals.",
    page: "home",
    pages: ["custom", "product", "collection", "cart"],
    max: 2,
    fields: [
      t("badge", "Urgency badge", 40), tb("badge", "Urgency badge", 40),
      t("title", "Headline", 80), tb("title", "Headline", 80),
      area("subhead", "Line under it", 200), areab("subhead", "Line under it", 200),
      { key: "endsAt", label: "Offer ends", type: "text", max: 16, hint: "Bangladesh time, e.g. 2026-12-31 23:59. Countdown ticks down to this date." },
      t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30),
      link("ctaLink", "Button link"),
      { key: "bgColor", label: "Background colour", type: "color" },
      { key: "textColor", label: "Text colour", type: "color" },
    ],
    defaults: {
      badge: "LIMITED TIME SALE", badgeBn: "সীমিত সময়ের অফার",
      title: "Mega Flash Sale · Up to 40% Off", titleBn: "মেগা ফ্ল্যাশ সেল · ৪০% পর্যন্ত ছাড়",
      subhead: "Special discounts on our most popular items. Order before time runs out!", subheadBn: "আমাদের জনপ্রিয় পণ্যে বিশেষ মূল্যছাড়। অফার শেষ হবার আগেই অর্ডার করুন!",
      endsAt: "2026-12-31 23:59",
      ctaText: "Shop Flash Sale", ctaTextBn: "অফার দেখুন",
      ctaLink: "/search?sale=1",
      bgColor: "#1E1B4B",
      textColor: "#FFFFFF",
    },
    check: (s) => (s.endsAt && parseEndsAt(String(s.endsAt)) === null ? "write the end as a date and time, like 2026-12-31 23:59" : null),
  },
  {
    type: "accordion-faq",
    label: "Accordion FAQ",
    description: "Expandable questions & answers for sizing, delivery charges, cash on delivery, and exchange policies.",
    page: "home",
    pages: ["custom", "product", "collection", "cart"],
    max: 3,
    fields: [
      t("title", "Heading", 80), tb("title", "Heading", 80),
      area("intro", "Intro line (optional)", 200), areab("intro", "Intro line (optional)", 200),
    ],
    list: {
      key: "items",
      label: "Questions",
      itemLabel: "Question",
      min: 1,
      max: 10,
      fields: [
        t("q", "Question", 120), tb("q", "Question", 120),
        area("a", "Answer", 600), areab("a", "Answer", 600),
      ],
      defaultItem: {
        q: "What is your delivery charge and time?",
        qBn: "ডেলিভারি চার্জ এবং সময় কত?",
        a: "Delivery inside Dhaka is ৳70 (1-2 days). Outside Dhaka is ৳130 (3-4 days).",
        aBn: "ঢাকা সিটির ভেতরে ডেলিভারি চার্জ ৭০ টাকা (১-২ দিন)। ঢাকার বাইরে ১৩০ টাকা (৩-৪ দিন)।",
      },
    },
    defaults: {
      title: "Frequently Asked Questions",
      titleBn: "সাধারণ কিছু জিজ্ঞাসা",
      intro: "Got questions before placing your order? Here are the answers.",
      introBn: "অর্ডার করার আগে কোনো প্রশ্ন থাকলে নিচের উত্তরগুলো দেখে নিন।",
      items: [
        {
          q: "Do you offer Cash on Delivery (COD)?",
          qBn: "আপনারা কি ক্যাশ অন ডেলিভারি দেন?",
          a: "Yes! We offer 100% Cash on Delivery across all 64 districts in Bangladesh.",
          aBn: "হ্যাঁ! সারা বাংলাদেশের যেকোনো প্রান্তে ক্যাশ অন ডেলিভারিতে অর্ডার গ্রহণ করা হয়।",
        },
        {
          q: "What is your size exchange policy?",
          qBn: "সাইজ পরিবর্তন বা এক্সচেঞ্জের নিয়ম কী?",
          a: "If the size does not fit, simply message us within 3 days and we will exchange it smoothly.",
          aBn: "পণ্য হাতে পাওয়ার ৩ দিনের মধ্যে সাইজ পরিবর্তনের জন্য আমাদের ইনবক্স করলে সাথে সাথেই ব্যবস্থা নেওয়া হবে।",
        },
        {
          q: "Can I inspect the parcel before paying the courier?",
          qBn: "ডেলিভারি ম্যানের সামনে পণ্য দেখে নেয়া যাবে?",
          a: "Yes, you can check the parcel in front of the delivery agent before paying.",
          aBn: "অবশ্যই, ডেলিভারি ম্যানের উপস্থিতিতে পণ্য দেখে নিশ্চিত হয়ে মূল্য পরিশোধ করতে পারবেন।",
        },
      ],
    },
  },
  {
    type: "marquee-ticker",
    label: "Announcement Marquee",
    description: "An animated continuous scrolling ribbon for coupons, shipping perks, and festival highlights.",
    page: "home",
    pages: ["custom", "product", "collection", "cart"],
    max: 2,
    fields: [
      t("text", "Primary ticker text", 180), tb("text", "Primary ticker text", 180),
      { key: "speed", label: "Scroll speed", type: "select", options: [{ value: "normal", label: "Normal" }, { value: "slow", label: "Gentle" }, { value: "fast", label: "Fast" }] },
      { key: "icon", label: "Badge icon", type: "select", options: [{ value: "lightning", label: "Lightning" }, { value: "truck", label: "Delivery" }, { value: "gift", label: "Gift" }, { value: "fire", label: "Hot Sale" }, { value: "star", label: "Star" }] },
      link("link", "Link (optional)"),
      { key: "bgColor", label: "Background", type: "color" },
      { key: "textColor", label: "Text colour", type: "color" },
    ],
    defaults: {
      text: "FREE DELIVERY INSIDE DHAKA ON ORDERS OVER ৳2,500 · 100% CASH ON DELIVERY IN 64 DISTRICTS · EASY 3-DAY EXCHANGE",
      textBn: "২,৫০০ টাকার অর্ডারে ঢাকা সিটিতে ফ্রি ডেলিভারি · ৬৪ জেলায় ক্যাশ অন ডেলিভারি · ৩ দিনের সহজ এক্সচেঞ্জ সুবিধা",
      speed: "normal",
      icon: "lightning",
      link: "",
      bgColor: "#4F46E5",
      textColor: "#FFFFFF",
    },
  },
  {
    type: "video-reels",
    label: "Product Video Showcase",
    description: "Responsive video player for product demonstrations, unboxing, and styling tutorials.",
    page: "home",
    pages: ["custom", "product", "collection", "cart"],
    max: 3,
    fields: [
      t("title", "Heading", 80), tb("title", "Heading", 80),
      area("subhead", "Line under it (optional)", 200), areab("subhead", "Line under it (optional)", 200),
      { key: "videoUrl", label: "YouTube or Video address", type: "url", max: 300, hint: "Paste YouTube address (e.g. https://youtu.be/...) or direct video link" },
      { key: "aspectRatio", label: "Aspect ratio", type: "select", options: [{ value: "16-9", label: "Widescreen (16:9)" }, { value: "9-16", label: "Vertical Reel (9:16)" }] },
      image("poster", "Poster picture (optional)"),
      t("ctaText", "Button text (optional)", 30), tb("ctaText", "Button text (optional)", 30),
      link("ctaLink", "Button link (optional)"),
    ],
    defaults: {
      title: "See It in Action",
      titleBn: "ভিডিওতে পণ্যের বিস্তারিত দেখুন",
      subhead: "Watch how our products are crafted and styled in real life.",
      subheadBn: "বাস্তবে পণ্যের ফেব্রিক, ফিটিং ও ফিনিশিং ভিডিওতে দেখুন।",
      videoUrl: "",
      aspectRatio: "16-9",
      poster: "",
      ctaText: "Shop This Look",
      ctaTextBn: "কালেকশন দেখুন",
      ctaLink: "/search",
    },
    check: (s) => (s.videoUrl && !safeUrl(String(s.videoUrl)) ? "enter a valid video address" : null),
  },
  {
    type: "floating-contact",
    label: "Floating WhatsApp & Call",
    description: "Persistent floating WhatsApp chat & direct hotline phone button for instant customer inquiries.",
    page: "home",
    pages: ["custom", "product", "collection", "cart"],
    max: 1,
    fields: [
      t("phone", "Direct call phone number", 20, { hint: "e.g. 01712345678" }),
      t("whatsapp", "WhatsApp number", 20, { hint: "e.g. 01712345678 or +8801712345678" }),
      { key: "position", label: "Screen position", type: "select", options: [{ value: "bottom-right", label: "Bottom Right" }, { value: "bottom-left", label: "Bottom Left" }] },
      area("message", "Pre-filled WhatsApp message", 200),
      areab("message", "Pre-filled WhatsApp message", 200),
      t("label", "Tooltip badge text", 30),
      tb("label", "Tooltip badge text", 30),
    ],
    defaults: {
      phone: "01712345678",
      whatsapp: "01712345678",
      position: "bottom-right",
      message: "Hello! I am browsing your store and would like to ask a question.",
      messageBn: "আসসালামু আলাইকুম! আপনাদের স্টোরের প্রোডাক্ট সম্পর্কে জানতে চাচ্ছিলাম।",
      label: "Need Help? Chat with us",
      labelBn: "সাহায্য প্রয়োজন? ইনবক্স করুন",
    },
  },
];

export interface StoreSectionCategory {
  id: string;
  title: string;
  icon: string;
  types: string[];
}

/** Standard organized category tabs for browsing sections in Store Pages */
export const STORE_SECTION_CATEGORIES: StoreSectionCategory[] = [
  { id: "all", title: "All Sections", icon: "", types: [] },
  { id: "hero", title: "Header & Hero", icon: "", types: ["hero", "banner", "announcement-bar"] },
  { id: "products", title: "Product Showcases", icon: "", types: ["featured-products", "category-grid", "product-related", "collection-products"] },
  { id: "trust", title: "Trust & Social Proof", icon: "", types: ["trust-strip", "product-reviews", "video-reels"] },
  { id: "promotions", title: "Promotions & Urgency", icon: "", types: ["countdown-timer", "marquee-ticker", "floating-contact"] },
  { id: "content", title: "Content & FAQs", icon: "", types: ["rich-text", "accordion-faq", "contact-block"] },
];

/** The 11-character id of a YouTube video from a pasted address (watch, youtu.be, embed, shorts), or null. Nothing else is ever put in a page. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
        id = m?.[1] ?? null;
      }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** "2026-12-20 23:59" (Bangladesh time, 23:59 when no time is given) as the moment it means, or null if it is not a real date. */
export function parseEndsAt(v: string): Date | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 23), Number(m[5] ?? 59)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  // A 31st of a 30-day month would roll over into the next month; that is not a real date.
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, mo - 1, d, h - 6, mi));
}

// ---- Editing text and pictures on the page itself (docs/46, stage 4) --------------------------------------------------------

const PATH = /^[A-Za-z][A-Za-z0-9]*(\.[0-9]{1,2}\.[A-Za-z][A-Za-z0-9]*)?$/;

/**
 * The field a path points at, when the page may change it from the preview: a plain text field of the section ("headline"), or one of its list
 * items ("items.2.title"). The preview is a different site, so what it sends is checked here against the section's own definition.
 * Only text, textarea and image fields qualify; anything else (links, colours, numbers) is changed in the form.
 */
export function editableField(def: SectionDef, path: string, kinds: Field["type"][] = ["text", "textarea"]): Field | null {
  if (!PATH.test(path)) return null;
  const parts = path.split(".");
  const ok = (f: Field | undefined) => (f && kinds.includes(f.type) ? f : null);
  if (parts.length === 1) return ok(def.fields.find((f) => f.key === parts[0]));
  if (!def.list || parts[0] !== def.list.key) return null;
  return ok(def.list.fields.find((f) => f.key === parts[2]));
}

/** A copy of the settings with one text value replaced. The path must already have passed `editableField`. */
export function setByPath(settings: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const parts = path.split(".");
  if (parts.length === 1) return { ...settings, [parts[0]!]: value };
  const [listKey, index, field] = parts as [string, string, string];
  const list = Array.isArray(settings[listKey]) ? (settings[listKey] as Record<string, unknown>[]) : [];
  const i = Number(index);
  if (!list[i]) return settings;
  return { ...settings, [listKey]: list.map((item, j) => (j === i ? { ...item, [field]: value } : item)) };
}

export function getByPath(settings: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  if (parts.length === 1) return settings[parts[0]!];
  const list = settings[parts[0]!];
  return Array.isArray(list) ? (list[Number(parts[1])] as Record<string, unknown> | undefined)?.[parts[2]!] : undefined;
}

export const sectionDef = (type: string): SectionDef | undefined => SECTIONS.find((s) => s.type === type);
/** Whether a section may be placed on this kind of page. */
export const allowedOn = (def: SectionDef, kind: PageKind): boolean => def.page === kind || (def.pages?.includes(kind) ?? false);
export const sectionsFor = (kind: PageKind): SectionDef[] => SECTIONS.filter((s) => allowedOn(s, kind));
/** The sections a page cannot lose. */
export const requiredFor = (kind: PageKind): string[] => SECTIONS.filter((s) => s.required && s.page === kind).map((s) => s.type);

// ---- The page ------------------------------------------------------------------------------------------------------

export interface PageSection {
  id: string;
  type: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
}

export interface PageJson {
  version: 1;
  sections: PageSection[];
}

export const MAX_SECTIONS = 30;
const ID = /^[a-z0-9_-]{3,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** `https://` or a path on the store. Never `javascript:`, `data:` or anything else. */
export function safeUrl(v: string): boolean {
  if (v === "") return true;
  if (/^\/(?!\/)[^\s]*$/.test(v)) return true;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
/** Pictures are the store's own uploads, or an https address. */
export const safeImage = (v: string) => v === "" || (/^\/media\/[A-Za-z0-9._/-]+$/.test(v) && !v.includes("..")) || (/^https:\/\//.test(v) && safeUrl(v));

// Control characters are removed on purpose: text from the editor must not carry them into the page.
// eslint-disable-next-line no-control-regex
const plain = (s: string, max: number) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").slice(0, max);

function normField(f: Field, raw: unknown, where: string): unknown {
  const bad = (msg: string): never => {
    throw new ValidationError(`${where}: ${msg}`, { field: f.key });
  };
  switch (f.type) {
    case "checkbox": return raw === true || raw === "on" || raw === "true";
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return bad(`${f.label} must be a number`);
      const r = Math.round(n);
      if ((f.min !== undefined && r < f.min) || (f.max !== undefined && r > f.max)) return bad(`${f.label} must be from ${f.min} to ${f.max}`);
      return r;
    }
    case "select": {
      const v = String(raw ?? "");
      if (!f.options?.some((o) => o.value === v)) return bad(`${f.label} is not one of the choices`);
      return v;
    }
    case "color": {
      const v = String(raw ?? "");
      if (!HEX.test(v)) return bad(`${f.label} must be a colour like #2B2118`);
      return v.toUpperCase();
    }
    case "url": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (v.length > (f.max ?? 300)) return bad(`${f.label} is too long`);
      if (!safeUrl(v)) return bad(`${f.label} must start with https:// or /`);
      return v;
    }
    case "image": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (v.length > (f.max ?? 400)) return bad(`${f.label} is too long`);
      if (!safeImage(v)) return bad(`${f.label} must be an uploaded picture or an https:// address`);
      return v;
    }
    default: {
      const v = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
      return plain(v, f.max ?? 200).trim();
    }
  }
}

function normObject(fields: Field[], raw: unknown, defaults: Record<string, unknown>, where: string): Record<string, unknown> {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = normField(f, f.key in src ? src[f.key] : defaults[f.key], where);
  return out;
}

/** Cleans one section's settings against its definition. Unknown keys are dropped, bad values refused with a plain message. */
export function normalizeSettings(def?: SectionDef | null, raw?: unknown, label = def?.label ?? "Section"): Record<string, unknown> {
  if (!def) return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = normObject(def.fields, raw, def.defaults, label);
  if (def.list) {
    const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[def.list.key] : undefined;
    const arr = Array.isArray(src) ? src : (def.defaults[def.list.key] as unknown[]);
    if (arr.length < def.list.min) throw new ValidationError(`${label}: add at least ${def.list.min} ${def.list.itemLabel.toLowerCase()}`);
    if (arr.length > def.list.max) throw new ValidationError(`${label}: at most ${def.list.max} ${def.list.label.toLowerCase()}`);
    out[def.list.key] = arr.map((item, i) => normObject(def.list!.fields, item, def.list!.defaultItem, `${label}, ${def.list!.itemLabel.toLowerCase()} ${i + 1}`));
  }
  const problem = def.check?.(out);
  if (problem) throw new ValidationError(`${label}: ${problem}`);
  return out;
}

/** Checks a whole page: known sections, limits per section, unique ids, clean settings. Returns the normalised page. */
export function validatePage(kind: PageKind, raw: unknown): PageJson {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { sections?: unknown }).sections)) throw new ValidationError("The page is not in the right shape");
  const list = (raw as { sections: unknown[] }).sections;
  if (list.length > MAX_SECTIONS) throw new ValidationError(`A page can have up to ${MAX_SECTIONS} sections`);
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const sections = list.map((s, i): PageSection => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const def = typeof o.type === "string" ? sectionDef(o.type) : undefined;
    if (!def || !allowedOn(def, kind)) throw new ValidationError(`Section ${i + 1} is not one this page can use`);
    const id = typeof o.id === "string" ? o.id : "";
    if (!ID.test(id)) throw new ValidationError(`Section ${i + 1} has a bad id`);
    if (seen.has(id)) throw new ValidationError(`Two sections share the id ${id}`);
    seen.add(id);
    const n = (counts.get(def.type) ?? 0) + 1;
    counts.set(def.type, n);
    if (def.max && n > def.max) throw new ValidationError(`Only ${def.max} ${def.label.toLowerCase()} ${def.max === 1 ? "section is" : "sections are"} allowed on a page`);
    return { id, type: def.type, ...(o.disabled === true ? { disabled: true } : {}), settings: normalizeSettings(def, o.settings, `${def.label} (section ${i + 1})`) };
  });
  for (const type of requiredFor(kind)) {
    const label = sectionDef(type)!.label;
    const found = sections.find((s) => s.type === type);
    if (!found) throw new ValidationError(`This page needs the "${label}" section`);
    if (found.disabled) throw new ValidationError(`The "${label}" section cannot be hidden: this page does not work without it`);
  }
  return { version: 1, sections };
}

let counter = 0;
export function newSectionId(type: string): string {
  return `${type.replace(/[^a-z0-9]/g, "").slice(0, 12)}_${Date.now().toString(36)}${(++counter).toString(36)}`.slice(0, 40);
}

export function newSection(type: string): PageSection {
  const def = sectionDef(type);
  if (!def) throw new ValidationError("Unknown section");
  return { id: newSectionId(type), type, settings: structuredClone(def.defaults) };
}

export function defaultHomePage(): PageJson {
  return {
    version: 1,
    sections: ["hero", "featured-products", "category-grid", "trust-strip"].map((type) => ({ id: `${type.replace(/-/g, "_")}_1`, type, settings: normalizeSettings(sectionDef(type)!, {}) })),
  };
}

export function defaultLandingPage(): PageJson {
  return {
    version: 1,
    sections: ["lp-hero", "lp-benefits", "lp-gallery", "lp-order-form", "lp-faq", "lp-sticky-cta"].map((type) => ({ id: `${type.replace(/-/g, "_")}_1`, type, settings: normalizeSettings(sectionDef(type)!, {}) })),
  };
}

const starting = (types: string[]): PageJson => ({ version: 1, sections: types.map((type) => ({ id: `${type.replace(/-/g, "_")}_1`, type, settings: normalizeSettings(sectionDef(type)!, {}) })) });
const DEFAULT_PAGES: Record<Exclude<PageKind, "landing" | "custom">, string[]> = {
  home: ["hero", "featured-products", "category-grid", "trust-strip"],
  // The layouts the storefront has always had: they are what a store shows until its owner edits them.
  product: ["product-main", "product-reviews", "product-related"],
  collection: ["collection-header", "collection-products"],
  cart: ["cart-main"],
};
/** The starting layout of any page kind. Landing pages have their own. */
export function defaultPageFor(kind: PageKind): PageJson {
  if (kind === "landing") return defaultLandingPage();
  if (kind === "custom") return defaultCustomPage();
  return starting(DEFAULT_PAGES[kind]);
}

/** A new page made from sections starts as one heading and paragraph, ready to type into. */
export function defaultCustomPage(): PageJson {
  return starting(["lp-text"]);
}

/** Which list of products a product-grid section shows ("new", "sale", "featured", "cat:<slug>"). Shared by the server and the live preview. */
export function productKey(s: { source: string; categorySlug?: string }): string {
  return s.source === "category" ? `cat:${s.categorySlug ?? ""}` : s.source;
}
