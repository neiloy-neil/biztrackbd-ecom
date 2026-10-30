"use client";

import { useActionState } from "react";
import { Button } from "@biztrackbd/ui";
import { inviteAction, type InviteState } from "./actions";

export function InviteForm({ roles, disabled }: { roles: { value: string; label: string }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="card row items-end gap-md flex-wrap">
      <label className="field m-0 flex-1 min-w-240">
        <span className="label">Email Address</span>
        <input name="email" type="email" required className="input" placeholder="colleague@yourbrand.com" />
      </label>
      <label className="field m-0 min-w-160">
        <span className="label">Assigned Role</span>
        <select name="role" className="select">{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
      </label>
      <Button type="submit" disabled={pending || disabled}>{pending ? "Sending…" : "Send Invite"}</Button>
      {state.error && <div className="notice bad w-full" role="alert">{state.error}</div>}
      {state.link && (
        <div className="w-full">
          <p className="notice good text-sm mt-xs">
            {state.emailed ? <>We emailed the invite to {state.email}. </> : <>Invite ready for {state.email}. We could not email it, so send them this link. </>}
            You can also send this link yourself (for example on WhatsApp). It works once and is shown only now.
          </p>
          <input readOnly value={state.link} className="input font-mono mt-xs w-full" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </form>
  );
}
