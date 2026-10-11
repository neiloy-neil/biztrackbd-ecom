"use client";

import { useActionState } from "react";
import { saveIntegrationAction, type SaveState } from "./actions";
import type { ProviderKey } from "@biztrackbd/core";

export interface FieldDef {
  /** The name the server action reads. Never shown to people. */
  name: string;
  /** What people read. */
  label: string;
  secret: boolean;
  hint?: string;
}

export interface ProviderFormProps {
  provider: ProviderKey;
  mode: "TEST" | "LIVE";
  fields: FieldDef[];
  configValues: Record<string, string>;
  secretsSet: Record<string, boolean>;
  unreadable: boolean;
  /** Called after a successful save, so the list can show the new status without a reload. */
  onSaved?: () => void;
}

/** The keys form for one integration in one mode. Secrets are write-only: the stored value is never sent to the browser, and blank means keep it. */
export function ProviderForm(p: ProviderFormProps) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveIntegrationAction.bind(null, p.provider), {});
  return (
    <form action={action} autoComplete="off" className="stack" style={{ gap: 14 }} data-testid={`form-${p.provider}`}>
      <input type="hidden" name="mode" value={p.mode} />
      {p.fields.map((f) => (
        <div key={f.name} className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor={`${p.provider}-${p.mode}-${f.name}`}>{f.label}</label>
          {f.secret ? (
            <input id={`${p.provider}-${p.mode}-${f.name}`} className="input" name={f.name} type="password" autoComplete="new-password" placeholder={p.secretsSet[f.name] ? "Saved. Type to replace." : "Not set"} />
          ) : (
            <input id={`${p.provider}-${p.mode}-${f.name}`} className="input" name={f.name} defaultValue={p.configValues[f.name] ?? ""} />
          )}
          {f.hint && <div className="hint">{f.hint}</div>}
        </div>
      ))}
      {p.unreadable && <div className="notice bad" role="alert">The saved keys cannot be read. Enter all of them again.</div>}
      {state.error && <div className="notice bad" role="alert">{state.error}</div>}
      {state.ok && <div className="notice good" role="status">Saved.</div>}
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
