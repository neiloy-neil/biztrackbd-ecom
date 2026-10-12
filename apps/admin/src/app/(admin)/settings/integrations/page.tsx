import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { headers } from "next/headers";
import Link from "next/link";
import { COURIER_PROVIDERS, PROVIDER_KEYS, PROVIDERS, listIntegrations, loadCredentials, type CourierProviderKey, type ProviderKey } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { IntegrationsList, type IntegrationItem, type ModeData } from "./integrations-list";

const WEBHOOK_NOTE: Record<CourierProviderKey, string> = {
  STEADFAST: "Paste this in your Steadfast merchant panel under API settings, as the webhook URL. Parcels are also checked every 30 minutes.",
  PATHAO: "Paste this in your Pathao merchant panel under Webhook integration. Parcels are also checked every 30 minutes.",
  REDX: "RedX does not send status messages, so parcels are checked every 30 minutes instead.",
};

/** What people read for each field. The names on the left are what the server reads and never change. */
const LABELS: Record<string, string> = {
  apiKey: "API key", secretKey: "Secret key", clientId: "Client ID", clientSecret: "Client secret", username: "Username (email)", password: "Password",
  storeId: "Store ID", accessToken: "Access token", pickupStoreId: "Pickup store ID", storePassword: "Store password", pixelId: "Pixel ID",
  apiSecret: "API secret", measurementId: "Measurement ID", senderEmail: "Sender email", senderName: "Sender name", senderId: "Sender ID",
};
const HINTS: Partial<Record<string, string>> = {
  senderEmail: "Customers see this as the sender. It must be verified in your Brevo account.",
  senderId: "The name or number customers see on the message, if your SMS provider supports one.",
  pickupStoreId: "The pickup store you set up in your RedX panel.",
  pixelId: "The number from Meta Events Manager. It is not secret.",
  measurementId: "Looks like G-XXXXXXXXXX. It is not secret.",
};

const META: Record<ProviderKey, { group: string; description: string }> = {
  STEADFAST: { group: "Couriers", description: "Book parcels and follow delivery with Steadfast Courier." },
  PATHAO: { group: "Couriers", description: "Book pickups and follow parcels with Pathao." },
  REDX: { group: "Couriers", description: "Book RedX pickups. Parcels are checked every 30 minutes." },
  SSLCOMMERZ: { group: "Payments", description: "Take card and mobile-banking payments into your own merchant account." },
  META_CAPI: { group: "Marketing and tracking", description: "Send purchases to Meta from the server for better ad results." },
  GA4: { group: "Marketing and tracking", description: "Send purchase events to Google Analytics 4." },
  BREVO_BYO: { group: "Messaging", description: "Send customer emails from your own Brevo account." },
  SMS_BYO: { group: "Messaging", description: "Send customer text messages from your own SMS account." },
};

export const dynamic = "force-dynamic";

export default async function Integrations({ searchParams }: { searchParams: Promise<{ mode?: string; open?: string }> }) {
  const sp = await searchParams;
  const mode = sp.mode === "TEST" ? "TEST" : "LIVE";
  const open = PROVIDER_KEYS.find((k) => k === sp.open);
  const s = await requireAccess("billing", "edit");
  if (s.demo) return <DemoLocked what="Integrations" keepHref={trialHref(s.demo.keep)} />;
  const saved = await listIntegrations(s.tenantId);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  const items: IntegrationItem[] = [];
  for (const key of PROVIDER_KEYS) {
    const spec = PROVIDERS[key];
    const isCourier = (COURIER_PROVIDERS as string[]).includes(key);
    const modes = {} as Record<"TEST" | "LIVE", ModeData>;
    for (const m of ["TEST", "LIVE"] as const) {
      const row = saved.find((i) => i.provider === key && i.mode === m);
      // The status address carries the store's webhook token. It is shown to the owner only, never logged.
      const token = isCourier && row && !row.unreadable ? await loadCredentials(s.tenantId, key, m).then((c) => c.integrationToken, () => null) : null;
      modes[m] = {
        status: (row?.status as ModeData["status"]) ?? null,
        lastError: row?.lastError ?? null,
        configValues: row?.config ?? {},
        secretsSet: row?.secretsSet ?? {},
        unreadable: row?.unreadable ?? false,
        webhookUrl: token && key !== "REDX" ? `${origin}/api/webhooks/courier/${token}` : null,
      };
    }
    items.push({
      key, label: spec.label, group: META[key].group, description: META[key].description, isCourier,
      webhookNote: isCourier ? WEBHOOK_NOTE[key as CourierProviderKey] : null,
      // Settings first, then secrets, as the form has always listed them.
      fields: [
        ...spec.config.map((name) => ({ name, label: LABELS[name] ?? name, secret: false, hint: HINTS[name] })),
        ...spec.secrets.map((name) => ({ name, label: LABELS[name] ?? name, secret: true, hint: HINTS[name] })),
      ],
      modes,
    });
  }

  return (
    <>
      <PageHeader
        title="Integrations"
        sub="Connect your own courier, payment, tracking and messaging accounts. Keys are encrypted and can never be shown again, only replaced."
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Integrations" }]}
        linkAs={Link}
      />
      <IntegrationsList items={items} initialMode={mode} initialOpen={open} />
    </>
  );
}
