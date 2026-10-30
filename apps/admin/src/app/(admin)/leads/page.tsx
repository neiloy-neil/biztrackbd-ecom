import { listSiteLeads, listAssignableStaff } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { LeadsManager } from "./leads-manager";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await requireAccess("leads");
  const actor = session.actor;

  const [{ items, total, unreadCount }, staffMembers] = await Promise.all([
    listSiteLeads(session.tenantId, actor),
    listAssignableStaff(session.tenantId, actor).catch(() => []),
  ]);

  return (
    <LeadsManager
      initialLeads={items as any}
      staffMembers={staffMembers}
      initialTotal={total}
      initialUnreadCount={unreadCount}
    />
  );
}
