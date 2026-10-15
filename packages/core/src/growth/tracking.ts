import { createHash } from "node:crypto";
import { Prisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { loadCredentials } from "../vault/integrations";

/**
 * Marketing pixels and server-side events (docs/07 section 17, docs/10).
 *
 * Meta counts an event once when the browser Pixel and the server (Conversions API) report it with the same event id.
 * Every event here has a stable id: a Purchase is always `purchase_<orderId>`, so the browser on the thank-you page and the
 * server at the moment of ordering agree without talking to each other. A server copy survives ad blockers; the browser copy
 * carries the visitor's own cookies. We keep one row per (event id, origin) so the owner can see both arrived.
 */

export const EVENT_NAMES = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Development and end-to-end tests may point this at a local fake. Ignored in production, so a stray variable cannot redirect real events. */
const graph = () => (process.env.NODE_ENV !== "production" && process.env.META_GRAPH_URL) || "https://graph.facebook.com/v21.0";
const EVENT_ID = /^[A-Za-z0-9_-]{8,80}$/;
const COOKIE = /^[A-Za-z0-9._-]{1,200}$/;

let fetchImpl: typeof fetch = (...a) => fetch(...a);
/** Tests swap in a fake Meta. */
export function setPixelFetchForTests(f: typeof fetch | undefined): void {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** Meta wants phone numbers as digits with the country code, lower-case and hashed. */
const hashPhone = (local: string) => sha(`88${local}`);
const hashEmail = (e: string) => sha(e.trim().toLowerCase());

export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;

export interface TrackingConfig {
  pixelId: string | null;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  tiktokPixelId: string | null;
  ga4ApiSecret: string | null;
  metaDomainVerification: string | null;
  googleSiteVerification: string | null;
  googleOAuthClientId: string | null;
  googleOAuthClientSecret: string | null;
  googleMerchantCenterId: string | null;
  capiConnected: boolean;
  capiMode: "TEST" | "LIVE" | null;
  capiStatus: string | null;
  lastVerifiedAt: Date | null;
  lastError: string | null;
}

export interface SeoSuiteConfig {
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  socialShareImageUrl: string | null;
  googleSiteVerification: string | null;
  richSnippetsEnabled: boolean;
  storeName: string;
  tagline: string | null;
  sitemapUrl: string;
  robotsUrl: string;
}

export interface StorefrontTracking {
  pixelId: string | null;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  tiktokPixelId: string | null;
  metaDomainVerification: string | null;
  googleSiteVerification?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  socialShareImageUrl?: string | null;
  richSnippetsEnabled?: boolean;
}

/** What the storefront may know: public pixel and container IDs. Access tokens never leave the server. */
export async function getStorefrontTracking(tenantId: string): Promise<StorefrontTracking> {
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst({
      select: {
        metaPixelId: true,
        googleAnalyticsId: true,
        googleTagManagerId: true,
        tiktokPixelId: true,
        metaDomainVerification: true,
        googleSiteVerification: true,
        seoTitle: true,
        description: true,
        seoKeywords: true,
        socialShareImageUrl: true,
        richSnippetsEnabled: true,
      },
    });
    return {
      pixelId: s?.metaPixelId ?? null,
      googleAnalyticsId: s?.googleAnalyticsId ?? null,
      googleTagManagerId: s?.googleTagManagerId ?? null,
      tiktokPixelId: s?.tiktokPixelId ?? null,
      metaDomainVerification: s?.metaDomainVerification ?? null,
      googleSiteVerification: s?.googleSiteVerification ?? null,
      seoTitle: s?.seoTitle ?? null,
      seoDescription: s?.description ?? null,
      seoKeywords: s?.seoKeywords ?? null,
      socialShareImageUrl: s?.socialShareImageUrl ?? null,
      richSnippetsEnabled: s?.richSnippetsEnabled ?? true,
    };
  });
}

export async function getSeoSuiteConfig(tenantId: string, origin?: string): Promise<SeoSuiteConfig> {
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst();
    const t = await tx.tenant.findUnique({ where: { id: tenantId }, select: { subdomain: true } });
    const cleanOrigin = origin || `https://${t?.subdomain || "store"}.biztrack.bd`;
    return {
      seoTitle: s?.seoTitle ?? null,
      seoDescription: s?.description ?? null,
      seoKeywords: s?.seoKeywords ?? null,
      socialShareImageUrl: s?.socialShareImageUrl ?? null,
      googleSiteVerification: s?.googleSiteVerification ?? null,
      richSnippetsEnabled: s?.richSnippetsEnabled ?? true,
      storeName: s?.storeName ?? "My Store",
      tagline: s?.tagline ?? null,
      sitemapUrl: `${cleanOrigin}/sitemap.xml`,
      robotsUrl: `${cleanOrigin}/robots.txt`,
    };
  });
}

export async function saveSeoSuiteConfig(
  tenantId: string,
  actor: StaffActor,
  input: {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string | null;
    socialShareImageUrl?: string | null;
    googleSiteVerification?: string | null;
    richSnippetsEnabled?: boolean;
  },
): Promise<void> {
  assertCan(actor, "marketing", "edit");
  const googleVerif = cleanVerification(input.googleSiteVerification);
  const seoTitle = input.seoTitle?.trim() || null;
  const seoDescription = input.seoDescription?.trim() || null;
  const seoKeywords = input.seoKeywords?.trim() || null;
  const socialShareImageUrl = input.socialShareImageUrl?.trim() || null;
  const richSnippetsEnabled = input.richSnippetsEnabled !== undefined ? Boolean(input.richSnippetsEnabled) : true;

  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.storeSettings.updateMany({
      data: {
        seoTitle,
        description: seoDescription,
        seoKeywords,
        socialShareImageUrl,
        googleSiteVerification: googleVerif,
        richSnippetsEnabled,
      },
    });
    if (count === 0) throw new NotFoundError("Store settings");
    await audit(tx, tenantId, actor, "seo.config_saved", {
      seoTitle,
      hasGoogleVerification: Boolean(googleVerif),
      richSnippetsEnabled,
    });
  });
}

/** Legacy alias for backwards compatibility */
export async function getPixelId(tenantId: string): Promise<string | null> {
  return (await getStorefrontTracking(tenantId)).pixelId;
}

async function capiRow(tenantId: string) {
  const rows = await withTenant(tenantId, (tx) => tx.tenantIntegration.findMany({ where: { provider: "META_CAPI", status: { not: "DISABLED" } } }));
  return rows.find((r) => r.mode === "LIVE") ?? rows[0] ?? null;
}

export async function getTrackingConfig(tenantId: string, actor: StaffActor): Promise<TrackingConfig> {
  assertCan(actor, "marketing", "view");
  const [sf, row, s] = await Promise.all([
    getStorefrontTracking(tenantId),
    capiRow(tenantId),
    withTenant(tenantId, (tx) =>
      tx.storeSettings.findFirst({
        select: {
          ga4ApiSecret: true,
          metaDomainVerification: true,
          googleSiteVerification: true,
          googleOAuthClientId: true,
          googleOAuthClientSecret: true,
          googleMerchantCenterId: true,
        },
      }),
    ),
  ]);
  return {
    pixelId: sf.pixelId,
    googleAnalyticsId: sf.googleAnalyticsId,
    googleTagManagerId: sf.googleTagManagerId,
    tiktokPixelId: sf.tiktokPixelId,
    ga4ApiSecret: s?.ga4ApiSecret ?? null,
    metaDomainVerification: s?.metaDomainVerification ?? null,
    googleSiteVerification: s?.googleSiteVerification ?? null,
    googleOAuthClientId: s?.googleOAuthClientId ?? null,
    googleOAuthClientSecret: s?.googleOAuthClientSecret ?? null,
    googleMerchantCenterId: s?.googleMerchantCenterId ?? null,
    capiConnected: Boolean(row),
    capiMode: (row?.mode as "TEST" | "LIVE" | undefined) ?? null,
    capiStatus: row?.status ?? null,
    lastVerifiedAt: row?.lastVerifiedAt ?? null,
    lastError: row?.lastError ?? null,
  };
}

export async function savePixelId(tenantId: string, actor: StaffActor, input: string): Promise<void> {
  await saveTrackingConfig(tenantId, actor, { pixelId: input });
}

function cleanVerification(v?: string | null): string | null {
  if (!v) return null;
  let s = v.trim();
  const match = s.match(/content=["']([^"']+)["']/i);
  if (match?.[1]) {
    s = match[1].trim();
  }
  if (s.toLowerCase().startsWith("google-site-verification=")) {
    s = s.slice("google-site-verification=".length).trim();
  }
  if (s.toLowerCase().startsWith("google-site-verification:")) {
    s = s.slice("google-site-verification:".length).trim();
  }
  s = s.replace(/^["']|["']$/g, "").trim();
  return s || null;
}

export async function saveTrackingConfig(
  tenantId: string,
  actor: StaffActor,
  input: {
    pixelId?: string | null;
    googleAnalyticsId?: string | null;
    googleTagManagerId?: string | null;
    tiktokPixelId?: string | null;
    ga4ApiSecret?: string | null;
    metaDomainVerification?: string | null;
    googleSiteVerification?: string | null;
    googleOAuthClientId?: string | null;
    googleOAuthClientSecret?: string | null;
    googleMerchantCenterId?: string | null;
  },
): Promise<void> {
  assertCan(actor, "marketing", "edit");
  const pixelId = input.pixelId?.trim() || null;
  if (pixelId && !/^\d{8,20}$/.test(pixelId)) throw new ValidationError("A Meta Pixel ID is 8 to 20 digits. Copy it from Meta Events Manager.");
  const ga4 = input.googleAnalyticsId?.trim() || null;
  if (ga4 && !/^G-[A-Za-z0-9]+$/i.test(ga4)) throw new ValidationError("A Google Analytics 4 ID starts with G-, like G-ABC123XYZ.");
  const gtm = input.googleTagManagerId?.trim() || null;
  if (gtm && !/^GTM-[A-Za-z0-9]+$/i.test(gtm)) throw new ValidationError("A Google Tag Manager Container ID starts with GTM-, like GTM-ABC123X.");
  const tiktok = input.tiktokPixelId?.trim() || null;
  if (tiktok && !/^[A-Za-z0-9_-]{10,40}$/.test(tiktok)) throw new ValidationError("Enter a valid TikTok Pixel ID (10 to 40 characters).");
  const ga4Secret = input.ga4ApiSecret?.trim() || null;
  if (ga4Secret && !/^[A-Za-z0-9_-]{10,64}$/.test(ga4Secret)) throw new ValidationError("Enter a valid GA4 Measurement Protocol API Secret.");
  const domainVerif = cleanVerification(input.metaDomainVerification);
  const googleVerif = cleanVerification(input.googleSiteVerification);
  const googleOAuthClientId = input.googleOAuthClientId?.trim() || null;
  const googleOAuthClientSecret = input.googleOAuthClientSecret?.trim() || null;
  const googleMerchantCenterId = input.googleMerchantCenterId?.trim() || null;

  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.storeSettings.updateMany({
      data: {
        metaPixelId: pixelId,
        googleAnalyticsId: ga4,
        googleTagManagerId: gtm,
        tiktokPixelId: tiktok,
        ga4ApiSecret: ga4Secret,
        metaDomainVerification: domainVerif,
        googleSiteVerification: googleVerif,
        googleOAuthClientId,
        googleOAuthClientSecret,
        googleMerchantCenterId,
      },
    });
    if (count === 0) throw new NotFoundError("Store settings");
    await audit(tx, tenantId, actor, "tracking.config_saved", {
      pixelId,
      googleAnalyticsId: ga4,
      googleTagManagerId: gtm,
      tiktokPixelId: tiktok,
      ga4ApiSecret: ga4Secret ? "[secret]" : null,
      metaDomainVerification: domainVerif,
      googleSiteVerification: googleVerif,
      googleOAuthClientId,
      googleMerchantCenterId,
    });
  });
}

// ---- Facebook Graph API OAuth & Ad Account Helpers ---------------------------------

export function buildMetaOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "ads_management,business_management",
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaOAuthCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ValidationError(err.error?.message ?? "Failed to authorize Facebook account");
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

export interface MetaAdAccountPixel {
  adAccountId: string;
  adAccountName: string;
  pixelId: string;
  pixelName: string;
}

export async function fetchMetaPixels(accessToken: string): Promise<MetaAdAccountPixel[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,adspixels{id,name}&access_token=${accessToken}`,
  );
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as {
    data?: { id: string; name: string; account_id: string; adspixels?: { data?: { id: string; name: string }[] } }[];
  };
  const list: MetaAdAccountPixel[] = [];
  for (const acc of body.data ?? []) {
    for (const px of acc.adspixels?.data ?? []) {
      list.push({
        adAccountId: acc.account_id || acc.id,
        adAccountName: acc.name,
        pixelId: px.id,
        pixelName: px.name,
      });
    }
  }
  return list;
}

// ---- Sending -------------------------------------------------------------------------------------------------------

export interface UserContext {
  phoneLocal?: string | null;
  email?: string | null;
  customerId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

interface ServerEvent {
  name: EventName;
  eventId: string;
  time: Date;
  url?: string | null;
  user: UserContext;
  value?: number;
  contentIds?: string[];
  numItems?: number;
}

function capiBody(e: ServerEvent, testCode?: string) {
  const u = e.user;
  const user_data: Record<string, unknown> = {};
  if (u.phoneLocal) user_data.ph = [hashPhone(u.phoneLocal)];
  if (u.email) user_data.em = [hashEmail(u.email)];
  if (u.customerId) user_data.external_id = [sha(u.customerId)];
  if (u.ip) user_data.client_ip_address = u.ip;
  if (u.userAgent) user_data.client_user_agent = u.userAgent.slice(0, 400);
  if (u.fbp && COOKIE.test(u.fbp)) user_data.fbp = u.fbp;
  if (u.fbc && COOKIE.test(u.fbc)) user_data.fbc = u.fbc;
  const custom_data: Record<string, unknown> = {};
  if (e.value !== undefined) { custom_data.value = e.value; custom_data.currency = "BDT"; }
  if (e.contentIds?.length) { custom_data.content_ids = e.contentIds.slice(0, 50); custom_data.content_type = "product"; }
  if (e.numItems !== undefined) custom_data.num_items = e.numItems;
  return {
    data: [{ event_name: e.name, event_time: Math.floor(e.time.getTime() / 1000), event_id: e.eventId, action_source: "website", ...(e.url ? { event_source_url: e.url } : {}), user_data, custom_data }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

export type SendResult = { ok: true; httpStatus: number } | { ok: false; httpStatus: number | null; detail: string };

/** One call to Meta's Conversions API. Never throws, and the error text never contains the token. */
async function sendCapi(tenantId: string, pixelId: string, e: ServerEvent, testCode?: string): Promise<SendResult> {
  const row = await capiRow(tenantId);
  if (!row) return { ok: false, httpStatus: null, detail: "No server-side token saved" };
  let token: string;
  try {
    token = (await loadCredentials(tenantId, "META_CAPI", row.mode)).secrets.accessToken ?? "";
  } catch {
    return { ok: false, httpStatus: null, detail: "The saved token cannot be read. Enter it again." };
  }
  try {
    const res = await fetchImpl(`${graph()}/${pixelId}/events`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(capiBody(e, testCode)), signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) return { ok: false, httpStatus: res.status, detail: (body.error?.message ?? `Meta answered ${res.status}`).slice(0, 200).replace(token, "[token]") };
    if (!body.events_received) return { ok: false, httpStatus: res.status, detail: "Meta did not accept the event" };
    return { ok: true, httpStatus: res.status };
  } catch {
    return { ok: false, httpStatus: null, detail: "Could not reach Meta" };
  }
}

async function remember(tenantId: string, r: { name: EventName; eventId: string; origin: "BROWSER" | "SERVER"; orderId?: string | null; status: string; payload?: object; detail?: string; httpStatus?: number | null }): Promise<boolean> {
  try {
    await withTenant(tenantId, (tx) =>
      tx.trackingEvent.create({ data: { tenantId, provider: "META", name: r.name, eventId: r.eventId, origin: r.origin, orderId: r.orderId ?? null, status: r.status, payload: (r.payload ?? {}) as Prisma.InputJsonValue, detail: r.detail ?? null, httpStatus: r.httpStatus ?? null } }),
    );
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // already recorded: a repeat, not a new event
    throw e;
  }
}

// ---- From the storefront -------------------------------------------------------------------------------------------

export const BrowserEventInput = z.object({
  name: z.enum(EVENT_NAMES).refine((n) => n !== "Purchase", "Purchases are reported by the order, not the browser"),
  eventId: z.string().regex(EVENT_ID),
  url: z.string().max(500).optional(),
  contentIds: z.array(z.string().max(64)).max(50).optional(),
  numItems: z.number().int().min(0).max(1000).optional(),
});

/**
 * The visitor's browser fired a Pixel event and tells us. We keep the record and send the same event, same id, from the
 * server, so Meta sees it twice and counts it once. The value comes from the database, never from the browser.
 */
export async function trackBrowserEvent(tenantId: string, raw: unknown, user: UserContext): Promise<{ recorded: boolean }> {
  const parsed = BrowserEventInput.safeParse(raw);
  const pixelId = await getPixelId(tenantId);
  if (!parsed.success || !pixelId) return { recorded: false };
  const e = parsed.data;
  if (!(await remember(tenantId, { name: e.name, eventId: e.eventId, origin: "BROWSER", status: "SENT", payload: { contentIds: e.contentIds ?? [], numItems: e.numItems ?? null } }))) return { recorded: false };
  if (await capiRow(tenantId)) {
    const r = await sendCapi(tenantId, pixelId, { name: e.name, eventId: e.eventId, time: new Date(), url: e.url, user, contentIds: e.contentIds, numItems: e.numItems });
    await remember(tenantId, { name: e.name, eventId: e.eventId, origin: "SERVER", status: r.ok ? "SENT" : "FAILED", detail: r.ok ? undefined : r.detail, httpStatus: r.httpStatus, payload: { contentIds: e.contentIds ?? [] } });
  }
  return { recorded: true };
}

async function purchaseFacts(tenantId: string, orderId: string) {
  return withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId }, include: { items: { select: { sku: true, variantId: true, quantity: true } } } });
    if (!o) return null;
    return { total: Number(o.totalAmount), phoneLocal: o.customerPhone, email: o.customerEmail, customerId: o.customerId, ids: o.items.map((i) => i.variantId ?? i.sku ?? "").filter(Boolean), qty: o.items.reduce((n, i) => n + i.quantity, 0) };
  });
}

/**
 * Dispatch server-side event to Google Analytics 4 via Measurement Protocol.
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function sendGa4ServerEvent(
  tenantId: string,
  event: {
    name: "purchase" | "refund";
    transactionId: string;
    value: number;
    currency?: string;
    items?: { id: string; name?: string; quantity?: number; price?: number }[];
    clientId?: string;
  },
): Promise<{ ok: boolean }> {
  try {
    const s = await withTenant(tenantId, (tx) =>
      tx.storeSettings.findFirst({
        select: { googleAnalyticsId: true, ga4ApiSecret: true },
      }),
    );
    if (!s?.googleAnalyticsId || !s.ga4ApiSecret) return { ok: false };

    const clientId = event.clientId || `bt_${event.transactionId.slice(-16)}`;
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(s.googleAnalyticsId)}&api_secret=${encodeURIComponent(s.ga4ApiSecret)}`;

    const body = {
      client_id: clientId,
      events: [
        {
          name: event.name,
          params: {
            transaction_id: event.transactionId,
            value: event.value,
            currency: event.currency ?? "BDT",
            items: event.items?.map((it) => ({
              item_id: it.id,
              item_name: it.name ?? it.id,
              quantity: it.quantity ?? 1,
              price: it.price ?? 0,
            })) ?? [],
          },
        },
      ],
    };

    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    return { ok: res.status >= 200 && res.status < 300 };
  } catch (err) {
    console.error("[tracking] GA4 server event failed", err instanceof Error ? err.name : "unknown");
    return { ok: false };
  }
}

/**
 * The order was just placed: report the Purchase to Meta from the server. Safe to call twice (a repeat is ignored). Best effort:
 * a Meta outage must never touch the customer's order, so this never throws.
 */
export async function sendServerPurchase(tenantId: string, orderId: string, ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null; url?: string | null } = {}): Promise<{ sent: boolean }> {
  try {
    const f = await purchaseFacts(tenantId, orderId);
    if (!f) return { sent: false };

    // 1. Dispatch to Google Analytics 4 Measurement Protocol (if configured)
    sendGa4ServerEvent(tenantId, {
      name: "purchase",
      transactionId: orderId,
      value: f.total,
      currency: "BDT",
      items: f.ids.map((id) => ({ id })),
    }).catch(() => undefined);

    // 2. Dispatch to Meta Conversions API (if configured)
    const pixelId = await getPixelId(tenantId);
    if (!pixelId || !(await capiRow(tenantId))) return { sent: false };

    const eventId = purchaseEventId(orderId);
    const payload = { value: f.total, currency: "BDT", contentIds: f.ids, numItems: f.qty };
    if (!(await remember(tenantId, { name: "Purchase", eventId, origin: "SERVER", orderId, status: "SENT", payload }))) return { sent: false };
    const r = await sendCapi(tenantId, pixelId, { name: "Purchase", eventId, time: new Date(), url: ctx.url, user: { phoneLocal: f.phoneLocal, email: f.email, customerId: f.customerId, ip: ctx.ip, userAgent: ctx.userAgent, fbp: ctx.fbp, fbc: ctx.fbc }, value: f.total, contentIds: f.ids, numItems: f.qty });
    if (!r.ok) {
      await withTenant(tenantId, (tx) => tx.trackingEvent.updateMany({ where: { eventId, origin: "SERVER" }, data: { status: "FAILED", detail: r.detail, httpStatus: r.httpStatus } }));
    }
    return { sent: r.ok };
  } catch (e) {
    console.error("[tracking] server purchase failed", e instanceof Error ? e.name : "unknown");
    return { sent: false };
  }
}

/** The thank-you page fired the browser Pixel's Purchase with the shared id. Returns what the Pixel should be told, from the order itself. */
export async function recordBrowserPurchase(tenantId: string, orderId: string): Promise<{ eventId: string; value: number; contentIds: string[]; numItems: number } | null> {
  const pixelId = await getPixelId(tenantId);
  if (!pixelId) return null;
  const f = await purchaseFacts(tenantId, orderId);
  if (!f) return null;
  const eventId = purchaseEventId(orderId);
  await remember(tenantId, { name: "Purchase", eventId, origin: "BROWSER", orderId, status: "SENT", payload: { value: f.total, currency: "BDT" } });
  return { eventId, value: f.total, contentIds: f.ids, numItems: f.qty };
}

/**
 * When an order is cancelled or marked returned by courier, fire a cancellation/reversal event to Meta CAPI.
 * This instructs Meta's ad algorithm to optimize away from serial COD returners and fraudulent numbers.
 */
export async function sendServerCancellation(
  tenantId: string,
  orderId: string,
  reason = "Courier return or cancelled",
): Promise<{ sent: boolean }> {
  try {
    const f = await purchaseFacts(tenantId, orderId);
    if (!f) return { sent: false };

    // 1. Dispatch refund event to GA4 Measurement Protocol
    sendGa4ServerEvent(tenantId, {
      name: "refund",
      transactionId: orderId,
      value: f.total,
      currency: "BDT",
    }).catch(() => undefined);

    // 2. Dispatch cancellation event to Meta CAPI
    const pixelId = await getPixelId(tenantId);
    if (!pixelId || !(await capiRow(tenantId))) return { sent: false };

    const eventId = `cancel_${orderId}`;
    const payload = { value: f.total, currency: "BDT", reason, contentIds: f.ids, numItems: f.qty };
    if (!(await remember(tenantId, { name: "Purchase", eventId, origin: "SERVER", orderId, status: "CANCELLED", payload }))) return { sent: false };
    const r = await sendCapi(tenantId, pixelId, {
      name: "Purchase",
      eventId,
      time: new Date(),
      user: { phoneLocal: f.phoneLocal, email: f.email, customerId: f.customerId },
      value: 0,
      contentIds: f.ids,
      numItems: f.qty,
    });
    return { sent: r.ok };
  } catch (e) {
    console.error("[tracking] server cancellation failed", e instanceof Error ? e.name : "unknown");
    return { sent: false };
  }
}

// ---- The owner's screen --------------------------------------------------------------------------------------------

export interface EventStat {
  name: string;
  browser: number;
  server: number;
  /** Event ids that arrived from both sides: Meta counts these once. */
  deduped: number;
  failed: number;
}

export interface TrackingOverview {
  config: TrackingConfig;
  stats: EventStat[];
  recent: { id: string; name: string; origin: string; status: string; eventId: string; detail: string | null; createdAt: Date }[];
}

export async function getTrackingOverview(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<TrackingOverview> {
  assertCan(actor, "marketing", "view");
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const config = await getTrackingConfig(tenantId, actor);
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.trackingEvent.findMany({ where: { createdAt: { gt: since } }, select: { name: true, eventId: true, origin: true, status: true } });
    const byName = new Map<string, { b: Set<string>; s: Set<string>; failed: number }>();
    for (const r of rows) {
      const e = byName.get(r.name) ?? { b: new Set(), s: new Set(), failed: 0 };
      if (r.origin === "BROWSER") e.b.add(r.eventId);
      else if (r.status === "FAILED") e.failed++;
      else e.s.add(r.eventId);
      byName.set(r.name, e);
    }
    const stats = EVENT_NAMES.map((name): EventStat => {
      const e = byName.get(name) ?? { b: new Set<string>(), s: new Set<string>(), failed: 0 };
      return { name, browser: e.b.size, server: e.s.size, deduped: [...e.b].filter((id) => e.s.has(id)).length, failed: e.failed };
    });
    const recent = await tx.trackingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, name: true, origin: true, status: true, eventId: true, detail: true, createdAt: true } });
    return { config, stats, recent };
  });
}

/** "Send a test event" from the screen: goes to Meta's Test Events tab with the code the owner copies from there. */
export async function sendTestEvent(tenantId: string, actor: StaffActor, testCode: string): Promise<SendResult> {
  assertCan(actor, "marketing", "edit");
  const code = testCode.trim();
  if (!/^TEST[A-Z0-9]{3,12}$/i.test(code)) throw new ValidationError("Paste the test code from Meta Events Manager, like TEST12345.");
  const pixelId = await getPixelId(tenantId);
  if (!pixelId) throw new ValidationError("Save your Pixel ID first.");
  if (!(await capiRow(tenantId))) throw new ValidationError("Save your Conversions API token in Integrations first.");
  const r = await sendCapi(tenantId, pixelId, { name: "PageView", eventId: `test_${Date.now().toString(36)}`, time: new Date(), user: {} }, code);
  await withTenant(tenantId, (tx) => audit(tx, tenantId, actor, "tracking.test_sent", { ok: r.ok }));
  return r;
}
