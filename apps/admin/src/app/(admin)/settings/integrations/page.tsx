import { headers } from "next/headers";
import { COURIER_PROVIDERS, PROVIDER_KEYS, PROVIDERS, listIntegrations, loadCredentials, type CourierProviderKey } from "@biztrackbd/core";
import { Chip } from "@/lib/chips";
import { requireAccess } from "@/lib/session";
import { CourierTools } from "./courier-tools";
import { ProviderForm } from "./form";

const WEBHOOK_NOTE: Record<CourierProviderKey, string> = {
  STEADFAST: "Paste this in your Steadfast merchant panel under API settings, as the webhook URL. Parcels are also checked every 30 minutes.",
  PATHAO: "Paste this in your Pathao merchant panel under Webhook integration. Parcels are also checked every 30 minutes.",
  REDX: "RedX does not send status messages, so parcels are checked every 30 minutes instead.",
};

export const dynamic = "force-dynamic";

export default async function Integrations({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: m } = await searchParams;
  const mode = m === "TEST" ? "TEST" : "LIVE";
  const s = await requireAccess("billing", "edit");
  const saved = await listIntegrations(s.tenantId);
  // The status address carries the store's webhook token. It is shown to the owner only, never logged.
  const tokens: Partial<Record<string, string | null>> = {};
  for (const key of COURIER_PROVIDERS) {
    const row = saved.find((i) => i.provider === key && i.mode === mode);
    if (row && !row.unreadable) tokens[key] = await loadCredentials(s.tenantId, key, mode).then((c) => c.integrationToken, () => null);
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Integrations</h1>
      <p className="muted">
        Your own keys for couriers, payments and tracking. They are encrypted before they are stored and can never be shown again,
        only replaced. Money from your customers goes straight to your accounts.
      </p>
      <p>
        Mode:{" "}
        <a href="?mode=LIVE" style={{ fontWeight: mode === "LIVE" ? 700 : 400 }}>Live</a>
        {" · "}
        <a href="?mode=TEST" style={{ fontWeight: mode === "TEST" ? 700 : 400 }}>Test</a>
      </p>
      {PROVIDER_KEYS.map((key) => {
        const spec = PROVIDERS[key];
        const current = saved.find((i) => i.provider === key && i.mode === mode);
        const isCourier = (COURIER_PROVIDERS as string[]).includes(key);
        const token = tokens[key] ?? null;
        return (
          <div key={key} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{spec.label}</strong>
              {current ? <Chip value={current.status} /> : <span className="muted">Not connected</span>}
            </div>
            {current?.lastError && <p className="muted">Last error: {current.lastError}</p>}
            <ProviderForm
              key={`${key}-${mode}`}
              provider={key}
              label={spec.label}
              mode={mode}
              secrets={[...spec.secrets]}
              config={[...spec.config]}
              configValues={current?.config ?? {}}
              secretsSet={current?.secretsSet ?? {}}
              unreadable={current?.unreadable ?? false}
            />
            {isCourier && current && !current.unreadable && (
              <CourierTools provider={key} mode={mode} webhookUrl={token && key !== "REDX" ? `${origin}/api/webhooks/courier/${token}` : null} webhookNote={WEBHOOK_NOTE[key as CourierProviderKey]} />
            )}
          </div>
        );
      })}
    </>
  );
}
