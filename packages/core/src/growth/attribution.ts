import { z } from "zod";

/**
 * First-touch and Last-touch Marketing Attribution (docs/56 item DATA-003).
 *
 * Captures campaign parameters (UTMs, referrers, landing pages, Meta fbc/fbp, Google gclid)
 * and preserves them in dual 1st-party cookies:
 * - `bt_attr_first`: Immutable first discovery touchpoint.
 * - `bt_attr_last`: Mutable most recent touchpoint.
 */

export const ATTR_FIRST_COOKIE = "bt_attr_first";
export const ATTR_LAST_COOKIE = "bt_attr_last";
export const ATTR_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Meta's click cookie is "fb.1.<time>.<fbclid>" and a click id can be long, so allow room; a value that does not fit is dropped, never cut.
const COOKIE_ID_REGEX = /^[A-Za-z0-9._-]{1,400}$/;
const CLICK_ID_MAX = 300;

export interface AttributionPayload {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  landingPath?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  capturedAt: string; // ISO 8601
}

export interface DualAttribution {
  firstTouch: AttributionPayload | null;
  lastTouch: AttributionPayload | null;
}

export const AttributionSchema = z.object({
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  utmTerm: z.string().max(120).optional().nullable(),
  utmContent: z.string().max(120).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  landingPage: z.string().max(500).optional().nullable(),
  landingPath: z.string().max(250).optional().nullable(),
  fbc: z.string().regex(COOKIE_ID_REGEX).optional().nullable(),
  fbp: z.string().regex(COOKIE_ID_REGEX).optional().nullable(),
  gclid: z.string().max(CLICK_ID_MAX).optional().nullable(),
  fbclid: z.string().max(CLICK_ID_MAX).optional().nullable(),
  capturedAt: z.string(),
});

function sanitizeString(str?: string | null, max = 250): string | null {
  if (!str) return null;
  const clean = str.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return clean.slice(0, max) || null;
}

/** Formats an fbclid query parameter into standard Meta _fbc cookie format: `fb.1.<creation_time>.<fbclid>` */
export function formatFbc(fbclid?: string | null, timestampMs = Date.now()): string | null {
  if (!fbclid) return null;
  const clean = sanitizeString(fbclid, CLICK_ID_MAX);
  if (!clean || !COOKIE_ID_REGEX.test(clean)) return null;
  return `fb.1.${timestampMs}.${clean}`;
}

/**
 * Extracts marketing attribution fields from URL search parameters, document referrer, and landing URL.
 * Returns null if no marketing or campaign parameters were present.
 */
export function parseAttributionFromParams(
  searchParams: URLSearchParams | Record<string, string | null | undefined>,
  options?: {
    referrer?: string | null;
    landingUrl?: string | null;
    landingPath?: string | null;
    fbpCookie?: string | null;
    fbcCookie?: string | null;
    capturedAt?: Date;
  }
): AttributionPayload | null {
  const getParam = (k: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(k);
    }
    return searchParams[k] ?? null;
  };

  const utmSource = sanitizeString(getParam("utm_source"), 100);
  const utmMedium = sanitizeString(getParam("utm_medium"), 100);
  const utmCampaign = sanitizeString(getParam("utm_campaign"), 100);
  const utmTerm = sanitizeString(getParam("utm_term"), 100);
  const utmContent = sanitizeString(getParam("utm_content"), 100);
  const fbclid = sanitizeString(getParam("fbclid"), CLICK_ID_MAX);
  const gclid = sanitizeString(getParam("gclid"), CLICK_ID_MAX);

  const rawReferrer = sanitizeString(options?.referrer, 500);
  let referrer: string | null = null;
  if (rawReferrer) {
    try {
      const parsedRef = new URL(rawReferrer);
      // Exclude self-referrals if landingUrl host matches referrer host
      if (options?.landingUrl) {
        const landingHost = new URL(options.landingUrl).hostname.toLowerCase();
        if (parsedRef.hostname.toLowerCase() === landingHost) {
          referrer = null;
        } else {
          referrer = parsedRef.origin + parsedRef.pathname;
        }
      } else {
        referrer = parsedRef.origin + parsedRef.pathname;
      }
    } catch {
      referrer = rawReferrer.slice(0, 300);
    }
  }

  const hasCampaignSignal = Boolean(
    utmSource || utmMedium || utmCampaign || utmTerm || utmContent || fbclid || gclid || referrer
  );

  if (!hasCampaignSignal && !options?.fbpCookie && !options?.fbcCookie) {
    return null;
  }

  const now = options?.capturedAt ?? new Date();
  const fbc = options?.fbcCookie || (fbclid ? formatFbc(fbclid, now.getTime()) : null);
  const fbp = options?.fbpCookie ? sanitizeString(options.fbpCookie, 100) : null;

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    referrer,
    landingPage: options?.landingUrl ? sanitizeString(options.landingUrl, 500) : null,
    landingPath: options?.landingPath ? sanitizeString(options.landingPath, 200) : null,
    fbclid,
    fbc: fbc && COOKIE_ID_REGEX.test(fbc) ? fbc : null,
    fbp: fbp && COOKIE_ID_REGEX.test(fbp) ? fbp : null,
    gclid,
    capturedAt: now.toISOString(),
  };
}

/** Serializes attribution payload safely into JSON string for cookie storage */
export function serializeAttributionCookie(payload: AttributionPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

/** Parses and validates attribution payload from cookie string */
export function parseAttributionCookie(cookieStr?: string | null): AttributionPayload | null {
  if (!cookieStr) return null;
  try {
    const raw = decodeURIComponent(cookieStr.trim());
    const parsed = JSON.parse(raw);
    const validated = AttributionSchema.safeParse(parsed);
    return validated.success ? (validated.data as AttributionPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Merges existing first-touch with newly observed touch to maintain dual attribution.
 * - `firstTouch`: set once, immutable.
 * - `lastTouch`: set whenever a new campaign touch is observed.
 */
export function resolveDualAttribution(
  existingFirst: AttributionPayload | null,
  existingLast: AttributionPayload | null,
  incoming: AttributionPayload | null
): DualAttribution {
  let firstTouch = existingFirst;
  let lastTouch = existingLast;

  if (incoming) {
    if (!firstTouch) {
      firstTouch = incoming;
    }
    lastTouch = incoming;
  }

  return {
    firstTouch,
    lastTouch,
  };
}
