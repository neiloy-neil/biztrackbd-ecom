"use client";

import { useEffect, useRef } from "react";

/**
 * Lets the blocks of a landing page rise into place as they come into view. It switches the effect on only once the page is running in the browser,
 * so without scripting (or if this fails) everything is simply shown, and a visitor who asks for less motion never gets it.
 */
export function LandingMotion() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = mark.current?.closest<HTMLElement>(".lp-pro");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("lp-js");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    root.querySelectorAll(".lp-reveal").forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("lp-js"); };
  }, []);
  return <span ref={mark} hidden />;
}
