import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getBasePrisma, resolveTenantByHost, withTenant } from "@biztrackbd/db";
import { activateTheme, getLive, publish, saveDraft } from "../builder/versions";
import { DomainError } from "../errors";
import { createOrder, transitionOrder } from "../orders/service";
import type { StaffActor } from "../permissions";
import { seedCatalog } from "./seed";
import { demoTemplate, type DemoTemplate } from "./templates";

/**
 * The demo admin (docs/41). A visitor gets a private copy of a demo store, with starter orders, that is deleted after a few hours.
 * The copy reuses the template's pictures by address, so a visitor costs database rows only and no storage.
 */

export const DEMO_SESSION_HOURS = 3;
export const DEMO_MAX_ACTIVE = 50;
export const DEMO_STARTS_PER_HOUR = 3;
/** A new sample order at most this often, and never more than this many in one demo. */
export const DEMO_ORDER_EVERY_MS = 3 * 60_000;
export const DEMO_MAX_ORDERS = 40;
export const DEMO_MAX_UNPACKED = 12;

export class DemoBusyError extends DomainError {
  constructor() { super("DEMO_BUSY", "The demo is busy right now. Please try again in a few minutes.", 503); }
}
export class DemoLimitError extends DomainError {
  constructor() { super("DEMO_LIMIT", "You have started a few demos already. Please use one of them, or try again in an hour.", 429); }
}

const rootDomain = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const FAR_FUTURE = new Date("2100-01-01T00:00:00Z");
const PHONE = "01700000000";

function secret(): string {
  const s = process.env.DEMO_SESSION_SECRET || process.env.CUSTOMER_AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("DEMO_SESSION_SECRET (or CUSTOMER_AUTH_SECRET) must be set");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`demo|${payload}`).digest("base64url");

export interface DemoCookiePayload { tenantId: string; expiresAt: number }

export function createDemoCookie(p: DemoCookiePayload): string {
  const json = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${json}.${sign(json)}`;
}

/** The tenant and expiry in a demo cookie, or null if it is forged or past its time. The tenant still has to be checked against the database. */
export function verifyDemoCookie(value: string | undefined | null, now = Date.now()): DemoCookiePayload | null {
  try {
    const [json, sig] = (value ?? "").split(".");
    if (!json || !sig) return null;
    const a = Buffer.from(sig), b = Buffer.from(sign(json));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as DemoCookiePayload;
    if (typeof p.tenantId !== "string" || typeof p.expiresAt !== "number" || now > p.expiresAt) return null;
    return p;
  } catch {
    return null;
  }
}

/** Who started a demo, as a hash: enough to limit one visitor, nothing that identifies them. */
export const demoCreatorKey = (ip: string, agent = "") => createHash("sha256").update(`${secret()}|${ip}|${agent.slice(0, 80)}`).digest("hex").slice(0, 32);

const NAMES = ["Rina Akter", "Tanvir Hasan", "Nusrat Jahan", "Imran Hossain", "Sadia Islam", "Mehedi Hasan", "Farzana Yasmin", "Rakib Ahmed", "Mou Chowdhury", "Shakil Khan", "Tasnim Sultana", "Arif Rahman"];
const PLACES: { area: string; district: string; division: string }[] = [
  { area: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, { area: "Mirpur", district: "Dhaka", division: "Dhaka" }, { area: "Uttara", district: "Dhaka", division: "Dhaka" },
  { area: "Agrabad", district: "Chattogram", division: "Chattogram" }, { area: "Zindabazar", district: "Sylhet", division: "Sylhet" }, { area: "Rajshahi Sadar", district: "Rajshahi", division: "Rajshahi" },
];

interface Copy { tenantId: string; subdomain: string; expiresAt: Date }

const actorOf = (id: string, name: string, email: string): StaffActor => ({ userId: id, email, name, role: "STORE_OWNER" });
const shortId = () => randomBytes(5).toString("hex").slice(0, 8);

/** Reads what a copy needs from the template's own demo store: its pictures by product, its categories and its published home page. */
async function readTemplateStore(t: DemoTemplate) {
  const root = rootDomain();
  const found = await resolveTenantByHost(`${t.host}.${root}`, root);
  if (!found) throw new DomainError("DEMO_UNAVAILABLE", "That demo is not available right now.", 503);
  const data = await withTenant(found.id, async (tx) => {
    const products = await tx.product.findMany({ select: { slug: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } });
    const settings = await tx.storeSettings.findFirst();
    return { urls: new Map(products.flatMap((p) => (p.images[0] ? [[p.slug, p.images[0].url] as const] : []))), settings };
  });
  const live = await getLive(found.id, "home");
  return { ...data, live };
}

/**
 * Makes a visitor's private copy of a demo store and returns the signed cookie that opens its admin. Refuses (before creating anything)
 * when too many demos exist or this visitor has started several in the last hour.
 */
export async function createDemoSession(templateId: string, creator: string, now = new Date()): Promise<Copy & { cookie: string; template: string }> {
  const t = demoTemplate(templateId);
  if (!t) throw new DomainError("DEMO_UNAVAILABLE", "That demo is not available.", 404);
  const base = getBasePrisma();
  const [counts] = await base.$queryRaw<{ active: number; recent: number }[]>`SELECT * FROM demo_session_counts(${creator})`;
  if ((counts?.recent ?? 0) >= DEMO_STARTS_PER_HOUR) throw new DemoLimitError();
  if ((counts?.active ?? 0) >= DEMO_MAX_ACTIVE) throw new DemoBusyError();

  const src = await readTemplateStore(t);
  const id = randomUUID();
  const subdomain = `d-${shortId()}`;
  const email = `demo-${subdomain}@demo.${rootDomain().replace(/:\d+$/, "")}`;
  const expiresAt = new Date(now.getTime() + DEMO_SESSION_HOURS * 3_600_000);
  await base.$queryRaw`SELECT signup_create_tenant(${id}, ${t.storeName}, ${subdomain}, ${t.id}, 'BUSINESS'::"PlanTier", ${"Demo owner"}, ${email}, ${PHONE}, 14, false, ${null}, 3)`;

  try {
    const owner = await withTenant(id, async (tx) => {
      await tx.tenant.update({
        where: { id },
        data: { isDemo: true, demoKind: "SESSION", demoTemplate: t.id, demoExpiresAt: expiresAt, demoCreator: creator, demoKeepToken: randomBytes(18).toString("base64url"), status: "ACTIVE", trialEndsAt: FAR_FUTURE, themeId: t.id, locale: "en-BD" },
      });
      const s = src.settings;
      await tx.storeSettings.create({
        data: {
          tenantId: id, storeName: t.storeName, storeNameBn: t.storeNameBn, tagline: t.tagline, contactPhone: PHONE, email, announcement: s?.announcement ?? null, announcementBn: s?.announcementBn ?? null,
          description: s?.description ?? null, logoUrl: s?.logoUrl ?? null, codEnabled: true, bkashEnabled: true, nagadEnabled: false, bkashNumber: "01711111111",
        },
      });
      await tx.shippingZone.createMany({
        data: [
          { tenantId: id, name: "Inside Dhaka city", districts: ["Dhaka"], rate: 80, freeOverAmount: 3000, etaMinDays: 1, etaMaxDays: 2 },
          { tenantId: id, name: "Outside Dhaka", districts: ["*"], rate: 130, freeOverAmount: 5000, etaMinDays: 3, etaMaxDays: 4 },
        ],
      });
      await tx.themeInstall.create({ data: { tenantId: id, themeId: t.id, isActive: true, pagesJson: {}, settings: {} } });
      await seedCatalog(tx, id, t, src.urls, { sample: true });
      return tx.tenantUser.create({ data: { tenantId: id, email, name: "Demo owner", phone: PHONE, role: "STORE_OWNER", passwordHash: "EXTERNAL_AUTH" } });
    });
    const actor = actorOf(owner.id, owner.name, email);
    await activateTheme(id, actor, t.id);
    if (src.live) {
      await saveDraft(id, actor, "home", src.live.page, src.live.theme);
      await publish(id, actor, "home", "Demo layout");
    }
    await seedStarterOrders(id, actor);
  } catch (e) {
    // Never leave a half-made copy behind.
    await deleteDemoTenant(id).catch(() => undefined);
    throw e;
  }
  return { tenantId: id, subdomain, expiresAt, template: t.id, cookie: createDemoCookie({ tenantId: id, expiresAt: expiresAt.getTime() }) };
}

interface Pick { variantId: string; price: number }

async function pickVariants(tenantId: string, n: number): Promise<Pick[]> {
  const vs = await withTenant(tenantId, (tx) => tx.productVariant.findMany({ where: { stockQuantity: { gt: 3 }, product: { status: "ACTIVE", deletedAt: null } }, select: { id: true, price: true }, take: 60 }));
  const out: Pick[] = [];
  for (let i = 0; i < n && vs.length; i++) { const v = vs[randomInt(vs.length)]!; out.push({ variantId: v.id, price: Number(v.price) }); }
  return out;
}

const newPhone = () => `01${[3, 4, 5, 6, 7, 8, 9][randomInt(7)]}${randomInt(10_000_000, 99_999_999)}`;

/** One sample order: mostly cash on delivery, sometimes a bKash payment with a TrxID waiting to be checked. */
async function placeSample(tenantId: string, kind: "COD" | "MANUAL_BKASH"): Promise<{ orderId: string }> {
  const items = await pickVariants(tenantId, randomInt(1, 3));
  if (items.length === 0) throw new Error("no products to order");
  const place = PLACES[randomInt(PLACES.length)]!;
  const placed = await createOrder(tenantId, {
    idempotencyKey: `demo-${randomUUID()}`,
    customer: { name: NAMES[randomInt(NAMES.length)]!, phone: newPhone() },
    shipping: { address: `House ${randomInt(1, 90)}, Road ${randomInt(1, 20)}, ${place.area}`, city: place.area, district: place.district, division: place.division },
    items: items.map((i) => ({ variantId: i.variantId, quantity: 1 })),
    paymentMethod: kind,
    ...(kind === "MANUAL_BKASH" ? { mfs: { senderNumber: newPhone(), trxId: `DM${randomBytes(4).toString("hex").toUpperCase()}${randomInt(10, 99)}` } } : {}),
  });
  return { orderId: placed.orderId };
}

/** About two weeks of history so the dashboard, chart and reports have something to show: delivered, shipped, one cancelled, and some waiting. */
async function seedStarterOrders(tenantId: string, actor: StaffActor): Promise<void> {
  const system = { type: "SYSTEM_CRON" as const, id: actor.userId, name: "Demo" };
  const plan: { daysAgo: number; fate: "DELIVERED" | "SHIPPED" | "CANCELLED" | "CONFIRMED" | "NEW" | "CHECK"; kind: "COD" | "MANUAL_BKASH" }[] = [
    { daysAgo: 12, fate: "DELIVERED", kind: "COD" }, { daysAgo: 11, fate: "DELIVERED", kind: "MANUAL_BKASH" }, { daysAgo: 9, fate: "DELIVERED", kind: "COD" }, { daysAgo: 8, fate: "DELIVERED", kind: "COD" },
    { daysAgo: 6, fate: "DELIVERED", kind: "MANUAL_BKASH" }, { daysAgo: 5, fate: "DELIVERED", kind: "COD" }, { daysAgo: 4, fate: "CANCELLED", kind: "COD" }, { daysAgo: 3, fate: "DELIVERED", kind: "COD" },
    { daysAgo: 2, fate: "SHIPPED", kind: "COD" }, { daysAgo: 1, fate: "SHIPPED", kind: "MANUAL_BKASH" }, { daysAgo: 1, fate: "CONFIRMED", kind: "COD" },
    { daysAgo: 0, fate: "NEW", kind: "COD" }, { daysAgo: 0, fate: "CHECK", kind: "MANUAL_BKASH" },
  ];
  for (const p of plan) {
    const { orderId } = await placeSample(tenantId, p.kind);
    if (p.fate !== "NEW" && p.fate !== "CHECK") {
      if (p.fate === "CANCELLED") { await transitionOrder(tenantId, orderId, "CANCELLED", system, "Customer changed their mind"); }
      else {
        if (p.kind === "MANUAL_BKASH") await withTenant(tenantId, (tx) => tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", mfsVerifiedAt: new Date() } }));
        const path = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
        const stop = path.indexOf(p.fate);
        for (let i = 0; i <= stop; i++) await transitionOrder(tenantId, orderId, path[i]!, system);
      }
    }
    if (p.daysAgo > 0) {
      const back = new Date(Date.now() - p.daysAgo * 86_400_000 - randomInt(0, 6) * 3_600_000);
      await withTenant(tenantId, (tx) => tx.order.update({ where: { id: orderId }, data: { createdAt: back, ...(p.fate === "DELIVERED" ? { deliveredAt: new Date(back.getTime() + 2 * 86_400_000) } : {}) } }));
    }
  }
  await withTenant(tenantId, (tx) => tx.tenant.update({ where: { id: tenantId }, data: { demoLastOrderAt: new Date() } }));
}

/**
 * Called when a demo admin page loads: if it has been a few minutes since the last sample order, one more arrives, so the demo feels alive.
 * Safe to call on every load: the "last order" time is claimed in one statement, so two pages at once place one order.
 */
export async function maybeDropDemoOrder(tenantId: string, now = new Date()): Promise<boolean> {
  try {
    const claimed = await withTenant(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<{ n: number; unpacked: number }[]>`
        SELECT (SELECT count(*)::int FROM "Order") AS n, (SELECT count(*)::int FROM "Order" WHERE status IN ('PENDING', 'CONFIRMED', 'PROCESSING')) AS unpacked`;
      const r = rows[0]!;
      if (r.n >= DEMO_MAX_ORDERS || r.unpacked >= DEMO_MAX_UNPACKED) return false;
      const since = new Date(now.getTime() - DEMO_ORDER_EVERY_MS);
      const upd = await tx.$executeRaw`UPDATE "Tenant" SET "demoLastOrderAt" = ${now} WHERE "demoKind" = 'SESSION' AND ("demoLastOrderAt" IS NULL OR "demoLastOrderAt" < ${since})`;
      return upd > 0;
    });
    if (!claimed) return false;
    await placeSample(tenantId, randomInt(10) < 3 ? "MANUAL_BKASH" : "COD");
    return true;
  } catch (e) {
    console.error("[demo] sample order failed", e instanceof Error ? e.name : "unknown");
    return false;
  }
}

/** Deletes a visitor's demo copy. Orders go first: their items point at products, so the store cannot be removed in one step while orders exist. */
export async function deleteDemoTenant(tenantId: string): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await tx.order.deleteMany({});
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}

/** The cleanup job: deletes every visitor demo past its time. */
export async function sweepDemoSessions(): Promise<{ deleted: number }> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string }[]>`SELECT * FROM demo_expired_sessions()`;
  let deleted = 0;
  for (const r of rows) {
    try {
      await deleteDemoTenant(r.tenantId);
      deleted++;
    } catch (e) {
      console.error("[demo] could not delete an expired demo", e instanceof Error ? e.name : "unknown");
    }
  }
  return { deleted };
}

/** What the admin needs to know about a demo tenant from its cookie: still there, still a visitor copy, not expired. */
export async function loadDemoTenant(tenantId: string, now = new Date()): Promise<{ id: string; subdomain: string; template: string; expiresAt: Date; keepCode: string | null } | null> {
  const t = await withTenant(tenantId, (tx) => tx.tenant.findFirst({ where: { id: tenantId, demoKind: "SESSION" }, select: { id: true, subdomain: true, demoTemplate: true, demoExpiresAt: true, demoKeepToken: true } })).catch(() => null);
  if (!t || !t.demoExpiresAt || t.demoExpiresAt <= now) return null;
  return { id: t.id, subdomain: t.subdomain, template: t.demoTemplate ?? "", expiresAt: t.demoExpiresAt, keepCode: t.demoKeepToken ? `${t.id}.${t.demoKeepToken}` : null };
}
