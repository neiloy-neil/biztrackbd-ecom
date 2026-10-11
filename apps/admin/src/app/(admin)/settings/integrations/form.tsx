"use client";

import { useActionState } from "react";
import { Button } from "@biztrackbd/ui";
import { saveIntegrationAction, type SaveState } from "./actions";
import type { ProviderKey } from "@biztrackbd/core";

export interface ProviderFormProps {
  provider: ProviderKey;
  label: string;
  mode: "TEST" | "LIVE";
  secrets: string[];
  config: string[];
  configValues: Record<string, string>;
  secretsSet: Record<string, boolean>;
  unreadable: boolean;
}

const field = { display: "grid", gap: 4, marginBottom: 10 } as const;
const input = { font: "inherit", padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 8, minHeight: 40 } as const;

export function ProviderForm(p: ProviderFormProps) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveIntegrationAction.bind(null, p.provider), {});
  return (
    <form action={action} autoComplete="off">
      <input type="hidden" name="mode" value={p.mode} />
      {p.config.map((n) => (
        <label key={n} style={field}>
          <span>{n}</span>
          <input name={n} defaultValue={p.configValues[n] ?? ""} style={input} />
        </label>
      ))}
      {p.secrets.map((n) => (
        <label key={n} style={field}>
          <span>{n}</span>
          {/* Write-only: the stored value is never sent to the browser. Blank means keep what is saved. */}
          <input name={n} type="password" autoComplete="new-password" placeholder={p.secretsSet[n] ? "Saved. Type to replace." : "Not set"} style={input} />
        </label>
      ))}
      {p.unreadable && <p className="err" style={{ color: "var(--danger)" }}>The saved keys cannot be read. Enter all of them again.</p>}
      {state.error && <p role="alert" style={{ color: "var(--danger)" }}>{state.error}</p>}
      {state.ok && <p style={{ color: "var(--success)" }}>Saved.</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
