"use client";

import { useState } from "react";

/** A cover picture for a category: uploads through the same route as product photos and keeps the address in a hidden field. */
export function ImageField({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/media", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not upload that photo.");
      setUrl(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span className="label">Cover picture <span className="opt">(optional)</span></span>
      <input type="hidden" name="imageUrl" value={url} />
      <div className="row" style={{ alignItems: "center", gap: 12 }}>
        {url ? /* eslint-disable-line @next/next/no-img-element */ <img src={url} alt="" width={64} height={64} style={{ objectFit: "cover", borderRadius: 10 }} data-testid="category-image" /> : <span className="thumb" aria-hidden="true">·</span>}
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : url ? "Change picture" : "Add a picture"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} data-testid="category-image-input" />
        </label>
        {url && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUrl("")}>Remove</button>}
      </div>
      {error && <div className="err" role="alert">{error}</div>}
    </div>
  );
}
