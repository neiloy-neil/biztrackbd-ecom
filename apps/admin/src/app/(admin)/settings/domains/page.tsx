import type { Metadata } from "next";
import { can, dnsInstruction, listDomains } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { addDomainAction, checkNowAction, makePrimaryAction, removeDomainAction } from "./actions";
import { DomainWatcher } from "./watcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domains" };

const DONE: Record<string, string> = { added: "Domain added. Create the record below and we will do the rest.", primary: "Main address changed.", removed: "Domain removed.", checked: "Checked just now." };

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
  const canEdit = can(s.user.role, "billing", "edit");
  const rows = await listDomains(s.tenantId, s.actor);
  const err = one(sp.err);
  const done = one(sp.done);
  const pending = rows.filter((r) => !statusOf(r).connected).map((r) => r.id);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  return (
    <>
      <DomainWatcher pendingIds={canEdit ? pending : []} />
      <div className="page-head"><h1>Domains</h1></div>
      <p className="page-sub">Your store is always at <b>{s.tenantSubdomain}.{root}</b>. Add your own domain, like yourshop.com, and customers will see that instead.</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{DONE[done]}</div>}

      {rows.length === 0 && <div className="card empty" data-testid="domains-empty">You have not added a domain yet.</div>}
      <div className="stack" data-testid="domain-list">
        {rows.map((d) => {
          const st = statusOf(d);
          const rec = dnsInstruction(d.domain);
          return (
            <section key={d.id} className="card" data-testid="domain-card" data-domain={d.domain} data-status={st.connected ? "connected" : "pending"}>
              <div className="card-head">
                <h2 style={{ overflowWrap: "anywhere" }}>{d.domain}</h2>
                <span className={`pill ${st.tone}`} data-testid="domain-status">{st.label}</span>
              </div>
              {d.isPrimary && st.connected && <p className="muted" style={{ fontSize: 13 }}>This is the address customers see.</p>}
              {!st.connected && d.dnsNote && <p style={{ marginTop: 6 }} data-testid="domain-note">{d.dnsNote}</p>}
              {st.connected && <p style={{ marginTop: 6 }}>It works, with a secure padlock. <a className="link" href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">Open {d.domain}</a></p>}

              {!st.connected && (
                <div className="card" style={{ marginTop: 10, background: "var(--bg)" }} data-testid="dns-steps">
                  <h2 style={{ fontSize: 14 }}>Create this record where you bought the domain</h2>
                  <dl className="kv" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: "6px 0 10px" }}>
                    <dt className="muted">Type</dt><dd><b>{rec.kind}</b></dd>
                    <dt className="muted">Name</dt><dd><b>{rec.name}</b></dd>
                    <dt className="muted">Value</dt><dd><b style={{ overflowWrap: "anywhere" }} data-testid="dns-value">{rec.value}</b></dd>
                  </dl>
                  <ol style={{ paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>{rec.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
                </div>
              )}

              {canEdit && (
                <div className="row" style={{ marginTop: 12 }}>
                  {!st.connected && <form action={checkNowAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary" pending="Checking…" data-testid="check-now">Check now</SubmitButton></form>}
                  {d.verified && !d.isPrimary && <form action={makePrimaryAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary" pending="…">Make this the main address</SubmitButton></form>}
                  <form action={removeDomainAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary" pending="Removing…" aria-label={`Remove ${d.domain}`}>Remove</SubmitButton></form>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {canEdit && (
        <form action={addDomainAction} className="card stack" style={{ marginTop: 14 }} data-testid="domain-add">
          <h2>Add a domain</h2>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="domain">Your domain</label>
            <input id="domain" className="input" name="domain" required placeholder="yourshop.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Only the name, without https:// or a slash. Custom domains come with the Growth plan and above.</div>
          </div>
          <div><SubmitButton pending="Adding…">Add domain</SubmitButton></div>
        </form>
      )}
    </>
  );
}
