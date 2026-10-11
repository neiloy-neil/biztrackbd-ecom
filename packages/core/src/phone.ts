import { ValidationError } from "./errors";

/** Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, with spaces or dashes, and Bangla digits. Returns 01XXXXXXXXX. */
export function normalizeBdPhone(input: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  let s = input.replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/[\s\-()]/g, "");
  if (s.startsWith("+88")) s = s.slice(3);
  else if (s.startsWith("88") && s.length === 13) s = s.slice(2);
  if (!/^01[3-9]\d{8}$/.test(s)) {
    throw new ValidationError("Enter a valid Bangladeshi mobile number, like 01712345678", { field: "phone" });
  }
  return s;
}
