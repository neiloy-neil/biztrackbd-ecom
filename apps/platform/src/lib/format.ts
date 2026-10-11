/** ৳ 1,24,680 style (Bangladeshi digit grouping, as on the canvas). Whole taka unless there are paisa. */
export function taka(n: number | string | { toString(): string }): string {
  const v = Number(n.toString());
  const whole = Number.isInteger(v);
  return `৳ ${v.toLocaleString("en-IN", whole ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TZ = "Asia/Dhaka";

/** "10 Oct, 10:42 am" in Bangladesh time. */
export function dateTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(x)}, ${new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(x).toLowerCase()}`;
}

/** "Today, 10:42 am", "Yesterday", or "8 Oct". */
export function friendlyDate(d: Date | string, now = new Date()): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const day = (v: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(v);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(x).toLowerCase();
  if (day(x) === day(now)) return `Today, ${time}`;
  if (day(x) === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(x);
}

export function dateOnly(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(typeof d === "string" ? new Date(d) : d);
}

/** 01712345678 -> 01712-345678 */
export const prettyPhone = (p: string) => (p.length === 11 ? `${p.slice(0, 5)}-${p.slice(5)}` : p);

/** For an input's value attribute (yyyy-mm-dd) from a date in Bangladesh time. */
export const isoDay = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) : "");
