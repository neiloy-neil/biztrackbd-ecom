"use client";

import { useEffect } from "react";
import { BrandLockup } from "@biztrackbd/ui";

/** Shown when a page fails while it is being drawn: a calm message and a way out, instead of the bare default error screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap" style={{ margin: "0 auto", maxWidth: 560, padding: "72px 0", textAlign: "center" }} role="alert">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}><BrandLockup size={36} /></div>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-2, #4A3E31)", lineHeight: 1.5 }}>That was our mistake, not yours. Try again, or go back to the home page. If it keeps happening, message us on WhatsApp from the contact page.</p>
      <div>
        <button type="button" className="btn btn-primary" style={{ marginInline: 4, marginBlock: 4 }} onClick={() => reset()}>
          Try again
        </button>
        <a href="/" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Home</a>
          <a href="/contact" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Contact us</a>
      </div>
      {error.digest ? <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-3, #6B5E50)" }}>Code: {error.digest}</p> : null}
    </div>
  );
}
