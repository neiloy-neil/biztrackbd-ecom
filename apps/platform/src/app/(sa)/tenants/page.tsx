import type { Metadata } from "next";
import Link from "next/link";
import { ACCESS_LABELS, listTenants, type TenantFilter } from "@biztrackbd/core";
import { Pager } from "@/components/ui";
import { dateOnly, prettyPhone } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stores" };

const FILTERS: [TenantFilter, string][] = [["all", "All"], ["trial", "Trials"], ["paying", "Paying"], ["overdue", "Overdue"], ["locked", "Read-only or locked"], ["flagged", "Flagged"]];
const TONE: Record<string, string> = { TRIAL: "info", ACTIVE: "ok", GRACE: "warn", READ_ONLY: "bad", LOCKED: "bad" };

export default async function Tenants({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const filter = (FILTERS.find((f) => f[0] === one(sp.filter))?.[0] ?? "all") as TenantFilter;
  const q = one(sp.q)?.trim() ?? "";
  const page = pageOf(one(sp.page));
  const list = await listTenants(s.actor, { q: q || undefined, filter, page });
  const base = { q, filter: filter === "all" ? undefined : filter };
  return (
    <>
      <div className="page-head"><h1>Stores</h1></div>
      <nav className="tabs" aria-label="Filter">
        {FILTERS.map(([k, l]) => <Link key={k} href={`/tenants${qs({ ...base, filter: k === "all" ? undefined : k })}`} aria-current={k === filter ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>
      <form className="toolbar" method="get" role="search">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <label className="grow"><span className="sr-only">Search stores</span><input className="input" type="search" name="q" defaultValue={q} placeholder="Store name, address, domain, owner email or phone" /></label>
        <button className="btn btn-secondary" type="submit">Search</button>
      </form>
      {list.rows.length === 0 ? <div className="card empty" data-testid="tenants-empty">No stores match.</div> : (
        <table className="table" data-testid="tenants-table">
          <thead><tr><th>Store</th><th>Owner</th><th>Plan</th><th>State</th><th>Since</th></tr></thead>
          <tbody>
            {list.rows.map((t) => (
              <tr key={t.id} data-testid="tenant-row">
                <td><Link href={`/tenants/${t.id}`} className="link" prefetch={false}>{t.name}</Link><div className="muted" style={{ fontSize: 12.5 }}>{t.subdomain}</div>{t.quarantined && <span className="pill warn">Flagged</span>}</td>
                <td>{t.ownerName ?? "—"}<div className="muted" style={{ fontSize: 12.5 }}>{t.ownerEmail}{t.ownerPhone ? ` · ${prettyPhone(t.ownerPhone)}` : ""}</div></td>
                <td>{t.tier.charAt(0) + t.tier.slice(1).toLowerCase()}</td>
                <td><span className={`pill ${TONE[t.access.state] ?? "grey"}`}>{ACCESS_LABELS[t.access.state]}</span>{t.access.suspendedByPlatform && <div className="muted" style={{ fontSize: 12.5 }}>Switched off by us</div>}</td>
                <td className="muted">{dateOnly(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/tenants" params={base} />
    </>
  );
}
