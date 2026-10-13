import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { can, listAppStoreCatalog, listIntegrations, loadCredentials } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { AppStoreClient } from "./app-store-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apps & Integrations" };

export default async function Apps({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("billing");
  if (s.demo) return <DemoLocked what="Apps" keepHref={trialHref(s.demo.keep)} />;

  const canEdit = can(s.user.role, "billing", "edit");
  const overview = await listAppStoreCatalog(s.tenantId, s.actor);
  const integrations = await listIntegrations(s.tenantId);

  const [storeSettings, tenant] = await withTenant(s.tenantId, async (tx) => {
    const st = await tx.storeSettings.findFirst();
    const tn = await tx.tenant.findFirstOrThrow({ select: { subdomain: true, name: true, customDomain: true } });
    return [st, tn] as const;
  });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";
  const storefrontOrigin = tenant.customDomain
    ? `https://${tenant.customDomain}`
    : `${proto}://${tenant.subdomain}.${rootDomain}`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  // Fetch webhook tokens for couriers safely
  const webhookTokens: Record<string, string> = {};
  for (const prov of ["STEADFAST", "PATHAO"] as const) {
    try {
      const cred = await loadCredentials(s.tenantId, prov, "LIVE");
      if (cred?.integrationToken) webhookTokens[prov] = cred.integrationToken;
    } catch {
      // not configured yet
    }
  }

  const err = one(sp.err);
  const initialOpen = one(sp.open);

  return (
    <>
      <div className="page-head">
        <h1>Apps & Integrations</h1>
      </div>
      <p className="page-sub">
        Unified marketplace and integration hub. Activate couriers, track ad conversions, set up your product feed, and configure customer loyalty without leaving the page.
      </p>

      {err && (
        <div className="notice bad" role="alert" style={{ marginBottom: 16 }} data-testid="apps-error">
          {err}
        </div>
      )}
      {one(sp.done) && (
        <div className="notice good" role="status" style={{ marginBottom: 16 }}>
          Saved successfully.
        </div>
      )}

      {overview.allowance === 0 && (
        <div className="notice info" style={{ marginBottom: 16 }}>
          Your current plan tier does not include premium addon apps.{" "}
          <Link href="/billing" className="link" prefetch={false}>
            See plans
          </Link>
        </div>
      )}

      <AppStoreClient
        overview={overview}
        canEdit={canEdit}
        storeSettings={storeSettings}
        integrations={integrations}
        webhookTokens={webhookTokens}
        origin={origin}
        storefrontOrigin={storefrontOrigin}
        storeSubdomain={tenant.subdomain}
        initialOpen={initialOpen}
      />
    </>
  );
}
