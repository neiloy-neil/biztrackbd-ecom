"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { purchaseAction } from "@/app/growth-actions";
import type { StorefrontTracking } from "@biztrackbd/core";

declare global {
  interface Window {
    fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: unknown };
    gtag?: (...a: unknown[]) => void;
    dataLayer?: unknown[];
    ttq?: { track?: (...a: unknown[]) => void; page?: () => void };
    __btPixel?: boolean;
    __btGa4?: string;
  }
}

const cookie = (name: string) => {
  try {
    return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
  } catch {
    return undefined;
  }
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    : Math.random().toString(36).slice(2, 22);

const optedOut = () =>
  typeof navigator !== "undefined" &&
  (navigator.doNotTrack === "1" ||
    (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/** Maps internal event names to GA4 standard ecommerce event names */
const GA4_EVENT_MAP: Record<string, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  AddPaymentInfo: "add_payment_info",
  Purchase: "purchase",
};

/**
 * Fires events simultaneously across Meta Pixel, GA4, GTM dataLayer, and TikTok Pixel,
 * while notifying the server CAPI with the exact same eventId for deduplication.
 */
export function trackEvent(
  name: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase",
  o: { contentIds?: string[]; numItems?: number; value?: number } = {},
): void {
  if (typeof window === "undefined" || optedOut()) return;
  const eventId = `${name.toLowerCase()}_${uid()}`;

  // 1. Meta Pixel (Browser)
  if (window.__btPixel && window.fbq) {
    const fbData: Record<string, unknown> = {};
    if (o.contentIds?.length) {
      fbData.content_ids = o.contentIds;
      fbData.content_type = "product";
    }
    if (o.numItems !== undefined) fbData.num_items = o.numItems;
    if (o.value !== undefined) {
      fbData.value = o.value;
      fbData.currency = "BDT";
    }
    try {
      window.fbq("track", name, fbData, { eventID: eventId });
    } catch {
      /* ignore */
    }
  }

  // 2. Google Analytics 4 (gtag.js)
  if (window.__btGa4 && window.gtag) {
    const gaEvent = GA4_EVENT_MAP[name] ?? name.toLowerCase();
    const gaData: Record<string, unknown> = {
      currency: "BDT",
      value: o.value ?? 0,
      items: o.contentIds?.map((id) => ({ item_id: id })) ?? [],
    };
    try {
      window.gtag("event", gaEvent, gaData);
    } catch {
      /* ignore */
    }
  }

  // 3. GTM dataLayer
  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    try {
      window.dataLayer.push({
        event: name,
        ecommerce: {
          currency: "BDT",
          value: o.value ?? 0,
          items: o.contentIds?.map((id) => ({ item_id: id })) ?? [],
        },
      });
    } catch {
      /* ignore */
    }
  }

  // 4. TikTok Pixel
  if (window.ttq?.track) {
    try {
      window.ttq.track(name, {
        contents: o.contentIds?.map((id) => ({ content_id: id, content_type: "product" })),
        value: o.value ?? 0,
        currency: "BDT",
      });
    } catch {
      /* ignore */
    }
  }

  // 5. Server Conversions API (Meta CAPI Keepalive)
  if (window.__btPixel) {
    void fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        eventId,
        url: location.href,
        contentIds: o.contentIds,
        numItems: o.numItems,
        fbp: cookie("_fbp"),
        fbc: cookie("_fbc"),
      }),
    }).catch(() => undefined);
  }
}

/** Injects all configured merchant tags (Meta, GA4, GTM, TikTok) into storefront */
export function StorefrontTracker({ tracking }: { tracking: StorefrontTracking }) {
  const path = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (tracking.pixelId && /^\d{8,20}$/.test(tracking.pixelId)) {
      window.__btPixel = true;
    }
    if (tracking.googleAnalyticsId && /^G-[A-Za-z0-9]+$/i.test(tracking.googleAnalyticsId)) {
      window.__btGa4 = tracking.googleAnalyticsId;
    }
    return () => {
      window.__btPixel = false;
      delete window.__btGa4;
    };
  }, [tracking]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackEvent("PageView");
  }, [path]);

  const hasPixel = Boolean(tracking.pixelId && /^\d{8,20}$/.test(tracking.pixelId));
  const hasGa4 = Boolean(tracking.googleAnalyticsId && /^G-[A-Za-z0-9]+$/i.test(tracking.googleAnalyticsId));
  const hasGtm = Boolean(tracking.googleTagManagerId && /^GTM-[A-Za-z0-9]+$/i.test(tracking.googleTagManagerId));
  const hasTiktok = Boolean(tracking.tiktokPixelId && /^[A-Za-z0-9_-]{10,40}$/.test(tracking.tiktokPixelId));

  return (
    <>
      {/* Meta Pixel */}
      {hasPixel && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          onReady={() => trackEvent("PageView")}
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.pixelId}');`,
          }}
        />
      )}

      {/* Google Analytics 4 (gtag.js) */}
      {hasGa4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${tracking.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${tracking.googleAnalyticsId}');`,
            }}
          />
        </>
      )}

      {/* Google Tag Manager (GTM) */}
      {hasGtm && (
        <>
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${tracking.googleTagManagerId}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${tracking.googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}

      {/* TikTok Pixel */}
      {hasTiktok && (
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tracking.tiktokPixelId}');ttq.page();}(window, document, 'ttq');`,
          }}
        />
      )}
    </>
  );
}

/** Legacy alias */
export function Pixel({ pixelId }: { pixelId: string }) {
  return <StorefrontTracker tracking={{ pixelId, googleAnalyticsId: null, googleTagManagerId: null, tiktokPixelId: null, metaDomainVerification: null }} />;
}

/** ViewContent on a product page */
export function ViewContent({ id, price }: { id: string; price?: number }) {
  useEffect(() => {
    trackEvent("ViewContent", { contentIds: [id], value: price });
  }, [id, price]);
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
      /* ignore */
    }
    void purchaseAction(orderId, token).then((r) => {
      if (!r) return;
      trackEvent("Purchase", {
        contentIds: r.contentIds,
        numItems: r.numItems,
        value: r.value,
      });
    });
  }, [orderId, token]);
  return null;
}
