"use client";

import { useEffect, useRef } from "react";

/**
 * Universal scroll-reveal and animation trigger for store sections.
 * Automatically respects `prefers-reduced-motion` and provides live animation replay
 * and pulse highlighting inside the builder preview canvas.
 */
export function SectionMotion({ editing }: { editing?: boolean }) {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    // Strict reduced motion check
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      document.querySelectorAll(".bt-anim").forEach((el) => el.classList.add("bt-revealed"));
      return;
    }

    const revealAll = () => {
      document.querySelectorAll(".bt-anim:not(.bt-revealed)").forEach((el) => el.classList.add("bt-revealed"));
    };

    if (editing) {
      // In builder editor, reveal by default so canvas is never blank
      revealAll();

      // Mutation observer guarantees newly added sections are immediately visible
      const mo = new MutationObserver(() => {
        revealAll();
      });
      if (document.body) {
        mo.observe(document.body, { childList: true, subtree: true });
      }

      const onMessage = (e: MessageEvent) => {
        if (!e.data || typeof e.data !== "object") return;
        const m = e.data as { type?: string; id?: string };

        if (m.type === "bt-preview:update") {
          requestAnimationFrame(revealAll);
        } else if (m.type === "bt-preview:replay-anim" && m.id) {
          const el = document.querySelector(`[data-section-wrap="${m.id}"]`);
          if (el) {
            el.classList.remove("bt-revealed");
            // Force browser reflow to restart CSS keyframe animation
            void (el as HTMLElement).offsetWidth;
            el.classList.add("bt-revealed");
          }
        } else if (m.type === "bt-preview:highlight" && m.id) {
          const el = document.querySelector(`[data-section-wrap="${m.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.remove("bt-section-highlight");
            void (el as HTMLElement).offsetWidth;
            el.classList.add("bt-section-highlight");
            setTimeout(() => {
              el.classList.remove("bt-section-highlight");
            }, 1200);
          }
        }
      };

      window.addEventListener("message", onMessage);
      return () => {
        mo.disconnect();
        window.removeEventListener("message", onMessage);
      };
    }

    // Live storefront: observe scroll entrance
    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("bt-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
    );

    const animEls = document.querySelectorAll(".bt-anim:not(.bt-revealed)");
    animEls.forEach((el) => observer.observe(el));

    // Observe newly added nodes on live storefront as well
    const mo = new MutationObserver(() => {
      document.querySelectorAll(".bt-anim:not(.bt-revealed)").forEach((el) => observer.observe(el));
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, [editing]);

  return <span className="bt-motion-anchor" hidden aria-hidden="true" />;
}
