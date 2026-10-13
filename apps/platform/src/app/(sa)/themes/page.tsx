import type { Metadata } from "next";
import { TEMPLATE_CATEGORIES, canPlatform, listTemplatesForStaff, type StaffTemplateRow } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { publishTemplateAction, setTemplateStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Themes and modules" };

interface ModuleRow {
  name: string;
  desc: string;
  minPlan: string;
  storesEnabled: number;
  enabled: boolean;
}

const MODULES: ModuleRow[] = [
  { name: "Bespoke tailoring", desc: "Measurements, fabrics, fittings", minPlan: "Pro", storesEnabled: 86, enabled: true },
  { name: "Drops and launches", desc: "Countdown, notify me, limits", minPlan: "Pro", storesEnabled: 52, enabled: true },
  { name: "Baby and kids profiles", desc: "Child size reminders", minPlan: "Pro", storesEnabled: 37, enabled: true },
  { name: "Loyalty and referrals", desc: "Points and store credit", minPlan: "Pro", storesEnabled: 64, enabled: true },
  { name: "Booking and appointments", desc: "Fittings and pickups", minPlan: "Pro", storesEnabled: 21, enabled: false },
  { name: "Wholesale prices", desc: "Approved buyers and tiers", minPlan: "Business", storesEnabled: 9, enabled: true },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PUBLISHED: { bg: "#E8F6EE", color: "#15803D", label: "Live" },
  DRAFT: { bg: "#FEF3E2", color: "#92400E", label: "Draft" },
  ARCHIVED: { bg: "#EFEFF6", color: "#5B5B7B", label: "Hidden" },
};

export default async function ThemesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("tenants");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const canSee = canPlatform(s.actor.role, "plans", "view");
  const canEdit = canPlatform(s.actor.role, "plans", "edit");
  const templates: StaffTemplateRow[] = canSee ? await listTemplatesForStaff(s.actor) : [];

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Themes and modules</h1>

      </div>

      {one(sp.err) && <div className="notice bad" role="alert">{one(sp.err)}</div>}
      {one(sp.done) && <div className="notice good" role="status">{one(sp.done)}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }} data-testid="templates-table">
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>Store templates</div>
        {!canSee ? <p className="muted" style={{ padding: 24 }}>Templates are managed by the platform owner.</p> : (
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 200px", padding: "10px 24px", background: "var(--bg)", borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.3px" }}>
              <div>TEMPLATE</div><div>BASED ON</div><div>VERSION</div><div style={{ textAlign: "right" }}>STORES</div><div>STATUS</div><div />
            </div>
            {templates.map((t) => {
              const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.DRAFT!;
              return (
                <div key={t.id} data-testid={`template-${t.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 200px", padding: "10px 24px", minHeight: 64, alignItems: "center", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.name} <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>{t.id}</span></div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.blurb || t.audience}{t.builtIn ? " · built in" : ""}</div>
                  </div>
                  <div style={{ color: "var(--ink-2)" }}>{t.baseLook}</div>
                  <div className="num">{t.version}</div>
                  <div className="num" style={{ textAlign: "right" }}>{t.storesUsing}</div>
                  <div><span style={{ padding: "3px 10px", borderRadius: 11, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {canEdit && t.status !== "ARCHIVED" && <form action={setTemplateStatusAction.bind(null, t.id, "ARCHIVED")}><button type="submit" className="btn btn-secondary btn-sm">Hide</button></form>}
                    {canEdit && t.status === "ARCHIVED" && <form action={setTemplateStatusAction.bind(null, t.id, "PUBLISHED")}><button type="submit" className="btn btn-secondary btn-sm">Show again</button></form>}
                  </div>
                </div>
              );
            })}
          </div></div>
        )}
      </div>

      {canEdit && (
        <form action={publishTemplateAction} className="card stack" style={{ padding: 24 }} data-testid="publish-template">
          <h2 style={{ fontSize: 16 }}>Publish a template from a store</h2>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Build the design in an ordinary store with the visual editor and publish it there (colours, home, product, collection and cart pages). Then name that store here.
            The template takes what is <b>live</b> in that store. Use an existing id to publish the next version: stores already using it are offered the update and choose when to take it.
            A template is drawn with the look of the store it is taken from.
          </p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}><span className="label">Workshop store address</span><input className="input" name="store" required placeholder="my-workshop" /></label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}><span className="label">Template id</span><input className="input" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="eid-kapor" /></label>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}><span className="label">Name</span><input className="input" name="name" required maxLength={60} placeholder="Eid Kapor" /></label>
          </div>
          <label className="field" style={{ margin: 0 }}><span className="label">One line for the gallery</span><input className="input" name="blurb" maxLength={200} /></label>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}><span className="label">Who it is for</span><input className="input" name="audience" maxLength={80} /></label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}><span className="label">Category</span><select className="select" name="category" defaultValue="other">{TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}><span className="label">Tags (comma separated)</span><input className="input" name="tags" placeholder="Eid, Panjabi" /></label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}><span className="label">Feature label</span><input className="input" name="moduleLabel" maxLength={40} placeholder="Size guide" /></label>
          </div>
          <div><button type="submit" className="btn btn-primary" data-testid="publish-template-go">Publish template</button></div>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Modules
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) 130px 110px 120px 90px",
            padding: "10px 24px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-3)",
            letterSpacing: "0.3px",
          }}
        >
          <div>MODULE</div>
          <div>MIN PLAN</div>
          <div style={{ textAlign: "right" }}>ENABLED STORES</div>
          <div>FLAG</div>
          <div></div>
        </div>
        {MODULES.map((m) => (
          <div
            key={m.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) 130px 110px 120px 90px",
              padding: "0 24px",
              height: 60,
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              fontSize: 13.5,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{m.desc}</div>
            </div>
            <div style={{ color: "var(--ink-2)" }}>{m.minPlan}</div>
            <div className="num" style={{ textAlign: "right" }}>{m.storesEnabled}</div>
            <div>
              <div
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: m.enabled ? "var(--brand)" : "#D5D5E4",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: m.enabled ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#fff",
                    transition: "left 0.15s ease",
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
              Edit
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--tint)", borderRadius: 12, padding: "16px 20px", fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
        <b style={{ color: "var(--ink)" }}>How releases work.</b> A new theme version rolls out to 5% of stores first, then 25%, then everyone. Stores can keep their current version for 30 days. Their own edits are never overwritten.
      </div>
    </div>
  );
}
