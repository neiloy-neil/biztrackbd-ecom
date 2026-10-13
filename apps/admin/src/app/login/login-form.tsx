"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeSetupAction, loginAction, mfaAction, requestCodeAction, type LoginState } from "./actions";

const Err = ({ s }: { s: LoginState }) => (s.error ? <div className="notice bad" role="alert" data-testid="login-error">{s.error}</div> : null);

export function LoginForm({ next, initialEmail }: { next: string; initialEmail?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="stack" data-testid="login-form">
      <input type="hidden" name="next" value={next} />
      <Err s={state} />
      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="l-email">Email</label>
        <input
          id="l-email"
          className="input"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email ?? initialEmail ?? ""}
          required
          autoFocus={!initialEmail}
        />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="l-pw">Password</label>
        <input
          id="l-pw"
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={Boolean(initialEmail)}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="muted" style={{ fontSize: 14 }}>First time here, or forgot your password? <Link className="link" href={`/login/start?next=${encodeURIComponent(next)}`}>Set up your password</Link></p>
    </form>
  );
}

export function MfaForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(mfaAction, {});
  return (
    <form action={action} className="stack" data-testid="mfa-form">
      <input type="hidden" name="next" value={next} />
      <Err s={state} />
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-code">6-digit code</label><input id="m-code" className="input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus style={{ letterSpacing: 6, textAlign: "center", fontSize: 22 }} /></div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

/** Two steps on one screen: ask for the code, then type it with a new password. */
export function SetupForm({ next }: { next: string }) {
  const [ask, askAction, asking] = useActionState<LoginState, FormData>(requestCodeAction, {});
  const [done, doneAction, finishing] = useActionState<LoginState, FormData>(completeSetupAction, {});
  const step = done.step === "code" || done.error ? "code" : ask.step ?? "email";
  const email = done.email ?? ask.email ?? "";
  if (step === "email") {
    return (
      <form action={askAction} className="stack" data-testid="setup-email-form">
        <Err s={ask} />
        <p className="muted">Enter the email your store team knows you by. If it is on a team, we email you a 6-digit code.</p>
        <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="s-email">Email</label><input id="s-email" className="input" name="email" type="email" autoComplete="username" required autoFocus defaultValue={email} /></div>
        <button type="submit" className="btn btn-primary btn-block" disabled={asking}>{asking ? "Sending…" : "Send me a code"}</button>
      </form>
    );
  }
  return (
    <form action={doneAction} className="stack" data-testid="setup-code-form">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Err s={done} />
      <p className="muted" data-testid="code-sent">If <b>{email}</b> is on a team, a code is on its way. It can take a minute.</p>
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="s-code">Code from the email</label><input id="s-code" className="input" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus /></div>
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="s-pw">New password</label><input id="s-pw" className="input" name="password" type="password" autoComplete="new-password" minLength={10} required /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>At least 10 characters. A few random words work well.</div></div>
      <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="s-pw2">Type it again</label><input id="s-pw2" className="input" name="again" type="password" autoComplete="new-password" minLength={10} required /></div>
      <button type="submit" className="btn btn-primary btn-block" disabled={finishing}>{finishing ? "Saving…" : "Save password and sign in"}</button>
    </form>
  );
}
