import { STORE_THEMES, type ThemeId } from "@biztrackbd/core";
import { activateThemeAction } from "./actions";

const swatch: Record<ThemeId, string> = {
  kapor: "linear-gradient(135deg,#E9DCCB 0 50%,#8C5A3C 50%)",
  gadgetstudio: "linear-gradient(135deg,#F6F8FC 0 50%,#155EEF 50%)",
  "mini-bunny": "linear-gradient(135deg,#FFF0E8 0 50%,#C24173 50%)",
  axionwear: "linear-gradient(135deg,#0B0D0F 0 50%,#D7FF3F 50%)",
  bindu: "linear-gradient(135deg,#FFF2F5 0 50%,#8A2855 50%)",
  berber: "linear-gradient(135deg,#0D121E 0 50%,#C9A24B 50%)",
};

export function ThemePicker({ active, canEdit }: { active: ThemeId; canEdit: boolean }) {
  return (
    <section className="card" data-testid="theme-picker">
      <div style={{ marginBottom: 10 }}><b>Storefront template</b><div className="muted" style={{ fontSize: 13 }}>Changing the template keeps products, orders and content. Each template keeps its own design history.</div></div>
      <div style={{ display: "grid", gap: 8 }}>
        {STORE_THEMES.map((theme) => (
          <form action={activateThemeAction} key={theme.id}>
            <input type="hidden" name="themeId" value={theme.id} />
            <button
              type="submit"
              disabled={!canEdit || active === theme.id}
              aria-pressed={active === theme.id}
              className="btn btn-secondary"
              data-testid={`store-theme-${theme.id}`}
              style={{ width: "100%", minHeight: 58, justifyContent: "flex-start", textAlign: "left", padding: 8 }}
            >
              <span aria-hidden="true" style={{ width: 42, height: 42, flex: "0 0 auto", borderRadius: 8, background: swatch[theme.id], border: "1px solid var(--line)" }} />
              <span style={{ display: "block", lineHeight: 1.25 }}><b>{theme.name}</b><br /><span className="muted" style={{ fontSize: 12 }}>{theme.audience}</span></span>
              {active === theme.id && <span className="pill ok" style={{ marginLeft: "auto" }}>Active</span>}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
