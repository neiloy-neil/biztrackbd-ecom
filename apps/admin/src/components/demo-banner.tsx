"use client";

import { useEffect, useState } from "react";

/** Says this is a demo, counts down to when it is deleted, and offers the way out and the way in. */
export function DemoBanner({ expiresAt, keepHref }: { expiresAt: number; keepHref: string }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, expiresAt - Date.now());
      setLeft(l);
      if (l <= 0) window.location.href = "/demo?msg=" + encodeURIComponent("Your demo ended. Start a new one any time.");
    }, 30_000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <div role="status" data-testid="demo-banner" className="demo-banner">
      <span><b>Demo</b> · nothing here is real. Deleted in {h > 0 ? `${h} h ` : ""}{m} min unless you keep it</span>
      <span className="demo-actions">
        <a className="btn btn-primary btn-sm" href={keepHref} data-testid="demo-keep">Keep this store</a>
        <a className="btn btn-secondary btn-sm" href="/demo/exit" data-testid="demo-exit">Exit demo</a>
      </span>
    </div>
  );
}
