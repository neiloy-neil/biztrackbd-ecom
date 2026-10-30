"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "bt_native_session_v1";

function getOrInitSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function parseDevice(): { device: string; browser: string; os: string } {
  if (typeof navigator === "undefined") return { device: "desktop", browser: "unknown", os: "unknown" };
  const ua = navigator.userAgent.toLowerCase();
  const device = /mobile|android|iphone|ipad|phone/i.test(ua) ? "mobile" : "desktop";
  let browser = "other";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";

  let os = "other";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("mac os")) os = "Apple";
  else if (ua.includes("linux")) os = "Linux";

  return { device, browser, os };
}

function sendBeacon(url: string, data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(data);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, json);
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => undefined);
  }
}

const IGNORABLE_ERROR_PATTERNS = [
  /Java object is gone/i,
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /NetworkError when attempting to fetch resource/i,
];

function isIgnorableClientError(message: string, stack?: string | null): boolean {
  if (!message) return true;
  return IGNORABLE_ERROR_PATTERNS.some((p) => p.test(message) || (stack ? p.test(stack) : false));
}

export function NativeAnalyticsTracker() {
  const pathname = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    const sessionId = getOrInitSessionId();
    if (!sessionId) return;

    // 1. Session start / attribution on first mount
    if (!initialized.current) {
      initialized.current = true;
      const sp = new URLSearchParams(window.location.search);
      const { device, browser, os } = parseDevice();

      sendBeacon("/api/track/native", {
        type: "session",
        sessionId,
        landingPage: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
        fbclid: sp.get("fbclid") || null,
        fbp: (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || null,
        fbc: sp.get("fbclid") ? `fb.1.${Date.now()}.${sp.get("fbclid")}` : (document.cookie.match(/_fbc=([^;]+)/) || [])[1] || null,
        utmSource: sp.get("utm_source") || null,
        utmMedium: sp.get("utm_medium") || null,
        utmCampaign: sp.get("utm_campaign") || null,
        utmContent: sp.get("utm_content") || null,
        utmTerm: sp.get("utm_term") || null,
        device,
        browser,
        os,
      });

      // 2. Global Error Capture
      const handleError = (evt: ErrorEvent) => {
        const msg = evt.message || "Unknown client error";
        const stack = evt.error?.stack || null;
        if (isIgnorableClientError(msg, stack)) return;

        sendBeacon("/api/track/error", {
          sessionId,
          pageUrl: window.location.href,
          message: msg,
          stack,
          browser,
          os,
          device,
        });
      };

      const handleRejection = (evt: PromiseRejectionEvent) => {
        const msg = evt.reason instanceof Error ? evt.reason.message : String(evt.reason);
        const stack = evt.reason instanceof Error ? evt.reason.stack : null;
        if (isIgnorableClientError(msg, stack)) return;

        sendBeacon("/api/track/error", {
          sessionId,
          pageUrl: window.location.href,
          message: "Unhandled Promise Rejection: " + msg,
          stack,
          browser,
          os,
          device,
        });
      };

      window.addEventListener("error", handleError);
      window.addEventListener("unhandledrejection", handleRejection);
    }

    // 3. Pageview event
    sendBeacon("/api/track/native", {
      type: "event",
      sessionId,
      eventType: "PAGEVIEW",
      pagePath: pathname,
      pageTitle: document.title,
    });

    // 4. Click / CTA tracker
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a, button") as HTMLElement | null;
      if (!target) return;
      const text = (target.textContent || "").trim().slice(0, 50);
      const href = target.getAttribute("href");
      if (text || href) {
        sendBeacon("/api/track/native", {
          type: "event",
          sessionId,
          eventType: href?.includes("/start") ? "CTA" : "CLICK",
          pagePath: window.location.pathname,
          targetText: text,
          targetHref: href,
        });
      }
    };

    document.addEventListener("click", handleClick, { passive: true });
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [pathname]);

  return null;
}
