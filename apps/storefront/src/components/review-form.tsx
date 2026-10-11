"use client";

import { useState } from "react";
import { submitReviewAction } from "@/app/growth-actions";

export interface ReviewFormText {
  writeReview: string;
  yourRating: string;
  reviewTitleOpt: string;
  reviewBody: string;
  submitReview: string;
  reviewThanks: string;
  reviewThanksPending: string;
  reviewFailed: string;
  starsN: string;
}

/** One product the signed-in customer has received and can review. Star buttons, a few words, done. */
export function ReviewForm({ productId, title, text, done }: { productId: string; title: string; text: ReviewFormText; done: boolean }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (done) return null;
  if (result?.ok) return <div className="card" role="status" data-testid="review-done"><b>{title}</b><p className="muted" style={{ marginTop: 4 }}>{result.message}</p></div>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await submitReviewAction(productId, rating, headline, body);
    setBusy(false);
    setResult(r.ok ? { ok: true, message: r.published ? text.reviewThanks : text.reviewThanksPending } : { ok: false, message: r.error || text.reviewFailed });
  }

  return (
    <div className="card" data-testid="review-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <b>{title}</b>
        {!open && <button type="button" className="link-btn" onClick={() => setOpen(true)} data-testid="review-open">{text.writeReview}</button>}
      </div>
      {open && (
        <form onSubmit={send} className="stack" style={{ marginTop: 12 }} data-testid="review-form">
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>{text.yourRating}</legend>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={n <= rating} aria-label={text.starsN.replace("{n}", String(n))} onClick={() => setRating(n)} data-testid={`star-${n}`}
                  style={{ fontSize: 28, lineHeight: 1, minWidth: 44, minHeight: 44, background: "none", border: 0, cursor: "pointer", color: n <= rating ? "var(--accent)" : "var(--line)" }}>★</button>
              ))}
            </div>
          </fieldset>
          <label className="field"><span className="label">{text.reviewTitleOpt}</span><input className="input" maxLength={100} value={headline} onChange={(e) => setHeadline(e.target.value)} data-testid="review-title" /></label>
          <label className="field"><span className="label">{text.reviewBody}</span><textarea className="input" rows={4} maxLength={1000} required minLength={5} value={body} onChange={(e) => setBody(e.target.value)} data-testid="review-body" /></label>
          {result && !result.ok && <div className="err" role="alert" data-testid="review-error">{result.message}</div>}
          <button className="btn btn-primary btn-round" type="submit" disabled={busy} data-testid="review-submit">{text.submitReview}</button>
        </form>
      )}
    </div>
  );
}
