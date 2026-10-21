import type { Metadata } from "next";
import Link from "next/link";
import { listTenantTickets } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { createTicketAction } from "./actions";
import { SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Help & Support" };

export default async function MerchantSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSession();
  const sp = await searchParams;
  const tickets = await listTenantTickets(s.tenantId, s.actor);

  const err = typeof sp.err === "string" ? sp.err : null;

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 920 }}>
      <div className="page-head">
        <h1>Help & Support</h1>
      </div>
      <p className="page-sub">
        Get assistance from the BizTrackBD technical team with custom domains, couriers, payment gateways, and theme configurations.
      </p>

      {err && (
        <div className="notice bad" role="alert">
          {err}
        </div>
      )}

      {/* Compose Ticket Card */}
      <form action={createTicketAction} className="card stack" style={{ gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Open a new ticket</div>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Subject</span>
          <input
            name="subject"
            className="input"
            placeholder="e.g. Domain rongdhonu.com not connecting after adding DNS"
            required
          />
        </label>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="label">Priority</span>
            <select name="priority" className="select" defaultValue="NORMAL">
              <option value="LOW">Low (general inquiry)</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High (store blocked / checkout impacted)</option>
            </select>
          </label>
        </div>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Message</span>
          <textarea
            name="message"
            className="input"
            rows={4}
            placeholder="Describe what you need help with. Include any error messages or registrar details..."
            required
            style={{ padding: 12, lineHeight: 1.55 }}
          />
        </label>

        <div>
          <SubmitButton className="btn btn-primary" style={{ height: 40, padding: "0 20px" }} pending="Working…">
            Submit ticket
          </SubmitButton>
        </div>
      </form>

      {/* Existing Tickets List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", fontSize: 15, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Your tickets ({tickets.length})
        </div>

        {tickets.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
            You haven&apos;t opened any support tickets yet.
          </div>
        ) : (
          tickets.map((t) => {
            let statusLabel = "Open";
            let statusBg = "var(--tint)";
            let statusColor = "var(--brand)";

            if (t.status === "WAITING_ON_TENANT") {
              statusLabel = "Awaiting your reply";
              statusBg = "var(--warning-bg)";
              statusColor = "var(--warning)";
            } else if (t.status === "SOLVED") {
              statusLabel = "Solved";
              statusBg = "var(--success-bg)";
              statusColor = "var(--success)";
            }

            const dateStr = t.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--line)",
                  color: "inherit",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>{t.code}</span>
                    <b style={{ fontSize: 14.5 }}>{t.subject}</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>
                    Updated {dateStr}
                  </div>
                </div>

                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 11,
                    fontSize: 12,
                    fontWeight: 600,
                    background: statusBg,
                    color: statusColor,
                    flex: "none",
                  }}
                >
                  {statusLabel}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
