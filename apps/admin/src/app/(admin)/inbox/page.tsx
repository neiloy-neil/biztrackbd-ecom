import type { Metadata } from "next";
import { CONTACT_REPLY_MAX, can, listContactMessages, markContactRead, type ContactTab } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton, Tabs } from "@/components/ui";
import { dateTime, prettyPhone } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { closeAction, replyAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inbox" };

const TABS: { key: ContactTab; label: string }[] = [{ key: "open", label: "To answer" }, { key: "replied", label: "Answered" }, { key: "closed", label: "Closed" }];

export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("customers");
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "open") as ContactTab;
  const canEdit = can(s.user.role, "customers", "edit");
  const list = await listContactMessages(s.tenantId, s.actor, tab);
  // Opening the inbox marks what is shown as read, for people who can answer.
  if (canEdit) for (const r of list.rows) if (r.status === "NEW") await markContactRead(s.tenantId, s.actor, r.id);
  const err = one(sp.err);

  return (
    <>
      <PageHeader title="Inbox" />
      <p className="page-sub">Messages from the contact form on your store. You answer by SMS to the number the customer gave; it uses one SMS credit.</p>
      {one(sp.replied) && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="inbox-replied">Reply sent.</div>}
      {one(sp.closed) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Closed.</div>}
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="inbox-error">{err}</div>}
      <Tabs tabs={TABS.map((t) => ({ href: `/inbox${t.key === "open" ? "" : `?tab=${t.key}`}`, label: t.label, count: list.counts[t.key], alert: t.key === "open", current: t.key === tab }))} />

      {list.rows.length === 0 ? (
        <div className="card empty" data-testid="inbox-empty">{tab === "open" ? "No messages waiting. Your contact page is at /contact on your store." : "Nothing here."}</div>
      ) : (
        <div className="stack" data-testid="inbox-list">
          {list.rows.map((m) => (
            <article key={m.id} className="card" data-testid="inbox-row">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div><b>{m.name}</b> <a className="link num" href={`tel:${m.phone}`}>{prettyPhone(m.phone)}</a>{m.email && <span className="muted"> · {m.email}</span>}</div>
                <span className="muted" style={{ fontSize: 13 }}>{dateTime(m.createdAt)}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{m.message}</p>
              {m.replyText && <div className="notice info"><b>{m.repliedBy ?? "Reply"}:</b> {m.replyText}</div>}
              {canEdit && (m.status === "NEW" || m.status === "READ") && (
                <div className="stack" style={{ marginTop: 10 }}>
                  <form action={replyAction.bind(null, m.id)} className="stack">
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">Reply by SMS</span>
                      <textarea className="textarea" name="text" rows={2} maxLength={CONTACT_REPLY_MAX} required data-testid="inbox-reply-text" />
                    </label>
                    <div className="row">
                      <SubmitButton className="btn btn-primary btn-sm" pending="Sending…" data-testid="inbox-reply-send">Send SMS</SubmitButton>
                      <a className="btn btn-secondary btn-sm" href={`https://wa.me/88${m.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    </div>
                  </form>
                  <form action={closeAction.bind(null, m.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Close without replying</SubmitButton></form>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
