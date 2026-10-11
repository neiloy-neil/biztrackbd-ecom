import { cookies } from "next/headers";
import { setThemeAction } from "./theme-actions";

/** Three buttons: follow the device, light, dark. Works without JavaScript. */
export async function ThemeSwitch() {
  const now = (await cookies()).get("bt_theme")?.value;
  const cur = now === "light" || now === "dark" ? now : "system";
  return (
    <form action={setThemeAction} className="theme-switch" aria-label="Appearance">
      <span className="muted" style={{ fontSize: 12 }}>Appearance</span>
      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
        {([["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => (
          <button key={v} type="submit" name="theme" value={v} className="btn btn-secondary btn-sm" aria-pressed={cur === v} data-testid={`theme-${v}`}>{l}</button>
        ))}
      </div>
    </form>
  );
}
