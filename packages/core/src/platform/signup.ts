import { notifyOwner } from "../mail/send";
import { copyKeptPage, copyKeptPictures, finishKeep, keptPageJson, keptPictureUrls, readKeptStore, writeKeptCatalog, type KeptStore } from "../demo/keep";
import { randomUUID } from "node:crypto";
import { Prisma, getBasePrisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { STORE_THEMES } from "../builder/theme";
import { installTemplateForNewStore, resolveTemplateForSignup } from "./templates";
import { audit } from "../audit/service";
import { DomainError, ValidationError } from "../errors";
import { publishEvent } from "../events";
import { normalizeBdPhone } from "../phone";
import { validateSubdomain } from "../routing/host";
import { scanBrandRisk } from "./brand";
import { demoTemplate } from "../demo/templates";
import { makeProductPictures, seedCatalog, type DemoDeps } from "../demo/seed";
import { createAutoLoginToken } from "../auth/auto-login";
import { adminCreateUser } from "../auth/supabase";
import { getCategoryStarterPreset, type StarterCatalogPreset } from "../demo/catalog-presets";

const EXTERNAL_AUTH = "EXTERNAL_AUTH";
const MAX_STORES_PER_EMAIL = 3;

/** Themes a new store can start on. Specialized behavior is enabled separately through modules. */
export const THEMES = STORE_THEMES.map(({ id, name, blurb }) => ({ id, name, blurb, live: true })) as readonly {
  id: (typeof STORE_THEMES)[number]["id"];
  name: string;
  blurb: string;
  live: true;
}[];

export const SignupInput = z.object({
  ownerName: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  phone: z.string().trim().min(1, "Enter your mobile number"),
  storeName: z.string().trim().min(2, "Enter your store name").max(60),
  category: z.enum(["FASHION", "BEAUTY", "ELECTRONICS", "GROCERY", "GENERAL"]).default("GENERAL"),
  password: z.string().min(8, "Use at least 8 characters").max(72).optional(),
  subdomain: z.string().trim().toLowerCase(),
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]).default("PRO"),
  // A template id: one of the original six, or any template staff have published (docs/46 stage 5). Checked against the published list below.
  theme: z.string().trim().toLowerCase().min(2).max(40).default("kapor"),
  tagline: z.string().trim().max(120).optional(),
  locale: z.enum(["bn-BD", "en-US"]).default("bn-BD"),
  demoData: z.boolean().default(true),
});
export type SignupInput = z.input<typeof SignupInput>;

export type SubdomainCheck = { ok: true; label: string } | { ok: false; reason: "too_short" | "too_long" | "invalid" | "reserved" | "taken" };

export const SUBDOMAIN_MESSAGES: Record<string, string> = {
  too_short: "Use at least 3 letters or numbers", too_long: "Use 40 characters or fewer", invalid: "Use only letters, numbers and single hyphens",
  reserved: "That name is kept for BizTrackBD. Choose another.", taken: "That address is already taken. Try another.",
};

/** Live check for the wizard: is this address free? */
export async function checkSubdomain(input: string): Promise<SubdomainCheck> {
  const v = validateSubdomain(input);
  if (!v.ok) return v;
  const [r] = await getBasePrisma().$queryRaw<{ taken: boolean }[]>`SELECT signup_subdomain_taken(${v.label}) AS taken`;
  return r?.taken ? { ok: false, reason: "taken" } : { ok: true, label: v.label };
}

export interface SignedUp {
  tenantId: string;
  subdomain: string;
  storeName: string;
  ownerEmail: string;
  ownerName: string;
  plan: "STARTER" | "PRO" | "BUSINESS";
  trialEndsAt: Date;
  /** Waiting for a person to look at the name before a custom domain can be connected. */
  quarantined: boolean;
  /** Products carried over from a demo the visitor chose to keep, and whether its home page came too (docs/41). */
  kept?: number;
  keptPage?: boolean;
  autoLoginToken?: string;
}

/** Three sample products so a new owner sees a working store at once. They count against the plan like any product and can be deleted. */
function failureOf(e: unknown): string {
  const msg = e instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(e.meta ?? {}) + e.message : e instanceof Error ? e.message : "";
  return msg;
}

async function seedCategoryCatalog(tx: TenantTx, id: string, preset: StarterCatalogPreset): Promise<number> {
  const catMap = new Map<string, string>();
  for (const c of preset.categories) {
    const created = await tx.category.create({
      data: { tenantId: id, name: c.name, slug: c.slug },
    });
    catMap.set(c.slug, created.id);
  }
  for (const p of preset.products) {
    const prod = await tx.product.create({
      data: {
        tenantId: id,
        title: p.title,
        titleBn: p.titleBn,
        slug: p.slug,
        descriptionHtml: `<p>${p.text}</p>${p.textBn ? `<p lang="bn">${p.textBn}</p>` : ""}<p><em>Sample product for ${preset.categoryKey} store. Edit or replace with your own.</em></p>`,
        shortExcerpt: p.text,
        status: "ACTIVE",
        basePrice: p.price,
        compareAtPrice: p.compareAt ?? null,
        costPrice: p.cost ?? Math.round(p.price * 0.55),
        isFeatured: p.featured ?? false,
        categoryId: catMap.get(p.category) ?? null,
        tags: [preset.categoryKey.toLowerCase(), "starter"],
      },
    });
    for (const v of p.variants) {
      await tx.productVariant.create({
        data: {
          tenantId: id,
          productId: prod.id,
          title: v.title,
          sku: `${p.slug}-${v.title}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
          price: p.price,
          stockQuantity: v.stock,
          options: v.options ?? {},
          isActive: true,
        },
      });
    }
  }
  await tx.$executeRaw`UPDATE "Tenant" SET "productCount" = "productCount" + ${preset.products.length} WHERE id = ${id}`;
  return preset.products.length;
}

/**
 * Creates a store, its owner, its trial and its starting settings in one go (docs/16 phase 5, docs/23 onboarding).
 */
export async function signupStore(raw: unknown, opts: { now?: Date; /** Draws and stores the sample products' pictures. Without it the samples have none. */ pictures?: Pick<DemoDeps, "rasterize" | "save">; /** A demo's "keep this store" code, and how to copy one of its pictures into the new store (docs/41). */ keep?: { code: string; copyImage: (tenantId: string, url: string) => Promise<string> } } = {}): Promise<SignedUp> {
  const parsed = SignupInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form", { field: parsed.error.issues[0]?.path[0] });
  const input = parsed.data;
  let phone: string;
  try {
    phone = normalizeBdPhone(input.phone);
  } catch {
    throw new ValidationError("Enter a valid Bangladeshi mobile number, like 01712345678", { field: "phone" });
  }
  const chosen = await resolveTemplateForSignup(input.theme);
  // Everything about how the store is drawn follows the template's look; the template itself is remembered on the store.
  const look = chosen.baseLook;
  const sub = validateSubdomain(input.subdomain);
  if (!sub.ok) throw new ValidationError(SUBDOMAIN_MESSAGES[sub.reason]!, { field: "subdomain" });

  const base = getBasePrisma();
  const plan = await base.plan.findUnique({ where: { tier: input.plan } });
  if (!plan || !plan.isPublic) throw new ValidationError("Choose a plan", { field: "plan" });
  const brand = scanBrandRisk(input.storeName, sub.label);

  const id = randomUUID();
  try {
    await base.$queryRaw`SELECT signup_create_tenant(${id}, ${input.storeName}, ${sub.label}, ${look}, ${input.plan}::"PlanTier", ${input.ownerName}, ${input.email}, ${phone}, ${plan.trialDays}, ${brand !== null}, ${brand ? `Name or address contains "${brand}"` : null}, ${MAX_STORES_PER_EMAIL})`;
  } catch (e) {
    const m = failureOf(e);
    if (m.includes("subdomain taken")) throw new ValidationError(SUBDOMAIN_MESSAGES.taken!, { field: "subdomain" });
    if (m.includes("too many stores")) throw new ValidationError("This email already has the most stores one person can start. Sign in to the one you have.", { field: "email" });
    throw e;
  }

  // A demo the visitor wants to keep: its products, pictures and home page come along, instead of the template's untouched samples (docs/41).
  let kept: KeptStore | null = null;
  let keptPictures = new Map<string, string>();
  if (opts.keep) {
    try {
      kept = await readKeptStore(opts.keep.code);
      if (kept) keptPictures = await copyKeptPictures(id, keptPictureUrls(kept, await keptPageJson(kept.demoTenantId)), opts.keep.copyImage);
    } catch (e) {
      console.error("keep this store failed, using samples", e instanceof Error ? e.name : "unknown");
      kept = null;
    }
  }

  const categoryPreset = getCategoryStarterPreset(input.category);

  // Sample products that fit the chosen template (docs/38). Pictures are made first because they are stored under the store's id.
  const template = input.demoData && !kept ? demoTemplate(look) : undefined;
  let samples: { template: NonNullable<typeof template>; urls: Map<string, string> } | null = null;
  try {
    if (template && opts.pictures) {
      let urls = new Map<string, string>();
      try { urls = await makeProductPictures(id, template, opts.pictures); } catch (e) { console.error("sample pictures failed", e instanceof Error ? e.name : "unknown"); }
      samples = { template, urls };
    }
    const result = await withTenant(id, async (tx) => {
      const tenant = await tx.tenant.findFirstOrThrow();
      await tx.storeSettings.create({
        data: {
          tenantId: id, storeName: input.storeName, tagline: input.tagline || kept?.settings?.tagline || null, contactPhone: phone, email: input.email,
          ...(kept?.settings ? { description: kept.settings.description, announcement: kept.settings.announcement, announcementBn: kept.settings.announcementBn, storeNameBn: kept.settings.storeNameBn } : {}),
        },
      });
      await tx.shippingZone.createMany({
        data: [
          { tenantId: id, name: categoryPreset.shipping.insideDhaka.name, districts: ["Dhaka"], rate: categoryPreset.shipping.insideDhaka.rate, freeOverAmount: categoryPreset.shipping.insideDhaka.freeOver, etaMinDays: 1, etaMaxDays: 2 },
          { tenantId: id, name: categoryPreset.shipping.outsideDhaka.name, districts: ["*"], rate: categoryPreset.shipping.outsideDhaka.rate, freeOverAmount: categoryPreset.shipping.outsideDhaka.freeOver, etaMinDays: 3, etaMaxDays: 4 },
        ],
      });
      await tx.themeInstall.create({ data: { tenantId: id, themeId: look, isActive: true, pagesJson: {}, settings: {} } });
      await tx.subscription.create({
        data: { tenantId: id, planTier: input.plan, interval: "MONTHLY", status: "TRIALING", amount: 0, currentPeriodStart: tenant.trialStartsAt, currentPeriodEnd: tenant.trialEndsAt },
      });

      let authUserId: string | null = null;
      if (input.password) {
        try {
          const u = await adminCreateUser(input.email, input.password, { confirmed: true });
          authUserId = u.id;
        } catch (authErr) {
          console.warn("adminCreateUser during signup skipped or existing", authErr instanceof Error ? authErr.message : authErr);
        }
      }

      const owner = await tx.tenantUser.create({
        data: {
          tenantId: id, email: input.email, name: input.ownerName, phone, role: "STORE_OWNER",
          passwordHash: EXTERNAL_AUTH,
          authUserId,
        },
      });
      await installTemplateForNewStore(tx, id, chosen.info, owner.id);
      let keptCount = 0;
      if (kept) {
        keptCount = await writeKeptCatalog(tx, id, kept, keptPictures);
      } else if (input.demoData) {
        const hasExplicitCategory = Boolean((raw as Record<string, unknown>)?.category);
        if (hasExplicitCategory) {
          keptCount = await seedCategoryCatalog(tx, id, categoryPreset);
        } else if (samples) {
          await seedCatalog(tx, id, samples.template, samples.urls, { sample: true });
        } else if (template) {
          await seedCatalog(tx, id, template, new Map(), { sample: true });
        } else {
          keptCount = await seedCategoryCatalog(tx, id, categoryPreset);
        }
      }

      const autoLoginToken = createAutoLoginToken({ tenantId: id, userId: owner.id, email: owner.email });

      await audit(tx, id, { userId: owner.id, email: owner.email }, "store.created", { plan: input.plan, theme: look, template: chosen.info.id, category: input.category, demoData: input.demoData, quarantined: brand !== null });
      return {
        tenantId: id, subdomain: sub.label, storeName: input.storeName, plan: input.plan, trialEndsAt: tenant.trialEndsAt,
        quarantined: brand !== null, kept: keptCount, ownerId: owner.id, ownerEmail: owner.email, ownerName: owner.name,
        autoLoginToken,
      };
    });
    let keptPage = false;
    if (kept) {
      keptPage = await copyKeptPage(kept.demoTenantId, id, { userId: result.ownerId, email: result.ownerEmail, name: result.ownerName, role: "STORE_OWNER" }, keptPictures);
      await finishKeep(kept.demoTenantId);
    }
    await publishEvent("store/created", { tenantId: id, subdomain: sub.label, plan: input.plan });
    await notifyOwner(id, "WELCOME", { trialEndsDate: result.trialEndsAt }, { dedupeKey: id });
    const { ownerId: _o, ...out } = result;
    return { ...out, keptPage };
  } catch (e) {
    // Never leave a half-made store behind: it would hold the address and the email's quota.
    await withTenant(id, (tx) => tx.tenant.delete({ where: { id } })).catch(() => undefined);
    if (e instanceof DomainError) throw e;
    throw e;
  }
}
