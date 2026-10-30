import type { Metadata } from "next";
import {
  listAffiliatePartners,
  listAffiliatePayouts,
  listAffiliateReferrals,
  storeOriginFor,
  can,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { AffiliatesClient } from "./affiliates-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Affiliate & Influencer Hub" };

export default async function AffiliatesPage() {
  const s = await requireAccess("marketing");
  const canEdit = can(s.user.role, "marketing", "edit");

  const [partners, payouts, referrals, origin] = await Promise.all([
    listAffiliatePartners(s.tenantId),
    listAffiliatePayouts(s.tenantId),
    listAffiliateReferrals(s.tenantId),
    storeOriginFor(s.tenantId).catch(() => storefrontOrigin(s.tenantSubdomain)),
  ]);

  return (
    <AffiliatesClient
      partners={partners}
      payouts={payouts}
      referrals={referrals}
      storeOrigin={origin}
      canEdit={canEdit}
    />
  );
}
