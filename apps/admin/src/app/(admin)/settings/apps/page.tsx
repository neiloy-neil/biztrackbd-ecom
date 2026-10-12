import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import type { Metadata } from "next";
import Link from "next/link";
import { can, listModules } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { setModuleAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apps" };

export default async function Apps({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("billing");
  if (s.demo) return <DemoLocked what="Apps" keepHref={trialHref()} />;
  const canEdit = can(s.user.role, "billing", "edit");
  const l = await listModules(s.tenantId, s.actor);
  const err = one(sp.err);
  return (
    <>
      <div className="page-head"><h1>Apps</h1></div>
      <p className="page-sub">Extra features you can switch on for your store. What you can use depends on your plan.</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="apps-error">{err}</div>}
      {one(sp.done) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Saved.</div>}
      {l.allowance === 0 && <div className="notice info" style={{ marginBottom: 12 }}>Your plan does not include optional apps. <Link href="/billing" className="link" prefetch={false}>See plans</Link></div>}
      <div className="stack" data-testid="apps-list">
        {l.modules.map((m) => (
          <section key={m.key} className="card" data-testid={`app-${m.key}`} style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 260px" }}>
              <b>{m.label}</b>
              <div className="muted" style={{ fontSize: 13 }}>{m.description}</div>
              {m.blocked && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{m.blocked}</div>}
            </div>
            <div className="row">
              <span className={`pill ${m.enabled ? "ok" : "grey"}`}>{m.enabled ? "On" : "Off"}</span>
              {canEdit && !m.blocked && (
                <form action={setModuleAction.bind(null, m.key, !m.enabled)}>
                  <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">{m.enabled ? "Switch off" : "Switch on"}</SubmitButton>
                </form>
              )}
            </div>
          </section>
        ))}
      </div>
      {l.allowance != null && l.allowance > 0 && <p className="muted" style={{ marginTop: 10 }}>{l.used} of {l.allowance} apps in use on your plan.</p>}
    </>
  );
}
