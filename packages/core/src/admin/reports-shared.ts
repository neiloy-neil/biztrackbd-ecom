import { ValidationError } from "../errors";
import { addDays, dhakaDate } from "./dashboard";

export { REPORT_PRESETS } from "./reports-presets";
import { REPORT_PRESETS } from "./reports-presets";

export interface ResolvedReportRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  days: number;
  prevFrom: string; // YYYY-MM-DD
  prevTo: string;   // YYYY-MM-DD
  presetKey: string;
  label: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 400;

/** Resolves standard presets or custom 'from'/'to' ranges in Bangladesh Time (Asia/Dhaka). */
export function resolveReportRange(
  params: { range?: string | null; from?: string | null; to?: string | null },
  now = new Date()
): ResolvedReportRange {
  const today = dhakaDate(now);
  const yesterday = addDays(today, -1);

  let from = addDays(today, -29);
  let to = today;
  let presetKey = "30";

  const requestedKey = params.range?.toLowerCase().trim();

  if (params.from || params.to) {
    if (!params.from || !params.to || !DATE_REGEX.test(params.from) || !DATE_REGEX.test(params.to)) {
      throw new ValidationError("Choose valid 'From' and 'To' dates in YYYY-MM-DD format");
    }
    if (params.from > params.to) {
      throw new ValidationError("'From' date must be before or equal to 'To' date");
    }
    from = params.from;
    to = params.to;
    presetKey = "custom";
  } else if (requestedKey === "today") {
    from = today;
    to = today;
    presetKey = "today";
  } else if (requestedKey === "yesterday") {
    from = yesterday;
    to = yesterday;
    presetKey = "yesterday";
  } else if (requestedKey === "7") {
    from = addDays(today, -6);
    to = today;
    presetKey = "7";
  } else if (requestedKey === "30") {
    from = addDays(today, -29);
    to = today;
    presetKey = "30";
  } else if (requestedKey === "month") {
    from = `${today.slice(0, 8)}01`;
    to = today;
    presetKey = "month";
  } else if (requestedKey === "last_month") {
    // 1st of this month minus 1 day is last day of previous month
    const thisMonthFirst = `${today.slice(0, 8)}01`;
    const lastMonthEnd = addDays(thisMonthFirst, -1);
    const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;
    from = lastMonthStart;
    to = lastMonthEnd;
    presetKey = "last_month";
  } else if (requestedKey === "90") {
    from = addDays(today, -89);
    to = today;
    presetKey = "90";
  }

  const days =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

  if (days > MAX_REPORT_DAYS) {
    throw new ValidationError(`Choose a date range of up to ${MAX_REPORT_DAYS} days`);
  }

  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);

  const formatShort = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  const label = `${formatShort(from)} – ${formatShort(to)} (vs ${formatShort(prevFrom)} – ${formatShort(prevTo)})`;

  return {
    from,
    to,
    days,
    prevFrom,
    prevTo,
    presetKey,
    label,
  };
}

/** Escapes individual CSV cell and prefixes single-quote on dangerous leading characters. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Joins array of row arrays into a UTF-8 BOM CSV text string for Excel compatibility. */
export function createCsvDocument(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${body}`;
}

export const takaNum = (n: number) => Math.round(n);
