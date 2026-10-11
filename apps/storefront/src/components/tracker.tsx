"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { purchaseAction } from "@/app/growth-actions";

declare global {
  interface Window {
    fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: unknown };
    __btPixel?: boolean;
  }
}

const cookie = (name: string) => {
  try {
    return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
  } catch {
    return undefined;
  }
};
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : Math.random().toString(36).slice(2, 22));
const optedOut = () => typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/**
 * Fires a Pixel event with an id, and tells our server the same id so it can send the same event from the server. Meta counts the
 * pair once. Does nothing without a Pixel, and nothing when the visitor has asked not to be tracked.
 */
export function trackEvent(name: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo", o: { contentIds?: string[]; numItems?: number } = {}): void {
  if (typeof window === "undefined" || !window.__btPixel || optedOut()) return;
  const eventId = `${name.toLowerCase()}_${uid()}`;
  const data = o.contentIds ? { content_ids: o.contentIds, content_type: "product", ...(o.numItems !== undefined ? { num_items: o.numItems } : {}) } : {};
  try {
    window.fbq?.("track", name, data, { eventID: eventId });
  } catch {
    /* a blocked or broken Pixel must never break the page */
  }
  // keepalive: the request is finished even if the visitor navigates away this instant ("Buy now").
  void fetch("/api/track", {
    method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, eventId, url: location.href, contentIds: o.contentIds, numItems: o.numItems, fbp: cookie("_fbp"), fbc: cookie("_fbc") }),
  }).catch(() => undefined);
}

/** The Meta Pixel snippet, only when the store has a Pixel ID (digits only, so it cannot carry code). */
export function Pixel({ pixelId }: { pixelId: string }) {
  const path = usePathname();
  const first = useRef(true);
  const valid = /^\d{8,20}$/.test(pixelId);
  useEffect(() => {
    if (!valid) return;
    window.__btPixel = true;
    return () => {
      window.__btPixel = false;
    };
  }, [valid]);
  useEffect(() => {
    // The first page view waits for the script to be ready (below); later route changes report themselves.
    if (first.current) { first.current = false; return; }
    trackEvent("PageView");
  }, [path]);
  if (!valid) return null;
  return (
    <Script
      id="meta-pixel" strategy="afterInteractive"
      onReady={() => trackEvent("PageView")}
      dangerouslySetInnerHTML={{
        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`,
      }}
    />
  );
}

/** ViewContent on a product page. */
export function ViewContent({ id }: { id: string }) {
  useEffect(() => {
    trackEvent("ViewContent", { contentIds: [id] });
  }, [id]);
  return null;
}

/** Purchase on the thank-you page, once per order, with the id the server used when the order was placed. */
export function PurchaseTracker({ orderId, token }: { orderId: string; token?: string }) {
  useEffect(() => {
    if (optedOut()) return;
    const flag = `bt_purchase_${orderId}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      /* private mode: at worst the pair is reported twice, and Meta counts it once */
    }
    void purchaseAction(orderId, token).then((r) => {
      if (!r || !window.__btPixel) return;
      try {
        window.fbq?.("track", "Purchase", { value: r.value, currency: "BDT", content_ids: r.contentIds, content_type: "product", num_items: r.numItems }, { eventID: r.eventId });
      } catch {
        /* ignore */
      }
    });
  }, [orderId, token]);
  return null;
}
