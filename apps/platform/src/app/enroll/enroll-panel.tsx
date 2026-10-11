"use client";

import { useActionState, useState } from "react";
import { confirmEnrollAction, startEnrollAction, type EnrollState } from "../login/actions";

export function EnrollPanel() {
  const [setup, setSetup] = useState<EnrollState>({});
  const [confirm, action, pending] = useActionState<EnrollState, FormData>(confirmEnrollAction, {});
  if (!setup.enrolled) {
    return (
      <div className="stack">
        {setup.error && <div className="notice bad" role="alert">{setup.error}</div>}
        <p>Platform access needs a second step: a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) each time you sign in.</p>
        <div><button type="button" className="btn btn-primary" onClick={async () => setSetup(await startEnrollAction())} data-testid="totp-start">Set up two-factor</button></div>
      </div>
    );
  }
  return (
    <form action={action} className="stack" data-testid="totp-enroll">
      {confirm.error && <div className="notice bad" role="alert" data-testid="sec-error">{confirm.error}</div>}
      <p>1. Scan this picture with your authenticator app, or type the key by hand.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.enrolled.qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
      <p style={{ overflowWrap: "anywhere" }}>Key: <code data-testid="totp-secret">{setup.enrolled.secret}</code></p>
      <p>2. Type the 6-digit code the app shows.</p>
      <input type="hidden" name="factorId" value={setup.enrolled.factorId} />
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="t-on">6-digit code</label><input id="t-on" className="input" name="code" inputMode="numeric" autoComplete="one-time-code" required /></div>
      <div><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Checking…" : "Turn on and continue"}</button></div>
    </form>
  );
}
