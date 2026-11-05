import type { Metadata } from "next";
import { can, getMarketingOptOut, listMessageTemplates } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
import { SmsBalanceCard } from "@/components/sms-balance-card";
import { SubmitButton } from "@/components/ui";
import { MessageCard } from "./message-card";
import { saveMarketingChoiceAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer messages" };

export default async function Notifications() {
  const s = await requireAccess("design");
  const { templates, storeName } = await listMessageTemplates(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "design", "edit");
  const optedOut = can(s.user.role, "billing") ? await getMarketingOptOut(s.tenantId, s.actor).catch(() => null) : null;
  const orderMessages = templates.filter((t) => !t.alwaysOn);
  const reminders = templates.filter((t) => t.alwaysOn);

  return (
    <>
      <PageHeader
        title="Customer messages"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Notifications" }]}
        sub="The SMS your customers get about their order. Each one is off until you turn it on. Every message uses one SMS credit from your plan."
      />
      <SmsBalanceCard tenantId={s.tenantId} actor={s.actor} canBuy={can(s.user.role, "billing", "edit")} />
      {optedOut !== null && (
        <form action={saveMarketingChoiceAction} className="card mb-3" style={{ padding: 16, display: "grid", gap: 8 }} data-testid="marketing-choice">
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" name="tips" defaultChecked={!optedOut} disabled={!can(s.user.role, "billing", "edit")} style={{ marginTop: 4 }} />
            <span><b>Send me product tips and offers from BizTrackBD</b><br /><span className="muted" style={{ fontSize: 13.5 }}>Occasional emails to help you sell more. Messages about your plan, payments and account always reach you.</span></span>
          </label>
          {can(s.user.role, "billing", "edit") && <div><SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save</SubmitButton></div>}
        </form>
      )}
      {!canEdit && <div className="notice mb-3">You can read these messages but not change them.</div>}
      <fieldset disabled={!canEdit} className="border-0 p-0 m-0">
        <div className="stack" data-testid="order-messages">
          {orderMessages.map((t) => <MessageCard key={t.event} t={t} storeName={storeName} />)}
        </div>
        <h2 className="text-base font-bold mt-4 mb-2">Reminders</h2>
        <div className="stack">
          {reminders.map((t) => <MessageCard key={t.event} t={t} storeName={storeName} />)}
        </div>
      </fieldset>
    </>
  );
}
