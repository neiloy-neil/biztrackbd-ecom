import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantTicketDetail } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { replyTicketAction } from "../actions";
import { SubmitButton } from "@/components/ui";

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

  const statusLabel =
    ticket.status === "WAITING_ON_TENANT"
      ? "Awaiting your reply"
      : ticket.status === "SOLVED"
      ? "Solved"
      : "Open";

  const pillClass =
    ticket.status === "WAITING_ON_TENANT"
      ? "pill warn"
      : ticket.status === "SOLVED"
      ? "pill good"
      : "pill info";

  return (
    <div className="stack gap-lg max-w-860">
      <div>
        <Link href="/support" className="back">
          ← Back to tickets
        </Link>
      </div>

      {created && (
        <div className="notice good mb-md" role="status">
          Support ticket submitted successfully. Our team will review it shortly.
        </div>
      )}

      {err && (
        <div className="notice bad mb-md" role="alert">
          {err}
        </div>
      )}

      {/* Ticket Header Card */}
      <div className="card">
        <div className="flex-between flex-wrap gap-md">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted text-bold">{ticket.code}</div>
            <h1 className="text-lg text-bold mt-xs">{ticket.subject}</h1>
          </div>
          <span className={pillClass}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="stack gap-md">
        {ticket.messages.map((m) => {
          const isPlatform = m.authorType === "PLATFORM";
          const isSystem = m.authorType === "SYSTEM";
          const timeStr = m.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const dateStr = m.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

          if (isSystem) {
            return (
              <div
                key={m.id}
                className="card-panel-warn text-sm pre-wrap"
              >
                <b className="text-warning">System note:</b> {m.body}
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={isPlatform ? "chat-align-start" : "chat-align-end"}
            >
              <div
                className={isPlatform ? "chat-bubble-platform" : "chat-bubble-tenant"}
              >
                <div className="text-xs text-muted mb-xs">
                  <b className={isPlatform ? "text-brand" : ""}>
                    {isPlatform ? "BizTrackBD Support" : "You"}
                  </b>{" "}
                  · {dateStr}, {timeStr}
                </div>
                <div className="text-sm pre-wrap">
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Card */}
      {ticket.status !== "SOLVED" ? (
        <form action={replyTicketAction} className="card stack gap-md mt-xs">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div className="text-base text-bold">Reply to ticket</div>
          <textarea
            name="message"
            className="textarea"
            rows={3}
            placeholder="Type your response here..."
            required
          />
          <div>
            <SubmitButton className="btn btn-primary" pending="Working…">
              Send reply
            </SubmitButton>
          </div>
        </form>
      ) : (
        <div className="card-panel-muted text-center text-sm text-muted">
          This ticket has been marked as solved. If you need further assistance, please open a new ticket.
        </div>
      )}
    </div>
  );
}
