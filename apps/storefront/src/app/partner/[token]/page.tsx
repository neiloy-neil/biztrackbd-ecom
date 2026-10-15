import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAffiliateByToken, storeOriginFor } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";
import { PartnerClient } from "./partner-client";

export const dynamic = "force-dynamic";

export default async function PartnerPortalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const store = await getStore();

  let portalData;
  try {
    portalData = await getAffiliateByToken(store.id, token);
  } catch {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = await storeOriginFor(store.id).catch(() => `${proto}://${host}`);

  return (
    <PartnerClient
      token={token}
      partner={portalData.partner}
      referrals={portalData.referrals}
      payouts={portalData.payouts}
      storeName={store.subdomain ? `${store.subdomain.toUpperCase()} Store` : "Partner Portal"}
      origin={origin}
    />
  );
}
