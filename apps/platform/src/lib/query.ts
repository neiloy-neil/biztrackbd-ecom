/** Builds a query string from the non-empty values, for tab, filter and pager links. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && !(k === "page" && String(v) === "1")) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
export const pageOf = (v: string | undefined) => Math.min(Math.max(parseInt(v ?? "1", 10) || 1, 1), 1000);
