/** A small RFC 4180 reader: quoted cells, doubled quotes, commas and newlines inside quotes, CRLF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const BN = "০১২৩৪৫৬৭৮৯";

/** "৳ 1,250.50", "Tk 1250", "(120)", "১২৫০" all read as numbers. Anything else is null. */
export function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
  if (s === "" || s === "-") return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[^\d.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

export const headerKey = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
