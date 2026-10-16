import { listSiteLeads } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { LeadsManager } from "./leads-manager";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getSession();
  const actor = {
    userId: session.userId,
    role: session.role as any,
    email: session.email,
    name: session.name,
  };

  const { items, total, unreadCount } = await listSiteLeads(session.tenantId, actor);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
      {/* Page Title */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "var(--text, #0f172a)" }}>
              Leads & Inquiries
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  background: "#f59e0b",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 9999,
                }}
              >
                {unreadCount} New
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.92rem", color: "var(--muted, #64748b)", margin: "6px 0 0" }}>
            Triage customer contact messages, quote requests, appointments, and reservations in real-time.
          </p>
        </div>

        <div style={{ fontSize: "0.88rem", color: "var(--muted, #64748b)" }}>
          Total Captured: <strong>{total}</strong>
        </div>
      </div>

      <LeadsManager initialLeads={items as any} />
    </div>
  );
}
