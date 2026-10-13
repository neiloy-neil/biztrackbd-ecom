"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n-core";
import { sendContactAction } from "./actions";

const S = {
  en: {
    name: "Your name", phone: "Your mobile number", phoneHelp: "We reply by SMS to this number.", email: "Email", optional: "optional", message: "Your message", send: "Send message", sending: "Sending…",
    done: "Thank you. We have your message and will reply by SMS soon.", another: "Send another message", badPhone: "Enter a valid mobile number, like 01712345678",
  },
  bn: {
    name: "আপনার নাম", phone: "আপনার মোবাইল নম্বর", phoneHelp: "এই নম্বরে SMS-এ উত্তর দেব।", email: "ইমেইল", optional: "ঐচ্ছিক", message: "আপনার বার্তা", send: "বার্তা পাঠান", sending: "পাঠানো হচ্ছে…",
    done: "ধন্যবাদ। আপনার বার্তা পেয়েছি, শীঘ্রই SMS-এ উত্তর দেব।", another: "আরেকটি বার্তা পাঠান", badPhone: "সঠিক মোবাইল নম্বর দিন, যেমন 01712345678",
  },
} as const;

export function ContactForm({ lang }: { lang: Lang }) {
  const s = S[lang];
  const [f, setF] = useState({ name: "", phone: "", email: "", message: "" });
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((c) => ({ ...c, [k]: e.target.value }));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(""); setField("");
    if (!/^(\+?880|0)?1[3-9]\d{8}$/.test(f.phone.replace(/[\s-]/g, ""))) { setError(s.badPhone); setField("phone"); return; }
    setBusy(true);
    const r = await sendContactAction({ name: f.name, phone: f.phone.replace(/[\s-]/g, ""), email: f.email || undefined, message: f.message });
    setBusy(false);
    if (!r.ok) { setError(r.error); setField(r.field ?? ""); return; }
    setDone(true);
    setF({ name: "", phone: "", email: "", message: "" });
  }

  if (done) {
    return (
      <div className="card" role="status" data-testid="contact-done">
        <p style={{ marginTop: 0 }}>{s.done}</p>
        <button type="button" className="btn btn-ghost" onClick={() => setDone(false)}>{s.another}</button>
      </div>
    );
  }
  const bad = (k: string) => (field === k ? { "aria-invalid": true } : {});
  return (
    <form className="card" onSubmit={send} noValidate data-testid="contact-form">
      <label className="field"><span className="label">{s.name}</span><input id="c-name" className="input" autoComplete="name" required value={f.name} onChange={set("name")} {...bad("name")} data-testid="contact-name" /></label>
      <label className="field">
        <span className="label">{s.phone}</span>
        <input id="c-phone" className="input" inputMode="tel" autoComplete="tel" required placeholder="01XXXXXXXXX" value={f.phone} onChange={set("phone")} {...bad("phone")} data-testid="contact-phone" />
        <span className="muted" style={{ fontSize: 12.5 }}>{s.phoneHelp}</span>
      </label>
      <label className="field"><span className="label">{s.email} <span className="opt">({s.optional})</span></span><input id="c-email" className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} {...bad("email")} /></label>
      <label className="field"><span className="label">{s.message}</span><textarea id="c-message" className="input" style={{ minHeight: 120, padding: 12 }} required maxLength={1000} value={f.message} onChange={set("message")} {...bad("message")} data-testid="contact-message" /></label>
      {error && <div className="err" role="alert" style={{ marginBottom: 10 }} data-testid="contact-error">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block btn-round" disabled={busy} data-testid="contact-send">{busy ? s.sending : s.send}</button>
    </form>
  );
}
