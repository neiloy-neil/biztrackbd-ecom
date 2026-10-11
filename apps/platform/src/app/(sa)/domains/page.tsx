import type { Metadata } from "next";
import Link from "next/link";
import { listPlatformDomains, type DomainFilter } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { checkDomainAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domains" };

const TABS: [DomainFilter, string][] = [["connecting", "Connecting"], ["connected", "Connected"], ["all", "All"]];

export default async function Domains({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const tab = (TABS.find((t) => t[0] === one(sp.tab))?.[0] ?? "connecting") as DomainFilter;
  const rows = await listPlatformDomains(s.actor, tab);
  const err = one(sp.err);
  const done = one(sp.done);
  const label = (r: (typeof rows)[number]) => (r.connected ? "Connected" : r.verified ? "Getting certificate" : r.dnsStatus === "found" ? "Record found" : r.dnsStatus === "wrong_record" ? "Wrong record" : "Waiting for DNS");

  return (
    <>
      <div className="page-head"><h1>Domains</h1></div>
      <p className="page-sub">Every store&apos;s own domain. Each one is checked by itself every few minutes. Use Check now to look again right away.</p>
      <nav className="tabs" aria-label="Status">
        {TABS.map(([k, l]) => <Link key={k} href={`/domains?tab=${k}`} aria-current={k === tab ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Checked just now.</div>}
      {rows.length === 0 ? <div className="card empty" data-testid="domains-empty">Nothing here.</div> : (
        <div className="stack">
          {rows.map((r) => (
            <section key={r.id} className="card" data-testid="domain-card" data-domain={r.domain}>
              <div className="card-head">
                <h2 style={{ overflowWrap: "anywhere" }}>{r.domain}</h2>
                <span className={`pill ${r.connected ? "ok" : r.dnsStatus === "wrong_record" ? "bad" : "warn"}`} data-testid="domain-status">{label(r)}</span>
              </div>
              <dl className="kv">
                <dt>Store</dt><dd><Link href={`/tenants/${r.tenantId}`} className="link" prefetch={false}>{r.storeName}</Link> · {r.subdomain}</dd>
                <dt>Added</dt><dd>{dateTime(r.createdAt)}</dd>
                <dt>Last checked</dt><dd>{r.lastCheckedAt ? dateTime(r.lastCheckedAt) : "Not yet"}</dd>
                <dt>Certificate</dt><dd>{r.sslStatus}</dd>
                {r.dnsNote && !r.connected && (<><dt>What we see</dt><dd>{r.dnsNote}</dd></>)}
              </dl>
              {!r.connected && <form action={checkDomainAction.bind(null, r.id)} style={{ marginTop: 10 }}><SubmitButton className="btn btn-secondary" pending="Checking…">Check now</SubmitButton></form>}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
