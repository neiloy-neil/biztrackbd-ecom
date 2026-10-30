import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { PageHeader } from "@biztrackbd/ui";
import { ImportAssistantClient } from "./import-assistant-client";

export const dynamic = "force-dynamic";

export default async function AdminImportContentPage() {
  const session = await getSession();
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <div className="stack gap-4 max-w-4xl mx-auto">
      <PageHeader
        title="Smart Content Import Assistant"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Import" }]}
        sub="Quickly bootstrap your services, team profiles, and business identity by pasting existing text."
      />

      <ImportAssistantClient storeOrigin={storeOrigin} />
    </div>
  );
}
