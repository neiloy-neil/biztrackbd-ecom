import type { Metadata } from "next";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import Link from "next/link";
import {
  listPlatformAudit,
  listPlatformUsers,
  canPlatform,
  type PlatformUserView,
  type PlatformRole,
} from "@biztrackbd/core";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import {
  inviteStaffAction,
  updateStaffRoleAction,
  toggleStaffActiveAction,
} from "./actions";
import { SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team and audit log" };

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Platform Owner",
  FINANCE: "Finance & Billing",
  SUPPORT_LEAD: "Support Lead",
  SUPPORT: "Support Staff",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("audit");
  const tab = one(sp.tab) ?? "team";
  const action = one(sp.action)?.trim() || undefined;
  const err = one(sp.err);
  const done = one(sp.done);

  const canEditTeam = canPlatform(s.actor.role, "audit", "edit") || s.actor.role === "OWNER";

  const [staffUsers, auditRows] = await Promise.all([
    listPlatformUsers(s.actor),
    listPlatformAudit(s.actor, { action, limit: 200 }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <h1>Team and audit log</h1>
      </div>

      {err && <div className="notice bad" role="alert">{err}</div>}
      {done && <div className="notice good" role="status">{done}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #E7E7F0", paddingBottom: 2 }}>
        <Link
          href="/audit?tab=team"
          prefetch={false}
          style={{
            padding: "8px 16px",
            borderBottom: tab === "team" ? "3px solid #5B4FE8" : "3px solid transparent",
            color: tab === "team" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Platform Team ({staffUsers.length})
        </Link>
        <Link
          href="/audit?tab=audit"
          prefetch={false}
          style={{
            padding: "8px 16px",
            borderBottom: tab === "audit" ? "3px solid #5B4FE8" : "3px solid transparent",
            color: tab === "audit" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Audit Trail ({auditRows.length})
        </Link>
      </div>

      {/* 1. TEAM MEMBERS TAB */}
      {tab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
              Platform Staff Roster
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 780 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.8fr) 160px 110px 140px 130px",
                    padding: "10px 24px",
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink-3)",
                    letterSpacing: "0.3px",
                  }}
                >
                  <div>STAFF MEMBER</div>
                  <div>ROLE</div>
                  <div>STATUS</div>
                  <div>LAST LOGIN</div>
                  <div style={{ textAlign: "right" }}>ACTIONS</div>
                </div>

                {staffUsers.map((u: PlatformUserView) => (
                  <div
                    key={u.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.8fr) 160px 110px 140px 130px",
                      padding: "14px 24px",
                      alignItems: "center",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 13.5,
                      opacity: u.isActive ? 1 : 0.6,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{u.email}</div>
                    </div>

                    <div>
                      {canEditTeam && u.id !== s.actor.id ? (
                        <form
                          action={async (formData) => {
                            "use server";
                            const role = String(formData.get("role"));
                            await updateStaffRoleAction(u.id, role);
                          }}
                          style={{ margin: 0 }}
                        >
                          <AutoSubmitSelect
                            name="role"
                            defaultValue={u.role}
                            options={[{ value: "OWNER", label: "Platform Owner" }, { value: "FINANCE", label: "Finance" }, { value: "SUPPORT_LEAD", label: "Support Lead" }, { value: "SUPPORT", label: "Support" }]}
                          />
                        </form>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                      )}
                    </div>

                    <div>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: u.isActive ? "#E8F6EE" : "#FCEBEB",
                          color: u.isActive ? "#15803D" : "#DC2626",
                        }}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {u.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      {canEditTeam && u.id !== s.actor.id && (
                        <form action={toggleStaffActiveAction.bind(null, u.id)} style={{ margin: 0 }}>
                          <SubmitButton
                            className={`btn btn-sm ${u.isActive ? "btn-secondary" : "btn-primary"}`}
                            style={{ fontSize: 11.5 }}
                           pending="Working…">
                            {u.isActive ? "Deactivate" : "Activate"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Invite Staff Card */}
          {canEditTeam && (
            <form action={inviteStaffAction} className="card stack" style={{ padding: 24, maxWidth: 640 }}>
              <h2 style={{ fontSize: 16 }}>Invite Platform Staff Member</h2>
              <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
                Grant staff access to manage stores, reconcile payments, review tickets, or access platform settings.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Full Name</span>
                  <input className="input" name="name" required placeholder="John Doe" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Email Address</span>
                  <input className="input" type="email" name="email" required placeholder="staff@biztrack.bd" />
                </label>
              </div>

              <div>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Platform Role</span>
                  <select className="select" name="role" defaultValue="SUPPORT">
                    <option value="SUPPORT">Support (Read tenants, reply to tickets)</option>
                    <option value="SUPPORT_LEAD">Support Lead (Support + Suspend stores & manage announcements)</option>
                    <option value="FINANCE">Finance (Approve payments, manual bank adjustments)</option>
                    <option value="OWNER">Platform Owner (Full administrative access)</option>
                  </select>
                </label>
              </div>

              <div>
                <SubmitButton className="btn btn-primary" pending="Working…">
                  Invite Staff Member
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 2. AUDIT TRAIL TAB */}
      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="page-sub" style={{ margin: 0 }}>
            Immutable chronological record of administrative actions, merchant impersonations, and automated daily sweeps.
          </p>

          <form className="toolbar" method="get" role="search">
            <input type="hidden" name="tab" value="audit" />
            <label className="grow">
              <span className="sr-only">Action</span>
              <input
                className="input"
                name="action"
                defaultValue={action ?? ""}
                placeholder="Filter by action, for example PAYMENT_APPROVED or IMPERSONATE"
              />
            </label>
            <button className="btn btn-secondary" type="submit">Filter</button>
          </form>

          {auditRows.length === 0 ? (
            <div className="card empty">No audit log entries matching this filter.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table" data-testid="audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Who</th>
                    <th>Store</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((r) => (
                    <tr key={r.id}>
                      <td className="muted">{dateTime(r.createdAt)}</td>
                      <td><b>{r.action}</b></td>
                      <td>{r.actorId === "SYSTEM" ? "System" : r.actorId}</td>
                      <td>
                        {r.tenantId ? (
                          <Link href={`/tenants/${r.tenantId}`} className="link" prefetch={false}>
                            Open
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5, maxWidth: 360, overflowWrap: "anywhere" }}>
                        {JSON.stringify(r.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
