import Link from "next/link";
import { listAudit } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  ["", "All"],
  ["staff.", "Team"],
  ["integration.", "Integrations"],
  ["product.", "Products"],
  ["order.", "Orders"],
] as const;

function summary(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") || "none" : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; before?: string }>;
}) {
  const { area = "", before } = await searchParams;
  const s = await requireAccess("team");
  const before_ = before ? new Date(before) : undefined;
  const rows = await listAudit(s.tenantId, s.actor, {
    action: area || undefined,
    limit: 50,
    before: before_ && !Number.isNaN(before_.getTime()) ? before_ : undefined,
  });
  const last = rows[rows.length - 1];

  return (
    <>
      <PageHeader
        title="Audit Log"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Audit Log" }]}
        sub="Who changed what. Entries cannot be edited or deleted. Keys and passwords are never recorded."
      />

      <div className="tab-strip mb-3">
        {FILTERS.map(([value, label]) => (
          <Link
            key={label}
            href={value ? `?area=${value}` : "?"}
            className={`tab-btn ${area === value ? "active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-5">
          <p className="muted text-base m-0">No audit log entries recorded in this category yet.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrap">
            <table className="table m-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs whitespace-nowrap">{r.createdAt.toLocaleString("en-GB")}</td>
                    <td className="text-sm font-semibold">
                      {r.actorEmail}
                      {r.ipAddress && <div className="muted font-mono text-xs">{r.ipAddress}</div>}
                    </td>
                    <td>
                      <code className="text-xs">{r.action}</code>
                    </td>
                    <td className="muted text-xs">{summary(r.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 50 && last && (
        <div className="mt-3">
          <Link
            href={`?${area ? `area=${area}&` : ""}before=${last.createdAt.toISOString()}`}
            className="btn btn-secondary btn-sm"
          >
            Older entries →
          </Link>
        </div>
      )}
    </>
  );
}
