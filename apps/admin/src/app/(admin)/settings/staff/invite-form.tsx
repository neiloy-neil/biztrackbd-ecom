"use client";

import { useActionState } from "react";
import { Button } from "@biztrackbd/ui";
import { inviteAction, type InviteState } from "./actions";

const box = { font: "inherit", padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 8, minHeight: 40 } as const;

export function InviteForm({ roles, disabled }: { roles: { value: string; label: string }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="card row" style={{ alignItems: "end" }}>
      <label style={{ display: "grid", gap: 4 }}><span>Email</span><input name="email" type="email" required style={{ ...box, minWidth: 240 }} /></label>
      <label style={{ display: "grid", gap: 4 }}>
        <span>Role</span>
        <select name="role" style={box}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
      </label>
      <Button type="submit" disabled={pending || disabled}>{pending ? "Sending…" : "Invite"}</Button>
      {state.error && <div role="alert" style={{ flexBasis: "100%", color: "var(--danger)" }}>{state.error}</div>}
      {state.link && (
        <div style={{ flexBasis: "100%" }}>
          <p style={{ margin: "4px 0", color: "var(--success)" }}>Invite ready for {state.email}. Send them this link. It works once and is shown only now.</p>
          <input readOnly value={state.link} style={{ ...box, width: "100%" }} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </form>
  );
}
