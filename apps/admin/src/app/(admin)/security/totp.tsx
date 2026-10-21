"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, confirmTotpAction, removeTotpAction, startTotpAction, type TotpState } from "../../login/actions";
import { useBusyAction } from "@biztrackbd/ui";

const Msg = ({ s }: { s: TotpState }) => (
  <>
    {s.error && <div className="notice bad" role="alert" data-testid="sec-error">{s.error}</div>}
    {s.done && <div className="notice good" role="status" data-testid="sec-done">{s.done}</div>}
  </>
);

export function TotpPanel({ enabledFactorId }: { enabledFactorId: string | null }) {
  const [setup, setSetup] = useState<TotpState>({});
  const { busy: startBusy, run: runStart } = useBusyAction();
  const [confirm, confirmAction, confirming] = useActionState<TotpState, FormData>(confirmTotpAction, {});
  const [remove, removeAction, removing] = useActionState<TotpState, FormData>(removeTotpAction, {});

  if (enabledFactorId) {
    return (
      <form action={removeAction} className="stack" data-testid="totp-on">
        <Msg s={confirm.done ? confirm : remove} />
        <p>Two-factor sign-in is <b>on</b>. To turn it off, enter a code from your authenticator app.</p>
        <input type="hidden" name="factorId" value={enabledFactorId} />
        <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="t-off">6-digit code</label><input id="t-off" className="input" name="code" inputMode="numeric" autoComplete="one-time-code" required /></div>
        <div><button type="submit" className="btn btn-secondary" disabled={removing}>{removing ? "Checking…" : "Turn off two-factor"}</button></div>
      </form>
    );
  }
  if (confirm.done) return <Msg s={confirm} />;
  if (!setup.enrolled) {
    return (
      <div className="stack">
        <Msg s={setup} />
        <p>Add a second step: a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) each time you sign in.</p>
        <div><button type="button" className="btn btn-primary" disabled={startBusy !== null} onClick={() => runStart("start", async () => setSetup(await startTotpAction()))} data-testid="totp-start">Set up two-factor</button></div>
      </div>
    );
  }
  return (
    <form action={confirmAction} className="stack" data-testid="totp-enroll">
      <Msg s={confirm} />
      <p>1. Scan this picture with your authenticator app, or type the key by hand.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.enrolled.qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
      <p style={{ overflowWrap: "anywhere" }}>Key: <code data-testid="totp-secret">{setup.enrolled.secret}</code></p>
      <p>2. Type the 6-digit code the app shows.</p>
      <input type="hidden" name="factorId" value={setup.enrolled.factorId} />
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="t-on">6-digit code</label><input id="t-on" className="input" name="code" inputMode="numeric" autoComplete="one-time-code" required /></div>
      <div><button type="submit" className="btn btn-primary" disabled={confirming}>{confirming ? "Checking…" : "Turn on two-factor"}</button></div>
    </form>
  );
}

export function PasswordPanel() {
  const [state, action, pending] = useActionState<TotpState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="stack" data-testid="password-form">
      <Msg s={state} />
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="p-cur">Current password</label><input id="p-cur" className="input" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="p-new">New password</label><input id="p-new" className="input" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="p-new2">Type it again</label><input id="p-new2" className="input" name="again" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div><button type="submit" className="btn btn-secondary" disabled={pending}>{pending ? "Saving…" : "Change password"}</button></div>
    </form>
  );
}
