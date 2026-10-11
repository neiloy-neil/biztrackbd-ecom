"use client";

import { useState } from "react";
import { Drawer, Segmented } from "@biztrackbd/ui";
import type { ProviderKey } from "@biztrackbd/core";
import { CourierTools } from "./courier-tools";
import { ProviderForm, type FieldDef } from "./provider-form";

type Mode = "TEST" | "LIVE";
type Status = "CONNECTED" | "NEEDS_ATTENTION" | "DISABLED" | null;

export interface ModeData {
  status: Status;
  lastError: string | null;
  configValues: Record<string, string>;
  secretsSet: Record<string, boolean>;
  unreadable: boolean;
  /** Couriers only: the address to paste into the courier's own portal. */
  webhookUrl: string | null;
}

export interface IntegrationItem {
  key: ProviderKey;
  label: string;
  group: string;
  description: string;
  fields: FieldDef[];
  isCourier: boolean;
  webhookNote: string | null;
  modes: Record<Mode, ModeData>;
}

/** The one word the card shows: what the store can rely on right now. */
function overall(item: IntegrationItem): { text: string; tone: "ok" | "warn" | "grey" | "info" } {
  const live = item.modes.LIVE.status, test = item.modes.TEST.status;
  if (live === "NEEDS_ATTENTION" || (live === null && test === "NEEDS_ATTENTION")) return { text: "Needs attention", tone: "warn" };
  if (live === "CONNECTED") return { text: "Connected", tone: "ok" };
  if (test === "CONNECTED") return { text: "Test mode only", tone: "info" };
  return { text: "Not connected", tone: "grey" };
}

const INITIALS: Record<string, string> = { STEADFAST: "SF", PATHAO: "Pa", REDX: "RX", SSLCOMMERZ: "SSL", META_CAPI: "M", GA4: "GA", BREVO_BYO: "Br", SMS_BYO: "SMS" };

export function IntegrationsList({ items, initialMode, initialOpen }: { items: IntegrationItem[]; initialMode: Mode; initialOpen?: ProviderKey }) {
  const [openKey, setOpenKey] = useState<ProviderKey | null>(initialOpen ?? null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const open = items.find((i) => i.key === openKey) ?? null;
  const groups = [...new Set(items.map((i) => i.group))];
  const data = open?.modes[mode];

  return (
    <>
      <div className="stack" style={{ gap: 22 }}>
        {groups.map((g) => (
          <section key={g} aria-label={g}>
            <h2 className="int-group">{g}</h2>
            <ul className="int-list">
              {items.filter((i) => i.group === g).map((i) => {
                const st = overall(i);
                return (
                  <li key={i.key} className="int-card" data-testid={`int-${i.key}`}>
                    <span className="int-logo" aria-hidden>{INITIALS[i.key] ?? i.label.slice(0, 2)}</span>
                    <div className="int-body">
                      <strong>{i.label}</strong>
                      <p>{i.description}</p>
                    </div>
                    <span className={`pill ${st.tone}`} data-testid={`status-${i.key}`}>{st.text}</span>
                    <button type="button" className={`btn btn-sm ${st.tone === "ok" ? "btn-secondary" : "btn-primary"}`} onClick={() => setOpenKey(i.key)} data-testid={`connect-${i.key}`} aria-label={`${st.tone === "grey" ? "Connect" : "Manage"} ${i.label}`}>
                      {st.tone === "grey" ? "Connect" : "Manage"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <Drawer open={open !== null} onClose={() => setOpenKey(null)} title={open ? `${open.label}` : ""}>
        {open && data && (
          <div className="stack" style={{ gap: 16 }} data-testid={`drawer-${open.key}`}>
            <p className="muted">{open.description}</p>
            <div>
              <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: "LIVE", label: "Live" }, { value: "TEST", label: "Test" }]} />
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>{mode === "LIVE" ? "Real orders and real money." : "Practice keys, so nothing real is booked or charged."}</p>
            </div>
            {data.lastError && <div className="notice bad" role="alert">Last error: {data.lastError}</div>}
            <ProviderForm key={`${open.key}-${mode}`} provider={open.key} mode={mode} fields={open.fields} configValues={data.configValues} secretsSet={data.secretsSet} unreadable={data.unreadable} />
            {open.isCourier && data.status && !data.unreadable && open.webhookNote && (
              <CourierTools provider={open.key} mode={mode} webhookUrl={open.key !== "REDX" ? data.webhookUrl : null} webhookNote={open.webhookNote} />
            )}
            <p className="muted" style={{ fontSize: 13 }}>Your keys are encrypted before they are stored and can never be shown again, only replaced. Money from your customers goes straight to your own accounts.</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
