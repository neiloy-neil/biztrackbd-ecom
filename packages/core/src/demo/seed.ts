import { randomUUID } from "node:crypto";
import { getBasePrisma, resolveTenantByHost, withTenant, type TenantTx } from "@biztrackbd/db";
import { activateTheme, publish, saveDraft } from "../builder/versions";
import { themeDefaults } from "../builder/theme";
import type { StaffActor } from "../permissions";
import { bannerSvg, productSvg, type Palette } from "./art";
import { DEMO_TEMPLATES, demoTemplate, type DemoProduct, type DemoTemplate } from "./templates";

/**
 * Builds (or rebuilds) a template's demo store (docs/38). Pictures are drawn here as SVG; turning them into WebP and storing them is
 * handed in, so this package does not depend on the image libraries. Every run starts from a clean slate: the old store, its pictures
 * and anything visitors left behind are removed first, so a demo never drifts.
 */

export interface DemoDeps {
  /** SVG text in, a raster picture (PNG) out. */
  rasterize(svg: string): Promise<Buffer>;
  /** Stores one raster picture for the store and returns the address pages load it from. */
  save(tenantId: string, picture: Buffer): Promise<{ url: string }>;
  /** Removes a stored picture. Failures are ignored: an orphaned picture is harmless, a failed reset is not. */
  remove(tenantId: string, url: string): Promise<unknown>;
}

export interface DemoResult { template: string; tenantId: string; subdomain: string; products: number; pictures: number }

const rootDomain = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const FAR_FUTURE = new Date("2100-01-01T00:00:00Z");
const PHONE = "01700000000";

const tone = (t: DemoTemplate, p: DemoProduct): Palette =>
  p.colour ? { ...t.palette, main: p.colour.main, accent: p.colour.accent } : p.tone === "accent" ? { ...t.palette, main: t.palette.accent, accent: t.palette.main } : t.palette;
const html = (p: DemoProduct, sample: boolean) =>
  `<p>${p.text}</p><p lang="bn">${p.textBn}</p><p><em>${sample ? "A sample product. Edit or delete it, then add your own." : "Demo store: this is a sample product."}</em></p>`;

/** Deletes a demo store and its pictures if it exists. */
async function removeExisting(template: DemoTemplate, deps: DemoDeps): Promise<boolean> {
  const root = rootDomain();
  const found = await resolveTenantByHost(`${template.host}.${root}`, root);
  if (!found) return false;
  const urls = await withTenant(found.id, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { isDemo: true } });
    // Never wipe a real merchant's store that happens to hold a demo name.
    if (!t.isDemo) throw new Error(`${template.host}.${root} exists and is not a demo store; refusing to touch it`);
    const settings = await tx.storeSettings.findFirst({ select: { logoUrl: true } });
    const images = await tx.productImage.findMany({ select: { url: true } });
    const versions = await tx.themeVersion.findMany({ select: { sectionsJson: true } });
    const inPages = JSON.stringify(versions.map((v) => v.sectionsJson)).match(/https:\/\/[^"\\]+\.webp/g) ?? [];
    return [...images.map((i) => i.url), ...(settings?.logoUrl ? [settings.logoUrl] : []), ...inPages];
  });
  await withTenant(found.id, (tx) => tx.tenant.delete({ where: { id: found.id } }));
  await Promise.all([...new Set(urls)].map((u) => deps.remove(found.id, u).catch(() => undefined)));
  return true;
}


export interface SeedOptions {
  /** Sample products for a new merchant's own store (editable, worded as samples) rather than a public demo store. */
  sample?: boolean;
}

/** One picture per product of the template, stored for this store. Returns the picture address by product slug. */
export async function makeProductPictures(tenantId: string, t: DemoTemplate, deps: Pick<DemoDeps, "rasterize" | "save">): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const p of t.products) urls.set(p.slug, (await deps.save(tenantId, await deps.rasterize(productSvg(p.art, tone(t, p))))).url);
  return urls;
}

/** The template's categories, products, variants and pictures. A product without a picture entry is created without one. */
export async function seedCatalog(tx: TenantTx, id: string, t: DemoTemplate, productUrls: Map<string, string>, opts: SeedOptions = {}): Promise<void> {
  const sample = opts.sample === true;
  const cat = new Map<string, string>();
  let order = 0;
  for (const c of t.categories) {
    const first = t.products.find((p) => p.category === c.slug);
    cat.set(c.slug, (await tx.category.create({ data: { tenantId: id, name: c.name, slug: c.slug, sortOrder: order++, imageUrl: first ? productUrls.get(first.slug) ?? null : null } })).id);
  }
  for (const p of t.products) {
    const product = await tx.product.create({
      data: {
        tenantId: id, title: p.title, titleBn: p.titleBn, slug: p.slug, descriptionHtml: html(p, sample), shortExcerpt: p.text, status: "ACTIVE", basePrice: p.price, compareAtPrice: p.compareAt ?? null,
        costPrice: p.cost, isFeatured: p.featured === true, categoryId: cat.get(p.category) ?? null, tags: [t.id],
      },
    });
    const url = productUrls.get(p.slug);
    if (url) await tx.productImage.create({ data: { tenantId: id, productId: product.id, url, altText: p.title, sortOrder: 0 } });
    for (const v of p.variants) {
      await tx.productVariant.create({
        data: { tenantId: id, productId: product.id, title: v.title, sku: `${p.slug}-${v.title}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), price: p.price, stockQuantity: p.stock, options: v.options },
      });
    }
  }
  await tx.$executeRaw`UPDATE "Tenant" SET "productCount" = "productCount" + ${t.products.length} WHERE id = ${id}`;
}

export async function resetDemoStore(templateId: string, deps: DemoDeps): Promise<DemoResult> {
  const t = demoTemplate(templateId);
  if (!t) throw new Error(`No demo template named ${templateId}`);
  await removeExisting(t, deps);

  const id = randomUUID();
  const email = `demo-${t.host}@${rootDomain().replace(/:\d+$/, "")}`;
  const base = getBasePrisma();
  // The same SQL function signup uses, called directly: it does not apply the reserved-name rule that keeps these names away from signup.
  await base.$queryRaw`SELECT signup_create_tenant(${id}, ${t.storeName}, ${t.host}, ${t.id}, 'BUSINESS'::"PlanTier", ${"Demo " + t.storeName}, ${email}, ${PHONE}, 14, false, ${null}, 3)`;

  // Pictures first, so the catalog can be written in one go.
  let pictures = 0;
  const store = async (svg: string) => { pictures++; return (await deps.save(id, await deps.rasterize(svg))).url; };
  const productUrls = await makeProductPictures(id, t, deps);
  pictures += productUrls.size;
  const heroUrl = await store(bannerSvg(t.palette, t.hero.art));
  const bannerUrl = await store(bannerSvg({ ...t.palette, bg: t.palette.main === "#1B1F24" ? "#F1F3F5" : t.palette.bg }, t.banner.art));

  const owner = await withTenant(id, async (tx) => {
    await tx.tenant.update({ where: { id }, data: { isDemo: true, demoKind: "TEMPLATE", status: "ACTIVE", trialEndsAt: FAR_FUTURE, themeId: t.id, locale: "en-BD" } });
    await tx.storeSettings.create({
      data: {
        tenantId: id, storeName: t.storeName, storeNameBn: t.storeNameBn, tagline: t.tagline, contactPhone: PHONE, email,
        announcement: t.announcement.text, announcementBn: t.announcement.textBn, description: `${t.storeName}: ${t.tagline}. A BizTrackBD demo store.`,
        codEnabled: true, bkashEnabled: false, nagadEnabled: false,
      },
    });
    await tx.shippingZone.createMany({
      data: [
        { tenantId: id, name: "Inside Dhaka city", districts: ["Dhaka"], rate: 80, freeOverAmount: 3000, etaMinDays: 1, etaMaxDays: 2 },
        { tenantId: id, name: "Outside Dhaka", districts: ["*"], rate: 130, freeOverAmount: 5000, etaMinDays: 3, etaMaxDays: 4 },
      ],
    });
    await tx.themeInstall.create({ data: { tenantId: id, themeId: t.id, isActive: true, pagesJson: {}, settings: {} } });

    await seedCatalog(tx, id, t, productUrls);
    return tx.tenantUser.create({ data: { tenantId: id, email, name: `Demo ${t.storeName}`, phone: PHONE, role: "STORE_OWNER", passwordHash: "EXTERNAL_AUTH" } });
  });

  // The home page, built from the same sections a merchant gets in the builder, then published.
  const actor: StaffActor = { userId: owner.id, email, name: owner.name, role: "STORE_OWNER" };
  await activateTheme(id, actor, t.id);
  const page = {
    version: 1 as const,
    sections: [
      { id: "announce1", type: "announcement-bar", settings: { text: t.announcement.text, textBn: t.announcement.textBn, bgColor: t.palette.ink, textColor: "#FFFFFF", link: "" } },
      { id: "hero1", type: "hero", settings: { eyebrow: t.hero.eyebrow, eyebrowBn: t.hero.eyebrowBn, title: t.hero.title, titleBn: t.hero.titleBn, text: t.hero.text, textBn: t.hero.textBn, ctaText: t.hero.ctaText, ctaTextBn: t.hero.ctaTextBn, ctaLink: "/search?sort=newest", image: heroUrl, align: "left" } },
      { id: "grid1", type: "featured-products", settings: { title: "Featured", titleBn: "নির্বাচিত", source: "featured", categorySlug: "", limit: 4, columns: "4" } },
      { id: "cats1", type: "category-grid", settings: { title: "Shop by category", titleBn: "ক্যাটাগরি অনুযায়ী কিনুন", limit: 3 } },
      { id: "banner1", type: "banner", settings: { image: bannerUrl, heading: t.banner.heading, headingBn: t.banner.headingBn, text: t.banner.text, textBn: t.banner.textBn, ctaText: t.banner.ctaText, ctaTextBn: t.banner.ctaTextBn, ctaLink: "/search?sale=1", height: "short" } },
      { id: "grid2", type: "featured-products", settings: { title: "New arrivals", titleBn: "নতুন পণ্য", source: "new", categorySlug: "", limit: 8, columns: "4" } },
      { id: "about1", type: "rich-text", settings: { heading: t.about.heading, headingBn: t.about.headingBn, body: t.about.body, bodyBn: t.about.bodyBn } },
      ...(t.bespoke ? [
        { id: "bespoke1", type: "rich-text", settings: { heading: t.bespoke.heading, headingBn: t.bespoke.headingBn, body: t.bespoke.body, bodyBn: t.bespoke.bodyBn } },
        { id: "bespoke2", type: "banner", settings: { image: bannerUrl, heading: t.bespoke.bannerHeading, headingBn: t.bespoke.bannerHeadingBn, text: t.bespoke.bannerText, textBn: t.bespoke.bannerTextBn, ctaText: t.bespoke.ctaText, ctaTextBn: t.bespoke.ctaTextBn, ctaLink: "/search?sort=newest", height: "short" } },
      ] : []),
      { id: "trust1", type: "trust-strip", settings: {} },
    ],
  };
  await saveDraft(id, actor, "home", page, themeDefaults(t.id));
  await publish(id, actor, "home", "Demo layout");

  return { template: t.id, tenantId: id, subdomain: t.host, products: t.products.length, pictures };
}

export const DEMO_TEMPLATE_IDS = DEMO_TEMPLATES.map((t) => t.id);
