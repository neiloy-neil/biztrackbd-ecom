import { listContentItems } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { ContentItemsManager } from "../content-items/content-items-manager";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const session = await getSession();
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
