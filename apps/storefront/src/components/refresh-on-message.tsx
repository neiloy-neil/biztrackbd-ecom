"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** In the editor's preview: redraws the page from the server when the editor says its draft was saved. Only the editor that framed us can ask. */
export function RefreshOnMessage({ adminOrigin }: { adminOrigin?: string }) {
  const router = useRouter();
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent || (adminOrigin && e.origin !== adminOrigin)) return;
      if ((e.data as { type?: string } | null)?.type === "bt-preview:refresh") router.refresh();
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "bt-preview:ready" }, adminOrigin || "*");
    return () => window.removeEventListener("message", onMessage);
  }, [router, adminOrigin]);
  return null;
}
