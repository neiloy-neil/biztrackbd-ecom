import { randomUUID } from "node:crypto";
import { Prisma, getBasePrisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { STORE_THEMES, validateThemeId } from "../builder/theme";
import { audit } from "../audit/service";
import { DomainError, ValidationError } from "../errors";
import { publishEvent } from "../events";
import { normalizeBdPhone } from "../phone";
import { validateSubdomain } from "../routing/host";
import { scanBrandRisk } from "./brand";
import { demoTemplate } from "../demo/templates";
import { makeProductPictures, seedCatalog, type DemoDeps } from "../demo/seed";

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
  subdomain: z.string().trim().toLowerCase(),
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]).default("PRO"),
  theme: z.enum(["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"]).default("kapor"),
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
  plan: "STARTER" | "PRO" | "BUSINESS";
  trialEndsAt: Date;
  /** Waiting for a person to look at the name before a custom domain can be connected. */
  quarantined: boolean;
}

/** Three sample products so a new owner sees a working store at once. They count against the plan like any product and can be deleted. */
function failureOf(e: unknown): string {
  const msg = e instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(e.meta ?? {}) + e.message : e instanceof Error ? e.message : "";
  return msg;
}

/**
 * Creates a store, its owner, its trial and its starting settings in one go (docs/16 phase 5, docs/23 onboarding).
 * The owner is created without a password: sign-in is by the platform's auth provider, which is not connected yet.
 */
export async function signupStore(raw: unknown, opts: { now?: Date; /** Draws and stores the sample products' pictures. Without it the samples have none. */ pictures?: Pick<DemoDeps, "rasterize" | "save"> } = {}): Promise<SignedUp> {
  const parsed = SignupInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form", { field: parsed.error.issues[0]?.path[0] });
  const input = parsed.data;
  let phone: string;
  try {
    phone = normalizeBdPhone(input.phone);
  } catch {
    throw new ValidationError("Enter a valid Bangladeshi mobile number, like 01712345678", { field: "phone" });
  }
  validateThemeId(input.theme);
  const sub = validateSubdomain(input.subdomain);
  if (!sub.ok) throw new ValidationError(SUBDOMAIN_MESSAGES[sub.reason]!, { field: "subdomain" });

  const base = getBasePrisma();
  const plan = await base.plan.findUnique({ where: { tier: input.plan } });
  if (!plan || !plan.isPublic) throw new ValidationError("Choose a plan", { field: "plan" });
  const brand = scanBrandRisk(input.storeName, sub.label);

  const id = randomUUID();
  try {
    await base.$queryRaw`SELECT signup_create_tenant(${id}, ${input.storeName}, ${sub.label}, ${input.theme}, ${input.plan}::"PlanTier", ${input.ownerName}, ${input.email}, ${phone}, ${plan.trialDays}, ${brand !== null}, ${brand ? `Name or address contains "${brand}"` : null}, ${MAX_STORES_PER_EMAIL})`;
  } catch (e) {
    const m = failureOf(e);
    if (m.includes("subdomain taken")) throw new ValidationError(SUBDOMAIN_MESSAGES.taken!, { field: "subdomain" });
    if (m.includes("too many stores")) throw new ValidationError("This email already has the most stores one person can start. Sign in to the one you have.", { field: "email" });
    throw e;
  }

  // Sample products that fit the chosen template (docs/38). Pictures are made first because they are stored under the store's id.
  const template = input.demoData ? demoTemplate(input.theme) : undefined;
  let samples: { template: NonNullable<typeof template>; urls: Map<string, string> } | null = null;
  try {
    if (template) {
      let urls = new Map<string, string>();
      if (opts.pictures) {
        try { urls = await makeProductPictures(id, template, opts.pictures); } catch (e) { console.error("sample pictures failed", e instanceof Error ? e.name : "unknown"); }
      }
      samples = { template, urls };
    }
    const result = await withTenant(id, async (tx) => {
      const tenant = await tx.tenant.findFirstOrThrow();
      await tx.storeSettings.create({ data: { tenantId: id, storeName: input.storeName, tagline: input.tagline || null, contactPhone: phone, email: input.email } });
      await tx.shippingZone.createMany({
        data: [
          { tenantId: id, name: "Inside Dhaka city", districts: ["Dhaka"], rate: 80, freeOverAmount: 3000, etaMinDays: 1, etaMaxDays: 2 },
          { tenantId: id, name: "Outside Dhaka", districts: ["*"], rate: 130, freeOverAmount: 5000, etaMinDays: 3, etaMaxDays: 4 },
        ],
      });
      await tx.themeInstall.create({ data: { tenantId: id, themeId: input.theme, isActive: true, pagesJson: {}, settings: {} } });
      await tx.subscription.create({
        data: { tenantId: id, planTier: input.plan, interval: "MONTHLY", status: "TRIALING", amount: 0, currentPeriodStart: tenant.trialStartsAt, currentPeriodEnd: tenant.trialEndsAt },
      });
      const owner = await tx.tenantUser.create({ data: { tenantId: id, email: input.email, name: input.ownerName, phone, role: "STORE_OWNER", passwordHash: EXTERNAL_AUTH } });
      if (input.demoData && samples) await seedCatalog(tx, id, samples.template, samples.urls, { sample: true });
      await audit(tx, id, { userId: owner.id, email: owner.email }, "store.created", { plan: input.plan, theme: input.theme, demoData: input.demoData, quarantined: brand !== null });
      return { tenantId: id, subdomain: sub.label, storeName: input.storeName, plan: input.plan, trialEndsAt: tenant.trialEndsAt, quarantined: brand !== null };
    });
    await publishEvent("store/created", { tenantId: id, subdomain: sub.label, plan: input.plan });
    return result;
  } catch (e) {
    // Never leave a half-made store behind: it would hold the address and the email's quota.
    await withTenant(id, (tx) => tx.tenant.delete({ where: { id } })).catch(() => undefined);
    if (e instanceof DomainError) throw e;
    throw e;
  }
}
