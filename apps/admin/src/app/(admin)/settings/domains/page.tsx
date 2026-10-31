import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import type { Metadata } from "next";
import { can, dnsInstruction, listDomains } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { addDomainAction, checkNowAction, makePrimaryAction, removeDomainAction } from "./actions";
import { DomainWatcher } from "./watcher";
import { SubdomainEditor } from "./subdomain-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domains" };

const DONE: Record<string, string> = { added: "Domain added. Create the record below and we will do the rest.", primary: "Main address changed.", removed: "Domain removed.", checked: "Checked just now.", subdomain_changed: "Store subdomain updated successfully! Your store is now active at your new address." };

function statusOf(d: { verified: boolean; dnsStatus: string; sslStatus: string }): { label: string; tone: "ok" | "warn" | "bad" | "grey"; connected: boolean } {
  if (d.verified && d.sslStatus === "issued" && d.dnsStatus === "verified") return { label: "Connected", tone: "ok", connected: true };
  if (d.verified && d.dnsStatus === "wrong_record") return { label: "The record changed", tone: "bad", connected: false };
  if (d.verified) return { label: "Getting your certificate", tone: "warn", connected: false };
  if (d.dnsStatus === "found") return { label: "Record found, finishing setup", tone: "warn", connected: false };
  if (d.dnsStatus === "wrong_record") return { label: "Wrong record", tone: "bad", connected: false };
  return { label: "Waiting for your DNS record", tone: "grey", connected: false };
}

export default async function Domains({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("billing");
  if (s.demo) return <DemoLocked what="Domains" keepHref={trialHref(s.demo.keep)} />;
  const canEdit = can(s.user.role, "billing", "edit");
  const rows = await listDomains(s.tenantId, s.actor);
  const err = one(sp.err);
  const done = one(sp.done);
  const pending = rows.filter((r) => !statusOf(r).connected).map((r) => r.id);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");

  return (
    <>
      <DomainWatcher pendingIds={canEdit ? pending : []} />
      <PageHeader
        title="Domains"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Domains" }]}
        sub="Manage your free store address and connect branded custom domains."
      />
      {err && <div className="notice bad mb-sm" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good mb-sm" role="status">{DONE[done]}</div>}

      <div className="mb-md">
        <SubdomainEditor currentSubdomain={s.tenantSubdomain} rootDomain={root} canEdit={canEdit} />
      </div>

      <div className="mt-lg mb-sm">
        <h2 className="text-base font-bold m-0">Custom Domains</h2>
        <p className="muted text-xs m-0 mt-xs">Connect your own custom domain (e.g. <code>yourbrand.com</code>) to brand your online store.</p>
      </div>

      {rows.length === 0 && <div className="card empty p-xl text-center" data-testid="domains-empty">You have not added a custom domain yet.</div>}
      <div className="stack gap-md" data-testid="domain-list">
        {rows.map((d) => {
          const st = statusOf(d);
          const rec = dnsInstruction(d.domain);
          return (
            <section key={d.id} className="card p-md" data-testid="domain-card" data-domain={d.domain} data-status={st.connected ? "connected" : "pending"}>
              <div className="card-head flex-between items-center mb-sm">
                <h2 className="text-base font-bold m-0 break-all">{d.domain}</h2>
                <span className={`pill ${st.tone}`} data-testid="domain-status">{st.label}</span>
              </div>
              {d.isPrimary && st.connected && <p className="muted text-sm m-0">This is the primary address customers see.</p>}
              {!st.connected && d.dnsNote && <p className="text-sm text-ink-2 mt-xs" data-testid="domain-note">{d.dnsNote}</p>}
              {st.connected && <p className="text-sm text-ink-2 mt-xs">It works, with a secure padlock. <a className="link" href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">Open {d.domain}</a></p>}

              {!st.connected && (
                <div className="card p-md mt-sm bg-subtle border" data-testid="dns-steps">
                  <h3 className="text-sm font-bold mb-xs" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
                    DNS Records to create at your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
                  </h3>
                  <p className="muted text-xs mb-sm">
                    Log in to where you bought <b>{d.domain}</b>, open <b>DNS Settings / Advanced DNS</b>, and add the record{rec.records.length > 1 ? "s" : ""} below:
                  </p>

                  <div className="table-wrap mb-sm" style={{ overflowX: "auto" }}>
                    <table className="table border" style={{ width: "100%", fontSize: 13, background: "var(--surface)", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px 12px", textAlign: "left", background: "var(--bg)", color: "var(--ink-2)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Type</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", background: "var(--bg)", color: "var(--ink-2)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Host / Name</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", background: "var(--bg)", color: "var(--ink-2)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Value / Target</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", background: "var(--bg)", color: "var(--ink-2)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>TTL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rec.records.map((r, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="pill ok font-mono text-xs" style={{ fontWeight: 700 }}>{r.kind}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <code className="font-mono" style={{ fontWeight: 700, color: "var(--ink)" }}>{r.name}</code>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <code className="font-mono break-all" style={{ fontWeight: 700, color: "var(--brand, #0B4D3B)" }} data-testid={i === 0 ? "dns-value" : undefined}>{r.value}</code>
                              <span className="muted text-xs block mt-xs">{r.purpose}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }} className="muted text-xs">Automatic / 5 min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-xs font-bold text-ink-2 uppercase tracking-wide mb-xs">Setup Instructions:</h4>
                  <ol className="pl-md stack gap-xs text-sm" style={{ margin: 0 }}>
                    {rec.steps.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
              )}

              {canEdit && (
                <div className="row gap-xs mt-md">
                  <form action={checkNowAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="Checking…" data-testid="check-now">{st.connected ? "Re-sync" : "Check now"}</SubmitButton></form>
                  {d.verified && !d.isPrimary && <form action={makePrimaryAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Make this the main address</SubmitButton></form>}
                  <form action={removeDomainAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="Removing…" aria-label={`Remove ${d.domain}`}>Remove</SubmitButton></form>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {canEdit && (
        <form action={addDomainAction} className="card stack mt-md" data-testid="domain-add">
          <h2 className="text-base font-bold m-0">Add a custom domain</h2>
          <div className="field m-0">
            <label className="label" htmlFor="domain">Your domain name</label>
            <input
              id="domain"
              className="input font-mono"
              name="domain"
              required
              placeholder="example: yourshop.com or shop.yourbrand.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
            <div className="muted text-xs mt-xs stack gap-xs">
              <span>Enter only the domain name (without <code>https://</code>, <code>http://</code>, or slashes).</span>
              <span>Adding your root domain (e.g. <code>yourshop.com</code>) enables both <code>yourshop.com</code> and <code>www.yourshop.com</code> with free automatic SSL.</span>
            </div>
          </div>
          <div><SubmitButton className="btn btn-primary" pending="Adding…">Add domain</SubmitButton></div>
        </form>
      )}
    </>
  );
}
