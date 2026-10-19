import type { Metadata } from "next";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import {
  TEMPLATE_CATEGORIES,
  canPlatform,
  listTemplatesForStaff,
  listWorkshopStores,
  BUNDLE_VERTICALS,
  type WorkshopStore,
  getAppCatalogWithTelemetry,
  type StaffTemplateRow,
  type ManagedAppCatalogItem,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import {
  publishTemplateAction,
  uploadTemplateFileAction,
  createWorkshopAction,
  openWorkshopEditorAction,
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

  const [templates, modules, workshops]: [StaffTemplateRow[], ManagedAppCatalogItem[], WorkshopStore[]] = await Promise.all([
    canSee ? listTemplatesForStaff(s.actor) : Promise.resolve([]),
    getAppCatalogWithTelemetry(s.actor),
    canSee ? listWorkshopStores(s.actor).catch(() => []) : Promise.resolve([]),
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
            <div style={{ minWidth: 920 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 300px",
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
                      gridTemplateColumns: "minmax(0, 1.6fr) 110px 70px 110px 110px 300px",
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
                      <a className="btn btn-secondary btn-sm" href={`/themes/export/${t.id}`} download>Download</a>
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
        <div className="card stack" style={{ padding: 24 }} data-testid="template-studio">
          <h2 style={{ fontSize: 16 }}>Template studio</h2>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Design a template in the real visual editor. Make a workshop store, open its editor, build the pages, then save it as a template below.
            Stores and business sites both work; a business workshop also carries its extra pages (menu, reservations, and so on).
          </p>
          {workshops.length > 0 && (
            <div className="stack" style={{ gap: 8 }} data-testid="workshops">
              {workshops.map((w) => (
                <div key={w.tenantId} className="row" style={{ gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  <div>
                    <b>{w.name}</b>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{w.subdomain} · {w.siteMode === "ECOMMERCE" ? "Store" : `Business · ${w.businessVertical}`}</div>
                  </div>
                  <form action={openWorkshopEditorAction.bind(null, w.tenantId)}>
                    <button type="submit" className="btn btn-secondary btn-sm" data-testid={`open-workshop-${w.subdomain}`}>Open editor</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createWorkshopAction} className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 180px" }}>
              <span className="label">Workshop name</span>
              <input className="input" name="name" required maxLength={60} placeholder="Eid fashion workshop" />
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 140px" }}>
              <span className="label">Address word</span>
              <input className="input" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="eid-fashion" />
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}>
              <span className="label">Start from</span>
              <select className="select" name="startFrom" defaultValue="">
                <option value="">Default look</option>
                {templates.filter((t) => t.status === "PUBLISHED").map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 140px" }}>
              <span className="label">Kind</span>
              <select className="select" name="siteMode" defaultValue="ECOMMERCE">
                <option value="ECOMMERCE">Online store</option>
                <option value="PORTFOLIO">Business site</option>
              </select>
            </label>
            <label className="field" style={{ margin: 0, flex: "1 1 160px" }}>
              <span className="label">Business type (business only)</span>
              <select className="select" name="vertical" defaultValue="">
                <option value="">None</option>
                {BUNDLE_VERTICALS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" data-testid="create-workshop-go">Create workshop</button>
          </form>
        </div>
      )}

      {canEdit && (
        <form action={uploadTemplateFileAction} className="card stack" style={{ padding: 24 }} data-testid="upload-template">
          <h2 style={{ fontSize: 16 }}>Upload a template file</h2>
          <p className="muted" style={{ fontSize: 13.5 }}>
            One .json file: colours, page layouts, header and footer, business pages and preview pictures. Download any template above to see the format.
            Once live it appears in the marketing gallery and signup, and each merchant can apply it from their design screen, then edit it. Merchants already using
            it are offered the new version as drafts and never lose their own edits.
          </p>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Template file</span>
            <input className="input" type="file" name="file" accept="application/json,.json" required />
          </label>
          <label className="row" style={{ gap: 8, fontSize: 13.5 }}>
            <input type="checkbox" name="draft" /> Save as a draft (do not show it yet)
          </label>
          <div>
            <button type="submit" className="btn btn-primary" data-testid="upload-template-go">Upload template</button>
          </div>
        </form>
      )}

      {canEdit && (
        <form action={publishTemplateAction} className="card stack" style={{ padding: 24 }} data-testid="publish-template">
          <h2 style={{ fontSize: 16 }}>Save a workshop as a template</h2>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Takes the workshop's live design (colours, home, product, collection and cart pages, header and footer, and a business site's extra pages) and makes it a template, or a new version of one. Publish the pages in the editor first. Saving again with the same id keeps its preview pictures.
          </p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0, flex: "1 1 200px" }}>
              <span className="label">Workshop store address</span>
              <input className="input" name="store" required list="workshop-addresses" placeholder="ws-eid-fashion" />
              <datalist id="workshop-addresses">{workshops.map((w) => <option key={w.tenantId} value={w.subdomain} />)}</datalist>
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
