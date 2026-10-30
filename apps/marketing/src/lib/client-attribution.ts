import {
  parseAttributionFromParams,
  parseAttributionCookie,
  serializeAttributionCookie,
  ATTR_FIRST_COOKIE,
  ATTR_LAST_COOKIE,
  ATTR_COOKIE_MAX_AGE_SECONDS,
  type AttributionPayload,
  type DualAttribution,
} from "@biztrackbd/core/attribution";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match && match[1] ? match[1] : null;
}

function writeCookie(name: string, value: string, maxAge = ATTR_COOKIE_MAX_AGE_SECONDS): void {
  if (typeof document === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

/**
 * Initializes and records first-touch and last-touch attribution on client page load.
 */
export function initClientAttribution(): DualAttribution {
  if (typeof window === "undefined") {
    return { firstTouch: null, lastTouch: null };
  }

  const existingFirstRaw = readCookie(ATTR_FIRST_COOKIE);
  const existingLastRaw = readCookie(ATTR_LAST_COOKIE);
  const existingFirst = parseAttributionCookie(existingFirstRaw);
  const existingLast = parseAttributionCookie(existingLastRaw);

  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");

  const currentTouch = parseAttributionFromParams(new URLSearchParams(window.location.search), {
    referrer: document.referrer || null,
    landingUrl: window.location.href,
    landingPath: window.location.pathname,
    fbpCookie: fbp,
    fbcCookie: fbc,
  });

  let firstTouch = existingFirst;
  let lastTouch = existingLast;

  // 1. Record immutable First-Touch if not already saved
  if (!firstTouch && currentTouch) {
    firstTouch = currentTouch;
    writeCookie(ATTR_FIRST_COOKIE, serializeAttributionCookie(firstTouch));
  }

  // 2. Record Last-Touch if new campaign parameters arrived
  if (currentTouch) {
    lastTouch = currentTouch;
    writeCookie(ATTR_LAST_COOKIE, serializeAttributionCookie(lastTouch));
  }

  return { firstTouch, lastTouch };
}

/**
 * Retrieves stored attribution parameters to attach to conversion payloads (contact, leads, bookings, signups).
 */
export function getAttributionForPayload(): {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  fbp?: string | null;
  fbc?: string | null;
} {
  if (typeof window === "undefined") return {};

  const lastRaw = readCookie(ATTR_LAST_COOKIE);
  const firstRaw = readCookie(ATTR_FIRST_COOKIE);
  const last = parseAttributionCookie(lastRaw);
  const first = parseAttributionCookie(firstRaw);

  const best = last || first;
  let fbp = readCookie("_fbp") || best?.fbp || null;
  let fbc = readCookie("_fbc") || best?.fbc || null;
  let utmSource = best?.utmSource || null;
  let utmMedium = best?.utmMedium || null;
  let utmCampaign = best?.utmCampaign || null;
  let utmTerm = best?.utmTerm || null;
  let utmContent = best?.utmContent || null;
  let referrer = best?.referrer || (document.referrer || null);

  // Immediate fallback: read current URL search params directly (e.g. if cookies were blocked or haven't written)
  try {
    const sp = new URLSearchParams(window.location.search);
    if (!utmCampaign && sp.get("utm_campaign")) utmCampaign = sp.get("utm_campaign");
    if (!utmSource && sp.get("utm_source")) utmSource = sp.get("utm_source");
    if (!utmMedium && sp.get("utm_medium")) utmMedium = sp.get("utm_medium");
    if (!utmTerm && sp.get("utm_term")) utmTerm = sp.get("utm_term");
    if (!utmContent && sp.get("utm_content")) utmContent = sp.get("utm_content");
    const fbclid = sp.get("fbclid");
    if (fbclid && !fbc) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
      if (!utmSource) utmSource = "meta";
      if (!utmMedium) utmMedium = "paid_social";
      if (!utmCampaign) utmCampaign = "trial14";
    }
  } catch {}

  // Cache fallback to sessionStorage
  const STORAGE_KEY = "bt_attr_fallback_v1";
  try {
    if (!utmCampaign || !utmSource) {
      const cached = window.sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!utmCampaign && parsed.utmCampaign) utmCampaign = parsed.utmCampaign;
        if (!utmSource && parsed.utmSource) utmSource = parsed.utmSource;
        if (!utmMedium && parsed.utmMedium) utmMedium = parsed.utmMedium;
        if (!utmContent && parsed.utmContent) utmContent = parsed.utmContent;
        if (!fbc && parsed.fbc) fbc = parsed.fbc;
        if (!fbp && parsed.fbp) fbp = parsed.fbp;
      }
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utmCampaign, utmSource, utmMedium, utmContent, fbc, fbp }));
    }
  } catch {}

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    referrer,
    fbp,
    fbc,
  };
}

/** Generates a collision-resistant eventId for Meta Pixel and CAPI deduplication */
export function generateTrackingEventId(prefix = "ev"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${ts}_${rand}`;
}
