"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: unknown };
    gtag?: (...a: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_PLATFORM_META_PIXEL_ID;
const GA4_ID = process.env.NEXT_PUBLIC_PLATFORM_GA4_ID;
const GTM_ID = process.env.NEXT_PUBLIC_PLATFORM_GTM_ID;

/** Fires a conversion event on the BizTrackBD marketing website */
export function trackPlatformEvent(name: "PageView" | "Lead" | "ViewContent" | "CompleteRegistration" | string, data: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  // Meta Pixel
  if (window.fbq) {
    try {
      window.fbq("track", name, data);
    } catch {
      /* ignore */
    }
  }

  // Google Analytics 4
  if (window.gtag) {
    try {
      window.gtag("event", name.toLowerCase(), data);
    } catch {
      /* ignore */
    }
  }

  // GTM dataLayer
  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    try {
      window.dataLayer.push({
        event: name,
        ...data,
      });
    } catch {
      /* ignore */
    }
  }
}

export function PlatformTracker() {
  const path = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackPlatformEvent("PageView", { page_path: path });
  }, [path]);

  return (
    <>
      {/* Platform Meta Pixel */}
      {PIXEL_ID && (
        <Script
          id="platform-meta-pixel"
          strategy="afterInteractive"
          onReady={() => trackPlatformEvent("PageView", { page_path: path })}
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');`,
          }}
        />
      )}

      {/* Platform GA4 */}
      {GA4_ID && (
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

      {/* Platform GTM */}
      {GTM_ID && (
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
    </>
  );
}
