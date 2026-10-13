"use client";

import { useEffect } from "react";
import { trackLandingViewAction } from "@/app/l/actions";
import { trackEvent } from "./tracker";

/**
 * Runs once when a landing page opens: counts the view (once per tab, no visitor identified) and tells the ad platforms the product was
 * viewed. Does nothing in the editor's preview.
 */
export function LandingEvents({ slug, contentIds, value, preview }: { slug: string; contentIds: string[]; value?: number; preview?: boolean }) {
  useEffect(() => {
    if (preview) return;
    try {
      const flag = `bt_lv_${slug}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        void trackLandingViewAction(slug);
      }
    } catch {
      void trackLandingViewAction(slug);
    }
    trackEvent("ViewContent", { contentIds, value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, preview]);
  return null;
}
