"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { recheckDomainAction } from "./actions";

/**
 * While a domain is still connecting, look again every 10 seconds and redraw the page, so the owner sees it reach
 * Connected without pressing anything. It stops as soon as every domain is done, and pauses while the tab is hidden.
 */
export function DomainWatcher({ pendingIds }: { pendingIds: string[] }) {
  const router = useRouter();
  const key = pendingIds.join(",");
  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      await Promise.all(key.split(",").map((id) => recheckDomainAction(id).catch(() => null)));
      if (!stopped) router.refresh();
    };
    const t = setInterval(tick, 10_000);
    return () => { stopped = true; clearInterval(t); };
  }, [key, router]);
  return null;
}
