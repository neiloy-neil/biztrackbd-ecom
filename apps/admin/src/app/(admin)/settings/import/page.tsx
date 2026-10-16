import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { ImportAssistantClient } from "./import-assistant-client";

export const dynamic = "force-dynamic";

export default async function AdminImportContentPage() {
  const session = await getSession();
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "10px 0" }}>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
            Smart Content Import Assistant
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.95rem" }}>
            Quickly bootstrap your services, team profiles, and business identity by pasting existing text.
          </p>
        </div>
      </div>

      <ImportAssistantClient storeOrigin={storeOrigin} />
    </div>
  );
}
