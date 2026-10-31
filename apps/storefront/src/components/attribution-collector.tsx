"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  parseAttributionFromParams,
  parseAttributionCookie,
  serializeAttributionCookie,
  formatFbc,
  ATTR_FIRST_COOKIE,
  ATTR_LAST_COOKIE,
  ATTR_COOKIE_MAX_AGE_SECONDS,
} from "@biztrackbd/core/attribution";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge = ATTR_COOKIE_MAX_AGE_SECONDS): void {
  if (typeof document === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

function CollectorInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const search = window.location.search;
      const sp = new URLSearchParams(search);
      const fbclid = sp.get("fbclid");

      // 1. Format and persist _fbc if fbclid is present in URL
      if (fbclid) {
        const formattedFbc = formatFbc(fbclid);
        if (formattedFbc) {
          setCookie("_fbc", formattedFbc, 90 * 24 * 60 * 60); // 90 days Meta standard
        }
      }

      // 2. Ensure persistent _fbp cookie if missing
      let fbp = getCookie("_fbp");
      if (!fbp) {
        const rand = Math.floor(Math.random() * 8999999999 + 1000000000);
        fbp = `fb.1.${Date.now()}.${rand}`;
        setCookie("_fbp", fbp, 90 * 24 * 60 * 60); // 90 days Meta standard
      }

      const fbc = getCookie("_fbc");

      // 3. Extract campaign attribution
      const currentTouch = parseAttributionFromParams(sp, {
        referrer: document.referrer || null,
        landingUrl: window.location.href,
        landingPath: window.location.pathname,
        fbpCookie: fbp,
        fbcCookie: fbc,
      });

      if (currentTouch) {
        // Record first-touch (immutable discovery) if not already set
        const existingFirst = parseAttributionCookie(getCookie(ATTR_FIRST_COOKIE));
        if (!existingFirst) {
          setCookie(ATTR_FIRST_COOKIE, serializeAttributionCookie(currentTouch));
        }

        // Record last-touch (updated on every marketing touchpoint)
        setCookie(ATTR_LAST_COOKIE, serializeAttributionCookie(currentTouch));
      }
    } catch {
      /* ignore attribution errors in browser */
    }
  }, [pathname, searchParams]);

  return null;
}

export function AttributionCollector() {
  return (
    <Suspense fallback={null}>
      <CollectorInner />
    </Suspense>
  );
}
