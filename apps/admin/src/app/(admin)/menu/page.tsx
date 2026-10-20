import { redirect } from "next/navigation";
import { getAdminMenu, getStoreInfo, getTenantCapabilities } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { MenuManager } from "./menu-manager";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const session = await requireAccess("design");
  const capabilities = await getTenantCapabilities(session.tenantId);

  // If tenant has no menu capability (e.g. standard doctor or pure ecommerce without menu module), redirect to home or design
  if (!capabilities.menu) {
    redirect("/design");
  }

  const [categories, storeInfo] = await Promise.all([
    getAdminMenu(session.tenantId),
    getStoreInfo(session.tenantId),
  ]);
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <MenuManager
      initialCategories={categories}
      storeOrigin={storeOrigin}
      storeName={storeInfo.storeName}
      logoUrl={storeInfo.logoUrl}
    />
  );
}
