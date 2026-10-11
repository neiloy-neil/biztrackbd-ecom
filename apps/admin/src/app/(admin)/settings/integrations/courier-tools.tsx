"use client";

import { useActionState } from "react";
import { testConnectionAction, type TestState } from "./actions";
import type { ProviderKey } from "@biztrackbd/core";

/** Shown under a connected courier: a "test the keys" button, and the address to paste into the courier's own portal. */
export function CourierTools({ provider, mode, webhookUrl, webhookNote }: { provider: ProviderKey; mode: "TEST" | "LIVE"; webhookUrl: string | null; webhookNote: string }) {
  const [state, action, pending] = useActionState<TestState, FormData>(testConnectionAction.bind(null, provider, mode), {});
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }} data-testid={`courier-tools-${provider}`}>
      <form action={action} className="row">
        <button className="btn btn-secondary btn-sm" type="submit" disabled={pending}>{pending ? "Testing…" : "Test connection"}</button>
        {state.ok && <span style={{ color: "var(--success)" }} role="status">Connected. The keys work.</span>}
        {state.error && <span role="alert" style={{ color: "var(--danger)" }}>{state.error}</span>}
      </form>
      <div style={{ marginTop: 10, fontSize: 13.5 }}>
        <b>Status address</b>
        {webhookUrl ? (
          <>
            <input className="input input-sm" readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} aria-label={`${provider} status address`} style={{ marginTop: 4 }} />
            <p className="muted" style={{ marginTop: 4 }}>{webhookNote}</p>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 4 }}>{webhookNote}</p>
        )}
      </div>
    </div>
  );
}
