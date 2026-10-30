import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { can, listAppStoreCatalog, listIntegrations, loadCredentials, uddoktaPayUrls } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { AppStoreClient, type StoreSettingsData } from "./app-store-client";

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
    const st = await tx.storeSettings.findFirst({
      select: {
        whatsappNumber: true,
        metaPixelId: true,
        googleAnalyticsId: true,
        googleTagManagerId: true,
        tiktokPixelId: true,
        metaDomainVerification: true,
        googleSiteVerification: true,
        googleOAuthClientId: true,
        googleOAuthClientSecret: true, // read here only to learn whether one is saved; it is never sent to the browser
        googleMerchantCenterId: true,
        seoTitle: true,
        seoKeywords: true,
        socialShareImageUrl: true,
        richSnippetsEnabled: true,
        description: true,
        storeName: true,
        loyaltyEnabled: true,
        loyaltySpendPerPoint: true,
        loyaltyPointsPerBlock: true,
        loyaltyBdtPerBlock: true,
        loyaltyMaxCartPercent: true,
        referralEnabled: true,
        refereeDiscountBdt: true,
        refereeMinCartBdt: true,
        referrerRewardPoints: true,
        vipSilverMin: true,
        vipGoldMin: true,
        vipPlatinumMin: true,
        vipGoldDiscount: true,
        vipPlatinumDiscount: true,
        loyaltyExpiryMonths: true,
        birthdayVoucherBdt: true,
      },
    });
    const tn = await tx.tenant.findFirstOrThrow({ select: { subdomain: true, name: true, customDomain: true } });
    return [st as StoreSettingsData | null, tn] as const;
  });

  // Secrets are write-only: the client learns whether one is saved, never the value.
  const safeStoreSettings = storeSettings
    ? { ...storeSettings, googleOAuthClientSecret: undefined, googleOAuthClientSecretSet: Boolean(storeSettings.googleOAuthClientSecret) }
    : null;

  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";
  const storefrontOrigin = tenant.customDomain
    ? `https://${tenant.customDomain}`
    : `${proto}://${tenant.subdomain}.${rootDomain}`;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    (process.env.NODE_ENV === "production" ? "admin.biztrack.bd" : "localhost:3001");
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
      <PageHeader
        title="Apps & Integrations"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Apps & Integrations" }]}
        sub="Unified marketplace and integration hub. Activate couriers, track ad conversions, set up your product feed, and configure customer loyalty without leaving the page."
      />

      {err && (
        <div className="notice bad mb-3" role="alert" data-testid="apps-error">
          {err}
        </div>
      )}
      {one(sp.done) && (
        <div className="notice good mb-3" role="status">
          Saved successfully.
        </div>
      )}

      {overview.allowance === 0 && (
        <div className="notice info mb-3">
          Your current plan tier does not include premium addon apps.{" "}
          <Link href="/billing" className="link" prefetch={false}>
            See plans
          </Link>
        </div>
      )}

      <AppStoreClient
        overview={overview}
        canEdit={canEdit}
        storeSettings={safeStoreSettings}
        integrations={integrations}
        webhookTokens={webhookTokens}
        origin={origin}
        storefrontOrigin={storefrontOrigin}
        uddoktaStoreUrls={storefrontOrigin ? uddoktaPayUrls("store", storefrontOrigin) : null}
        storeSubdomain={tenant.subdomain}
        initialOpen={initialOpen}
      />
    </>
  );
}
