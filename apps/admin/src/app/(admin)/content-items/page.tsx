import { listContentItems, isSiteContentKind, type SiteContentKind } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { ContentItemsManager } from "./content-items-manager";

export const dynamic = "force-dynamic";

export default async function AdminContentItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const rawKind = sp.kind?.toUpperCase();
  const lockedKind: SiteContentKind | undefined =
    rawKind && (rawKind === "SERVICE" || rawKind === "PORTFOLIO" || rawKind === "TEAM" || rawKind === "CREDENTIAL" || rawKind === "PUBLICATION" || rawKind === "EVENT")
      ? (rawKind as SiteContentKind)
      : undefined;

  const items = await listContentItems(session.tenantId);
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <ContentItemsManager
      initialItems={items}
      lockedKind={lockedKind}
      storeOrigin={storeOrigin}
    />
  );
}
