"use client";

import { useEffect } from "react";
import { AuthBrand } from "@/components/auth-brand";

/** Shown when a page fails while it is being drawn: a calm message and a way out, instead of the bare default error screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 460, textAlign: "center" }} role="alert">
      <AuthBrand />
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-2, #4A3E31)", lineHeight: 1.5 }}>Try again. If it keeps happening, note the code below and check the logs.</p>
      <div>
        <button type="button" className="btn btn-primary" style={{ marginInline: 4, marginBlock: 4 }} onClick={() => reset()}>
          Try again
        </button>
        <a href="/" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Back to the overview</a>
      </div>
      {error.digest ? <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-3, #6B5E50)" }}>Code: {error.digest}</p> : null}
    </div>
  );
}
