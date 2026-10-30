import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_REPLY_MAX,
  can,
  listContactMessages,
  markContactRead,
  listWhatsAppConversations,
  listTenantStaffUsers,
  listSupportQuickReplies,
  type ContactTab,
} from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton, Tabs } from "@/components/ui";
import { dateTime, prettyPhone } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { closeAction, replyAction } from "./actions";
import { WhatsAppDeskClient } from "./whatsapp-desk-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Inbox & WhatsApp Desk" };

const WEB_TABS: { key: ContactTab; label: string }[] = [
  { key: "open", label: "To answer" },
  { key: "replied", label: "Answered" },
  { key: "closed", label: "Closed" },
];

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("customers");
  const channel = one(sp.channel) || "whatsapp";
  const canEdit = can(s.user.role, "customers", "edit");

  // If viewing WhatsApp channel
  if (channel === "whatsapp") {
    const [waData, staffUsers, quickReplies] = await Promise.all([
      listWhatsAppConversations(s.tenantId, { limit: 100 }),
      listTenantStaffUsers(s.tenantId),
      listSupportQuickReplies(s.tenantId),
    ]);

    return (
      <>
        <PageHeader
          title="Customer Support Desk"
          crumbs={[{ label: "Home", href: "/" }, { label: "Inbox" }]}
          sub="Omnichannel customer communications: Live WhatsApp conversations and store contact messages."
        />

        {/* Channel Navigation Switcher */}
        <div className="tab-strip mb-md">
          <Link
            href="/inbox?channel=whatsapp"
            className="tab-item active"
          >
            WhatsApp Live Desk ({waData.total})
          </Link>
          <Link
            href="/inbox?channel=web"
            className="tab-item"
          >
            Store Contact Form
          </Link>
        </div>

        <WhatsAppDeskClient
          currentUserId={s.user.id}
          staffUsers={staffUsers}
          initialQuickReplies={quickReplies}
          initialConversations={waData.conversations.map((c) => ({
            id: c.id,
            customerPhone: c.customerPhone,
            customerName: c.customerName,
            status: c.status,
            unreadCount: c.unreadCount,
            lastMessageText: c.lastMessageText,
            lastMessageAt: c.lastMessageAt,
            assignedUserId: c.assignedUserId,
            assignedUser: c.assignedUser,
            botPausedUntil: c.botPausedUntil,
            customer: c.customer
              ? {
                  id: c.customer.id,
                  name: c.customer.name,
                  phone: c.customer.phone,
                  totalOrders: c.customer.totalOrders,
                  totalSpent: c.customer.totalSpent,
                }
              : null,
          }))}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Web Contact Form tab
  const tab = (WEB_TABS.find((t) => t.key === one(sp.tab))?.key ?? "open") as ContactTab;
  const list = await listContactMessages(s.tenantId, s.actor, tab);
  if (canEdit) {
    for (const r of list.rows) {
      if (r.status === "NEW") await markContactRead(s.tenantId, s.actor, r.id);
    }
  }
  const err = one(sp.err);

  return (
    <>
      <PageHeader
        title="Customer Support Desk"
        crumbs={[{ label: "Home", href: "/" }, { label: "Inbox" }]}
        sub="Messages from the contact form on your store. You answer by SMS to the number the customer gave."
      />

      {/* Channel Navigation Switcher */}
      <div className="tab-strip mb-md">
        <Link
          href="/inbox?channel=whatsapp"
          className="tab-item"
        >
          WhatsApp Live Desk
        </Link>
        <Link
          href="/inbox?channel=web"
          className="tab-item active"
        >
          Store Contact Form
        </Link>
      </div>

      {one(sp.replied) && (
        <div className="notice good mb-md" role="status" data-testid="inbox-replied">
          Reply sent.
        </div>
      )}
      {one(sp.closed) && (
        <div className="notice good mb-md" role="status">
          Closed.
        </div>
      )}
      {err && (
        <div className="notice bad mb-md" role="alert" data-testid="inbox-error">
          {err}
        </div>
      )}

      <Tabs
        tabs={WEB_TABS.map((t) => ({
          href: `/inbox?channel=web${t.key === "open" ? "" : `&tab=${t.key}`}`,
          label: t.label,
          count: list.counts[t.key],
          alert: t.key === "open",
          current: t.key === tab,
        }))}
      />

      {list.rows.length === 0 ? (
        <div className="card empty" data-testid="inbox-empty">
          {tab === "open"
            ? "No messages waiting. Your contact page is at /contact on your store."
            : "Nothing here."}
        </div>
      ) : (
        <div className="stack" data-testid="inbox-list">
          {list.rows.map((m) => (
            <article key={m.id} className="card" data-testid="inbox-row">
              <div className="row flex-between">
                <div>
                  <b>{m.name}</b>{" "}
                  <a className="link num" href={`tel:${m.phone}`}>
                    {prettyPhone(m.phone)}
                  </a>
                  {m.email && <span className="muted"> · {m.email}</span>}
                </div>
                <span className="muted text-sm">
                  {dateTime(m.createdAt)}
                </span>
              </div>
              <p className="pre-wrap my-xs">{m.message}</p>
              {m.replyText && (
                <div className="notice info">
                  <b>{m.repliedBy ?? "Reply"}:</b> {m.replyText}
                </div>
              )}
              {canEdit && (m.status === "NEW" || m.status === "READ") && (
                <div className="stack mt-sm">
                  <form action={replyAction.bind(null, m.id)} className="stack">
                    <label className="field mb-0">
                      <span className="label">Reply by SMS</span>
                      <textarea
                        className="textarea"
                        name="text"
                        rows={2}
                        maxLength={CONTACT_REPLY_MAX}
                        required
                        data-testid="inbox-reply-text"
                      />
                    </label>
                    <div className="row">
                      <SubmitButton
                        className="btn btn-primary btn-sm"
                        pending="Sending…"
                        data-testid="inbox-reply-send"
                      >
                        Send SMS
                      </SubmitButton>
                      <a
                        className="btn btn-secondary btn-sm"
                        href={`https://wa.me/88${m.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </form>
                  <form action={closeAction.bind(null, m.id)}>
                    <SubmitButton className="btn btn-secondary btn-sm" pending="…">
                      Close without replying
                    </SubmitButton>
                  </form>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
