import { listDownloads } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { DownloadsManager } from "./downloads-manager";

export const dynamic = "force-dynamic";

export default async function AdminDownloadsPage() {
  const session = await getSession();
  const downloads = await listDownloads(session.tenantId);
  const storeOrigin = storefrontOrigin(session.tenantSubdomain);

  return (
    <DownloadsManager
      initialDownloads={downloads}
      storeOrigin={storeOrigin}
    />
  );
}
