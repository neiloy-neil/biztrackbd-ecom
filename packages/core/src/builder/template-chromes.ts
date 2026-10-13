import { defaultChrome, validateChrome, type Chrome, type ColumnType } from "./chrome";

/**
 * The header and footer a template carries (docs/47). Only the layout and the style: where the logo sits, the search, the announcement bar's
 * colours, and which footer blocks there are. Words and links stay the store's own: the logo, phone, address and menu come from its settings,
 * so a template never brings someone else's text.
 */

/** Cleans a header and footer for use as a template's: store-specific words and links are removed, the layout and colours stay. */
export function templateChrome(raw: unknown): Chrome {
  const c = validateChrome(raw);
  const keep: ColumnType[] = ["about", "shop", "help", "contact", "social", "payments"];
  const columns = c.footer.columns.filter((col) => keep.includes(col.type)).map((col) => ({ ...col, title: "", titleBn: "", body: "", bodyBn: "", links: [] }));
  return validateChrome({
    ...c,
    header: { ...c.header, announcement: { ...c.header.announcement, mode: c.header.announcement.mode === "off" ? "off" : "settings", text: "", textBn: "", link: "" } },
    menu: { auto: true, items: [] },
    footer: { columns: columns.length ? columns : defaultChrome().footer.columns, copyright: "", copyrightBn: "" },
  });
}

const cols = (...types: ColumnType[]) => types.map((type) => ({ id: type, type, title: "", titleBn: "", body: "", bodyBn: "", links: [] }));

function make(header: Partial<Chrome["header"]>, bar: { bgColor: string; textColor: string }, ...types: ColumnType[]): Chrome {
  const d = defaultChrome();
  return templateChrome({ ...d, header: { ...d.header, ...header, announcement: { ...d.header.announcement, mode: "settings", ...bar } }, footer: { columns: cols(...types), copyright: "", copyrightBn: "" } });
}

/** One header and footer for each of the six original templates, matched to the look. */
export const BUILT_IN_CHROMES: Record<string, Chrome> = {
  kapor: make({ logo: "center", search: "icon" }, { bgColor: "#2B2118", textColor: "#FFFFFF" }, "about", "shop", "help", "social"),
  gadgetstudio: make({ logo: "left", search: "bar" }, { bgColor: "#101828", textColor: "#FFFFFF" }, "shop", "help", "contact", "payments"),
  "mini-bunny": make({ logo: "stacked", search: "bar" }, { bgColor: "#C24173", textColor: "#FFFFFF" }, "about", "shop", "help", "social"),
  axionwear: make({ logo: "left", search: "icon" }, { bgColor: "#D7FF3F", textColor: "#0B0D0F" }, "shop", "help", "social"),
  bindu: make({ logo: "center", search: "icon" }, { bgColor: "#8A2855", textColor: "#FFFFFF" }, "about", "shop", "contact", "social"),
  berber: make({ logo: "stacked", search: "icon" }, { bgColor: "#C9A24B", textColor: "#0D121E" }, "about", "shop", "contact", "payments"),
};
