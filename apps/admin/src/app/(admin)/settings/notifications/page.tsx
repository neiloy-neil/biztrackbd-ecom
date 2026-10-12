import type { Metadata } from "next";
import { can, listMessageTemplates } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { MessageCard } from "./message-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer messages" };

export default async function Notifications() {
  const s = await requireAccess("design");
  const { templates, storeName, smsCredits } = await listMessageTemplates(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "design", "edit");
  const orderMessages = templates.filter((t) => !t.alwaysOn);
  const reminders = templates.filter((t) => t.alwaysOn);

  return (
    <>
      <div className="page-head"><h1>Customer messages</h1></div>
      <p className="page-sub">The SMS your customers get about their order. Each one is off until you turn it on. Every message uses one SMS credit from your plan.</p>
      <div className="notice" style={{ marginBottom: 14 }} data-testid="sms-credits">
        {smsCredits.limit == null ? `${smsCredits.used} SMS sent this month. Your plan has no SMS limit.` : `${smsCredits.used} of ${smsCredits.limit} SMS credits used this month.`}
      </div>
      {!canEdit && <div className="notice" style={{ marginBottom: 14 }}>You can read these messages but not change them.</div>}
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="stack" data-testid="order-messages">
          {orderMessages.map((t) => <MessageCard key={t.event} t={t} storeName={storeName} />)}
        </div>
        <h2 style={{ fontSize: 16, margin: "22px 0 10px" }}>Reminders</h2>
        <div className="stack">
          {reminders.map((t) => <MessageCard key={t.event} t={t} storeName={storeName} />)}
        </div>
      </fieldset>
    </>
  );
}
