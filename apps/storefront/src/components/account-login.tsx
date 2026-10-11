"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestCodeAction, verifyCodeAction } from "@/app/(store)/account/actions";
import { fmt, type Lang } from "@/lib/i18n-core";
import type { LOGIN_STRINGS } from "@/lib/strings";
import { cleanPhoneDigits } from "./checkout-form";


export function AccountLogin({ s, lang }: { s: Record<(typeof LOGIN_STRINGS)[number], string>; lang: Lang }) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  const phone = `0${digits}`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^1[3-9]\d{8}$/.test(digits)) { setError(lang === "bn" ? "সঠিক মোবাইল নম্বর দিন" : "Enter a valid mobile number"); return; }
    setBusy(true); setError("");
    const r = await requestCodeAction(phone);
    setBusy(false);
    if (r.ok) { setStep("code"); setCode(""); } else setError(r.error);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await verifyCodeAction(phone, code);
    if (r.ok) { router.refresh(); return; }
    setBusy(false);
    setError(r.error);
  }

  return (
    <div className="card center-card" data-testid="account-login">
      <h2 style={{ fontSize: 20 }}>{s.signIn}</h2>
      {step === "phone" ? (
        <form onSubmit={send} noValidate>
          <p className="muted" style={{ margin: "6px 0 16px" }}>{s.signInS}</p>
          <label className="field">
            <span className="label">{s.mobileNumber}</span>
            <div className="phone-field" data-invalid={error ? "true" : "false"}>
              <span className="cc">+880</span>
              <input name="phone" inputMode="tel" autoComplete="tel-national" placeholder="1712-345678" value={shown} onChange={(e) => setDigits(cleanPhoneDigits(e.target.value))} aria-invalid={!!error} data-testid="login-phone" />
            </div>
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block btn-round" style={{ marginTop: 14 }} disabled={busy} data-testid="send-code">{s.sendCode}</button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="muted" style={{ margin: "6px 0 16px" }}>{fmt(s.codeSentTo, { phone })}</p>
          <label className="field">
            <span className="label">{s.enterCode}</span>
            <input className="input otp-input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={!!error} data-testid="login-code" autoFocus />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block btn-round" style={{ marginTop: 14 }} disabled={busy || code.length !== 6} data-testid="verify-code">{s.verify}</button>
          <button type="button" className="link-btn" style={{ marginTop: 12 }} onClick={() => { setStep("phone"); setError(""); }}>{s.useOtherNumber}</button>
        </form>
      )}
    </div>
  );
}
