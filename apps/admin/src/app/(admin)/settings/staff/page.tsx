import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { ASSIGNABLE_ROLES, AREAS, PERMISSIONS, ROLE_LABELS, listTeam } from "@biztrackbd/core";
import { Button, PageHeader } from "@biztrackbd/ui";
import { Chip } from "@/lib/chips";
import { requireAccess } from "@/lib/session";
import { changeRoleAction, revokeAction, setActiveAction } from "./actions";
import { InviteForm } from "./invite-form";
import { PendingButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const AREA_LABEL: Record<(typeof AREAS)[number], string> = {
  orders: "Orders and fulfilment",
  products: "Products and inventory",
  customers: "Customers and messages",
  leads: "Inquiries and leads",
  bookings: "Bookings and appointments",
  marketing: "Discounts and marketing",
  reports: "Reports and profit",
  design: "Theme and store design",
  billing: "Payments, domains, billing, keys",
  team: "Team and audit log",
};

export default async function Staff() {
  const s = await requireAccess("team", "edit");
  if (s.demo) return <DemoLocked what="Team" keepHref={trialHref(s.demo.keep)} />;
  const team = await listTeam(s.tenantId, s.actor);
  const full = team.seats.limit != null && team.seats.used >= team.seats.limit;
  const roles = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Team</h1>
      <p className="muted">
        {team.seats.limit == null ? `${team.seats.used} accounts` : `${team.seats.used} of ${team.seats.limit} accounts used on your plan`}. Invites count until they are accepted or removed.
      </p>
      {full && <div className="card" style={{ borderColor: "var(--warning)" }}>You have reached the staff limit on your plan. Upgrade to add more.</div>}
      <InviteForm roles={roles} disabled={full} />

      <table>
        <thead><tr><th>Person</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {team.members.map((m) => {
            const isOwner = m.role === "STORE_OWNER";
            const isMe = m.id === s.user.id;
            return (
              <tr key={m.id}>
                <td><strong>{m.name}</strong><div className="muted">{m.email}</div></td>
                <td>
                  {isOwner || isMe ? ROLE_LABELS[m.role] : (
                    <form action={changeRoleAction.bind(null, m.id)} className="row">
                      <select name="role" aria-label={`Role for ${m.name ?? m.email}`} defaultValue={m.role} style={{ padding: 6 }}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                      <PendingButton variant="secondary" style={{ minHeight: 40, padding: "4px 10px" }} pendingLabel="Working…">Save</PendingButton>
                    </form>
                  )}
                </td>
                <td><Chip value={m.isActive ? "PAID" : "CANCELLED"} /> <span className="muted">{m.isActive ? "Active" : "Inactive"}</span></td>
                <td>
                  {!isOwner && !isMe && (
                    <form action={setActiveAction.bind(null, m.id, !m.isActive)}>
                      <PendingButton variant={m.isActive ? "danger" : "secondary"} style={{ minHeight: 40, padding: "4px 10px" }} pendingLabel="Working…">{m.isActive ? "Deactivate" : "Reactivate"}</PendingButton>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
          {team.invites.map((i) => (
            <tr key={i.id}>
              <td><strong>{i.email}</strong><div className="muted">Invited</div></td>
              <td>{ROLE_LABELS[i.role]}</td>
              <td><Chip value="PENDING" /> <span className="muted">{i.expired ? "Expired" : `Expires ${i.expiresAt.toLocaleDateString("en-GB")}`}</span></td>
              <td><form action={revokeAction.bind(null, i.id)}><PendingButton variant="secondary" style={{ minHeight: 40, padding: "4px 10px" }} pendingLabel="Working…">Remove</PendingButton></form></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>What each role can do</h2>
      <table>
        <thead><tr><th>Area</th>{ASSIGNABLE_ROLES.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}</tr></thead>
        <tbody>
          {AREAS.map((a) => (
            <tr key={a}>
              <td>{AREA_LABEL[a]}</td>
              {ASSIGNABLE_ROLES.map((r) => <td key={r}>{{ none: "None", view: "View", edit: "Edit" }[PERMISSIONS[r][a]]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">The owner always has full access.</p>
    </>
  );
}
