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

export function portfolioPlanBullets(p: PlanView): string[] {
  const f = p.features;
  const out = [
    "Custom domain with free SSL included",
    f.downloadsLimit === "unlimited" ? "Unlimited downloadable assets & lead magnets" : `Up to ${f.downloadsLimit} downloadable assets & lead magnets`,
    f.contentItemsLimit === "unlimited" ? "Unlimited services, portfolio projects & case studies" : `Up to ${f.contentItemsLimit} services & portfolio projects`,
    "Instant WhatsApp alert & lead capture inbox",
    "Anti-bot protected contact & inquiry forms",
  ];
  if (f.bookingRequests) out.push("Online appointment & table booking requests");
  if (f.teamProfiles) out.push("Team profiles & multi-staff directory");
  if (f.hybridStore) out.push("Hybrid Store: sell products & merchandise with checkout");
  out.push(`${p.limits.storageGb ?? "Unlimited"} GB photo & PDF document storage`);
  return out;
}
