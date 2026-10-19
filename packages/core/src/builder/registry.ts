import { ValidationError } from "../errors";
import type { SiteMode, BusinessVertical } from "../site/mode";
import type { TenantCapabilities } from "../site/capabilities";

export type { SiteMode, BusinessVertical };

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

  /** BizTrack Business modes where this section can be placed. Null/undefined = all modes compatible with its capabilities. */
  modes?: SiteMode[];
  /** Recommended verticals for this section in the section picker. */
  verticals?: BusinessVertical[];
  /** Required capability flags (e.g. ["commerce"], ["menu"], ["booking_requests"], ["leads"]). */
  capabilities?: (keyof TenantCapabilities | string)[];
  /** Categorization for the builder section browser. */
  category?: "hero" | "content" | "proof" | "contact" | "vertical" | "commerce" | "promotions";
  /** Live database feed source for the section. "settings" = uses inline settings. */
  dataSource?: "settings" | "section" | "services" | "menu" | "events" | "portfolio";
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
  {
    type: "drop-spotlight", label: "Drop countdown & pre-order", description: "Showcase an upcoming or live limited drop banner with link and call to action.", page: "home", pages: ["custom", "product", "collection"], max: 2,
    fields: [
      t("title", "Heading", 80), tb("title", "Heading", 80),
      area("subtitle", "Subheading / Terms", 200), areab("subtitle", "Subheading / Terms", 200),
      t("dropSlug", "Drop handle / slug", 80, { hint: "The slug of the drop from Marketing > Limited Drops" }),
      t("ctaText", "Button text", 30), tb("ctaText", "Button text", 30),
      { key: "bgColor", label: "Background colour", type: "color" },
      { key: "textColor", label: "Text colour", type: "color" },
    ],
    defaults: { title: "Exclusive Limited Drop", titleBn: "এক্সক্লুসিভ লিমিটেড ড্রপ", subtitle: "Pre-order now before allocation caps run out.", subtitleBn: "স্টক শেষ হওয়ার আগেই প্রি-অর্ডার বুকিং করুন।", dropSlug: "", ctaText: "Explore Drop", ctaTextBn: "ড্রপ দেখুন", bgColor: "#0f172a", textColor: "#ffffff" },
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
  // ---- BizTrack Business Verticals
  {
    type: "restaurant-menu",
    label: "Restaurant menu",
    description: "Interactive food & beverage menu with category tabs, dish descriptions, prices and dietary badges.",
    page: "custom",
    pages: ["home", "custom"],
    max: 2,
    category: "vertical",
    verticals: ["RESTAURANT"],
    capabilities: ["menu"],
    dataSource: "menu",
    fields: [
      t("title", "Menu title", 80),
      tb("title", "Menu title", 80),
      area("subtitle", "Menu subtitle", 200),
      areab("subtitle", "Menu subtitle", 200),
      {
        key: "source",
        label: "Menu source",
        type: "select",
        options: [
          { value: "auto", label: "Live Menu categories (from Admin -> Menu)" },
          { value: "custom", label: "Custom inline dishes (set below)" },
        ],
      },
      { key: "showDietary", label: "Show dietary labels (Halal, Chef Special)", type: "checkbox" },
    ],
    list: {
      key: "items",
      label: "Custom menu items",
      itemLabel: "Dish",
      min: 1,
      max: 16,
      fields: [
        t("name", "Dish name", 80),
        tb("name", "Dish name", 80),
        t("category", "Category", 40),
        tb("category", "Category", 40),
        { key: "price", label: "Price (৳)", type: "number", min: 0 },
        area("description", "Description", 200),
        areab("description", "Description", 200),
        { key: "isChefSpecial", label: "Chef Special badge", type: "checkbox" },
        { key: "isHalal", label: "Halal badge", type: "checkbox" },
      ],
      defaultItem: {
        name: "Special Kacchi Biryani",
        nameBn: "স্পেশাল কাচ্চি বিরিয়ানি",
        category: "Biryani & Rice",
        categoryBn: "বিরিয়ানি ও পোলাও",
        price: 380,
        description: "Aromatic Chinigura rice slow-cooked with tender mutton and saffron.",
        descriptionBn: "ঘিয়ে ভাজা চিনিগুঁড়া চাল ও খাসির নরম মাংসের খাঁটি কাচ্চি।",
        isChefSpecial: true,
        isHalal: true,
      },
    },
    defaults: {
      title: "Our Menu",
      titleBn: "আমাদের স্পেশাল মেন্যু",
      subtitle: "Freshly prepared daily with 100% authentic Halal ingredients",
      subtitleBn: "প্রতিদিন খাঁটি উপাদানে প্রস্তুতকৃত ১০০% হালাল খাবার",
      source: "auto",
      showDietary: true,
      items: [
        {
          name: "Special Kacchi Biryani",
          nameBn: "স্পেশাল কাচ্চি বিরিয়ানি",
          category: "Biryani & Rice",
          categoryBn: "বিরিয়ানি ও পোলাও",
          price: 380,
          description: "Aromatic Chinigura rice slow-cooked with tender mutton and saffron.",
          descriptionBn: "ঘিয়ে ভাজা চিনিগুঁড়া চাল ও খাসির নরম মাংসের খাঁটি কাচ্চি।",
          isChefSpecial: true,
          isHalal: true,
        },
        {
          name: "Butter Chicken Masala",
          nameBn: "বাটার চিকেন কারি",
          category: "Curries",
          categoryBn: "কারি ও ডিশেস",
          price: 320,
          description: "Tandoori chicken pieces simmered in rich creamy tomato butter gravy.",
          descriptionBn: "ক্রিমি টমেটো গ্রেভিতে রান্না করা সুস্বাদু তন্দুরি চিকেন।",
          isChefSpecial: false,
          isHalal: true,
        },
      ],
    },
  },
  {
    type: "restaurant-hours-location",
    label: "Restaurant hours & location",
    description: "Business hours, full street address, Google Maps link, and direct table reservation prompt.",
    page: "custom",
    pages: ["home", "custom"],
    max: 1,
    category: "vertical",
    verticals: ["RESTAURANT"],
    fields: [
      t("title", "Section title", 80),
      tb("title", "Section title", 80),
      t("hoursWeekday", "Regular hours (Sat - Thu)", 60),
      tb("hoursWeekday", "Regular hours (Sat - Thu)", 60),
      t("hoursWeekend", "Weekend / Friday hours", 60),
      tb("hoursWeekend", "Weekend / Friday hours", 60),
      area("address", "Street address", 160),
      areab("address", "Street address", 160),
      link("googleMapsUrl", "Google Maps link"),
      t("phone", "Contact phone", 30),
      link("reservationLink", "Reservation page link"),
    ],
    defaults: {
      title: "Hours & Location",
      titleBn: "সময়সূচি ও অবস্থান",
      hoursWeekday: "Sat - Thu: 11:00 AM - 11:00 PM",
      hoursWeekdayBn: "শনি - বৃহস্পতি: সকাল ১১:০০ - রাত ১১:০০",
      hoursWeekend: "Friday: 2:00 PM - 11:30 PM",
      hoursWeekendBn: "শুক্রবার: দুপুর ২:০০ - রাত ১১:৩০",
      address: "House 12, Road 7, Dhanmondi, Dhaka",
      addressBn: "বাড়ি ১২, রোড ৭, ধানমন্ডি, ঢাকা",
      googleMapsUrl: "https://maps.google.com",
      phone: "01712-345678",
      reservationLink: "/reservations",
    },
  },
  {
    type: "reservation-cta",
    label: "Table reservation request",
    description: "Table booking form allowing guests to submit date, time, and party size.",
    page: "custom",
    pages: ["home", "custom"],
    max: 1,
    category: "contact",
    verticals: ["RESTAURANT"],
    capabilities: ["booking_requests"],
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle instructions", 200),
      areab("subtitle", "Subtitle instructions", 200),
      area("notice", "Urgent booking notice", 140),
      areab("notice", "Urgent booking notice", 140),
      t("directPhone", "Direct hotline phone", 30),
    ],
    defaults: {
      title: "Book a Table",
      titleBn: "টেবিল বুকিং রিকোয়েস্ট",
      subtitle: "Submit your preferred date and guest count. Our team will confirm via WhatsApp or Phone.",
      subtitleBn: "আপনার পছন্দের তারিখ ও অতিথির সংখ্যা জানিয়ে রিকোয়েস্ট পাঠান। আমাদের টিম ফোনে নিশ্চিত করবে।",
      notice: "For same-day reservations within 2 hours, please call directly.",
      noticeBn: "জরুরি বা ২ ঘণ্টার মধ্যে টেবিল পেতে অনুগ্রহ করে সরাসরি ফোন করুন।",
      directPhone: "01712-345678",
    },
  },
  {
    type: "doctor-hero",
    label: "Doctor professional hero",
    description: "Doctor profile header with BMDC registration, degrees, hospital affiliation, and appointment CTA.",
    page: "custom",
    pages: ["home", "custom"],
    max: 1,
    category: "vertical",
    verticals: ["DOCTOR_CLINIC"],
    fields: [
      t("name", "Doctor full name", 80),
      tb("name", "Doctor full name", 80),
      t("specialty", "Specialty", 80),
      tb("specialty", "Specialty", 80),
      t("degrees", "Qualifications / Degrees", 100),
      tb("degrees", "Qualifications / Degrees", 100),
      t("designation", "Designation", 100),
      tb("designation", "Designation", 100),
      t("institute", "Affiliated hospital / Medical college", 120),
      tb("institute", "Affiliated hospital / Medical college", 120),
      t("bmdcReg", "BMDC Registration number", 40),
      image("image", "Doctor photo"),
      link("appointmentLink", "Appointment page link"),
    ],
    defaults: {
      name: "Dr. Ahmed Tanvir",
      nameBn: "ডাঃ আহমেদ তানভীর",
      specialty: "Cardiologist & Specialist Physician",
      specialtyBn: "হৃদরোগ ও মেডিসিন বিশেষজ্ঞ",
      degrees: "MBBS, FCPS (Medicine), MD (Cardiology)",
      degreesBn: "এমবিবিএস, এফসিপিএস (মেডিসিন), এমডি (কার্ডিওলজি)",
      designation: "Associate Professor & Senior Consultant",
      designationBn: "সহযোগী অধ্যাপক ও সিনিয়র কনসালট্যান্ট",
      institute: "Dhaka Medical College & Hospital",
      instituteBn: "ঢাকা মেডিকেল কলেজ ও হাসপাতাল",
      bmdcReg: "BMDC Reg No: A-48291",
      image: "",
      appointmentLink: "/appointment",
    },
  },
  {
    type: "clinic-chambers",
    label: "Chambers & consultation schedules",
    description: "Chamber location cards with weekly visiting days, hours, and serial contact numbers.",
    page: "custom",
    pages: ["home", "custom"],
    max: 2,
    category: "vertical",
    verticals: ["DOCTOR_CLINIC"],
    capabilities: ["services"],
    fields: [
      t("title", "Section title", 80),
      tb("title", "Section title", 80),
      area("subtitle", "Subtitle", 160),
      areab("subtitle", "Subtitle", 160),
      {
        key: "source",
        label: "Chambers source",
        type: "select",
        options: [
          { value: "auto", label: "Database chambers (with starter fallback)" },
          { value: "custom", label: "Custom inline chambers (set below)" },
        ],
      },
      link("appointmentLink", "Online request link"),
    ],
    list: {
      key: "items",
      label: "Custom chambers",
      itemLabel: "Chamber",
      min: 1,
      max: 6,
      fields: [
        t("name", "Chamber / Hospital name", 80),
        tb("name", "Chamber / Hospital name", 80),
        area("address", "Full address", 160),
        areab("address", "Full address", 160),
        t("schedule", "Visiting days & hours", 80),
        tb("schedule", "Visiting days & hours", 80),
        t("phone", "Serial booking phone", 30),
      ],
      defaultItem: {
        name: "Ibn Sina Diagnostic & Consultation Center",
        nameBn: "ইবনে সিনা ডায়াগনস্টিক সেন্টার",
        address: "House 48, Road 9/A, Dhanmondi, Dhaka",
        addressBn: "বাড়ি ৪৮, রোড ৯/এ, ধানমন্ডি, ঢাকা",
        schedule: "Sat, Mon, Wed: 5:00 PM - 9:00 PM",
        scheduleBn: "শনি, সোম, বুধ: বিকাল ৫:০০ - রাত ৯:০০",
        phone: "01712-345678",
      },
    },
    defaults: {
      title: "Chambers & Consultation Schedules",
      titleBn: "চেম্বার ও রোগী দেখার সময়সূচি",
      subtitle: "Direct chamber schedules and serial booking contact numbers",
      subtitleBn: "রোগী দেখার নির্ধারিত চেম্বার ও সরাসরি সিরিয়ালের নম্বর",
      source: "auto",
      appointmentLink: "/appointment",
      items: [
        {
          name: "Ibn Sina Diagnostic & Consultation Center",
          nameBn: "ইবনে সিনা ডায়াগনস্টিক সেন্টার",
          address: "House 48, Road 9/A, Dhanmondi, Dhaka",
          addressBn: "বাড়ি ৪৮, রোড ৯/এ, ধানমন্ডি, ঢাকা",
          schedule: "Sat, Mon, Wed: 5:00 PM - 9:00 PM",
          scheduleBn: "শনি, সোম, বুধ: বিকাল ৫:০০ - রাত ৯:০০",
          phone: "01712-345678",
        },
      ],
    },
  },
  {
    type: "service-cards",
    label: "Business service cards",
    description: "Grid of professional service offerings with starting prices and quote actions.",
    page: "custom",
    pages: ["home", "custom"],
    max: 3,
    category: "proof",
    verticals: ["SERVICE_PROVIDER", "BUSINESS_COMPANY", "DOCTOR_CLINIC"],
    capabilities: ["services"],
    fields: [
      t("title", "Section title", 80),
      tb("title", "Section title", 80),
      area("subtitle", "Subtitle", 160),
      areab("subtitle", "Subtitle", 160),
      {
        key: "source",
        label: "Item source",
        type: "select",
        options: [
          { value: "auto", label: "Database services (with starter fallback)" },
          { value: "custom", label: "Custom inline services (set below)" },
        ],
      },
      {
        key: "columns",
        label: "Columns on desktop",
        type: "select",
        options: [
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
          { value: "4", label: "4 columns" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Custom services",
      itemLabel: "Service",
      min: 1,
      max: 12,
      fields: [
        t("title", "Service name", 80),
        tb("title", "Service name", 80),
        area("description", "Description", 240),
        areab("description", "Description", 240),
        { key: "startingPrice", label: "Starting price (৳, optional)", type: "number", min: 0 },
        t("icon", "Icon or emoji", 20),
        link("ctaLink", "Button link (optional)"),
      ],
      defaultItem: {
        title: "Commercial Facility Maintenance",
        titleBn: "বাণিজ্যিক রক্ষণাবেক্ষণ সেবা",
        description: "Full-cycle professional inspection, routine repair, and breakdown safety audits.",
        descriptionBn: "নিয়মিত পরিদর্শন, দ্রুত মেরামত এবং নিরাপত্তা অডিটের সমন্বিত সেবা।",
        startingPrice: 2500,
        icon: "⚡",
        ctaLink: "/contact",
      },
    },
    defaults: {
      title: "Our Professional Services",
      titleBn: "আমাদের সেবাসমূহ",
      subtitle: "Reliable and high-quality solutions delivered by certified specialists",
      subtitleBn: "নিবেদিত পেশাদারদের দ্বারা দক্ষ ও নির্ভরযোগ্য সমাধান",
      source: "auto",
      columns: "3",
      items: [
        {
          title: "Commercial & Office AC Maintenance",
          titleBn: "অফিস ও বাণিজ্যিক এসি সার্ভিসিং",
          description: "Full jet-wash cleaning, gas pressure inspection, compressor health audit and fast breakdown repairs.",
          descriptionBn: "জেট ওয়াশ ডিপ ক্লিনিং, গ্যাস প্রেশার চেক ও দ্রুত মেরামতের নির্ভরযোগ্য সার্ভিস।",
          startingPrice: 1200,
          icon: "❄️",
          ctaLink: "/contact",
        },
        {
          title: "Electrical & Substation Servicing",
          titleBn: "ইলেকট্রিক্যাল ও সাবস্টেশন সমাধান",
          description: "Certified electricians for load calculation, DB board maintenance, safety earthing and industrial wiring.",
          descriptionBn: "লোড ক্যালকুলেশন, ডিবি বোর্ড রক্ষণাবেক্ষণ ও ফ্যাক্টরি ওয়্যারিংয়ের সার্টিফাইড সেবা।",
          startingPrice: 2500,
          icon: "⚡",
          ctaLink: "/contact",
        },
        {
          title: "Corporate Facility Pest Control",
          titleBn: "কর্পোরেট পেস্ট কন্ট্রোল সার্ভিস",
          description: "Odorless herbal treatment for termites, roaches and rodents with 6-month written warranty.",
          descriptionBn: "গন্ধহীন আধুনিক পেস্ট কন্ট্রোল এবং উইপোকা দমনে ৬ মাসের লিখিত ওয়ারেন্টি।",
          startingPrice: 3500,
          icon: "🛡️",
          ctaLink: "/contact",
        },
      ],
    },
  },
  {
    type: "team-grid",
    label: "Team & specialist profiles",
    description: "Photo profiles of leadership, doctors, or team members with credentials.",
    page: "custom",
    pages: ["home", "custom"],
    max: 2,
    category: "proof",
    verticals: ["BUSINESS_COMPANY", "DOCTOR_CLINIC", "SERVICE_PROVIDER"],
    fields: [
      t("title", "Section title", 80),
      tb("title", "Section title", 80),
      area("subtitle", "Subtitle", 160),
      areab("subtitle", "Subtitle", 160),
      {
        key: "source",
        label: "Item source",
        type: "select",
        options: [
          { value: "auto", label: "Database team (with starter fallback)" },
          { value: "custom", label: "Custom inline team (set below)" },
        ],
      },
      {
        key: "columns",
        label: "Columns on desktop",
        type: "select",
        options: [
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
          { value: "4", label: "4 columns" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Custom team members",
      itemLabel: "Member",
      min: 1,
      max: 12,
      fields: [
        t("name", "Full name", 60),
        tb("name", "Full name", 60),
        t("role", "Role / Designation", 60),
        tb("role", "Role / Designation", 60),
        t("degrees", "Credentials / Degrees (optional)", 80),
        tb("degrees", "Credentials / Degrees (optional)", 80),
        image("image", "Photo"),
        area("bio", "Short bio (optional)", 200),
        areab("bio", "Short bio (optional)", 200),
      ],
      defaultItem: {
        name: "Engr. Farhan Kabir",
        nameBn: "প্রকৌ. ফারহান কবির",
        role: "Chief Technical Consultant",
        roleBn: "প্রধান প্রযুক্তি পরামর্শক",
        degrees: "B.Sc (BUET), M.Sc",
        degreesBn: "বিএসসি (বুয়েট), এমএসসি",
        image: "",
        bio: "Over 12 years of industry leadership in engineering solutions.",
        bioBn: "প্রকৌশল সমাধানে ১২ বছরেরও বেশি সময় ধরে শীর্ষস্থানীয় ভূমিকা।",
      },
    },
    defaults: {
      title: "Leadership & Specialists",
      titleBn: "আমাদের টিম",
      subtitle: "Experienced professionals dedicated to your success",
      subtitleBn: "অভিজ্ঞ ও নিবেদিত পেশাদারদের সমাহার",
      source: "auto",
      columns: "3",
      items: [
        {
          name: "Engr. Farhan Kabir",
          nameBn: "প্রকৌ. ফারহান কবির",
          role: "Chief Technical Consultant",
          roleBn: "প্রধান প্রযুক্তি পরামর্শক",
          degrees: "B.Sc (BUET), M.Sc",
          degreesBn: "বিএসসি (বুয়েট), এমএসসি",
          image: "",
          bio: "Over 12 years of industry leadership in engineering solutions.",
          bioBn: "প্রকৌশল সমাধানে ১২ বছরেরও বেশি সময় ধরে শীর্ষস্থানীয় ভূমিকা।",
        },
      ],
    },
  },
  {
    type: "portfolio-grid",
    label: "Featured projects & portfolio",
    description: "Curated grid of completed projects, case studies, or design work.",
    page: "custom",
    pages: ["home", "custom"],
    max: 3,
    category: "proof",
    verticals: ["PERSONAL_PORTFOLIO", "BUSINESS_COMPANY", "SERVICE_PROVIDER", "PUBLIC_FIGURE"],
    fields: [
      t("title", "Section title", 80),
      tb("title", "Section title", 80),
      area("subtitle", "Subtitle", 160),
      areab("subtitle", "Subtitle", 160),
      {
        key: "source",
        label: "Item source",
        type: "select",
        options: [
          { value: "auto", label: "Database projects (with starter fallback)" },
          { value: "custom", label: "Custom inline projects (set below)" },
        ],
      },
      {
        key: "columns",
        label: "Columns on desktop",
        type: "select",
        options: [
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
          { value: "4", label: "4 columns" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Custom projects",
      itemLabel: "Project",
      min: 1,
      max: 12,
      fields: [
        t("title", "Project title", 80),
        tb("title", "Project title", 80),
        t("category", "Category / Tag", 40),
        tb("category", "Category / Tag", 40),
        image("image", "Project cover image"),
        area("description", "Summary (optional)", 200),
        areab("description", "Summary (optional)", 200),
        link("link", "Project link (optional)"),
      ],
      defaultItem: {
        title: "Prime Commercial Tower HVAC Retrofit",
        titleBn: "প্রাইম কমার্শিয়াল টাওয়ার এসি রেট্রোফিট",
        category: "Corporate Facility",
        categoryBn: "কর্পোরেট স্থাপনা",
        image: "",
        description: "Modernized heating & cooling systems across a 15-story building cutting power draw by 28%.",
        descriptionBn: "১৫ তলা ভবনে বিদ্যুৎ সাশ্রয়ী আধুনিক কুলিং সিস্টেম সফলভাবে স্থাপন।",
        link: "",
      },
    },
    defaults: {
      title: "Featured Projects & Portfolio",
      titleBn: "নির্বাচিত কাজ ও প্রজেক্ট",
      subtitle: "A curated selection of our recently completed work and client case studies",
      subtitleBn: "সাম্প্রতিক বাস্তবায়িত কিছু উল্লেখযোগ্য কাজের এক ঝলক",
      source: "auto",
      columns: "3",
      items: [
        {
          title: "Prime Commercial Tower HVAC Retrofit",
          titleBn: "প্রাইম কমার্শিয়াল টাওয়ার এসি রেট্রোফিট",
          category: "Corporate Facility",
          categoryBn: "কর্পোরেট স্থাপনা",
          image: "",
          description: "Modernized heating & cooling systems across a 15-story building cutting power draw by 28%.",
          descriptionBn: "১৫ তলা ভবনে বিদ্যুৎ সাশ্রয়ী আধুনিক কুলিং সিস্টেম সফলভাবে স্থাপন।",
          link: "",
        },
      ],
    },
  },
  {
    type: "download-card",
    label: "Downloadable document card",
    description: "Download card for CV/Resume, Company Brochure, Profile, or Menu PDF.",
    page: "custom",
    pages: ["home", "custom"],
    max: 2,
    category: "content",
    verticals: ["PERSONAL_PORTFOLIO", "BUSINESS_COMPANY", "RESTAURANT", "PUBLIC_FIGURE"],
    capabilities: ["downloads"],
    fields: [
      t("title", "Card title", 80),
      tb("title", "Card title", 80),
      area("description", "Description", 180),
      areab("description", "Description", 180),
      link("fileUrl", "Downloadable file URL"),
      t("fileLabel", "File format and size label", 40),
      t("buttonText", "Button text", 30),
      tb("buttonText", "Button text", 30),
    ],
    defaults: {
      title: "Download CV / Resume",
      titleBn: "সিভি ডাউনলোড করুন",
      description: "Get a comprehensive overview of experience, education and professional credentials.",
      descriptionBn: "আমার সম্পূর্ণ অভিজ্ঞতা, শিক্ষা ও অর্জনের সারসংক্ষেপ দেখতে পিডিএফ ডাউনলোড করুন।",
      fileUrl: "",
      fileLabel: "PDF Document · 2.4 MB",
      buttonText: "Download PDF",
      buttonTextBn: "ডাউনলোড PDF",
    },
  },
  {
    type: "contact-form",
    label: "Contact & inquiry form",
    description: "Lead capture form for customer messages, quote inquiries, and project requests.",
    page: "custom",
    pages: ["home", "custom"],
    max: 2,
    category: "contact",
    capabilities: ["leads"],
    fields: [
      t("heading", "Heading", 80),
      tb("heading", "Heading", 80),
      area("subhead", "Subhead / Description", 200),
      areab("subhead", "Subhead / Description", 200),
      t("buttonText", "Button text", 40),
      tb("buttonText", "Button text", 40),
      t("directPhone", "Direct hotline phone (optional)", 30),
      t("directEmail", "Direct email (optional)", 80),
    ],
    defaults: {
      heading: "Get in Touch",
      headingBn: "যোগাযোগ করুন",
      subhead: "Send us a message and our team will get back to you promptly.",
      subheadBn: "আমাদের বার্তা পাঠান, আমরা দ্রুত আপনার সাথে যোগাযোগ করব।",
      buttonText: "Send Message",
      buttonTextBn: "বার্তা পাঠান",
      directPhone: "",
      directEmail: "",
    },
  },
  // ---- Modern Dynamic Component Sections
  {
    type: "bento-grid",
    label: "Bento feature grid",
    description: "Modern multi-column grid with dynamic spans, badge highlights, metric stats, and call-to-actions.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 4,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      {
        key: "layout",
        label: "Grid layout",
        type: "select",
        options: [
          { value: "bento-3", label: "3 Columns (Balanced)" },
          { value: "bento-2", label: "2 Columns (Editorial)" },
          { value: "bento-4", label: "4 Columns (Dashboard)" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Bento cards",
      itemLabel: "Card",
      min: 1,
      max: 8,
      fields: [
        t("title", "Card title", 70),
        tb("title", "Card title", 70),
        area("text", "Description", 180),
        areab("text", "Description", 180),
        t("badge", "Badge text", 30),
        tb("badge", "Badge text", 30),
        t("metric", "Highlight metric", 20),
        t("metricLabel", "Metric label", 40),
        tb("metricLabel", "Metric label", 40),
        {
          key: "icon",
          label: "Card icon",
          type: "select",
          options: [
            { value: "sparkles", label: "Sparkles" },
            { value: "truck", label: "Truck" },
            { value: "shield", label: "Shield" },
            { value: "star", label: "Star" },
            { value: "bolt", label: "Lightning" },
            { value: "heart", label: "Heart" },
            { value: "award", label: "Award" },
            { value: "clock", label: "Clock" },
            { value: "leaf", label: "Leaf" },
            { value: "check", label: "Check" },
            { value: "book", label: "Book" },
            { value: "info", label: "Info" },
          ],
        },
        {
          key: "cardStyle",
          label: "Card theme",
          type: "select",
          options: [
            { value: "surface", label: "Card Surface" },
            { value: "accent", label: "Brand Accent" },
            { value: "dark", label: "Deep Dark" },
            { value: "gradient", label: "Smooth Gradient" },
            { value: "glass", label: "Glassmorphism" },
          ],
        },
        {
          key: "span",
          label: "Column span",
          type: "select",
          options: [
            { value: "1", label: "Single (1 col)" },
            { value: "2", label: "Wide (2 col span)" },
          ],
        },
        image("image", "Background picture"),
        t("ctaText", "Button text", 30),
        tb("ctaText", "Button text", 30),
        link("ctaLink", "Button link"),
      ],
      defaultItem: {
        title: "Fast Delivery Across BD",
        titleBn: "সারা বাংলাদেশে দ্রুত ডেলিভারি",
        text: "Guaranteed door-to-door delivery with live tracking.",
        textBn: "লাইভ ট্র্যাকিং সহ নিশ্চিন্ত হোম ডেলিভারি সেবা।",
        badge: "Popular",
        badgeBn: "জনপ্রিয়",
        metric: "24h",
        metricLabel: "Dhaka delivery",
        metricLabelBn: "ঢাকায় ডেলিভারি",
        icon: "truck",
        cardStyle: "surface",
        span: "1",
        image: "",
        ctaText: "Explore",
        ctaTextBn: "বিস্তারিত",
        ctaLink: "/products",
      },
    },
    defaults: {
      title: "Why Choose Us",
      titleBn: "কেন আমাদের বেছে নেবেন",
      subtitle: "Handcrafted quality, transparent pricing, and nationwide support.",
      subtitleBn: "সেরা মান, সাশ্রয়ী মূল্য এবং দ্রুত গ্রাহক সেবা।",
      layout: "bento-3",
      items: [
        {
          title: "Lightning Fast Delivery",
          titleBn: "সারা দেশে দ্রুত ডেলিভারি",
          text: "24 hours inside Dhaka and 48-72 hours across all 64 districts with real-time updates.",
          textBn: "ঢাকায় ২৪ ঘণ্টার মধ্যে এবং সারাদেশে ২-৩ দিনে হোম ডেলিভারি।",
          badge: "Speed",
          badgeBn: "দ্রুততম",
          metric: "99.4%",
          metricLabel: "On-time arrival",
          metricLabelBn: "সঠিক সময়ে প্রাপ্তি",
          icon: "truck",
          cardStyle: "accent",
          span: "2",
          image: "",
          ctaText: "Track Order",
          ctaTextBn: "অর্ডার ট্র্যাক",
          ctaLink: "/track",
        },
        {
          title: "Authentic & 100% Verified",
          titleBn: "খাঁটি ও শতভাগ যাচাইকৃত",
          text: "Directly sourced from trusted artisans and certified manufacturers.",
          textBn: "সরাসরি প্রস্তুতকারকদের থেকে সংগৃহীত খাঁটি পণ্য।",
          badge: "Certified",
          badgeBn: "যাচাইকৃত",
          metric: "100%",
          metricLabel: "Original items",
          metricLabelBn: "আসল পণ্য",
          icon: "shield",
          cardStyle: "surface",
          span: "1",
          image: "",
          ctaText: "Our Story",
          ctaTextBn: "আমাদের কথা",
          ctaLink: "/about",
        },
        {
          title: "Hassle-Free Return",
          titleBn: "সহজ রিটার্ন সুবিধা",
          text: "7-day exchange warranty with immediate doorstep support.",
          textBn: "পণ্য পরিবর্তনের সহজ ও নির্ভরযোগ্য সুবিধা।",
          badge: "Guarantee",
          badgeBn: "গ্যারান্টি",
          metric: "7 Days",
          metricLabel: "Easy exchange",
          metricLabelBn: "এক্সচেঞ্জ মেয়াদ",
          icon: "award",
          cardStyle: "dark",
          span: "1",
          image: "",
          ctaText: "",
          ctaTextBn: "",
          ctaLink: "",
        },
        {
          title: "Dedicated Support 24/7",
          titleBn: "সার্বক্ষণিক গ্রাহক সেবা",
          text: "Friendly customer agents available via phone, WhatsApp, and chat.",
          textBn: "ফোন, হোয়াটসঅ্যাপ এবং চ্যাটের মাধ্যমে সার্বক্ষণিক সাহায্য।",
          badge: "Support",
          badgeBn: "সহায়তা",
          metric: "< 2m",
          metricLabel: "Response time",
          metricLabelBn: "রেসপন্স টাইম",
          icon: "bolt",
          cardStyle: "gradient",
          span: "2",
          image: "",
          ctaText: "Contact Us",
          ctaTextBn: "যোগাযোগ করুন",
          ctaLink: "/contact",
        },
      ],
    },
  },
  {
    type: "content-tabs",
    label: "Interactive content tabs",
    description: "Switch between topics, specs, features or menus with smooth tab switching and media sidebars.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 4,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      {
        key: "tabStyle",
        label: "Tab style",
        type: "select",
        options: [
          { value: "pills", label: "Pills" },
          { value: "underline", label: "Minimal Underline" },
          { value: "boxed", label: "Segmented Box" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Tabs",
      itemLabel: "Tab",
      min: 1,
      max: 6,
      fields: [
        t("label", "Tab button label", 40),
        tb("label", "Tab button label", 40),
        {
          key: "icon",
          label: "Tab icon",
          type: "select",
          options: [
            { value: "sparkles", label: "Sparkles" },
            { value: "star", label: "Star" },
            { value: "shield", label: "Shield" },
            { value: "truck", label: "Truck" },
            { value: "bolt", label: "Lightning" },
            { value: "heart", label: "Heart" },
            { value: "award", label: "Award" },
            { value: "clock", label: "Clock" },
            { value: "leaf", label: "Leaf" },
            { value: "check", label: "Check" },
            { value: "book", label: "Book" },
            { value: "info", label: "Info" },
          ],
        },
        t("badge", "Pill badge (optional)", 20),
        tb("badge", "Pill badge (optional)", 20),
        t("title", "Content heading", 80),
        tb("title", "Content heading", 80),
        area("text", "Content description", 300),
        areab("text", "Content description", 300),
        image("image", "Sidebar picture"),
        t("ctaText", "Button text", 30),
        tb("ctaText", "Button text", 30),
        link("ctaLink", "Button link"),
      ],
      defaultItem: {
        label: "Overview",
        labelBn: "সংক্ষিপ্ত বিবরণ",
        icon: "sparkles",
        badge: "",
        badgeBn: "",
        title: "Crafted With Premium Precision",
        titleBn: "প্রিমিয়াম কোয়ালিটির নিশ্চয়তা",
        text: "Every single detail has been thoughtfully engineered for long lasting reliability and customer delight.",
        textBn: "দীর্ঘস্থায়ী স্থায়িত্ব ও অনন্য অভিজ্ঞতার জন্য প্রতিটি বিবরণ যত্নসহকারে তৈরি করা হয়েছে।",
        image: "",
        ctaText: "Learn More",
        ctaTextBn: "আরও জানুন",
        ctaLink: "/about",
      },
    },
    defaults: {
      title: "Explore What We Offer",
      titleBn: "আমাদের বিশেষ সুবিধাসমূহ",
      subtitle: "Select a tab to view key features, specifications, and advantages.",
      subtitleBn: "আমাদের বিশেষত্ব ও সুবিধাসমূহ বিস্তারিত জানতে যেকোনো ট্যাব নির্বাচন করুন।",
      tabStyle: "pills",
      items: [
        {
          label: "Quality Craft",
          labelBn: "উচ্চ মান",
          icon: "award",
          badge: "Signature",
          badgeBn: "সিগনেচার",
          title: "Uncompromising Attention to Materials",
          titleBn: "খাঁটি ও টেকসই উপকরণের নিশ্চয়তা",
          text: "We source our raw components directly from accredited suppliers to maintain pristine grade standards across every batch.",
          textBn: "সেরা মান ধরে রাখতে আমরা সরাসরি অনুমোদিত সরবরাহকারীদের কাছ থেকে উপকরণ সংগ্রহ করি।",
          image: "",
          ctaText: "View Collection",
          ctaTextBn: "কালেকশন দেখুন",
          ctaLink: "/products",
        },
        {
          label: "Nationwide Care",
          labelBn: "দেশব্যাপী সেবা",
          icon: "truck",
          badge: "",
          badgeBn: "",
          title: "Doorstep Express Delivery & Support",
          titleBn: "দ্রুত ডেলিভারি ও আন্তরিক সাপোর্ট",
          text: "Our dedicated logistics partners guarantee safe, rapid, and fully insured parcel delivery straight to your doorstep.",
          textBn: "আমাদের নিজস্ব লজিস্টিকসের মাধ্যমে আপনার ঠিকানায় দ্রুত ও নিরাপদে পণ্য পৌঁছে দেওয়া হয়।",
          image: "",
          ctaText: "Delivery Info",
          ctaTextBn: "ডেলিভারি তথ্য",
          ctaLink: "/delivery",
        },
        {
          label: "100% Satisfaction",
          labelBn: "শতভাগ সন্তুষ্টি",
          icon: "shield",
          badge: "Safe",
          badgeBn: "নিরাপদ",
          title: "Money-Back Guarantee & Exchanges",
          titleBn: "মানি-ব্যাক ও এক্সচেঞ্জ সুবিধা",
          text: "Order with complete confidence. Inspect your items upon arrival with full support from our friendly representatives.",
          textBn: "সম্পূর্ণ নিশ্চিন্তে কেনাকাটা করুন। পণ্য হাতে পেয়ে চেক করার সুযোগ রয়েছে।",
          image: "",
          ctaText: "Read Guarantee",
          ctaTextBn: "শর্তাবলী দেখুন",
          ctaLink: "/guarantee",
        },
      ],
    },
  },
  {
    type: "video-lightbox",
    label: "Video showcase lightbox",
    description: "Blazing fast video preview card with pulsating play button that opens a clean modal player dialog.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 2,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Badge", 30),
      tb("badge", "Badge", 30),
      link("videoUrl", "Video address"),
      image("coverImage", "Custom cover picture"),
      {
        key: "aspectRatio",
        label: "Aspect ratio",
        type: "select",
        options: [
          { value: "16-9", label: "16:9 Widescreen" },
          { value: "4-3", label: "4:3 Standard" },
          { value: "21-9", label: "21:9 Cinematic" },
        ],
      },
      t("playLabel", "Play button label", 40),
      tb("playLabel", "Play button label", 40),
    ],
    defaults: {
      title: "See Our Craft in Action",
      titleBn: "ভিডিওতে আমাদের কাজ দেখুন",
      subtitle: "Watch our 2-minute journey and see the dedication behind every order.",
      subtitleBn: "আমাদের কার্যক্রম ও কাজের মান সম্পর্কে সংক্ষেপে জেনে নিন।",
      badge: "Watch Video",
      badgeBn: "ভিডিও দেখুন",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      coverImage: "",
      aspectRatio: "16-9",
      playLabel: "Watch Story (2 mins)",
      playLabelBn: "ভিডিওটি দেখুন (২ মিনিট)",
    },
  },
  // ---- Phase 3: Conversions, Social Proof & Pricing Matrix
  {
    type: "testimonials-slider",
    label: "Swipeable review carousel",
    description: "Touch-friendly swipeable carousel for customer reviews, star ratings, verified badges and reviewer locations.",
    page: "custom",
    pages: ["home", "custom", "landing", "product"],
    max: 3,
    category: "proof",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Trust rating badge", 40),
      tb("badge", "Trust rating badge", 40),
      {
        key: "layout",
        label: "Display layout",
        type: "select",
        options: [
          { value: "cards", label: "Cards Slider" },
          { value: "minimal", label: "Minimalist Quotes" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Customer reviews",
      itemLabel: "Review",
      min: 1,
      max: 8,
      fields: [
        t("name", "Customer name", 50),
        tb("name", "Customer name", 50),
        t("role", "Title / Note", 50),
        tb("role", "Title / Note", 50),
        t("location", "City / Area", 40),
        tb("location", "City / Area", 40),
        { key: "rating", label: "Stars", type: "number", min: 1, max: 5 },
        area("text", "Review message", 300),
        areab("text", "Review message", 300),
        image("avatar", "Customer photo"),
        { key: "verified", label: "Verified Buyer badge", type: "checkbox" },
      ],
      defaultItem: {
        name: "Sumaiya Akter",
        nameBn: "সুমাইয়া আক্তার",
        role: "Verified Customer",
        roleBn: "ভেরিফায়েড ক্রেতা",
        location: "Dhanmondi, Dhaka",
        locationBn: "ধানমন্ডি, ঢাকা",
        rating: 5,
        text: "The quality exceeded my expectations. Delivered in less than 24 hours in Dhaka!",
        textBn: "কাপড়ের মান অসাধারণ ছিল! ২৪ ঘণ্টারও কম সময়ে ঢাকায় ডেলিভারি পেয়েছি।",
        avatar: "",
        verified: true,
      },
    },
    defaults: {
      title: "What Our Valued Customers Say",
      titleBn: "গ্রাহকদের আসল প্রতিক্রিয়া ও রিভিউ",
      subtitle: "Real feedback from real buyers across all 64 districts.",
      subtitleBn: "সারাদেশের সম্মানিত গ্রাহকদের বাস্তব অভিজ্ঞতা।",
      badge: "4.9/5 Rating (1,200+ Reviews)",
      badgeBn: "৪.৯/৫ রেটিং (১২০০+ রিভিউ)",
      layout: "cards",
      items: [
        {
          name: "Sumaiya Akter",
          nameBn: "সুমাইয়া আক্তার",
          role: "Verified Customer",
          roleBn: "ভেরিফায়েড ক্রেতা",
          location: "Dhanmondi, Dhaka",
          locationBn: "ধানমন্ডি, ঢাকা",
          rating: 5,
          text: "The quality exceeded my expectations. Delivered in less than 24 hours in Dhaka! Fabric is super comfortable.",
          textBn: "কাপড়ের মান অসাধারণ ছিল! ২৪ ঘণ্টারও কম সময়ে ঢাকায় ডেলিভারি পেয়েছি। ফেব্রিক খুবই আরামদায়ক।",
          avatar: "",
          verified: true,
        },
        {
          name: "Tanvir Hasan",
          nameBn: "তানভীর হাসান",
          role: "Regular Buyer",
          roleBn: "নিয়মিত ক্রেতা",
          location: "Uttara, Dhaka",
          locationBn: "উত্তরা, ঢাকা",
          rating: 5,
          text: "100% authentic products. Cash on delivery made the shopping completely risk-free.",
          textBn: "শতভাগ খাঁটি পণ্য। ক্যাশ অন ডেলিভারি থাকার কারণে কেনাকাটা ছিল একদম নিশ্চিন্ত।",
          avatar: "",
          verified: true,
        },
        {
          name: "Farhana Chowdhury",
          nameBn: "ফারহানা চৌধুরী",
          role: "Verified Customer",
          roleBn: "ভেরিফায়েড ক্রেতা",
          location: "GEC, Chittagong",
          locationBn: "জিইসি, চট্টগ্রাম",
          rating: 5,
          text: "Prompt customer support via WhatsApp. Exchanged size smoothly without any extra delivery cost.",
          textBn: "হোয়াটসঅ্যাপে দারুণ কাস্টমার সাপোর্ট পেয়েছি। কোনো বাড়তি খরচ ছাড়াই সাইজ বদলে দিয়েছে।",
          avatar: "",
          verified: true,
        },
      ],
    },
  },
  {
    type: "pricing-matrix",
    label: "Plan comparison matrix",
    description: "Multi-tier pricing cards with feature checklists, highlighted popular ribbons, and direct call-to-actions.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 2,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Section badge", 30),
      tb("badge", "Section badge", 30),
    ],
    list: {
      key: "items",
      label: "Pricing plans",
      itemLabel: "Plan",
      min: 1,
      max: 4,
      fields: [
        t("name", "Plan title", 50),
        tb("name", "Plan title", 50),
        t("badge", "Card ribbon (e.g. Most Popular)", 30),
        tb("badge", "Card ribbon", 30),
        t("price", "Price (e.g. ৳ 1,499)", 30),
        t("period", "Billing cycle (e.g. / month)", 30),
        tb("period", "Billing cycle", 30),
        area("description", "Summary", 150),
        areab("description", "Summary", 150),
        { key: "highlighted", label: "Highlight as Featured / Popular", type: "checkbox" },
        area("features", "Features list (one per line)", 400),
        areab("features", "Features list (Bangla)", 400),
        t("ctaText", "Button text", 30),
        tb("ctaText", "Button text", 30),
        link("ctaLink", "Button link"),
      ],
      defaultItem: {
        name: "Standard Plan",
        nameBn: "স্ট্যান্ডার্ড প্ল্যান",
        badge: "",
        badgeBn: "",
        price: "৳ 1,499",
        period: "/ month",
        periodBn: "/ মাস",
        description: "Essential features for growing businesses.",
        descriptionBn: "নিয়মিত কার্যক্রম ও প্রবৃদ্ধির জন্য সেরা প্যাকেজ।",
        highlighted: false,
        features: "Nationwide Delivery\nDoorstep Cash On Delivery\nWhatsApp Notification\n7-Day Exchange Warranty",
        featuresBn: "সারাদেশে ডেলিভারি\nক্যাশ অন ডেলিভারি সুবিধা\nহোয়াটসঅ্যাপ নোটিফিকেশন\n৭ দিনের এক্সচেঞ্জ ওয়ারেন্টি",
        ctaText: "Get Started",
        ctaTextBn: "শুরু করুন",
        ctaLink: "/contact",
      },
    },
    defaults: {
      title: "Simple, Transparent Pricing",
      titleBn: "সহজ ও স্বচ্ছ প্যাকেজ মূল্য",
      subtitle: "Choose the perfect option tailored for your needs with zero hidden fees.",
      subtitleBn: "লুকানো চার্জ ছাড়া আপনার প্রয়োজন অনুযায়ী সেরা প্যাকেজটি বেছে নিন।",
      badge: "Packages & Plans",
      badgeBn: "প্যাকেজ ও মূল্য",
      items: [
        {
          name: "Starter",
          nameBn: "স্টার্টার",
          badge: "",
          badgeBn: "",
          price: "৳ 799",
          period: "/ month",
          periodBn: "/ মাস",
          description: "Ideal for new businesses and small teams getting started.",
          descriptionBn: "নতুন ব্যবসা ও ছোট উদ্যোক্তাদের সহজে শুরুর জন্য।",
          highlighted: false,
          features: "Up to 50 Monthly Orders\nStandard Courier Tracking\nEmail & Chat Support\nCash On Delivery Ready",
          featuresBn: "৫০টি মাসিক অর্ডার\nকুরিয়ার ট্র্যাকিং সুবিধা\nইমেইল ও চ্যাট সাপোর্ট\nক্যাশ অন ডেলিভারি সুবিধা",
          ctaText: "Choose Starter",
          ctaTextBn: "স্টার্টার নিন",
          ctaLink: "/contact",
        },
        {
          name: "Growth Pro",
          nameBn: "গ্রোথ প্রো",
          badge: "Most Popular",
          badgeBn: "জনপ্রিয়",
          price: "৳ 1,499",
          period: "/ month",
          periodBn: "/ মাস",
          description: "Full suite of automation tools for scaling brands.",
          descriptionBn: "ব্যবসা দ্রুত প্রসারের জন্য স্বয়ংক্রিয় ফিচার প্যাকেজ।",
          highlighted: true,
          features: "Unlimited Monthly Orders\nSteadfast & Pathao Auto-Sync\nAutomated WhatsApp Alerts\nFraud & Fake Order Detection\nDedicated Priority Support",
          featuresBn: "আনলিমিটেড মাসিক অর্ডার\nস্টেডফাস্ট ও পাঠাও অটো-সিঙ্ক\nস্বয়ংক্রিয় হোয়াটসঅ্যাপ বার্তা\nফেইক অর্ডার ফিল্টারিং\nডেডিকেটেড ভিআইপি সাপোর্ট",
          ctaText: "Start 14-Day Free Trial",
          ctaTextBn: "১৪ দিনের ফ্রি ট্রায়াল শুরু করুন",
          ctaLink: "/contact",
        },
        {
          name: "Enterprise",
          nameBn: "এন্টারপ্রাইজ",
          badge: "Custom",
          badgeBn: "কাস্টম",
          price: "৳ 3,499",
          period: "/ month",
          periodBn: "/ মাস",
          description: "High volume merchants requiring custom SLA and integrations.",
          descriptionBn: "বৃহৎ বাণিজ্যিক প্রতিষ্ঠান ও কাস্টম ইন্টিগ্রেশনের জন্য।",
          highlighted: false,
          features: "Multi-Branch & Warehouses\nCustom ERP & API Webhooks\nDedicated Account Manager\nCustom Domain & SSL Setup",
          featuresBn: "মাল্টি-ব্রাঞ্চ ও ওয়্যারহাউজ\nকাস্টম ইআরপি ও ওয়েবহুক\nডেডিকেটেড অ্যাকাউন্ট ম্যানেজার\nকাস্টম ডোমেইন ও ফ্রি এসএসএল",
          ctaText: "Contact Sales",
          ctaTextBn: "কথা বলুন",
          ctaLink: "/contact",
        },
      ],
    },
  },
  {
    type: "promo-popup",
    label: "Promotion & lead popup",
    description: "High-converting discount voucher and phone lead capture popup with coupon copy and dismissal memory.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 1,
    category: "promotions",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle / Instructions", 200),
      areab("subtitle", "Subtitle / Instructions", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      t("discountText", "Discount banner (e.g. 15% OFF)", 40),
      tb("discountText", "Discount banner", 40),
      t("code", "Voucher coupon code (e.g. SAVE200)", 30),
      {
        key: "trigger",
        label: "When to show",
        type: "select",
        options: [
          { value: "delay", label: "After 3 seconds delay" },
          { value: "scroll", label: "When scrolled 35% of page" },
          { value: "immediate", label: "Immediately on arrival" },
        ],
      },
      { key: "showPhoneCapture", label: "Collect customer phone numbers directly", type: "checkbox" },
      image("image", "Banner picture"),
      t("ctaText", "Button text", 30),
      tb("ctaText", "Button text", 30),
      link("ctaLink", "Button link"),
    ],
    defaults: {
      title: "Special Festival Offer",
      titleBn: "বিশেষ উৎসব অফার",
      subtitle: "Copy this exclusive discount voucher code and use it at checkout for instant savings.",
      subtitleBn: "নিচের কুপন কোডটি কপি করে চেকআউটে ব্যবহার করুন এবং বিশেষ ছাড় উপভোগ করুন।",
      badge: "Limited Time Only",
      badgeBn: "সীমিত সময়ের জন্য",
      discountText: "৳ 200 FLAT OFF",
      discountTextBn: "২০০ টাকা নিশ্চিত ছাড়",
      code: "SAVE200",
      trigger: "delay",
      showPhoneCapture: false,
      image: "",
      ctaText: "Shop Now",
      ctaTextBn: "এখনই কিনুন",
      ctaLink: "/products",
    },
  },
  // ---- aBlocks-Inspired Modern Widgets Suite (Phase 6)
  {
    type: "image-comparison",
    label: "Image comparison (Before & After)",
    description: "Interactive before and after comparison slider with touch drag support and dual bilingual label badges.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 3,
    category: "proof",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      image("beforeImage", "Before image"),
      image("afterImage", "After image"),
      t("beforeLabel", "Before label", 30),
      tb("beforeLabel", "Before label", 30),
      t("afterLabel", "After label", 30),
      tb("afterLabel", "After label", 30),
      {
        key: "orientation",
        label: "Slider direction",
        type: "select",
        options: [
          { value: "horizontal", label: "Horizontal (Left / Right)" },
          { value: "vertical", label: "Vertical (Top / Bottom)" },
        ],
      },
      {
        key: "initialSplit",
        label: "Initial split position (%)",
        type: "select",
        options: [
          { value: "50", label: "50% (Centered)" },
          { value: "35", label: "35% (More Before)" },
          { value: "65", label: "65% (More After)" },
        ],
      },
    ],
    defaults: {
      title: "Real Results, Proven Transformation",
      titleBn: "বাস্তব ফলাফল ও দৃশ্যমান পরিবর্তন",
      subtitle: "Drag the slider to see the dramatic before-and-after difference.",
      subtitleBn: "স্লাইডারটি টেনে আগের ও পরের চমৎকার পরিবর্তন দেখুন।",
      badge: "Before & After",
      badgeBn: "আগে ও পরে",
      beforeImage: "",
      afterImage: "",
      beforeLabel: "Before",
      beforeLabelBn: "আগে",
      afterLabel: "After",
      afterLabelBn: "পরে",
      orientation: "horizontal",
      initialSplit: "50",
    },
  },
  {
    type: "logo-marquee",
    label: "Infinite brand & logo marquee",
    description: "Silky smooth continuous scrolling ticker for client logos, payment gateways, and partner networks with pause on hover.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 3,
    category: "proof",
    fields: [
      t("title", "Heading / Caption", 80),
      tb("title", "Heading / Caption", 80),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      {
        key: "speed",
        label: "Scroll speed",
        type: "select",
        options: [
          { value: "normal", label: "Normal (30s)" },
          { value: "slow", label: "Slow (45s)" },
          { value: "fast", label: "Fast (18s)" },
        ],
      },
      {
        key: "direction",
        label: "Scroll direction",
        type: "select",
        options: [
          { value: "left", label: "Leftward (Standard)" },
          { value: "right", label: "Rightward" },
        ],
      },
      { key: "pauseOnHover", label: "Pause scrolling on hover or touch", type: "checkbox" },
      { key: "maskEdges", label: "Fade out sides with smooth gradient mask", type: "checkbox" },
    ],
    list: {
      key: "items",
      label: "Logos & Partners",
      itemLabel: "Partner",
      min: 2,
      max: 16,
      fields: [
        t("name", "Brand / Partner name", 40),
        image("image", "Logo image (or leave empty for text chip)"),
        t("label", "Optional sub-label (e.g. Official Partner)", 30),
        tb("label", "Optional sub-label", 30),
        link("link", "Partner URL"),
      ],
      defaultItem: {
        name: "bKash",
        image: "",
        label: "Payment Partner",
        labelBn: "পেমেন্ট পার্টনার",
        link: "",
      },
    },
    defaults: {
      title: "Trusted by Bangladesh's Top Brands & Leading Networks",
      titleBn: "বাংলাদেশের শীর্ষ ব্র্যান্ড ও বিশ্বস্ত পার্টনারদের পছন্দের তালিকায়",
      badge: "Partners & Integrations",
      badgeBn: "পার্টনার ও নেটওয়ার্ক",
      speed: "normal",
      direction: "left",
      pauseOnHover: true,
      maskEdges: true,
      items: [
        { name: "bKash", image: "", label: "Official PGW", labelBn: "পেমেন্ট গেটওয়ে", link: "" },
        { name: "Nagad", image: "", label: "MFS Network", labelBn: "মোবাইল ফিনান্সিয়াল", link: "" },
        { name: "SSLCommerz", image: "", label: "Certified Gateway", labelBn: "ভেরিফায়েড গেটওয়ে", link: "" },
        { name: "Pathao Courier", image: "", label: "Express Delivery", labelBn: "এক্সপ্রেস ডেলিভারি", link: "" },
        { name: "Steadfast Courier", image: "", label: "Nationwide COD", labelBn: "সারাদেশে ক্যাশ অন ডেলিভারি", link: "" },
        { name: "RedX Logistics", image: "", label: "Doorstep Partner", labelBn: "ডোরস্টেপ পার্টনার", link: "" },
        { name: "Visa", image: "", label: "Global Card", labelBn: "গ্লোবাল কার্ড", link: "" },
        { name: "Mastercard", image: "", label: "Secure Pay", labelBn: "সিকিউর পে", link: "" },
      ],
    },
  },
  {
    type: "process-timeline",
    label: "Process steps & journey timeline",
    description: "Step-by-step sequential timeline for order delivery stages, clinical treatment roadmap, or company story.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 3,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      {
        key: "layout",
        label: "Timeline flow",
        type: "select",
        options: [
          { value: "vertical", label: "Vertical Spine (Alternating)" },
          { value: "horizontal", label: "Horizontal Stepper (Desktop) / Vertical (Mobile)" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Timeline steps",
      itemLabel: "Step",
      min: 2,
      max: 6,
      fields: [
        t("stepNumber", "Step number / year (e.g. 01, 2026)", 10),
        t("title", "Step title", 60),
        tb("title", "Step title", 60),
        area("description", "Step details", 200),
        areab("description", "Step details", 200),
        t("badge", "Step status tag (e.g. Fast, Safe)", 25),
        tb("badge", "Step status tag", 25),
        {
          key: "icon",
          label: "Step icon",
          type: "select",
          options: [
            { value: "cart", label: "Shopping Cart" },
            { value: "shield", label: "Shield / Quality Check" },
            { value: "truck", label: "Express Delivery Truck" },
            { value: "box", label: "Parcel Box" },
            { value: "check", label: "Checkmark" },
            { value: "sparkles", label: "Sparkles" },
          ],
        },
      ],
      defaultItem: {
        stepNumber: "01",
        title: "Place Your Order",
        titleBn: "অর্ডার কনফার্ম করুন",
        description: "Choose your favorite item and submit your delivery address in 30 seconds.",
        descriptionBn: "আপনার পছন্দের পণ্য সিলেক্ট করে ৩০ সেকেন্ডে ডেলিভারি ঠিকানা দিন।",
        badge: "Instant",
        badgeBn: "তাৎক্ষণিক",
        icon: "cart",
      },
    },
    defaults: {
      title: "Simple & Seamless Delivery Process",
      titleBn: "সহজ ও নির্ভরযোগ্য ডেলিভারি প্রক্রিয়া",
      subtitle: "From order placement to your doorstep in 4 transparent stages.",
      subtitleBn: "অর্ডার করা থেকে ডোরস্টেপে পৌঁছানো পর্যন্ত ৪টি সহজ ধাপ।",
      badge: "How It Works",
      badgeBn: "যেভাবে কাজ করে",
      layout: "vertical",
      items: [
        {
          stepNumber: "01",
          title: "Place Order Online",
          titleBn: "অনলাইনে অর্ডার সাবমিট",
          description: "Select items, choose Cash on Delivery or bKash, and provide your phone number.",
          descriptionBn: "পণ্য বেছে নিয়ে ক্যাশ অন ডেলিভারি বা বিকাশ সিলেক্ট করুন।",
          badge: "Step 1",
          badgeBn: "ধাপ ১",
          icon: "cart",
        },
        {
          stepNumber: "02",
          title: "Quality Verification",
          titleBn: "কোয়ালিটি চেক ও প্যাকিং",
          description: "Our quality team hand-inspects every product and packs it with tamper-proof seal.",
          descriptionBn: "প্রতিটি পণ্য মান যাচাই করে সুরক্ষিত প্যাকেজিং সম্পন্ন করা হয়।",
          badge: "Verified",
          badgeBn: "যাচাইকৃত",
          icon: "shield",
        },
        {
          stepNumber: "03",
          title: "Express Courier Dispatch",
          titleBn: "কুরিয়ার হ্যান্ডওভার",
          description: "Handed over to Steadfast or Pathao with live SMS tracking sent to your phone.",
          descriptionBn: "লাইভ ট্র্যাকিং সুবিধাসহ এক্সপ্রেস কুরিয়ারে হস্তান্তর করা হয়।",
          badge: "Dispatched",
          badgeBn: "চলমান",
          icon: "truck",
        },
        {
          stepNumber: "04",
          title: "Doorstep Cash on Delivery",
          titleBn: "ডোরস্টেপে পণ্য গ্রহণ ও মূল্য পরিশোধ",
          description: "Check the parcel at your doorstep and pay only when fully satisfied.",
          descriptionBn: "পণ্য হাতে পেয়ে চেক করে সম্পূর্ণ নিশ্চিত হয়ে মূল্য পরিশোধ করুন।",
          badge: "Delivered",
          badgeBn: "পৌঁছে গেছে",
          icon: "box",
        },
      ],
    },
  },
  {
    type: "flip-box",
    label: "3D interactive flip cards",
    description: "Engaging 3D card grid with front showcase and back-side details revealed on hover or mobile tap.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 3,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      {
        key: "columns",
        label: "Grid columns",
        type: "select",
        options: [
          { value: "3", label: "3 Columns (Balanced)" },
          { value: "2", label: "2 Columns (Prominent)" },
          { value: "4", label: "4 Columns (Compact)" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Flip cards",
      itemLabel: "Card",
      min: 2,
      max: 8,
      fields: [
        t("frontTitle", "Front title", 50),
        tb("frontTitle", "Front title", 50),
        t("frontSubtitle", "Front subtitle", 60),
        tb("frontSubtitle", "Front subtitle", 60),
        t("frontBadge", "Front ribbon", 25),
        tb("frontBadge", "Front ribbon", 25),
        image("frontImage", "Front cover picture"),
        t("backTitle", "Back title", 50),
        tb("backTitle", "Back title", 50),
        area("backText", "Back description", 180),
        areab("backText", "Back description", 180),
        t("price", "Price highlight (e.g. ৳ 850)", 25),
        t("ctaText", "Back button text", 30),
        tb("ctaText", "Back button text", 30),
        link("ctaLink", "Back button link"),
      ],
      defaultItem: {
        frontTitle: "Special Service",
        frontTitleBn: "স্পেশাল সার্ভিস",
        frontSubtitle: "Premium Quality & Fast Delivery",
        frontSubtitleBn: "প্রিমিয়াম কোয়ালিটি ও দ্রুত ডেলিভারি",
        frontBadge: "Special",
        frontBadgeBn: "স্পেশাল",
        frontImage: "",
        backTitle: "Service Details",
        backTitleBn: "সার্ভিস বিস্তারিত",
        backText: "Comprehensive service package with 100% satisfaction guarantee.",
        backTextBn: "শতভাগ সন্তুষ্টির নিশ্চয়তাসহ বিশেষ প্যাকেজ সুবিধা।",
        price: "৳ 850",
        ctaText: "Order Now",
        ctaTextBn: "অর্ডার করুন",
        ctaLink: "/contact",
      },
    },
    defaults: {
      title: "Interactive Highlights & Specialties",
      titleBn: "বিশেষ আকর্ষণ ও সিগনেচার প্যাকেজ",
      subtitle: "Hover or tap any card to reveal in-depth specifications and pricing.",
      subtitleBn: "কার্ডে কার্সার রাখুন অথবা ট্যাপ করে বিস্তারিত তথ্য ও মূল্য দেখুন।",
      badge: "Flip & Explore",
      badgeBn: "ক্লিক করে দেখুন",
      columns: "3",
      items: [
        {
          frontTitle: "Signature Kebab Platter",
          frontTitleBn: "সিগনেচার কাবাব প্ল্যাটার",
          frontSubtitle: "Charcoal grilled tender skewers with naan & chutney",
          frontSubtitleBn: "কয়লার আঁচে তৈরি নরম শিক কাবাব ও স্পেশাল চাটনি",
          frontBadge: "Chef's Choice",
          frontBadgeBn: "শেফস চয়েস",
          frontImage: "",
          backTitle: "Platter Highlights",
          backTitleBn: "প্ল্যাটারের বিশেষত্ব",
          backText: "Includes 4 types of premium kebabs, garlic butter naan, minted raita, and seasonal salad.",
          backTextBn: "৪ রকমের প্রিমিয়াম কাবাব, গার্লিক বাটার নান, পুদিনা রায়তা ও ফ্রেশ সালাদ।",
          price: "৳ 1,290",
          ctaText: "Reserve Platter",
          ctaTextBn: "প্ল্যাটার বুক করুন",
          ctaLink: "/contact",
        },
        {
          frontTitle: "Organic Cotton Panjabi",
          frontTitleBn: "অরগানিক সুতি পাঞ্জাবি",
          frontSubtitle: "Breathable comfort with minimalist neck embroidery",
          frontSubtitleBn: "নরম আরামদায়ক সুতি কাপড় ও মার্জিত সুতার কাজ",
          frontBadge: "Best Seller",
          frontBadgeBn: "বেস্ট সেলার",
          frontImage: "",
          backTitle: "Fabric & Craft",
          backTitleBn: "কাপড় ও গুণমান",
          backText: "100% combed cotton, anti-shrink pre-washed, tailored with fine coconut shell buttons.",
          backTextBn: "১০০% আরামদায়ক সুতি, প্রি-ওয়াশড ও টেকসই নারিকেল বাটনের নিখুঁত ফিনিশিং।",
          price: "৳ 1,850",
          ctaText: "Order Panjabi",
          ctaTextBn: "পাঞ্জাবি কিনুন",
          ctaLink: "/collections",
        },
        {
          frontTitle: "Comprehensive Dental Care",
          frontTitleBn: "কম্প্রিহেন্সিভ ডেন্টাল কেয়ার",
          frontSubtitle: "Scaling, polishing & complete oral consultation",
          frontSubtitleBn: "স্কেলিং, পলিশিং ও অভিজ্ঞ ডাক্তারের পরামর্শ",
          frontBadge: "Popular",
          frontBadgeBn: "জনপ্রিয়",
          frontImage: "",
          backTitle: "Procedure Scope",
          backTitleBn: "চিকিৎসার বিস্তারিত",
          backText: "State-of-the-art ultrasonic scaling, stain removal, enamel fluoride coating, and checkup.",
          backTextBn: "আল্ট্রাসনিক স্কেলিং, দাগ দূরীকরণ, এনামেল সুরক্ষা ও সম্পূর্ণ দাঁতের চেকআপ।",
          price: "৳ 1,500",
          ctaText: "Book Appointment",
          ctaTextBn: "সিরিয়াল নিন",
          ctaLink: "/contact",
        },
      ],
    },
  },
  {
    type: "image-hotspots",
    label: "Interactive image hotspots",
    description: "Visual lifestyle image with interactive pulsing pins revealing product tags, pricing in ৳, and direct purchase links.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 2,
    category: "commerce",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      image("image", "Background hero image"),
    ],
    list: {
      key: "items",
      label: "Hotspot pins",
      itemLabel: "Pin",
      min: 1,
      max: 6,
      fields: [
        t("x", "Horizontal position X (%) (e.g. 35)", 10),
        t("y", "Vertical position Y (%) (e.g. 45)", 10),
        t("title", "Product / Tag name", 50),
        tb("title", "Product / Tag name", 50),
        t("price", "Price (e.g. ৳ 1,200)", 25),
        area("description", "Quick details", 120),
        areab("description", "Quick details", 120),
        t("linkText", "Action button text", 30),
        tb("linkText", "Action button text", 30),
        link("linkUrl", "Action URL"),
      ],
      defaultItem: {
        x: "50",
        y: "50",
        title: "Featured Item",
        titleBn: "ফিচার্ড পণ্য",
        price: "৳ 990",
        description: "Handcrafted quality with doorstep cash on delivery.",
        descriptionBn: "প্রিমিয়াম কোয়ালিটি এবং হোম ডেলিভারি সুবিধা।",
        linkText: "View Item",
        linkTextBn: "বিস্তারিত দেখুন",
        linkUrl: "/products",
      },
    },
    defaults: {
      title: "Shop the Look & Key Details",
      titleBn: "ছবিতে ক্লিক করে পণ্য বেছে নিন",
      subtitle: "Click or tap the glowing pins to inspect specific items, pricing, and specs.",
      subtitleBn: "ছবির উপর পিনগুলোতে ক্লিক করে পণ্যের বিস্তারিত ও দাম দেখুন।",
      badge: "Interactive Showcase",
      badgeBn: "ইন্টারঅ্যাক্টিভ শোকেস",
      image: "",
      items: [
        {
          x: "28",
          y: "36",
          title: "Minimalist Linen Kurti",
          titleBn: "মিনিমালিস্ট লিনেন কুর্তি",
          price: "৳ 1,450",
          description: "Lightweight organic linen with breathable comfort.",
          descriptionBn: "হালকা ও আরামদায়ক লিনেন ফেব্রিক।",
          linkText: "Shop Kurti",
          linkTextBn: "কুর্তি কিনুন",
          linkUrl: "/collections",
        },
        {
          x: "68",
          y: "48",
          title: "Artisanal Leather Tote",
          titleBn: "হাতে তৈরি চামড়ার টোট ব্যাগ",
          price: "৳ 2,890",
          description: "Full-grain natural leather with brass hardware.",
          descriptionBn: "খাঁটি দেশীয় চামড়ার নিখুঁত কারুকাজ।",
          linkText: "View Bag",
          linkTextBn: "ব্যাগ দেখুন",
          linkUrl: "/collections",
        },
        {
          x: "46",
          y: "82",
          title: "Handcrafted Kolapuri Sandals",
          titleBn: "কোলাপুরি স্যান্ডেল",
          price: "৳ 1,150",
          description: "Cushioned insole designed for all-day elegance.",
          descriptionBn: "নরম আরামদায়ক কুশন সোল ও ঐতিহ্যবাহী ডিজাইন।",
          linkText: "Get Sandals",
          linkTextBn: "স্যান্ডেল কিনুন",
          linkUrl: "/collections",
        },
      ],
    },
  },
  {
    type: "filterable-grid",
    label: "Filterable portfolio & card grid",
    description: "Instant client-side category pill filtering for restaurant menus, clinical procedures, corporate projects, or galleries.",
    page: "custom",
    pages: ["home", "custom", "landing"],
    max: 3,
    category: "content",
    fields: [
      t("title", "Heading", 80),
      tb("title", "Heading", 80),
      area("subtitle", "Subtitle", 200),
      areab("subtitle", "Subtitle", 200),
      t("badge", "Pill badge", 30),
      tb("badge", "Pill badge", 30),
      {
        key: "columns",
        label: "Grid columns",
        type: "select",
        options: [
          { value: "3", label: "3 Columns (Balanced)" },
          { value: "2", label: "2 Columns (Editorial)" },
          { value: "4", label: "4 Columns (Compact)" },
        ],
      },
    ],
    list: {
      key: "items",
      label: "Portfolio / Menu cards",
      itemLabel: "Item",
      min: 2,
      max: 12,
      fields: [
        t("title", "Item title", 60),
        tb("title", "Item title", 60),
        t("category", "Category name (e.g. Kebabs, Biryani, Consulting)", 40),
        tb("category", "Category name", 40),
        area("description", "Short description", 180),
        areab("description", "Short description", 180),
        t("price", "Price / Tag (e.g. ৳ 450)", 25),
        t("badge", "Card ribbon (e.g. Popular)", 25),
        tb("badge", "Card ribbon", 25),
        image("image", "Card image"),
        t("ctaText", "Button text", 30),
        tb("ctaText", "Button text", 30),
        link("ctaLink", "Button link"),
      ],
      defaultItem: {
        title: "Featured Service",
        titleBn: "ফিচার্ড সার্ভিস",
        category: "General",
        categoryBn: "সাধারণ",
        description: "Professional solution crafted with precision.",
        descriptionBn: "অভিজ্ঞ বিশেষজ্ঞদের দ্বারা পরিচালিত সেবা।",
        price: "৳ 750",
        badge: "",
        badgeBn: "",
        image: "",
        ctaText: "Learn More",
        ctaTextBn: "বিস্তারিত",
        ctaLink: "/contact",
      },
    },
    defaults: {
      title: "Explore by Category",
      titleBn: "ক্যাটাগরি অনুযায়ী দেখুন",
      subtitle: "Filter through our specialties with zero page reloads.",
      subtitleBn: "কোনো পেজ রিলোড ছাড়াই পছন্দমতো ক্যাটাগরি বেছে নিন।",
      badge: "Filterable Showcase",
      badgeBn: "ফিল্টারেবল শোকেস",
      columns: "3",
      items: [
        {
          title: "Beef Sheek Kebab",
          titleBn: "বিফ শিক কাবাব",
          category: "Kebabs",
          categoryBn: "কাবাব",
          description: "Marinated with 18 secret Mughlai spices and slow-cooked over coal.",
          descriptionBn: "১৮টি মোগলাই মসলায় ম্যারিনেট করা ও কয়লায় পোড়ানো শিক কাবাব।",
          price: "৳ 320",
          badge: "Bestseller",
          badgeBn: "বেস্টসেলার",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
        {
          title: "Mutton Kacchi Biryani",
          titleBn: "মাটন কাচ্চি বিরিয়ানি",
          category: "Biryani",
          categoryBn: "বিরিয়ানি",
          description: "Fragrant Chinigura rice with tender mustard-oil marinated mutton and fried potatoes.",
          descriptionBn: "চিনিগুঁড়া চাল ও খাসির খাঁটি কাচ্চি সাথে আলু ও ডিম।",
          price: "৳ 480",
          badge: "Must Try",
          badgeBn: "স্পেশাল",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
        {
          title: "Reshmi Chicken Kebab",
          titleBn: "রেশমি চিকেন কাবাব",
          category: "Kebabs",
          categoryBn: "কাবাব",
          description: "Boneless chicken thighs cream-infused with cashew paste and gentle herbs.",
          descriptionBn: "কাজুবাদাম ও ক্রিমে মাখানো মুখে মিলিয়ে যাওয়া নরম চিকেন কাবাব।",
          price: "৳ 360",
          badge: "",
          badgeBn: "",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
        {
          title: "Saffron Shahi Firni",
          titleBn: "জাফরানি শাহী ফিরনি",
          category: "Desserts",
          categoryBn: "ডেজার্ট",
          description: "Traditional earthen pot rice pudding topped with pistachio and Iranian saffron.",
          descriptionBn: "মাটির পাত্রে পরিবেশিত জাফরান ও পেস্তাবাদাম সমৃদ্ধ ঐতিহ্যবাহী ফিরনি।",
          price: "৳ 140",
          badge: "Sweet Delight",
          badgeBn: "মিষ্টি আয়োজন",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
        {
          title: "Hyderabadi Dum Biryani",
          titleBn: "হায়দ্রাবাদী দম বিরিয়ানি",
          category: "Biryani",
          categoryBn: "বিরিয়ানি",
          description: "Slow-dum aromatic rice layered with spiced chicken and caramelized onions.",
          descriptionBn: "দম পদ্ধতিতে রান্না সুস্বাদু স্পাইসি চিকেন বিরিয়ানি।",
          price: "৳ 420",
          badge: "",
          badgeBn: "",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
        {
          title: "Borhani & Mint Cooler",
          titleBn: "বোরহানি ও পুদিনা লাচ্ছি",
          category: "Drinks",
          categoryBn: "পানীয়",
          description: "Tangy rich yogurt cooler seasoned with roasted cumin and fresh mint leaves.",
          descriptionBn: "জিরার গুঁড়া ও পুদিনা পাতার সুস্বাদু ঐতিহ্যবাহী বোরহানি।",
          price: "৳ 110",
          badge: "Refreshing",
          badgeBn: "রিফ্রেশিং",
          image: "",
          ctaText: "Order Now",
          ctaTextBn: "অর্ডার করুন",
          ctaLink: "/contact",
        },
      ],
    },
  },
  {
    type: "visitor-counter",
    label: "Live Visitor Counter",
    description: "Real-time shopper counter badge with live cart interest and pulsing animations.",
    page: "home",
    pages: ["custom", "landing", "product", "collection", "cart"],
    category: "proof",
    max: 4,
    fields: [
      t("headline", "Heading / Text", 100),
      tb("headline", "Heading (Bangla)", 100),
      { key: "minViewers", label: "Minimum viewers", type: "number", min: 1, max: 200 },
      { key: "maxViewers", label: "Maximum viewers", type: "number", min: 2, max: 500 },
      { key: "showCartCount", label: "Show items in cart count", type: "checkbox" },
      t("cartText", "Cart text", 80),
      tb("cartText", "Cart text (Bangla)", 80),
      { key: "pulseIntervalSec", label: "Pulsing interval (seconds)", type: "number", min: 3, max: 60 },
      {
        key: "icon",
        label: "Counter icon",
        type: "select",
        options: [
          { value: "fire", label: "🔥 Fire" },
          { value: "eye", label: "👁️ Eye" },
          { value: "users", label: "👥 Users" },
          { value: "sparkles", label: "✨ Sparkles" },
        ],
      },
      {
        key: "badgeStyle",
        label: "Badge style",
        type: "select",
        options: [
          { value: "pill", label: "Compact floating pill" },
          { value: "card", label: "Framed counter card" },
          { value: "minimal", label: "Minimal inline text" },
        ],
      },
    ],
    defaults: {
      headline: "people are viewing this right now",
      headlineBn: "জন এই মুহূর্তে দেখছেন",
      minViewers: 8,
      maxViewers: 28,
      showCartCount: true,
      cartText: "people have this in their cart",
      cartTextBn: "জনের কার্টে এই পণ্যটি রয়েছে",
      pulseIntervalSec: 6,
      icon: "fire",
      badgeStyle: "pill",
    },
  },
  {
    type: "stock-scarcity",
    label: "Stock Scarcity Bar",
    description: "Dynamic low-stock urgency bar with animated fire badge and progress gauge.",
    page: "home",
    pages: ["custom", "landing", "product", "collection", "cart"],
    category: "promotions",
    max: 4,
    fields: [
      t("headline", "Heading", 80),
      tb("headline", "Heading (Bangla)", 80),
      t("scarcityText", "Scarcity message", 120),
      tb("scarcityText", "Scarcity message (Bangla)", 120),
      { key: "threshold", label: "Remaining items number", type: "number", min: 1, max: 50 },
      { key: "showProgressBar", label: "Show urgency progress bar", type: "checkbox" },
      { key: "progressPercent", label: "Sold percentage (%)", type: "number", min: 10, max: 98 },
      { key: "urgencyColor", label: "Urgency colour", type: "color" },
      t("badgeText", "Urgency badge tag", 30),
      tb("badgeText", "Urgency badge tag (Bangla)", 30),
    ],
    defaults: {
      headline: "Hurry, low stock!",
      headlineBn: "সীমিত স্টক! দ্রুত অর্ডার করুন",
      scarcityText: "Only {count} items left in stock — selling fast!",
      scarcityTextBn: "আর মাত্র {count}টি বাকি আছে — স্টক শেষ হওয়ার আগেই নিন!",
      threshold: 4,
      showProgressBar: true,
      progressPercent: 84,
      urgencyColor: "#EF4444",
      badgeText: "High Demand",
      badgeTextBn: "উচ্চ চাহিদা",
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
  {
    id: "business",
    title: "Business & Verticals",
    icon: "",
    types: [
      "restaurant-menu",
      "restaurant-hours-location",
      "reservation-cta",
      "doctor-hero",
      "clinic-chambers",
      "service-cards",
      "team-grid",
      "portfolio-grid",
      "image-comparison",
      "process-timeline",
      "flip-box",
      "filterable-grid",
      "download-card",
      "contact-form",
    ],
  },
  { id: "hero", title: "Header & Hero", icon: "", types: ["hero", "banner", "announcement-bar", "doctor-hero", "logo-marquee"] },
  { id: "products", title: "Product Showcases", icon: "", types: ["featured-products", "category-grid", "product-related", "collection-products", "image-hotspots", "flip-box", "filterable-grid"] },
  { id: "trust", title: "Trust & Social Proof", icon: "", types: ["trust-strip", "product-reviews", "visitor-counter", "video-reels", "team-grid", "portfolio-grid", "video-lightbox", "bento-grid", "testimonials-slider", "image-comparison", "logo-marquee", "process-timeline"] },
  { id: "promotions", title: "Promotions & Urgency", icon: "", types: ["countdown-timer", "stock-scarcity", "marquee-ticker", "floating-contact", "reservation-cta", "promo-popup", "flip-box"] },
  {
    id: "content",
    title: "Content & FAQs",
    icon: "",
    types: [
      "rich-text",
      "bento-grid",
      "content-tabs",
      "pricing-matrix",
      "video-lightbox",
      "accordion-faq",
      "image-comparison",
      "process-timeline",
      "flip-box",
      "filterable-grid",
      "contact-block",
      "contact-form",
      "service-cards",
      "clinic-chambers",
      "restaurant-menu",
      "restaurant-hours-location",
      "download-card",
    ],
  },
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

export interface SectionFilterOptions {
  mode?: SiteMode;
  vertical?: BusinessVertical;
  capabilities?: Partial<Record<keyof TenantCapabilities | string, boolean>>;
}

export const sectionDef = (type: string): SectionDef | undefined => SECTIONS.find((s) => s.type === type);

const COMMERCE_SECTIONS = new Set([
  "featured-products",
  "category-grid",
  "product-main",
  "product-reviews",
  "product-related",
  "collection-header",
  "collection-products",
  "cart-main",
  "lp-order-form",
  "drop-spotlight",
  "visitor-counter",
  "stock-scarcity",
]);

export const isCommerceSection = (def: SectionDef): boolean =>
  def.category === "commerce" || COMMERCE_SECTIONS.has(def.type);

/** Whether a section may be placed on this kind of page, with optional capability and mode filtering. */
export const allowedOn = (def: SectionDef, kind: PageKind, filter?: SectionFilterOptions): boolean => {
  const pageAllowed = def.page === kind || (def.pages?.includes(kind) ?? false);
  if (!pageAllowed) return false;
  if (!filter) return true;

  if (filter.mode && def.modes && !def.modes.includes(filter.mode)) {
    return false;
  }

  if (isCommerceSection(def)) {
    if (filter.mode === "PORTFOLIO") return false;
    if (filter.capabilities && filter.capabilities.commerce === false) return false;
  }

  if (def.capabilities && filter.capabilities) {
    for (const cap of def.capabilities) {
      if (filter.capabilities[cap] === false) return false;
    }
  }

  return true;
};

export const sectionsFor = (kind: PageKind, filter?: SectionFilterOptions): SectionDef[] =>
  SECTIONS.filter((s) => allowedOn(s, kind, filter));

/** Whether this section is tailored/recommended for a given business vertical. */
export const recommendedForVertical = (def: SectionDef, vertical?: BusinessVertical | null): boolean =>
  !!(vertical && def.verticals?.includes(vertical));

/** The sections a page cannot lose. */
export const requiredFor = (kind: PageKind): string[] => SECTIONS.filter((s) => s.required && s.page === kind).map((s) => s.type);

// ---- The page ------------------------------------------------------------------------------------------------------

export type SectionBgType = "default" | "color" | "gradient" | "image";
export type SectionPaddingY = "none" | "compact" | "normal" | "spacious";
export type SectionHideOn = "none" | "mobile" | "desktop";
export type SectionTextColor = "default" | "dark" | "light";

export const SECTION_GRADIENT_PRESETS: Record<string, { label: string; css: string }> = {
  midnight: { label: "Midnight Sky", css: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" },
  sunset: { label: "Warm Sunset", css: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)" },
  emerald: { label: "Deep Emerald", css: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)" },
  royal: { label: "Royal Indigo", css: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" },
  rose: { label: "Soft Rose", css: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" },
  "clean-dark": { label: "Sleek Carbon", css: "linear-gradient(180deg, #18181b 0%, #09090b 100%)" },
  "ocean-mist": { label: "Ocean Breeze", css: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)" },
  lavender: { label: "Lavender Glow", css: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)" },
};

export type SectionAnimation = "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom-in";
export type SectionAnimDuration = "fast" | "normal" | "slow";
export type SectionAnimDelay = 0 | 150 | 300 | 450;
export type SectionTextAlign = "left" | "center" | "right";
export type SectionTextScale = "compact" | "normal" | "enlarged";
export type SectionBgPattern = "none" | "dots" | "grid" | "diagonal" | "mesh" | "cross";

export interface SectionMobileStyle {
  paddingTop?: number;
  paddingBottom?: number;
  paddingY?: SectionPaddingY;
  textAlign?: SectionTextAlign;
  textScale?: SectionTextScale;
  reverseStack?: boolean;
}

export interface SectionStyle {
  bgType?: SectionBgType;
  bgColor?: string;
  bgGradient?: string;
  bgImage?: string;
  bgOverlay?: number;
  bgOverlayTint?: "dark" | "light";
  textColor?: SectionTextColor;
  paddingY?: SectionPaddingY;
  paddingTop?: number;
  paddingBottom?: number;
  cardMode?: boolean;
  hideOn?: SectionHideOn;
  animation?: SectionAnimation;
  animDuration?: SectionAnimDuration;
  animDelay?: SectionAnimDelay;
  anchorId?: string;
  customClass?: string;
  textAlign?: SectionTextAlign;
  bgPattern?: SectionBgPattern;
  bgPatternOpacity?: number;
  mobile?: SectionMobileStyle;
}

export interface PageSection {
  id: string;
  type: string;
  label?: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
  style?: SectionStyle;
}

export interface PageSeoSettings {
  title?: string;
  description?: string;
  keywords?: string;
  socialImage?: string;
  noIndex?: boolean;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface SocialProofSettings {
  enabled?: boolean;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  initialDelaySec?: number;
  intervalSec?: number;
  displayDurationSec?: number;
  showOnMobile?: boolean;
  safeAreaBottomPx?: number;
  maxItems?: number;
  anonymizeNames?: boolean;
  includeDistricts?: boolean;
}

export interface PageJson {
  version: 1;
  sections: PageSection[];
  seo?: PageSeoSettings;
  socialProof?: SocialProofSettings;
}

export const MAX_SECTIONS = 30;
const ID = /^[a-z0-9_-]{3,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** `https://` or a path on the store. Never `javascript:`, `data:` or anything else. */
export function safeUrl(v: string): boolean {
  if (v === "" || v === "#" || v.startsWith("#")) return true;
  if (/^\/(?!\/)[^\s]*$/.test(v)) return true;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
/** Pictures are the store's own uploads, or an https address. */
export const safeImage = (v: string) => v === "" || (/^\/media\/[A-Za-z0-9._/-]+$/.test(v) && !v.includes("..")) || (/^https:\/\//.test(v) && safeUrl(v));

export function normalizeSectionStyle(raw?: unknown): SectionStyle | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const style: SectionStyle = {};

  if (o.bgType === "color" || o.bgType === "gradient" || o.bgType === "image" || o.bgType === "default") {
    if (o.bgType !== "default") style.bgType = o.bgType;
  }
  if (typeof o.bgColor === "string" && HEX.test(o.bgColor.trim())) {
    style.bgColor = o.bgColor.trim().toLowerCase();
  }
  if (typeof o.bgGradient === "string") {
    const val = o.bgGradient.trim();
    if (val in SECTION_GRADIENT_PRESETS || val.startsWith("linear-gradient") || val.startsWith("radial-gradient")) {
      style.bgGradient = val.slice(0, 300);
    }
  }
  if (typeof o.bgImage === "string" && safeImage(o.bgImage.trim()) && o.bgImage.trim() !== "") {
    style.bgImage = o.bgImage.trim();
  }
  if (typeof o.bgOverlay === "number" && !Number.isNaN(o.bgOverlay)) {
    style.bgOverlay = Math.max(0, Math.min(100, Math.round(o.bgOverlay)));
  }
  if (o.bgOverlayTint === "dark" || o.bgOverlayTint === "light") {
    style.bgOverlayTint = o.bgOverlayTint;
  }
  if (o.textColor === "dark" || o.textColor === "light") {
    style.textColor = o.textColor;
  }
  if (o.paddingY === "none" || o.paddingY === "compact" || o.paddingY === "normal" || o.paddingY === "spacious") {
    style.paddingY = o.paddingY;
  }
  if (typeof o.paddingTop === "number" && !Number.isNaN(o.paddingTop)) {
    style.paddingTop = Math.max(0, Math.min(240, Math.round(o.paddingTop)));
  }
  if (typeof o.paddingBottom === "number" && !Number.isNaN(o.paddingBottom)) {
    style.paddingBottom = Math.max(0, Math.min(240, Math.round(o.paddingBottom)));
  }
  if (typeof o.cardMode === "boolean" && o.cardMode) {
    style.cardMode = true;
  }
  if (o.hideOn === "mobile" || o.hideOn === "desktop") {
    style.hideOn = o.hideOn;
  }
  if (
    o.animation === "none" ||
    o.animation === "fade" ||
    o.animation === "slide-up" ||
    o.animation === "slide-down" ||
    o.animation === "slide-left" ||
    o.animation === "slide-right" ||
    o.animation === "zoom-in"
  ) {
    if (o.animation !== "none") style.animation = o.animation;
  }
  if (o.animDuration === "fast" || o.animDuration === "normal" || o.animDuration === "slow") {
    if (o.animDuration !== "normal") style.animDuration = o.animDuration;
  }
  if (o.animDelay === 0 || o.animDelay === 150 || o.animDelay === 300 || o.animDelay === 450) {
    if (o.animDelay !== 0) style.animDelay = o.animDelay;
  }
  if (typeof o.anchorId === "string") {
    const aid = o.anchorId.trim().toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_-]/g, "");
    if (/^[a-z0-9_-]{2,32}$/.test(aid)) {
      style.anchorId = aid;
    }
  }
  if (typeof o.customClass === "string") {
    const cls = o.customClass.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 80);
    if (cls) {
      style.customClass = cls;
    }
  }
  if (o.textAlign === "left" || o.textAlign === "center" || o.textAlign === "right") {
    style.textAlign = o.textAlign;
  }
  if (
    o.bgPattern === "none" ||
    o.bgPattern === "dots" ||
    o.bgPattern === "grid" ||
    o.bgPattern === "diagonal" ||
    o.bgPattern === "mesh" ||
    o.bgPattern === "cross"
  ) {
    if (o.bgPattern !== "none") style.bgPattern = o.bgPattern;
  }
  if (typeof o.bgPatternOpacity === "number" && !Number.isNaN(o.bgPatternOpacity)) {
    style.bgPatternOpacity = Math.max(0, Math.min(100, Math.round(o.bgPatternOpacity)));
  }
  if (o.mobile && typeof o.mobile === "object" && !Array.isArray(o.mobile)) {
    const m = o.mobile as Record<string, unknown>;
    const mob: SectionMobileStyle = {};
    if (typeof m.paddingTop === "number" && !Number.isNaN(m.paddingTop)) {
      mob.paddingTop = Math.max(0, Math.min(240, Math.round(m.paddingTop)));
    }
    if (typeof m.paddingBottom === "number" && !Number.isNaN(m.paddingBottom)) {
      mob.paddingBottom = Math.max(0, Math.min(240, Math.round(m.paddingBottom)));
    }
    if (m.paddingY === "none" || m.paddingY === "compact" || m.paddingY === "normal" || m.paddingY === "spacious") {
      mob.paddingY = m.paddingY;
    }
    if (m.textAlign === "left" || m.textAlign === "center" || m.textAlign === "right") {
      mob.textAlign = m.textAlign;
    }
    if (m.textScale === "compact" || m.textScale === "normal" || m.textScale === "enlarged") {
      mob.textScale = m.textScale;
    }
    if (typeof m.reverseStack === "boolean" && m.reverseStack) {
      mob.reverseStack = true;
    }
    if (Object.keys(mob).length > 0) {
      style.mobile = mob;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

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
      if (v === "" || v === "#" || v.startsWith("#")) return v;
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
    const style = normalizeSectionStyle(o.style);
    const label = typeof o.label === "string" && o.label.trim().length > 0 ? plain(o.label.trim(), 60) : undefined;
    return {
      id,
      type: def.type,
      ...(label ? { label } : {}),
      ...(o.disabled === true ? { disabled: true } : {}),
      settings: normalizeSettings(def, o.settings, `${def.label} (section ${i + 1})`),
      ...(style ? { style } : {}),
    };
  });
  for (const type of requiredFor(kind)) {
    const label = sectionDef(type)!.label;
    const found = sections.find((s) => s.type === type);
    if (!found) throw new ValidationError(`This page needs the "${label}" section`);
    if (found.disabled) throw new ValidationError(`The "${label}" section cannot be hidden: this page does not work without it`);
  }
  const seo = normalizePageSeo((raw as { seo?: unknown }).seo);
  const socialProof = normalizeSocialProof((raw as { socialProof?: unknown }).socialProof);
  return { version: 1, sections, ...(seo ? { seo } : {}), ...(socialProof ? { socialProof } : {}) };
}

export function normalizeSocialProof(raw?: unknown): SocialProofSettings | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const sp: SocialProofSettings = {};

  if (typeof o.enabled === "boolean") {
    sp.enabled = o.enabled;
  }
  if (o.position === "bottom-left" || o.position === "bottom-right" || o.position === "top-left" || o.position === "top-right") {
    sp.position = o.position;
  }
  if (typeof o.initialDelaySec === "number" && Number.isFinite(o.initialDelaySec)) {
    sp.initialDelaySec = Math.max(1, Math.min(60, Math.round(o.initialDelaySec)));
  }
  if (typeof o.intervalSec === "number" && Number.isFinite(o.intervalSec)) {
    sp.intervalSec = Math.max(3, Math.min(180, Math.round(o.intervalSec)));
  }
  if (typeof o.displayDurationSec === "number" && Number.isFinite(o.displayDurationSec)) {
    sp.displayDurationSec = Math.max(2, Math.min(30, Math.round(o.displayDurationSec)));
  }
  if (typeof o.showOnMobile === "boolean") {
    sp.showOnMobile = o.showOnMobile;
  }
  if (typeof o.safeAreaBottomPx === "number" && Number.isFinite(o.safeAreaBottomPx)) {
    sp.safeAreaBottomPx = Math.max(0, Math.min(240, Math.round(o.safeAreaBottomPx)));
  }
  if (typeof o.maxItems === "number" && Number.isFinite(o.maxItems)) {
    sp.maxItems = Math.max(1, Math.min(50, Math.round(o.maxItems)));
  }
  if (typeof o.anonymizeNames === "boolean") {
    sp.anonymizeNames = o.anonymizeNames;
  }
  if (typeof o.includeDistricts === "boolean") {
    sp.includeDistricts = o.includeDistricts;
  }

  return Object.keys(sp).length > 0 ? sp : undefined;
}

export function normalizePageSeo(raw?: unknown): PageSeoSettings | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const seo: PageSeoSettings = {};

  if (typeof o.title === "string") {
    const t = plain(o.title, 80).trim();
    if (t) seo.title = t;
  }
  if (typeof o.description === "string") {
    const d = plain(o.description, 320).trim();
    if (d) seo.description = d;
  }
  if (typeof o.keywords === "string") {
    const k = plain(o.keywords, 200).trim();
    if (k) seo.keywords = k;
  }
  if (typeof o.socialImage === "string") {
    const img = o.socialImage.trim();
    if (safeImage(img) && img !== "") {
      seo.socialImage = img;
    }
  }
  if (typeof o.noIndex === "boolean" && o.noIndex) {
    seo.noIndex = true;
  }
  if (typeof o.canonicalUrl === "string") {
    const u = o.canonicalUrl.trim();
    if (safeUrl(u) && u !== "") {
      seo.canonicalUrl = u.slice(0, 300);
    }
  }
  if (typeof o.ogTitle === "string") {
    const ot = plain(o.ogTitle, 100).trim();
    if (ot) seo.ogTitle = ot;
  }
  if (typeof o.ogDescription === "string") {
    const od = plain(o.ogDescription, 320).trim();
    if (od) seo.ogDescription = od;
  }

  return Object.keys(seo).length > 0 ? seo : undefined;
}

/**
 * Intelligent client-side heuristic extracting page title, description, and social cover image
 * from existing sections (e.g. Hero, Banner, Text, FAQ).
 */
export function extractPageSeoHeuristic(page: PageJson, fallbackTitle?: string): PageSeoSettings {
  let titleCandidate = "";
  let descCandidate = "";
  let imageCandidate = "";

  for (const s of page.sections) {
    if (s.disabled) continue;
    const settings = (s.settings || {}) as Record<string, unknown>;

    // 1. Look for image candidates
    if (!imageCandidate) {
      if (typeof settings.image === "string" && settings.image.trim() !== "" && safeImage(settings.image.trim())) {
        imageCandidate = settings.image.trim();
      } else if (typeof settings.heroImage === "string" && settings.heroImage.trim() !== "" && safeImage(settings.heroImage.trim())) {
        imageCandidate = settings.heroImage.trim();
      } else if (typeof settings.coverImage === "string" && settings.coverImage.trim() !== "" && safeImage(settings.coverImage.trim())) {
        imageCandidate = settings.coverImage.trim();
      } else if (typeof settings.bgImage === "string" && settings.bgImage.trim() !== "" && safeImage(settings.bgImage.trim())) {
        imageCandidate = settings.bgImage.trim();
      } else if (typeof s.style?.bgImage === "string" && s.style.bgImage.trim() !== "" && safeImage(s.style.bgImage.trim())) {
        imageCandidate = s.style.bgImage.trim();
      }
    }

    // 2. Look for title candidates
    if (!titleCandidate) {
      const candidate = settings.title || settings.heading || settings.headline;
      if (typeof candidate === "string" && candidate.trim()) {
        titleCandidate = candidate.trim();
      }
    }

    // 3. Look for description candidates
    if (!descCandidate) {
      const candidate = settings.subtitle || settings.subheading || settings.tagline || settings.text || settings.body || settings.description;
      if (typeof candidate === "string" && candidate.trim() && candidate.trim() !== titleCandidate) {
        descCandidate = candidate.trim().replace(/\s+/g, " ");
      }
    }
  }

  const finalTitle = plain(titleCandidate || fallbackTitle || "Store Page", 70);
  const finalDesc = plain(
    descCandidate || `${finalTitle} - Explore our curated selections, products and services with fast delivery across Bangladesh.`,
    160
  );

  return {
    title: finalTitle,
    description: finalDesc,
    ...(imageCandidate ? { socialImage: imageCandidate } : {}),
  };
}

export interface SeoChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  maxScore: number;
  tip: string;
}

export interface SeoHealthReport {
  score: number;
  status: "good" | "warning" | "bad";
  checklist: SeoChecklistItem[];
}

/**
 * Calculates a live 0-100 SEO health score and actionable checklist for Google & Social sharing.
 */
export function calculateSeoHealthScore(seo?: PageSeoSettings, _page?: PageJson): SeoHealthReport {
  const title = (seo?.title || "").trim();
  const desc = (seo?.description || "").trim();
  const titleLen = title.length;
  const descLen = desc.length;

  const checklist: SeoChecklistItem[] = [
    {
      id: "title_present",
      label: "Page title is defined",
      passed: titleLen >= 5,
      score: titleLen >= 5 ? 25 : 0,
      maxScore: 25,
      tip: "Define a clear, descriptive title for search engines.",
    },
    {
      id: "title_length",
      label: "Title has optimal length (40–65 chars)",
      passed: titleLen >= 40 && titleLen <= 65,
      score: titleLen >= 40 && titleLen <= 65 ? 15 : titleLen > 0 && titleLen < 40 ? 8 : 0,
      maxScore: 15,
      tip: titleLen > 65 ? `Title is ${titleLen} characters (over 65 may get truncated by Google).` : "Target 40 to 65 characters to maximize visibility in Google search results.",
    },
    {
      id: "desc_present",
      label: "Meta description is defined",
      passed: descLen >= 20,
      score: descLen >= 20 ? 25 : 0,
      maxScore: 25,
      tip: "Provide a summary to convince users to click on search results.",
    },
    {
      id: "desc_length",
      label: "Description has optimal length (120–165 chars)",
      passed: descLen >= 120 && descLen <= 165,
      score: descLen >= 120 && descLen <= 165 ? 15 : descLen > 0 && descLen < 120 ? 7 : 0,
      maxScore: 15,
      tip: descLen > 165 ? `Description is ${descLen} characters (over 165 will be cut off with ...).` : "Aim for 120 to 165 characters for high search snippet click-through.",
    },
    {
      id: "social_image",
      label: "Social share card image attached",
      passed: Boolean(seo?.socialImage && seo.socialImage.trim().length > 0),
      score: seo?.socialImage ? 10 : 0,
      maxScore: 10,
      tip: "Add an OpenGraph image (1200×630px recommended) for Facebook & WhatsApp previews.",
    },
    {
      id: "indexing",
      label: "Search engine indexing enabled",
      passed: !seo?.noIndex,
      score: !seo?.noIndex ? 10 : 0,
      maxScore: 10,
      tip: seo?.noIndex ? "This page is marked as 'noindex' (hidden from search engines)." : "Search crawlers can index and rank this page.",
    },
  ];

  const totalScore = checklist.reduce((sum, item) => sum + item.score, 0);
  const status: "good" | "warning" | "bad" = totalScore >= 80 ? "good" : totalScore >= 45 ? "warning" : "bad";

  return {
    score: totalScore,
    status,
    checklist,
  };
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
