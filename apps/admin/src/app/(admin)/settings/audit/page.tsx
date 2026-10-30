import Link from "next/link";
import { listAudit } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";

const FILTERS = [["", "All"], ["staff.", "Team"], ["integration.", "Integrations"], ["product.", "Products"], ["order.", "Orders"]] as const;

function summary(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") || "none" : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ area?: string; before?: string }> }) {
  const { area = "", before } = await searchParams;
  const s = await requireAccess("team");
  const before_ = before ? new Date(before) : undefined;
  const rows = await listAudit(s.tenantId, s.actor, { action: area || undefined, limit: 50, before: before_ && !Number.isNaN(before_.getTime()) ? before_ : undefined });
  const last = rows[rows.length - 1];

  return (
    <>
      <PageHeader
        title="Audit Log"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Audit Log" }]}
        sub="Who changed what. Entries cannot be edited or deleted. Keys and passwords are never recorded."
      />
      <p className="row">
        {FILTERS.map(([value, label]) => (
          <Link key={label} href={value ? `?area=${value}` : "?"} style={{ fontWeight: area === value ? 700 : 400 }}>{label}</Link>
        ))}
      </p>
      {rows.length === 0 ? <p className="muted">Nothing here yet.</p> : (
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.createdAt.toLocaleString("en-GB")}</td>
                <td>{r.actorEmail}{r.ipAddress && <div className="muted">{r.ipAddress}</div>}</td>
                <td><code>{r.action}</code></td>
                <td className="muted">{summary(r.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length === 50 && last && <p><Link href={`?${area ? `area=${area}&` : ""}before=${last.createdAt.toISOString()}`}>Older entries</Link></p>}
    </>
  );
}
