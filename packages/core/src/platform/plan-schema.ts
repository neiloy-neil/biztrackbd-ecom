/** What the platform admin can edit on a plan, for each family of plans. The Plans page draws its form from this, and updatePlan validates against it. */

export type PlanFamily = "SHOP" | "SITE";

export interface LimitField { key: string; label: string }
export type FeatureField =
  | { key: string; label: string; kind: "bool" }
  | { key: string; label: string; kind: "choice"; options: string[] }
  /** A number of modules, or "all". */
  | { key: string; label: string; kind: "count" };

/** null means unlimited. */
export const PLAN_LIMIT_FIELDS: Record<PlanFamily, LimitField[]> = {
  SHOP: [
    { key: "products", label: "Products" },
    { key: "ordersPerMonth", label: "Orders a month" },
    { key: "staff", label: "Staff" },
    { key: "storageGb", label: "Photo storage (GB)" },
    { key: "smsCredits", label: "SMS credits" },
    { key: "landingPages", label: "Landing pages" },
    { key: "customPages", label: "Custom pages" },
  ],
  SITE: [
    { key: "products", label: "Products" },
    { key: "ordersPerMonth", label: "Orders a month" },
    { key: "staff", label: "Staff" },
    { key: "storageGb", label: "Photo storage (GB)" },
    { key: "landingPages", label: "Landing pages" },
    { key: "customPages", label: "Custom pages" },
    { key: "downloads", label: "Downloads" },
    { key: "contentItems", label: "Content items" },
  ],
};

export const PLAN_FEATURE_FIELDS: Record<PlanFamily, FeatureField[]> = {
  SHOP: [
    { key: "customDomain", label: "Custom domain", kind: "bool" },
    { key: "courierBooking", label: "Courier booking", kind: "choice", options: ["manual", "auto"] },
    { key: "fraud", label: "Fraud checks", kind: "choice", options: ["basic", "full"] },
    { key: "sectionBuilder", label: "Page builder", kind: "choice", options: ["settings", "home", "all"] },
    { key: "modules", label: "Add-on modules", kind: "count" },
    { key: "paymentGateway", label: "Payment gateway", kind: "bool" },
    { key: "capi", label: "Conversions API", kind: "bool" },
  ],
  SITE: [
    { key: "customDomain", label: "Custom domain", kind: "bool" },
    { key: "sectionBuilder", label: "Page builder", kind: "choice", options: ["home", "all"] },
    { key: "headerFooterEditing", label: "Header and footer editing", kind: "bool" },
    { key: "leadCapture", label: "Lead capture", kind: "bool" },
    { key: "whatsappAlerts", label: "WhatsApp alerts", kind: "bool" },
    { key: "bookingRequests", label: "Booking requests", kind: "bool" },
    { key: "teamProfiles", label: "Team profiles", kind: "bool" },
    { key: "hybridStore", label: "Hybrid store", kind: "bool" },
    { key: "courierBooking", label: "Courier booking", kind: "choice", options: ["manual", "auto"] },
    { key: "modules", label: "Add-on modules", kind: "count" },
    { key: "capi", label: "Conversions API", kind: "bool" },
  ],
};

/** Checks one feature value against its field. Returns the cleaned value, or null when it is not allowed. */
export function cleanFeature(field: FeatureField, v: unknown): { ok: true; value: unknown } | { ok: false } {
  if (field.kind === "bool") return typeof v === "boolean" ? { ok: true, value: v } : { ok: false };
  if (field.kind === "choice") return typeof v === "string" && field.options.includes(v) ? { ok: true, value: v } : { ok: false };
  if (v === "all") return { ok: true, value: "all" };
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1000 ? { ok: true, value: v } : { ok: false };
}
