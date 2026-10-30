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
        title="Custom Domains"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Domains" }]}
        sub={<>Your store is always at <b>{s.tenantSubdomain}.{root}</b>. Add your own domain, like yourshop.com, and customers will see that instead.</>}
      />
      {err && <div className="notice bad mb-sm" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good mb-sm" role="status">{DONE[done]}</div>}

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
                  <h2 className="text-sm font-bold mb-xs">Create this record where you bought the domain</h2>
                  <div className="grid grid-2 gap-xs my-sm">
                    <div><span className="muted text-xs">Type:</span> <b>{rec.kind}</b></div>
                    <div><span className="muted text-xs">Name:</span> <b>{rec.name}</b></div>
                    <div className="grid-col-all"><span className="muted text-xs">Value:</span> <b className="font-mono text-xs break-all" data-testid="dns-value">{rec.value}</b></div>
                  </div>
                  <ol className="pl-md stack gap-xs text-sm">{rec.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
                </div>
              )}

              {canEdit && (
                <div className="row gap-xs mt-md">
                  {!st.connected && <form action={checkNowAction.bind(null, d.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="Checking…" data-testid="check-now">Check now</SubmitButton></form>}
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
          <h2 className="text-base font-bold m-0">Add a domain</h2>
          <div className="field m-0">
            <label className="label" htmlFor="domain">Your domain</label>
            <input id="domain" className="input font-mono" name="domain" required placeholder="yourshop.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" />
            <div className="muted text-xs mt-xs">Only the name, without https:// or a slash. Custom domains come with the Growth plan and above.</div>
          </div>
          <div><SubmitButton className="btn btn-primary" pending="Adding…">Add domain</SubmitButton></div>
        </form>
      )}
    </>
  );
}
