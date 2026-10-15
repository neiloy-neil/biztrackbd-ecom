import { ValidationError } from "./errors";

/** Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, 1XXXXXXXXX (10-digit without leading 0), with spaces, dots, dashes, and Bangla digits. Returns canonical 01XXXXXXXXX. */
export function normalizeBdPhone(input: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  let s = input.replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/[\s\-().]/g, "");

  // Strip duplicate/cascaded prefixes like +880880..., 880880..., +88+88...
  while (s.startsWith("+880880")) s = "+880" + s.slice(7);
  while (s.startsWith("880880")) s = "880" + s.slice(6);
  while (s.startsWith("+88+88")) s = "+88" + s.slice(6);

  if (s.startsWith("+88")) s = s.slice(3);
  else if (s.startsWith("88") && s.length >= 13) s = s.slice(2);
  else if (s.startsWith("0088")) s = s.slice(4);

  // If user entered 10 digits omitting the leading zero (e.g. 1712345678 when UI displays +880)
  if (/^1[3-9]\d{8}$/.test(s)) {
    s = "0" + s;
  }

  if (!/^01[3-9]\d{8}$/.test(s)) {
    throw new ValidationError("Enter a valid Bangladeshi mobile number, like 01712345678", { field: "phone" });
  }
  return s;
}

