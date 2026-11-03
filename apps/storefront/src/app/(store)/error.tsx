"use client";

import { useEffect } from "react";


/** Shown when a page fails while it is being drawn: a calm message and a way out, instead of the bare default error screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="" style={{ margin: "64px auto", maxWidth: 460, padding: "0 16px", textAlign: "center" }} role="alert">
      
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>কিছু একটা ভুল হয়েছে · Something went wrong</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-2, #4A3E31)", lineHeight: 1.5 }}>আমাদের দিক থেকে সমস্যা হয়েছে। আবার চেষ্টা করুন বা হোম পেজে ফিরে যান। · Please try again, or go back to the home page.</p>
      <div>
        <button type="button" className="btn btn-primary" style={{ marginInline: 4, marginBlock: 4 }} onClick={() => reset()}>
          আবার চেষ্টা করুন · Try again
        </button>
        <a href="/" className="btn btn-ghost" style={{ marginInline: 4, marginBlock: 4 }}>হোম · Home</a>
      </div>
      {error.digest ? <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-3, #6B5E50)" }}>কোড · Code: {error.digest}</p> : null}
    </div>
  );
}
