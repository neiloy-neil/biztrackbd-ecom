import type { TemplateInfo } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { applyTemplateAction } from "./actions";

const PAGES: { key: string; label: string }[] = [{ key: "home", label: "Home" }, { key: "product", label: "Product" }, { key: "collection", label: "Collection" }, { key: "cart", label: "Cart" }];

/**
 * Choose another template for the store (docs/47 part D). The new layouts and style go into the drafts; nothing is live until each page is
 * published. A template drawn with a different look changes the look at once, and the card says so.
 */
export function TemplateSwitcher({ templates, currentLook, currentTemplate, canEdit }: { templates: TemplateInfo[]; currentLook: string; currentTemplate: string | null; canEdit: boolean }) {
  return (
    <section className="bld-group" data-testid="template-switcher">
      <div className="bld-gh">Change template</div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Your products, categories and pages stay. The new layouts and colours go into your drafts so you can look through them first; nothing changes on your live pages until you publish.</p>
      <div className="stack" style={{ gap: 10 }}>
        {templates.map((t) => {
          const current = (currentTemplate ?? currentLook) === t.id;
          const lookChange = t.baseLook !== currentLook;
          return (
            <form key={t.id} action={applyTemplateAction} className="bld-item" data-testid={`template-${t.id}`}>
              <input type="hidden" name="templateId" value={t.id} />
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: 8, background: t.settings.background, border: `3px solid ${t.settings.accent}`, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{t.name}</b> {current && <span className="pill ok">Current</span>}
                  <div className="muted" style={{ fontSize: 12.5 }}>{t.blurb || t.audience}</div>
                </div>
              </div>
              {!current && canEdit && (
                <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="muted" style={{ fontSize: 12.5 }}>Take its layout for</legend>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      {PAGES.map((p) => <label key={p.key} className="check"><input type="checkbox" name="take" value={p.key} defaultChecked /><span>{p.label}</span></label>)}
                    </div>
                  </fieldset>
                  {t.chrome && <label className="check"><input type="checkbox" name="chrome" defaultChecked /><span>Also its header and footer (as a draft you can publish or discard)</span></label>}
                  {lookChange && <div className="notice warn" role="note" style={{ fontSize: 13 }}>This template is drawn with a different look, and that changes on your live store <b>straight away</b>. Your pages show that look's own layouts until you publish the drafts.</div>}
                  <div><SubmitButton className="btn btn-secondary btn-sm" pending="Preparing drafts…">Use this template (as drafts)</SubmitButton></div>
                </div>
              )}
            </form>
          );
        })}
      </div>
    </section>
  );
}
