import type { Metadata } from "next";
import Link from "next/link";
import { listPlatformAudit } from "@biztrackbd/core";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("audit");
  const action = one(sp.action)?.trim() || undefined;
  const rows = await listPlatformAudit(s.actor, { action, limit: 200 });
  return (
    <>
      <div className="page-head"><h1>Audit log</h1></div>
      <p className="page-sub">Everything the platform team and the daily sweep did to a store. It cannot be edited.</p>
      <form className="toolbar" method="get" role="search">
        <label className="grow"><span className="sr-only">Action</span><input className="input" name="action" defaultValue={action ?? ""} placeholder="Filter by action, for example PAYMENT_APPROVED" /></label>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      {rows.length === 0 ? <div className="card empty">Nothing yet.</div> : (
        <table className="table" data-testid="audit-table">
          <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Store</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{dateTime(r.createdAt)}</td>
                <td><b>{r.action}</b></td>
                <td>{r.actorId === "SYSTEM" ? "System" : r.actorId}</td>
                <td>{r.tenantId ? <Link href={`/tenants/${r.tenantId}`} className="link" prefetch={false}>Open</Link> : "—"}</td>
                <td className="muted" style={{ fontSize: 12.5, maxWidth: 320, overflowWrap: "anywhere" }}>{JSON.stringify(r.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
