import type { PlanView } from "@biztrackbd/core";

export const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const n = (v: number | null, unit: string) => (v == null ? `Unlimited ${unit}` : `${v.toLocaleString("en-IN")} ${unit}`);

/** What a plan includes, in plain words, built from the Plan table so the page can never disagree with the product. */
export function planBullets(p: PlanView): string[] {
  const f = p.features;
  const out = [
    n(p.limits.products, "products"),
    `${p.limits.ordersPerMonth == null ? "Unlimited" : p.limits.ordersPerMonth.toLocaleString("en-IN")} orders a month`,
    `${p.limits.staff ?? "Unlimited"} staff ${p.limits.staff === 1 ? "account" : "accounts"}`,
    "Cash on delivery, bKash and Nagad checkout",
    "Order verification desk and quick phone-order desk",
  ];
  out.push(f.courierBooking === "auto" ? "Book Steadfast, Pathao and RedX from the order" : "Add courier tracking by hand");
  out.push(f.fraud === "full" ? "Cross-store delivery trust score and fraud holds" : "Basic fraud checks");
  if (f.customDomain) out.push("Your own domain");
  if (p.limits.smsCredits) out.push(`${p.limits.smsCredits.toLocaleString("en-IN")} SMS credits a month`);
  return out;
}
