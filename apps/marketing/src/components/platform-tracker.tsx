"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { initClientAttribution } from "../lib/client-attribution";

declare global {
  interface Window {
    fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: unknown };
    gtag?: (...a: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const CONSENT_STORAGE_KEY = "bt_cookie_consent_v1";

const PIXEL_ID = process.env.NEXT_PUBLIC_PLATFORM_META_PIXEL_ID;
const GA4_ID = process.env.NEXT_PUBLIC_PLATFORM_GA4_ID;
const GTM_ID = process.env.NEXT_PUBLIC_PLATFORM_GTM_ID;

const PROHIBITED_PARAM_REGEX = /^(name|first_?name|last_?name|email|phone|mobile|cell|number|message|notes|address|street|city|zip|password|secret|token|patient|medical|symptom|diagnosis|bmdc)$/i;

/** Sanitizes client event payloads to strictly prevent direct PII leaks into analytics/ad pipelines */
export function sanitizeEventPayload(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PROHIBITED_PARAM_REGEX.test(key)) {
      continue; // Drop prohibited PII keys
    }
    if (typeof value === "string") {
      // Drop values that match raw email or phone numbers
      if (value.includes("@") && value.includes(".")) continue;
      if (/^(\+?880|0)1[3-9]\d{8}$/.test(value.replace(/[\s-]/g, ""))) continue;
    }
    safe[key] = value;
  }
  return safe;
}

/** Check current consent state */
export function getPlatformConsent(): "granted" | "denied" | "unset" {
  if (typeof window === "undefined") return "unset";
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    /* ignore */
  }
  return "unset";
}

/** Fires a conversion event on the BizTrackBD marketing website with consent, PII protection, and eventID deduplication */
export function trackPlatformEvent(
  name: "PageView" | "Lead" | "ViewContent" | "CompleteRegistration" | string,
  data: Record<string, unknown> = {},
  options?: { eventId?: string }
): void {
  if (typeof window === "undefined") return;

  // Consent gate: do not dispatch to third parties if consent is not granted
  if (getPlatformConsent() !== "granted") return;

  const safeData = sanitizeEventPayload(data);

  // Meta Pixel with deduplication eventID
  if (window.fbq) {
    try {
      if (options?.eventId) {
        window.fbq("track", name, safeData, { eventID: options.eventId });
      } else {
        window.fbq("track", name, safeData);
      }
    } catch {
      /* ignore */
    }
  }

  // Google Analytics 4
  if (window.gtag) {
    try {
      window.gtag("event", name.toLowerCase(), {
        ...safeData,
        ...(options?.eventId ? { event_id: options.eventId } : {}),
      });
    } catch {
      /* ignore */
    }
  }

  // GTM dataLayer
  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    try {
      window.dataLayer.push({
        event: name,
        ...safeData,
        ...(options?.eventId ? { eventId: options.eventId } : {}),
      });
    } catch {
      /* ignore */
    }
  }
}

export function PlatformTracker() {
  const path = usePathname();
  const first = useRef(true);
  const [consent, setConsent] = useState<"granted" | "denied" | "unset">("unset");
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    // Initialize first-touch and last-touch attribution on mount
    initClientAttribution();

    const current = getPlatformConsent();
    setConsent(current);
    if (current === "unset") {
      setBannerVisible(true);
    }

    const onOpenSettings = () => setBannerVisible(true);
    window.addEventListener("open-cookie-settings", onOpenSettings);
    return () => window.removeEventListener("open-cookie-settings", onOpenSettings);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    if (first.current) {
      first.current = false;
      return;
    }
    trackPlatformEvent("PageView", { page_path: path });
  }, [path, consent]);

  const handleConsent = (decision: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, decision);
    } catch {
      /* ignore */
    }
    setConsent(decision);
    setBannerVisible(false);

    if (decision === "granted") {
      // Fire initial PageView now that user granted consent
      setTimeout(() => {
        trackPlatformEvent("PageView", { page_path: path });
      }, 100);
    }
  };

  return (
    <>
      {/* Platform Meta Pixel - Only mounted after explicit affirmative consent */}
      {consent === "granted" && PIXEL_ID && (
        <Script
          id="platform-meta-pixel"
          strategy="afterInteractive"
          onReady={() => trackPlatformEvent("PageView", { page_path: path })}
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');`,
          }}
        />
      )}

      {/* Platform GA4 - Only mounted after explicit affirmative consent */}
      {consent === "granted" && GA4_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
          <Script
            id="platform-ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA4_ID}');`,
            }}
          />
        </>
      )}

      {/* Platform GTM - Only mounted after explicit affirmative consent */}
      {consent === "granted" && GTM_ID && (
        <>
          <Script
            id="platform-gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}

      {/* Non-intrusive Cookie & Privacy Consent Banner */}
      {bannerVisible && (
        <aside
          role="region"
          aria-label="Cookie and Privacy Preferences"
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            maxWidth: 580,
            zIndex: 9999,
            background: "#FFFFFF",
            border: "1.5px solid var(--line-strong)",
            borderRadius: 14,
            padding: "12px 14px",
            boxShadow: "0 12px 36px rgba(11, 77, 59, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 18 }} aria-hidden="true">🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                Your Privacy &amp; Consent Choices
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}>
                Essential cookies keep the site secure and working. With your permission we also use anonymised analytics. We never sell your personal data or phone numbers.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleConsent("granted")}
                  style={{ minHeight: 34, padding: "6px 14px", fontSize: 12.5 }}
                >
                  Accept Analytics
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleConsent("denied")}
                  style={{ minHeight: 34, padding: "6px 14px", fontSize: 12.5 }}
                >
                  Decline Non-Essential
                </button>
                <a
                  href="/privacy"
                  style={{ fontSize: 12, color: "var(--brand)", textDecoration: "underline", marginLeft: 4 }}
                >
                  Read Policy
                </a>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
