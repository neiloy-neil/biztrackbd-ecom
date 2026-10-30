import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { ASSIGNABLE_ROLES, AREAS, PERMISSIONS, ROLE_LABELS, listTeam } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
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
      <PageHeader
        title="Team & Access Control"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Team" }]}
        sub={
          team.seats.limit == null
            ? `${team.seats.used} accounts active.`
            : `${team.seats.used} of ${team.seats.limit} accounts used on your plan. Invites count until they are accepted or removed.`
        }
      />

      {full && <div className="notice warn mb-md">You have reached the staff limit on your plan. Upgrade to add more.</div>}
      <InviteForm roles={roles} disabled={full} />

      <section className="card p-0 overflow-hidden mt-md mb-lg">
        <div className="table-wrap">
          <table className="table m-0">
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th className="r"></th></tr></thead>
            <tbody>
              {team.members.map((m) => {
                const isOwner = m.role === "STORE_OWNER";
                const isMe = m.id === s.user.id;
                return (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong><div className="muted text-xs">{m.email}</div></td>
                    <td>
                      {isOwner || isMe ? (
                        <span className="font-semibold text-sm">{ROLE_LABELS[m.role]}</span>
                      ) : (
                        <form action={changeRoleAction.bind(null, m.id)} className="row items-center gap-xs">
                          <select name="role" aria-label={`Role for ${m.name ?? m.email}`} defaultValue={m.role} className="select">
                            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <PendingButton variant="secondary" pendingLabel="Working…">Save</PendingButton>
                        </form>
                      )}
                    </td>
                    <td><Chip value={m.isActive ? "PAID" : "CANCELLED"} /> <span className="muted text-xs ml-xs">{m.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="r">
                      {!isOwner && !isMe && (
                        <form action={setActiveAction.bind(null, m.id, !m.isActive)}>
                          <PendingButton variant={m.isActive ? "danger" : "secondary"} pendingLabel="Working…">{m.isActive ? "Deactivate" : "Reactivate"}</PendingButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {team.invites.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.email}</strong><div className="muted text-xs">Invited</div></td>
                  <td>{ROLE_LABELS[i.role]}</td>
                  <td><Chip value="PENDING" /> <span className="muted text-xs ml-xs">{i.expired ? "Expired" : `Expires ${i.expiresAt.toLocaleDateString("en-GB")}`}</span></td>
                  <td className="r">
                    <form action={revokeAction.bind(null, i.id)}>
                      <PendingButton variant="secondary" pendingLabel="Working…">Remove</PendingButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="p-md border-bottom">
          <h2 className="text-base font-bold m-0">Role Permissions Matrix</h2>
        </div>
        <div className="table-wrap">
          <table className="table m-0">
            <thead><tr><th>Area</th>{ASSIGNABLE_ROLES.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a}>
                  <td className="font-semibold">{AREA_LABEL[a]}</td>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <td key={r}>
                      <span className={`pill ${PERMISSIONS[r][a] === "edit" ? "ok" : PERMISSIONS[r][a] === "view" ? "info" : "grey"}`}>
                        {{ none: "None", view: "View Only", edit: "Full Access" }[PERMISSIONS[r][a]]}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-sm bg-subtle text-xs text-ink-3">The store owner always retains unrestricted full access across all modules.</div>
      </section>
    </>
  );
}
