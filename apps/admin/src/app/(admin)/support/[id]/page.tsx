import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantTicketDetail } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { replyTicketAction } from "../actions";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ticket #${id.slice(0, 8)} | Support` };
}

export default async function MerchantTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSession();
  const { id } = await params;
  const sp = await searchParams;

  let ticket;
  try {
    ticket = await getTenantTicketDetail(s.tenantId, s.actor, id);
  } catch {
    notFound();
  }

  const err = typeof sp.err === "string" ? sp.err : null;
  const created = sp.created === "1";

  const statusLabel =
    ticket.status === "WAITING_ON_TENANT"
      ? "Awaiting your reply"
      : ticket.status === "SOLVED"
      ? "Solved"
      : "Open (In Progress)";

  const pillClass =
    ticket.status === "WAITING_ON_TENANT"
      ? "pill warn"
      : ticket.status === "SOLVED"
      ? "pill good"
      : "pill info";

  return (
    <div className="stack gap-xl max-w-920">
      <PageHeader
        title={`Ticket #${ticket.code}`}
        crumbs={[
          { label: "Help & Support", href: "/support" },
          { label: `#${ticket.code}` },
        ]}
        sub={ticket.subject}
      />

      {created && (
        <div className="notice good mb-md" role="status">
          Your support ticket #{ticket.code} has been created. The BizTrackBD support team has been notified.
        </div>
      )}

      {err && (
        <div className="notice bad mb-md" role="alert">
          {err}
        </div>
      )}

      {/* Ticket Meta Summary Card */}
      <div className="card p-md flex-center-y justify-between flex-wrap gap-md">
        <div className="flex-center-y gap-md">
          <span className={pillClass}>{statusLabel}</span>
          <span className="pill neutral">Priority: {ticket.priority}</span>
          <span className="text-xs text-muted">
            Opened:{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <Link href="/support" className="btn btn-secondary btn-sm">
          ← Back to all tickets
        </Link>
      </div>

      {/* Conversation Thread */}
      <div className="card p-0">
        <div className="py-sm px-md text-bold border-bottom flex-center-y justify-between">
          <span>Conversation History ({ticket.messages.length} messages)</span>
          <span className="text-xs text-muted">Live sync with BizTrackBD Platform Support</span>
        </div>

        <div className="p-lg stack gap-lg" style={{ maxHeight: 600, overflowY: "auto", background: "var(--bg-subtle, #fafafa)" }}>
          {ticket.messages.length === 0 ? (
            <div className="empty-state text-sm">No messages yet in this ticket.</div>
          ) : (
            ticket.messages.map((m) => {
              const isMerchant = m.authorType === "TENANT";
              const isSystem = m.authorType === "SYSTEM";

              if (isSystem) {
                return (
                  <div
                    key={m.id}
                    style={{
                      background: "#F1F5F9",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#475569",
                      textAlign: "center",
                      fontStyle: "italic",
                      alignSelf: "center",
                      maxWidth: "85%",
                    }}
                  >
                    {m.body}
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMerchant ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      borderRadius: 12,
                      padding: "12px 16px",
                      background: isMerchant ? "#0B4D3B" : "#ffffff",
                      color: isMerchant ? "#ffffff" : "#0f172a",
                      border: isMerchant ? "none" : "1px solid var(--line, #e2e8f0)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        marginBottom: 6,
                        borderBottom: isMerchant ? "1px solid rgba(255,255,255,0.2)" : "1px solid #f1f5f9",
                        paddingBottom: 4,
                      }}
                    >
                      <b
                        style={{
                          fontSize: 12,
                          color: isMerchant ? "#E3F1EA" : "#0B4D3B",
                        }}
                      >
                        {isMerchant ? "You (Merchant)" : "BizTrackBD Support Team"}
                      </b>
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.8,
                          color: isMerchant ? "#E3F1EA" : "#64748b",
                        }}
                      >
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Composer Form */}
        <form action={replyTicketAction} className="p-md border-top stack gap-md" style={{ background: "#ffffff" }}>
          <input type="hidden" name="ticketId" value={ticket.id} />

          <div className="text-sm text-bold">Reply to Support Team</div>

          <textarea
            name="message"
            className="textarea"
            rows={4}
            placeholder="Type your message or response here..."
            required
            style={{ width: "100%" }}
          />

          <div className="flex-center-y justify-between">
            <span className="text-xs text-muted">
              {ticket.status === "SOLVED"
                ? "Note: Sending a new message will automatically reopen this ticket."
                : "The platform support team will receive an instant push notification."}
            </span>

            <SubmitButton className="btn btn-primary" pending="Sending…">
              Send reply
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
