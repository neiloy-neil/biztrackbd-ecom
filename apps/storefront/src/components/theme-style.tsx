import { getLiveTheme, themeCss } from "@biztrackbd/core";

/** The store's colours, corners and font as CSS variables. Only validated values reach the page; an untouched theme writes nothing. */
export async function ThemeStyle({ tenantId }: { tenantId: string }) {
  const css = themeCss(await getLiveTheme(tenantId), "body");
  return css ? <style id="bt-theme" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
