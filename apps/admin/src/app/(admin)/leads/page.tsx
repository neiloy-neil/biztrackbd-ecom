import { listSiteLeads, listAssignableStaff } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { LeadsManager } from "./leads-manager";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getSession();
  const actor = session.actor;

  const [{ items, total, unreadCount }, staffMembers] = await Promise.all([
    listSiteLeads(session.tenantId, actor),
    listAssignableStaff(session.tenantId, actor).catch(() => []),
  ]);

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 20px" }}>
      <LeadsManager
        initialLeads={items as any}
        staffMembers={staffMembers}
        initialTotal={total}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
