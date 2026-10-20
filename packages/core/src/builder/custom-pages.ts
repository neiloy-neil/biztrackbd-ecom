import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, PlanLimitError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { defaultCustomPage, normalizeSettings, sectionDef, validatePage, type PageJson, type PageSection } from "./registry";
import { customKey } from "./versions";

/**
 * Pages built from sections (docs/47 part D): About us, Contact, a size guide, delivery and returns, or anything else. They are rows of the
 * same `Page` table as the rich-text pages (so the address, the footer and the sitemap work the same), told apart by having a layout
 * (`sectionsJson`), and edited in the visual editor with drafts, publish and history under the key `page:<id>`.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_PAGE_SLUGS = new Set([
  "new", "edit", "api", "admin", "cart", "checkout", "products", "c", "p", "blog", "l",
  "order", "account", "login", "search", "draft", "wholesale", "media", "go", "ref", "partner",
  "icon.svg", "robots.txt", "sitemap.xml", "manifest.json"
]);
const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** How many pages built from sections a plan allows. A plan's own `limits.customPages` wins (null = no limit); otherwise 3, 10 and 50. */
const DEFAULT_LIMIT: Record<string, number> = { STARTER: 3, PRO: 10, BUSINESS: 50 };

export interface CustomPageRow {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  updatedAt: Date;
  pageKey: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

// ---- Starting layouts: original text, English and Bangla. Pictures are left for the merchant to add.

type Pair = [string, string];
const sec = (type: string, i: number, settings: Record<string, unknown>): PageSection => ({ id: `${type.replace(/-/g, "_")}_${i}`, type, settings: normalizeSettings(sectionDef(type)!, settings) });
const text = (title: Pair, body: Pair, cta?: Pair) => ({ title: title[0], titleBn: title[1], text: body[0], textBn: body[1], ctaText: cta?.[0] ?? "", ctaTextBn: cta?.[1] ?? "" });

export interface CustomPageTemplate { id: string; name: string; blurb: string; titleSuggestion: string; slugSuggestion: string; build: () => PageJson }

export const CUSTOM_PAGE_TEMPLATES: CustomPageTemplate[] = [
  {
    id: "blank", name: "Blank page", blurb: "One heading and a paragraph to start from.", titleSuggestion: "New page", slugSuggestion: "new-page", build: defaultCustomPage,
  },
  {
    id: "about", name: "About us", blurb: "Who you are, what you stand for, and how to reach you.", titleSuggestion: "About us", slugSuggestion: "about-us",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("lp-text", 1, text(["About us", "আমাদের কথা"], ["Tell your customers who you are, where you started and why you do this. A few honest lines build more trust than a long story.", "আপনি কে, কোথা থেকে শুরু করেছেন আর কেন এই কাজ করেন তা ক্রেতাদের জানান। কয়েকটি সৎ লাইন লম্বা গল্পের চেয়ে বেশি আস্থা আনে।"])),
      sec("lp-split", 1, { ...text(["What we care about", "আমরা যা গুরুত্ব দিই"], ["Say what you promise every customer: quality, honest prices, quick delivery.", "প্রতিটি ক্রেতাকে আপনি কী প্রতিশ্রুতি দেন তা লিখুন: মান, ন্যায্য দাম, দ্রুত ডেলিভারি।"]), side: "right" }),
      sec("lp-benefits", 1, { title: "Why shop with us", titleBn: "কেন আমাদের কাছ থেকে কিনবেন", items: [{ title: "Checked before it leaves", titleBn: "পাঠানোর আগে যাচাই করা", text: "Every order is looked over by hand.", textBn: "প্রতিটি অর্ডার হাতে দেখা হয়।" }, { title: "Pay on delivery", titleBn: "হাতে পেয়ে টাকা", text: "Cash on delivery across Bangladesh.", textBn: "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।" }, { title: "We answer", titleBn: "আমরা উত্তর দিই", text: "Message us any day.", textBn: "যেকোনো দিন মেসেজ করুন।" }] }),
      sec("contact-block", 1, {}),
    ] }),
  },
  {
    id: "contact", name: "Contact", blurb: "Phone, WhatsApp, address and the questions people ask first.", titleSuggestion: "Contact us", slugSuggestion: "contact",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("lp-text", 1, text(["Contact us", "যোগাযোগ"], ["Call or message us. We reply the same day.", "ফোন বা মেসেজ করুন। আমরা একই দিনে উত্তর দিই।"])),
      sec("contact-block", 1, {}),
      sec("lp-faq", 1, { title: "Before you ask", titleBn: "জিজ্ঞাসার আগে", items: [{ q: "Where is my order?", qBn: "আমার অর্ডার কোথায়?", a: "Use the order link we sent you, or message us with your order number.", aBn: "আমরা যে অর্ডার লিংক পাঠিয়েছি তা দেখুন, বা অর্ডার নম্বর সহ মেসেজ করুন।" }, { q: "Can I change my address?", qBn: "ঠিকানা বদলানো যাবে?", a: "Yes, before the parcel is handed to the courier.", aBn: "হ্যাঁ, কুরিয়ারের কাছে দেওয়ার আগে।" }] }),
    ] }),
  },
  {
    id: "size-guide", name: "Size guide", blurb: "How to measure, and a place to explain your sizes.", titleSuggestion: "Size guide", slugSuggestion: "size-guide",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("lp-text", 1, text(["Size guide", "সাইজ গাইড"], ["Find your size in two minutes. Measure over light clothes and compare with the table below.", "দুই মিনিটে আপনার সাইজ খুঁজে নিন। পাতলা কাপড়ের ওপর মাপ নিয়ে নিচের তালিকার সাথে মিলিয়ে নিন।"])),
      sec("lp-split", 1, { ...text(["How to measure", "কীভাবে মাপবেন"], ["Chest: around the fullest part. Waist: around the narrowest part. Length: from the shoulder down.", "বুক: সবচেয়ে চওড়া অংশ ঘুরিয়ে। কোমর: সবচেয়ে সরু অংশ ঘুরিয়ে। দৈর্ঘ্য: কাঁধ থেকে নিচ পর্যন্ত।"]), side: "left" }),
      sec("rich-text", 1, { heading: "Our sizes", headingBn: "আমাদের সাইজ", body: "S: chest 38, length 28\\n\\nM: chest 40, length 29\\n\\nL: chest 42, length 30", bodyBn: "" }),
    ] }),
  },
  {
    id: "delivery", name: "Delivery and returns", blurb: "How long it takes, what it costs and what happens if something is wrong.", titleSuggestion: "Delivery and returns", slugSuggestion: "delivery-and-returns",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("lp-text", 1, text(["Delivery and returns", "ডেলিভারি ও ফেরত"], ["Plain answers about delivery time, charges and exchanges.", "ডেলিভারির সময়, খরচ আর বদল নিয়ে সহজ উত্তর।"])),
      sec("trust-strip", 1, {}),
      sec("lp-faq", 1, { title: "Questions", titleBn: "প্রশ্ন", items: [{ q: "How long does delivery take?", qBn: "ডেলিভারি পেতে কত সময় লাগে?", a: "1 to 2 days inside Dhaka and 3 to 4 days outside. We call before we send it.", aBn: "ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ৩-৪ দিন। পাঠানোর আগে আমরা ফোন করি।" }, { q: "What if something is wrong?", qBn: "কিছু ভুল হলে কী হবে?", a: "Check the parcel when it arrives and tell us the same day. We will exchange it or refund you.", aBn: "পণ্য পেয়ে দেখে নিন এবং সেদিনই জানান। আমরা বদল বা ফেরত দেব।" }] }),
    ] }),
  },
  {
    id: "services", name: "Services & Pricing", blurb: "Professional service offerings, transparent pricing, FAQs, and quote contact form.", titleSuggestion: "Services", slugSuggestion: "services",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("service-cards", 1, { title: "Our Professional Services", titleBn: "আমাদের সেবাসমূহ", subtitle: "Reliable and certified solutions tailored to your business needs", subtitleBn: "আপনার ব্যবসার প্রয়োজন অনুযায়ী নির্ভরযোগ্য ও সার্টিফাইড সেবা", source: "auto", columns: "3" }),
      sec("accordion-faq", 1, { title: "Frequently Asked Questions", titleBn: "সাধারণ জিজ্ঞাসা", items: [{ q: "How do I request a custom quotation?", qBn: "কীভাবে কাস্টম কোটেশন পাব?", a: "Submit the inquiry form below or message us on WhatsApp with your requirements.", aBn: "নিচের ফর্মটি পূরণ করুন বা আপনার চাহিদাসহ সরাসরি আমাদের হোয়াটসঅ্যাপ করুন।" }] }),
      sec("contact-form", 1, { heading: "Request a Free Consultation", headingBn: "বিনামূল্যে পরামর্শের জন্য যোগাযোগ করুন", subhead: "Tell us about your project and we will respond with an estimate within 24 hours.", subheadBn: "আপনার প্রজেক্টের বিস্তারিত জানান, আমরা ২৪ ঘণ্টার মধ্যে প্রাক্কলন জানাব।" }),
    ] }),
  },
  {
    id: "portfolio", name: "Portfolio & Case Studies", blurb: "Curated project showcase, client case studies, brochure downloads, and inquiry CTA.", titleSuggestion: "Portfolio", slugSuggestion: "portfolio",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("portfolio-grid", 1, { title: "Featured Client Projects", titleBn: "নির্বাচিত ক্লায়েন্ট প্রজেক্ট", subtitle: "Proven results delivered across diverse industries", subtitleBn: "বিভিন্ন খাতে সফলভাবে বাস্তবায়িত কিছু উল্লেখযোগ্য কাজ", source: "auto", columns: "3" }),
      sec("download-card", 1, { title: "Download Company Credentials", titleBn: "কোম্পানি প্রোফাইল ডাউনলোড করুন", description: "Get our verified brochure with comprehensive client case studies.", descriptionBn: "সম্পূর্ণ কেস স্টাডি সহ আমাদের প্রাতিষ্ঠানিক পরিচিতিপত্র দেখতে পিডিএফ ডাউনলোড করুন।" }),
      sec("contact-form", 1, { heading: "Have a Project in Mind?", headingBn: "নতুন কোনো প্রজেক্ট নিয়ে ভাবছেন?", subhead: "Let's collaborate to bring your vision to life.", subheadBn: "আপনার লক্ষ্য অর্জনে আমাদের টিম প্রস্তুত।" }),
    ] }),
  },
  {
    id: "team", name: "Team & Leadership", blurb: "Specialist photo profiles, professional credentials, leadership story, and contact details.", titleSuggestion: "Our Team", slugSuggestion: "team",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("lp-text", 1, text(["Our Leadership & Team", "আমাদের পরিচালনা পর্ষদ ও টিম"], ["Meet the experienced leaders and dedicated specialists driving excellence every day.", "অভিজ্ঞ নেতৃত্ব ও নিবেদিত বিশেষজ্ঞদের সাথে পরিচিত হোন যারা প্রতিদিন সেরা সেবা নিশ্চিত করেন।"])),
      sec("team-grid", 1, { title: "Specialists & Leaders", titleBn: "আমাদের বিশেষজ্ঞ ও লিডারবৃন্দ", subtitle: "Certified professionals with decades of combined expertise", subtitleBn: "দশকেরও বেশি সম্মিলিত অভিজ্ঞতাসম্পন্ন সার্টিফাইড বিশেষজ্ঞ", source: "auto", columns: "3" }),
      sec("contact-form", 1, { heading: "Join Our Mission or Connect", headingBn: "আমাদের সাথে যোগাযোগ করুন", subhead: "Reach out to our leadership team directly.", subheadBn: "আমাদের টিমের সাথে সরাসরি যোগাযোগ করতে মেসেজ পাঠান।" }),
    ] }),
  },
  {
    id: "chambers", name: "Chambers & Appointments", blurb: "Doctor qualifications, chamber schedules, serial hotline numbers, and booking CTA.", titleSuggestion: "Chambers & Appointment", slugSuggestion: "appointment",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("doctor-hero", 1, {}),
      sec("clinic-chambers", 1, { title: "Chamber Schedules", titleBn: "চেম্বার ও সময়সূচি", subtitle: "Direct visiting hours and serial booking contacts", subtitleBn: "রোগী দেখার নির্ধারিত চেম্বার ও সিরিয়াল নম্বর", source: "auto" }),
      sec("reservation-cta", 1, { title: "Request an Appointment", titleBn: "অ্যাপয়েন্টমেন্ট রিকোয়েস্ট", subtitle: "Submit preferred chamber and date. Our assistant will confirm by phone.", subtitleBn: "পছন্দের চেম্বার ও তারিখ সিলেক্ট করে রিকোয়েস্ট পাঠান। আমাদের সহকারী ফোনে নিশ্চিত করবেন।" }),
      sec("accordion-faq", 1, { title: "Patient Guidance & FAQs", titleBn: "রোগীদের সাধারণ জিজ্ঞাসা", items: [{ q: "How early should I arrive at the chamber?", qBn: "চেম্বারে কতক্ষণ আগে পৌঁছাতে হবে?", a: "Please arrive 15 minutes before your allocated serial time.", aBn: "অনুগ্রহ করে আপনার নির্ধারিত সিরিয়াল সময়ের ১৫ মিনিট পূর্বে চেম্বারে উপস্থিত থাকুন।" }] }),
    ] }),
  },
  {
    id: "menu", name: "Restaurant Menu & Dining", blurb: "Interactive food & beverage menu, dietary highlights, hours & location, and table reservation.", titleSuggestion: "Menu", slugSuggestion: "menu",
    build: () => validatePage("custom", { version: 1, sections: [
      sec("restaurant-menu", 1, { title: "Full Dining Menu", titleBn: "আমাদের সম্পূর্ণ মেন্যু", subtitle: "Freshly prepared daily with 100% Halal authentic ingredients", subtitleBn: "প্রতিদিন খাঁটি উপাদানে প্রস্তুতকৃত ১০০% হালাল খাবার", source: "auto", showDietary: true }),
      sec("restaurant-hours-location", 1, { title: "Dine-in Hours & Location", titleBn: "ডাইন-ইন সময়সূচি ও ঠিকানা" }),
      sec("reservation-cta", 1, { title: "Reserve a Dining Table", titleBn: "টেবিল বুকিং রিকোয়েস্ট", subtitle: "Guarantee your table for family and corporate gatherings.", subtitleBn: "পারিবারিক বা কর্পোরেট আড্ডার জন্য অগ্রিম টেবিল নিশ্চিত করুন।" }),
    ] }),
  },
];

export const customPageTemplate = (id: string | undefined | null): CustomPageTemplate | undefined => CUSTOM_PAGE_TEMPLATES.find((t) => t.id === id);

// ---- Store side ------------------------------------------------------------------------------------------------------------

const rowOf = (r: { id: string; title: string; slug: string; isPublished: boolean; updatedAt: Date; seoTitle: string | null; seoDescription: string | null }): CustomPageRow => ({ ...r, pageKey: customKey(r.id) });
const hasLayout = { sectionsJson: { not: Prisma.DbNull } } as const;

export async function listCustomPages(tenantId: string, actor: StaffActor): Promise<CustomPageRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => (await tx.page.findMany({ where: hasLayout, orderBy: { updatedAt: "desc" }, take: 200 })).map(rowOf));
}

export async function createCustomPage(tenantId: string, actor: StaffActor, input: { title: string; slug?: string; templateId?: string }): Promise<{ id: string; pageKey: string }> {
  assertCan(actor, "design", "edit");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) throw new ValidationError("Give the page a name of 2 to 80 characters", { field: "title" });
  const slug = (input.slug?.trim() || slugify(title)).toLowerCase();
  if (!SLUG.test(slug) || slug.length > 60 || RESERVED_PAGE_SLUGS.has(slug)) throw new ValidationError("The address can use small letters, numbers and dashes, like about-us", { field: "slug" });
  const layout = (customPageTemplate(input.templateId) ?? CUSTOM_PAGE_TEMPLATES[0]!).build();
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
    const plan = await tx.plan.findUnique({ where: { tier: tenant.planTier } });
    const limits = (plan?.limits as Record<string, unknown> | null) ?? {};
    const cap = "customPages" in limits ? (limits.customPages as number | null) : (DEFAULT_LIMIT[tenant.planTier] ?? 3);
    if (typeof cap === "number") {
      const used = await tx.page.count({ where: hasLayout });
      if (used >= cap) throw new PlanLimitError("pages built from sections", cap, used);
    }
    if (await tx.page.findFirst({ where: { slug }, select: { id: true } })) throw new ValidationError("You already have a page at that address", { field: "slug" });
    // Not live until the owner presses Publish in the editor: a half-built page never goes public.
    const row = await tx.page.create({ data: { tenantId, title, slug, contentHtml: "", isPublished: false, sectionsJson: layout as object } });
    await audit(tx, tenantId, actor, "page.created", { slug, template: input.templateId ?? "blank" });
    return { id: row.id, pageKey: customKey(row.id) };
  });
}

export async function updateCustomPage(tenantId: string, actor: StaffActor, id: string, input: { title?: string; seoTitle?: string; seoDescription?: string }): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.page.findFirst({ where: { id, ...hasLayout } });
    if (!row) throw new NotFoundError("Page");
    const data: Prisma.PageUpdateInput = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (t.length < 2 || t.length > 80) throw new ValidationError("Give the page a name of 2 to 80 characters", { field: "title" });
      data.title = t;
    }
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle.replace(/<[^>]*>/g, "").trim().slice(0, 70) || null;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription.replace(/<[^>]*>/g, "").trim().slice(0, 160) || null;
    await tx.page.update({ where: { id }, data });
  });
}

export async function setCustomPageLive(tenantId: string, actor: StaffActor, id: string, live: boolean): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.page.findFirst({ where: { id, ...hasLayout } });
    if (!row) throw new NotFoundError("Page");
    if (live && !(await tx.themeVersion.findFirst({ where: { pageKey: customKey(id), state: "PUBLISHED" }, select: { id: true } }))) throw new ValidationError("Publish the page from the editor first");
    await tx.page.update({ where: { id }, data: { isPublished: live } });
    await audit(tx, tenantId, actor, live ? "page.live" : "page.unpublished", { slug: row.slug });
  });
}

export async function deleteCustomPage(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.page.findFirst({ where: { id, ...hasLayout } });
    if (!row) throw new NotFoundError("Page");
    await tx.themeVersion.deleteMany({ where: { pageKey: customKey(id) } });
    await tx.page.delete({ where: { id } });
    await audit(tx, tenantId, actor, "page.deleted", { slug: row.slug });
  });
}

export interface PublicCustomPage { id: string; title: string; slug: string; seoTitle: string | null; seoDescription: string | null; page: PageJson }

/**
 * The public read. Null for an ordinary (rich-text) page, or a page that is not live. With `preview`, the draft layout is shown instead and a page
 * that is not live yet still renders.
 */
export async function getPublicCustomPage(tenantId: string, slug: string, preview?: { page: PageJson }): Promise<PublicCustomPage | null> {
  const now = new Date();
  const row = await withTenant(tenantId, (tx) => tx.page.findFirst({ where: { slug, ...hasLayout, ...(preview ? {} : { isPublished: true, OR: [{ publishAt: null }, { publishAt: { lte: now } }] }) } }));
  if (!row) return null;
  let page: PageJson;
  try {
    page = preview?.page ?? validatePage("custom", row.sectionsJson);
  } catch {
    return null;
  }
  return { id: row.id, title: row.title, slug: row.slug, seoTitle: row.seoTitle, seoDescription: row.seoDescription, page };
}

/** The id of a section page by slug, for the preview route (it needs the key to read the draft). */
export async function customPageIdBySlug(tenantId: string, slug: string): Promise<string | null> {
  return withTenant(tenantId, async (tx) => (await tx.page.findFirst({ where: { slug, ...hasLayout }, select: { id: true } }))?.id ?? null);
}
