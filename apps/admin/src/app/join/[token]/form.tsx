"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@biztrackbd/ui";
import { joinAction, type JoinState } from "./actions";

const field = { font: "inherit", padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 8, minHeight: 40 } as const;

export function JoinForm({ token, needsPassword }: { token: string; needsPassword: boolean }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction.bind(null, token), {});
  // The browser clears an uncontrolled form after the server answers; the name is kept so a typo in the password does not cost it.
  const [name, setName] = useState("");
  if (state.done) {
    return (
      <div data-testid="joined">
        <p style={{ color: "var(--success)" }}>You have joined.</p>
        {needsPassword ? <p><Link className="link" href="/login">Sign in</Link></p> : <p className="muted">Sign-in is not switched on in this environment.</p>}
      </div>
    );
  }
  return (
    <form action={action}>
      <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
        <span>Your name</span>
        <input name="name" required minLength={2} autoComplete="name" style={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {needsPassword && (
        <>
          <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <span>Choose a password</span>
            <input name="password" type="password" required minLength={10} autoComplete="new-password" style={field} />
            <span className="muted" style={{ fontSize: 12 }}>At least 10 characters. If you already have an account with this email, type that account&apos;s password instead.</span>
          </label>
          <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <span>Type it again</span>
            <input name="again" type="password" required minLength={10} autoComplete="new-password" style={field} />
          </label>
        </>
      )}
      {state.error && <p role="alert" style={{ color: "var(--danger)" }} data-testid="join-error">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Joining…" : "Accept invite"}</Button>
    </form>
  );
}
