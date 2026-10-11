"use client";

import { useState } from "react";

/** The customer's own referral link: copy it, or hand it to WhatsApp with a message already written. */
export function ShareReferral({ link, message, labels }: { link: string; message: string; labels: { copy: string; copied: string; whatsapp: string; yourLink: string } }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* the link is selectable in the box below */
    }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="field" style={{ margin: 0 }}>
        <span className="label">{labels.yourLink}</span>
        <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="referral-link" />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={copy} data-testid="copy-referral">{done ? labels.copied : labels.copy}</button>
        <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`} target="_blank" rel="noopener noreferrer" data-testid="share-whatsapp">{labels.whatsapp}</a>
      </div>
    </div>
  );
}
