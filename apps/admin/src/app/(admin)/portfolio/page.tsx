import type { Metadata } from "next";
import { listContentItems } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { ContentItemsManager } from "../content-items/content-items-manager";

export const metadata: Metadata = { title: "Portfolio" };

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const session = await requireAccess("design");
  const items = await listContentItems(session.tenantId, { kind: "PORTFOLIO" });
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <ContentItemsManager
      initialItems={items}
      lockedKind="PORTFOLIO"
      storeOrigin={storeOrigin}
    />
  );
}
