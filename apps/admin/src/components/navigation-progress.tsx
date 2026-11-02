"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Complete progress on route change
  useEffect(() => {
    setLoading(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [pathname]);

  // Intercept click on internal links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;
      if (target.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (target.getAttribute("download") || target.getAttribute("rel")?.includes("external")) return;

      try {
        const url = new URL(target.href);
        const current = new URL(window.location.href);
        if (url.origin === current.origin && (url.pathname !== current.pathname || url.search !== current.search)) {
          // Defer state update so it never blocks native event loop or Link navigation
          requestAnimationFrame(() => {
            setLoading(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            // Safety timeout: dismiss after 8s if network hangs
            timerRef.current = setTimeout(() => setLoading(false), 8000);
          });
        }
      } catch {
        // ignore unparseable URLs
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2.5,
        zIndex: 999999,
        background: "linear-gradient(90deg, #0f766e, #06b6d4, #10b981)",
        backgroundSize: "200% 100%",
        animation: "admin-topbar-slide 1.2s infinite linear",
        boxShadow: "0 1px 4px rgba(15, 118, 110, 0.4)",
      }}
    />
  );
}
