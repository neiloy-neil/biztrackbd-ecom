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
  const fbp = readCookie("_fbp") || best?.fbp || null;
  const fbc = readCookie("_fbc") || best?.fbc || null;

  return {
    utmSource: best?.utmSource || null,
    utmMedium: best?.utmMedium || null,
    utmCampaign: best?.utmCampaign || null,
    utmTerm: best?.utmTerm || null,
    utmContent: best?.utmContent || null,
    referrer: best?.referrer || null,
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
