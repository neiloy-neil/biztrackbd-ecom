import type { Metadata } from "next";
import Link from "next/link";
import { listTenantTickets } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { createTicketAction } from "./actions";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";

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
    <div className="stack gap-xl max-w-920">
      <PageHeader
        title="Help & Support"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Help & Support" }]}
        sub="Get assistance from the BizTrackBD technical team with custom domains, couriers, payment gateways, and theme configurations."
      />

      {err && (
        <div className="notice bad mb-md" role="alert">
          {err}
        </div>
      )}

      {/* Direct 24/7 Hotline & WhatsApp Quick Contact */}
      <div className="card" style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)", border: "1px solid #BBF7D0" }}>
        <div className="flex-between flex-wrap gap-md">
          <div>
            <div className="text-base text-bold text-success mb-xs">Direct Merchant Assistance (24/7)</div>
            <div className="text-xs text-muted">
              Connect directly with our dedicated technical team for urgent domain, courier or store issues.
            </div>
          </div>
          <div className="flex-center-y gap-sm flex-wrap">
            <a
              href="https://wa.me/8801886675596?text=Hello%20BizTrackBD%20Support!%20I%20need%20assistance%20with%20my%20store."
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
              style={{ padding: "8px 14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              💬 WhatsApp: +01886675596
            </a>
            <a
              href="tel:+8801886675596"
              className="btn btn-secondary"
              style={{ padding: "8px 14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              📞 Hotline: +01886675596
            </a>
          </div>
        </div>
      </div>

      {/* Compose Ticket Card */}
      <form action={createTicketAction} className="card stack gap-lg">
        <div className="text-base text-bold">Open a new ticket</div>

        <label className="field mb-0">
          <span className="label">Subject</span>
          <input
            name="subject"
            className="input"
            placeholder="e.g. Domain rongdhonu.com not connecting after adding DNS"
            required
          />
        </label>

        <div className="flex-center-y flex-wrap gap-lg">
          <label className="field flex-1 min-w-0 mb-0">
            <span className="label">Priority</span>
            <select name="priority" className="select" defaultValue="NORMAL">
              <option value="LOW">Low (general inquiry)</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High (store blocked / checkout impacted)</option>
            </select>
          </label>
        </div>

        <label className="field mb-0">
          <span className="label">Message</span>
          <textarea
            name="message"
            className="textarea"
            rows={4}
            placeholder="Describe what you need help with. Include any error messages or registrar details..."
            required
          />
        </label>

        <div>
          <SubmitButton className="btn btn-primary" pending="Working…">
            Submit ticket
          </SubmitButton>
        </div>
      </form>

      {/* Existing Tickets List */}
      <div className="card p-0">
        <div className="py-sm px-md text-bold border-bottom">
          Your tickets ({tickets.length})
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state text-sm">
            You haven&apos;t opened any support tickets yet.
          </div>
        ) : (
          tickets.map((t) => {
            const statusLabel =
              t.status === "WAITING_ON_TENANT"
                ? "Awaiting your reply"
                : t.status === "SOLVED"
                ? "Solved"
                : "Open";

            const pillClass =
              t.status === "WAITING_ON_TENANT"
                ? "pill warn"
                : t.status === "SOLVED"
                ? "pill good"
                : "pill info";

            const dateStr = t.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="flex-center-y gap-md py-sm px-md border-bottom link-block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex-center-y gap-sm">
                    <span className="text-xs text-bold text-muted">{t.code}</span>
                    <b className="text-base">{t.subject}</b>
                  </div>
                  <div className="text-xs text-muted mt-xs">
                    Updated {dateStr}
                  </div>
                </div>

                <span className={pillClass}>
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
