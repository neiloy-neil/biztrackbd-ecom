import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantTicketDetail } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { replyTicketAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket Details" };

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

  const ticket = await getTenantTicketDetail(s.tenantId, s.actor, id).catch(() => null);
  if (!ticket) notFound();

  const err = typeof sp.err === "string" ? sp.err : null;
  const created = sp.created === "1";

  let statusLabel = "Open";
  let statusBg = "var(--tint)";
  let statusColor = "var(--brand)";

  if (ticket.status === "WAITING_ON_TENANT") {
    statusLabel = "Awaiting your reply";
    statusBg = "var(--warning-bg)";
    statusColor = "var(--warning)";
  } else if (ticket.status === "SOLVED") {
    statusLabel = "Solved";
    statusBg = "var(--success-bg)";
    statusColor = "var(--success)";
  }

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
      <div>
        <Link href="/support" className="back">
          ← Back to tickets
        </Link>
      </div>

      {created && (
        <div className="notice good" role="status">
          Support ticket submitted successfully. Our team will review it shortly.
        </div>
      )}

      {err && (
        <div className="notice bad" role="alert">
          {err}
        </div>
      )}

      {/* Ticket Header Card */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 700 }}>{ticket.code}</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{ticket.subject}</h1>
          </div>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              background: statusBg,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Message Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ticket.messages.map((m) => {
          const isPlatform = m.authorType === "PLATFORM";
          const isSystem = m.authorType === "SYSTEM";
          const timeStr = m.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const dateStr = m.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

          if (isSystem) {
            return (
              <div
                key={m.id}
                style={{
                  background: "#FDF3E3",
                  border: "1px solid #F0DDB8",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--ink-2)",
                }}
              >
                <b style={{ color: "#B45309" }}>System note:</b> {m.body}
              </div>
            );
          }

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isPlatform ? "flex-start" : "flex-end",
              }}
            >
              <div
                style={{
                  maxWidth: 620,
                  borderRadius: 12,
                  padding: "16px 18px",
                  background: isPlatform ? "#F4F3FF" : "#fff",
                  border: isPlatform ? "1px solid #D9D5FA" : "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
                  <b style={{ color: isPlatform ? "var(--brand)" : "var(--ink)" }}>
                    {isPlatform ? "BizTrackBD Support" : "You"}
                  </b>{" "}
                  · {dateStr}, {timeStr}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Card */}
      {ticket.status !== "SOLVED" ? (
        <form action={replyTicketAction} className="card stack" style={{ gap: 14, marginTop: 8 }}>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Reply to ticket</div>
          <textarea
            name="message"
            className="input"
            rows={3}
            placeholder="Type your response here..."
            required
            style={{ padding: 12, lineHeight: 1.55 }}
          />
          <div>
            <button type="submit" className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>
              Send reply
            </button>
          </div>
        </form>
      ) : (
        <div style={{ padding: 18, background: "var(--bg)", borderRadius: 10, textAlign: "center", fontSize: 13.5, color: "var(--ink-3)" }}>
          This ticket has been marked as solved. If you need further assistance, please open a new ticket.
        </div>
      )}
    </div>
  );
}
