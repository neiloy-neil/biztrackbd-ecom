import type { Metadata } from "next";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import {
  TEMPLATE_CATEGORIES,
  canPlatform,
  listTemplatesForStaff,
  getAppCatalogWithTelemetry,
  type StaffTemplateRow,
  type ManagedAppCatalogItem,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import {
  publishTemplateAction,
  setTemplateStatusAction,
  toggleModuleMaintenanceAction,
  setModulePlanOverrideAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Themes and modules" };

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PUBLISHED: { bg: "#E8F6EE", color: "#15803D", label: "Live" },
  DRAFT: { bg: "#FEF3E2", color: "#92400E", label: "Draft" },
  ARCHIVED: { bg: "#EFEFF6", color: "#5B5B7B", label: "Hidden" },
};

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireAccess("tenants");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const canSee = canPlatform(s.actor.role, "plans", "view");
  const canEdit = canPlatform(s.actor.role, "plans", "edit");

  const [templates, modules]: [StaffTemplateRow[], ManagedAppCatalogItem[]] = await Promise.all([
    canSee ? listTemplatesForStaff(s.actor) : Promise.resolve([]),
    getAppCatalogWithTelemetry(s.actor),
  ]);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Themes and modules</h1>
      </div>

      {one(sp.err) && <div className="notice bad" role="alert">{one(sp.err)}</div>}
      {one(sp.done) && <div className="notice good" role="status">{one(sp.done)}</div>}

      {/* Store Templates Card */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }} data-testid="templates-table">
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Store templates
        </div>
        {!canSee ? (
          <p className="muted" style={{ padding: 24 }}>Templates are managed by the platform owner.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 820 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 200px",
                  padding: "10px 24px",
                  background: "var(--bg)",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-3)",
                  letterSpacing: "0.3px",
                }}
              >
                <div>TEMPLATE</div>
                <div>BASED ON</div>
                <div>VERSION</div>
                <div style={{ textAlign: "right" }}>STORES</div>
                <div>STATUS</div>
                <div />
              </div>
              {templates.map((t) => {
                const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.DRAFT!;
                return (
                  <div
                    key={t.id}
                    data-testid={`template-${t.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 200px",
                      padding: "10px 24px",
                      minHeight: 64,
                      alignItems: "center",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 13.5,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {t.id} {t.moduleLabel && `· ${t.moduleLabel}`}
                      </div>
                    </div>
                    <div>{t.baseLook}</div>
                    <div className="num">v{t.version}</div>
                    <div className="num" style={{ textAlign: "right" }}>{t.storesUsing}</div>
                    <div>
                      <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      {canEdit && t.status !== "PUBLISHED" && (
                        <form action={setTemplateStatusAction.bind(null, t.id, "PUBLISHED")}>
                          <button type="submit" className="btn btn-secondary btn-sm">Publish</button>
                        </form>
                      )}
                      {canEdit && t.status !== "ARCHIVED" && (
                        <form action={setTemplateStatusAction.bind(null, t.id, "ARCHIVED")}>
                          <button type="submit" className="btn btn-secondary btn-sm">Archive</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {canEdit && (
        <form action={publishTemplateAction} className="card stack" style={{ padding: 24 }} data-testid="publish-template">
          <h2 style={{ fontSize: 16 }}>Publish a template from a store</h2>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Build the design in an ordinary store with the visual editor and publish it there (colours, home, product, collection and cart pages).
          </p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}>
              <span className="label">Workshop store address</span>
              <input className="input" name="store" required placeholder="my-workshop" />
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}>
              <span className="label">Template id</span>
              <input className="input" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="eid-kapor" />
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}>
              <span className="label">Name</span>
              <input className="input" name="name" required maxLength={60} placeholder="Eid Kapor" />
            </label>
          </div>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">One line for the gallery</span>
            <input className="input" name="blurb" maxLength={200} />
          </label>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}>
              <span className="label">Category</span>
              <select className="select" name="category" defaultValue="other">
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}>
              <span className="label">Tags (comma separated)</span>
              <input className="input" name="tags" placeholder="Eid, Panjabi" />
            </label>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" data-testid="publish-template-go">
              Publish template
            </button>
          </div>
        </form>
      )}

      {/* Global App Catalog & Modules Telemetry Card */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }} data-testid="modules-catalog-table">
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          App Catalog & Global Module Control
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.8fr) 110px 100px 140px 160px 140px",
                padding: "10px 24px",
                background: "var(--bg)",
                borderBottom: "1px solid var(--line)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-3)",
                letterSpacing: "0.3px",
              }}
            >
              <div>APP / MODULE</div>
              <div>CATEGORY</div>
              <div style={{ textAlign: "right" }}>ACTIVE STORES</div>
              <div>MIN PLAN</div>
              <div>SYSTEM STATUS</div>
              <div style={{ textAlign: "right" }}>ACTIONS</div>
            </div>

            {modules.map((m) => (
              <div
                key={m.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.8fr) 110px 100px 140px 160px 140px",
                  padding: "14px 24px",
                  alignItems: "center",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13.5,
                  background: m.isGloballyDisabled ? "#FFFBF0" : "transparent",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    {m.label}
                    {m.badge && (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "var(--tint)", color: "var(--brand)", fontWeight: 700 }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                    Key: <code>{m.key}</code> · {m.tierLabel}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
                  {m.categoryLabel}
                </div>

                <div className="num" style={{ textAlign: "right", fontWeight: 700 }}>
                  {m.storesActive}
                </div>

                <div>
                  {canEdit ? (
                    <form action={setModulePlanOverrideAction} style={{ margin: 0 }}>
                      <input type="hidden" name="moduleKey" value={m.key} />
                      <AutoSubmitSelect
                        name="minPlan"
                        defaultValue={m.effectiveMinPlan}
                        options={[{ value: "STARTER", label: "Starter" }, { value: "PRO", label: "Pro" }, { value: "BUSINESS", label: "Business" }, { value: "DEFAULT", label: `Default (${m.minPlan || "PRO"})` }]}
                      />
                    </form>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{m.effectiveMinPlan}</span>
                  )}
                </div>

                <div>
                  {m.isGloballyDisabled ? (
                    <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "#FEF3E2", color: "#92400E" }}>
                      Maintenance
                    </span>
                  ) : (
                    <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "#E8F6EE", color: "#15803D" }}>
                      Operational
                    </span>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  {canEdit && (
                    <form action={toggleModuleMaintenanceAction} style={{ margin: 0 }}>
                      <input type="hidden" name="moduleKey" value={m.key} />
                      <input type="hidden" name="isUnderMaintenance" value={m.isGloballyDisabled ? "false" : "true"} />
                      <button
                        type="submit"
                        className={`btn btn-sm ${m.isGloballyDisabled ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: 11.5 }}
                      >
                        {m.isGloballyDisabled ? "Lift Maintenance" : "Kill-Switch"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
