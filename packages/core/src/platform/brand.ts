/**
 * Anti-phishing scanner (docs/12 section 2). A store whose name or address contains a protected brand is flagged for review
 * before it can connect a custom domain. This is a tripwire for a human, not a verdict: "Apex Tailors" is flagged and approved.
 */
const PROTECTED = [
  // Mobile money and banks: the most useful names to impersonate in Bangladesh
  "bkash", "nagad", "rocket", "upay", "islamibank", "islami-bank", "citybank", "ebl",
  // Major retail
  "daraz", "aarong", "yellow", "apex", "bata", "chaldal", "shwapno",
  // Global tech and luxury
  "apple", "samsung", "nike", "gucci", "rolex",
];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Returns the protected brand a store name or subdomain contains, or null. Short names must match a whole word. */
export function scanBrandRisk(...texts: string[]): string | null {
  for (const text of texts) {
    const words = tokens(text);
    const joined = squash(text);
    for (const brand of PROTECTED) {
      const key = squash(brand);
      if (key.length >= 5 ? joined.includes(key) : words.includes(key)) return brand;
    }
  }
  return null;
}
