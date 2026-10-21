import { getPixelFetch, hashEmail, hashPhone, type SendResult, type ServerEvent, capiBody } from "../growth/tracking";
import { getPlatformPrisma } from "@biztrackbd/db";

/**
 * Platform-wide Meta Conversions API (CAPI) and Marketing Tracking (docs/56 items DATA-002, DATA-004).
 *
 * Dispatches server-side events for BizTrackBD marketing website conversions:
 * - `Lead`: Platform inquiries from `/contact` and demo requests.
 * - `CompleteRegistration`: Merchant signups from `/start`.
 *
 * Dual-gated on affirmative consent: suppressed if explicit consent is missing.
 */

const graph = () => (process.env.NODE_ENV !== "production" && process.env.META_GRAPH_URL) || "https://graph.facebook.com/v21.0";

export function getPlatformPixelId(): string | null {
  return (
    process.env.PLATFORM_META_PIXEL_ID ||
    process.env.NEXT_PUBLIC_PLATFORM_META_PIXEL_ID ||
    null
  );
}

export function getPlatformCapiToken(): string | null {
  return (
    process.env.PLATFORM_META_CAPI_TOKEN ||
    process.env.PLATFORM_FACEBOOK_CAPI_TOKEN ||
    process.env.META_CAPI_ACCESS_TOKEN ||
    null
  );
}

export function getPlatformTestEventCode(): string | null {
  return (
    process.env.PLATFORM_META_TEST_EVENT_CODE ||
    process.env.NEXT_PUBLIC_PLATFORM_META_TEST_EVENT_CODE ||
    null
  );
}

export interface PlatformUserContext {
  phoneLocal?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface PlatformInquiryEventInput {
  inquiryId: string;
  eventId?: string;
  name: string;
  phone: string;
  email: string;
  topic?: string | null;
  url?: string | null;
  user?: PlatformUserContext;
  consentGiven?: boolean | null;
  testCode?: string | null;
}

/**
 * Dispatches a server-side Lead event to Meta Conversions API for platform inquiries.
 */
export async function trackPlatformInquiryCapi(input: PlatformInquiryEventInput): Promise<SendResult> {
  const pixelId = getPlatformPixelId();
  const token = getPlatformCapiToken();

  if (!pixelId || !token) {
    return { ok: false, httpStatus: null, detail: "Platform Meta Pixel or CAPI token is not configured" };
  }

  // Affirmative consent check: suppressed if explicitly denied
  if (input.consentGiven === false) {
    return { ok: false, httpStatus: null, detail: "Consent not given" };
  }

  const eventId = input.eventId || `inq_${input.inquiryId}`;
  const testCode = input.testCode || getPlatformTestEventCode() || undefined;

  const event: ServerEvent = {
    name: "Lead",
    eventId,
    time: new Date(),
    url: input.url || "https://biztrackbd.com/contact",
    user: {
      phoneLocal: input.phone || input.user?.phoneLocal,
      email: input.email || input.user?.email,
      ip: input.user?.ip,
      userAgent: input.user?.userAgent,
      fbp: input.user?.fbp,
      fbc: input.user?.fbc,
    },
    customData: {
      inquiry_id: input.inquiryId,
      topic: input.topic || "general",
    },
  };

  try {
    const fetchFn = getPixelFetch();
    const res = await fetchFn(`${graph()}/${pixelId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(capiBody(event, testCode)),
      signal: AbortSignal.timeout(5000),
    });

    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) {
      return {
        ok: false,
        httpStatus: res.status,
        detail: (body.error?.message ?? `Meta answered ${res.status}`).slice(0, 200).replace(token, "[token]"),
      };
    }

    if (!body.events_received) {
      return { ok: false, httpStatus: res.status, detail: "Meta did not accept the platform inquiry event" };
    }

    return { ok: true, httpStatus: res.status };
  } catch {
    return { ok: false, httpStatus: null, detail: "Could not reach Meta Conversions API" };
  }
}

export interface PlatformRegistrationEventInput {
  tenantId: string;
  eventId?: string;
  ownerName: string;
  phone: string;
  email: string;
  storeName: string;
  plan: string;
  url?: string | null;
  user?: PlatformUserContext;
  consentGiven?: boolean | null;
  testCode?: string | null;
}

/**
 * Dispatches a server-side CompleteRegistration event to Meta Conversions API for new merchant signups.
 */
export async function trackPlatformRegistrationCapi(input: PlatformRegistrationEventInput): Promise<SendResult> {
  const pixelId = getPlatformPixelId();
  const token = getPlatformCapiToken();

  if (!pixelId || !token) {
    return { ok: false, httpStatus: null, detail: "Platform Meta Pixel or CAPI token is not configured" };
  }

  if (input.consentGiven === false) {
    return { ok: false, httpStatus: null, detail: "Consent not given" };
  }

  const eventId = input.eventId || `reg_${input.tenantId}`;
  const testCode = input.testCode || getPlatformTestEventCode() || undefined;

  const event: ServerEvent = {
    name: "CompleteRegistration",
    eventId,
    time: new Date(),
    url: input.url || "https://biztrackbd.com/start",
    user: {
      phoneLocal: input.phone || input.user?.phoneLocal,
      email: input.email || input.user?.email,
      customerId: input.tenantId,
      ip: input.user?.ip,
      userAgent: input.user?.userAgent,
      fbp: input.user?.fbp,
      fbc: input.user?.fbc,
    },
    customData: {
      tenant_id: input.tenantId,
      store_name: input.storeName,
      plan: input.plan,
    },
  };

  try {
    const fetchFn = getPixelFetch();
    const res = await fetchFn(`${graph()}/${pixelId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(capiBody(event, testCode)),
      signal: AbortSignal.timeout(5000),
    });

    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) {
      return {
        ok: false,
        httpStatus: res.status,
        detail: (body.error?.message ?? `Meta answered ${res.status}`).slice(0, 200).replace(token, "[token]"),
      };
    }

    if (!body.events_received) {
      return { ok: false, httpStatus: res.status, detail: "Meta did not accept the platform registration event" };
    }

    return { ok: true, httpStatus: res.status };
  } catch {
    return { ok: false, httpStatus: null, detail: "Could not reach Meta Conversions API" };
  }
}

/** Browser-triggered funnel events the marketing site mirrors to CAPI. Anything else is refused. */
export const PLATFORM_BROWSER_EVENTS = ["PageView", "ViewContent", "InitiateCheckout", "CTAClick"] as const;
export type PlatformBrowserEvent = (typeof PLATFORM_BROWSER_EVENTS)[number];

export interface PlatformBrowserEventInput {
  name: PlatformBrowserEvent;
  /** Same id the browser Pixel used, so Meta merges the two copies. */
  eventId: string;
  url?: string | null;
  customData?: Record<string, string | number | boolean | null>;
  user?: PlatformUserContext;
  /** Must be exactly true: the visitor accepted analytics in the banner. */
  consentGiven: boolean;
  testCode?: string | null;
}

/**
 * Server copy of a consented browser funnel event (PageView, ViewContent, InitiateCheckout, CTAClick).
 * Carries no name, email or phone: only IP, user agent and the visitor's own fbp/fbc cookies.
 */
export async function trackPlatformBrowserEventCapi(input: PlatformBrowserEventInput): Promise<SendResult> {
  const pixelId = getPlatformPixelId();
  const token = getPlatformCapiToken();
  if (!pixelId || !token) return { ok: false, httpStatus: null, detail: "Platform Meta Pixel or CAPI token is not configured" };
  if (input.consentGiven !== true) return { ok: false, httpStatus: null, detail: "Consent not given" };
  if (!PLATFORM_BROWSER_EVENTS.includes(input.name)) return { ok: false, httpStatus: null, detail: "Event not allowed" };

  const event = {
    name: input.name,
    eventId: input.eventId,
    time: new Date(),
    url: input.url || null,
    user: {
      ip: input.user?.ip,
      userAgent: input.user?.userAgent,
      fbp: input.user?.fbp,
      fbc: input.user?.fbc,
    },
    customData: input.customData,
  } as unknown as ServerEvent;

  try {
    const res = await getPixelFetch()(`${graph()}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(capiBody(event, input.testCode || getPlatformTestEventCode() || undefined)),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, detail: (body.error?.message ?? `Meta answered ${res.status}`).slice(0, 200).replace(token, "[token]") };
    }
    if (!body.events_received) return { ok: false, httpStatus: res.status, detail: "Meta did not accept the browser event" };
    return { ok: true, httpStatus: res.status };
  } catch {
    return { ok: false, httpStatus: null, detail: "Could not reach Meta Conversions API" };
  }
}

export interface PlatformTrackingDiagnostics {
  pixelConfigured: boolean;
  pixelIdMasked: string | null;
  capiConfigured: boolean;
  testCodeConfigured: boolean;
  totalInquiriesCount: number;
  recentInquiries: {
    id: string;
    name: string;
    topic: string;
    status: string;
    createdAt: Date;
    hasPhone: boolean;
    hasEmail: boolean;
  }[];
}

/**
 * Returns tracking diagnostic telemetry for Platform Super Admin (/diagnostics/tracking).
 */
export async function getPlatformTrackingDiagnostics(): Promise<PlatformTrackingDiagnostics> {
  const pixelId = getPlatformPixelId();
  const token = getPlatformCapiToken();
  const testCode = getPlatformTestEventCode();

  const db = getPlatformPrisma();
  const [totalCount, recentRows] = await Promise.all([
    db.platformInquiry.count(),
    db.platformInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        topic: true,
        status: true,
        createdAt: true,
        phone: true,
        email: true,
      },
    }),
  ]);

  return {
    pixelConfigured: Boolean(pixelId),
    pixelIdMasked: pixelId ? `${pixelId.slice(0, 4)}...${pixelId.slice(-4)}` : null,
    capiConfigured: Boolean(token),
    testCodeConfigured: Boolean(testCode),
    totalInquiriesCount: totalCount,
    recentInquiries: recentRows.map((r) => ({
      id: r.id,
      name: r.name,
      topic: r.topic,
      status: r.status,
      createdAt: r.createdAt,
      hasPhone: Boolean(r.phone),
      hasEmail: Boolean(r.email),
    })),
  };
}
