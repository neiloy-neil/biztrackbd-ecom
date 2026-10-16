import { redirect } from "next/navigation";
import { getAdminMenu, getTenantCapabilities } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { MenuManager } from "./menu-manager";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const session = await getSession();
  const capabilities = await getTenantCapabilities(session.tenantId);

  // If tenant has no menu capability (e.g. standard doctor or pure ecommerce without menu module), redirect to home or design
  if (!capabilities.menu) {
    redirect("/design");
  }

  const categories = await getAdminMenu(session.tenantId);
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return <MenuManager initialCategories={categories} storeOrigin={storeOrigin} />;
}
