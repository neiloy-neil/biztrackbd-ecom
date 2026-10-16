import { withTenant } from "@biztrackbd/db";

export type SiteMode = "ECOMMERCE" | "PORTFOLIO" | "HYBRID";

export type BusinessVertical =
  | "RESTAURANT"
  | "DOCTOR_CLINIC"
  | "PUBLIC_FIGURE"
  | "BUSINESS_COMPANY"
  | "SERVICE_PROVIDER"
  | "PERSONAL_PORTFOLIO";

export interface ModeMeta {
  key: SiteMode;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  badge?: string;
}

export interface VerticalMeta {
  key: BusinessVertical;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  icon: string;
  recommendedCapabilities: string[];
}

export const SITE_MODES: Record<SiteMode, ModeMeta> = {
  ECOMMERCE: {
    key: "ECOMMERCE",
    labelEn: "Online Store & Ecommerce",
    labelBn: "অনলাইন স্টোর ও ই-কমার্স",
    descriptionEn: "Complete store with cart, checkout, bKash/Nagad, inventory, and Steadfast/Pathao courier booking.",
    descriptionBn: "কার্ট, চেকআউট, বিকাশ/নগদ, ইনভেন্টরি ও পাঠাও/স্টেডফাস্ট কুরিয়ার বুকিংসহ পূর্ণাঙ্গ অনলাইন শপ।",
  },
  PORTFOLIO: {
    key: "PORTFOLIO",
    labelEn: "Business Website & Portfolio",
    labelBn: "ব্যবসায়িক ওয়েবসাইট ও পোর্টফোলিও",
    descriptionEn: "Fast responsive website for clinics, restaurants, agencies, and professionals to capture leads and booking requests.",
    descriptionBn: "ক্লিনিক, রেস্তোরাঁ, কোম্পানি ও প্রফেশনালদের জন্য কাস্টমার লিড ও বুকিং রিকোয়েস্ট সংগ্রহের ওয়েবসাইট।",
    badge: "New",
  },
  HYBRID: {
    key: "HYBRID",
    labelEn: "Hybrid Business + Store",
    labelBn: "হাইব্রিড বিজনেস ও শপ",
    descriptionEn: "Showcase your portfolio, services, or restaurant menu while selling selected products with full checkout.",
    descriptionBn: "পোর্টফোলিও ও সেবার পাশাপাশি নির্দিষ্ট পণ্য বিক্রির জন্য চেকআউটসহ ওয়েবসাইট।",
  },
};

export const BUSINESS_VERTICALS: Record<BusinessVertical, VerticalMeta> = {
  RESTAURANT: {
    key: "RESTAURANT",
    labelEn: "Restaurant, Café & Food",
    labelBn: "রেস্তোরাঁ, ক্যাফে ও ফুড",
    descriptionEn: "Digital visual menu, downloadable QR code for tables, and table reservation requests.",
    descriptionBn: "ডিজিটাল মেনু, টেবিলের জন্য কিউআর কোড এবং টেবিল রিজার্ভেশন রিকোয়েস্ট।",
    icon: "utensils",
    recommendedCapabilities: ["menu", "booking_requests"],
  },
  DOCTOR_CLINIC: {
    key: "DOCTOR_CLINIC",
    labelEn: "Doctor, Specialist & Clinic",
    labelBn: "ডাক্তার, বিশেষজ্ঞ ও ক্লিনিক",
    descriptionEn: "Verified credentials, chamber schedules, and appointment requests (non-clinical contact).",
    descriptionBn: "ডিগ্রি ও যোগ্যতা, চেম্বারের সময়সূচি এবং অ্যাপয়েন্টমেন্ট রিকোয়েস্ট।",
    icon: "stethoscope",
    recommendedCapabilities: ["credentials", "booking_requests", "team_profiles", "services"],
  },
  PUBLIC_FIGURE: {
    key: "PUBLIC_FIGURE",
    labelEn: "Public Figure & Creator",
    labelBn: "পাবলিক ফিগার ও কনটেন্ট ক্রিয়েটর",
    descriptionEn: "Press/media links, biography, event schedule, and speaking or sponsorship booking inquiries.",
    descriptionBn: "মিডিয়া লিংক, জীবনী, ইভেন্ট শিডিউল এবং ইভেন্ট বা স্পনসরশিপ বুকিং এনকোয়ারি।",
    icon: "user-star",
    recommendedCapabilities: ["public_events", "portfolio_items", "leads"],
  },
  BUSINESS_COMPANY: {
    key: "BUSINESS_COMPANY",
    labelEn: "Company, Corporate & Agency",
    labelBn: "কোম্পানি, কর্পোরেট ও এজেন্সি",
    descriptionEn: "Company overview, services, client case studies, team profiles, and consultation quote requests.",
    descriptionBn: "কোম্পানি পরিচিতি, সেবা, কেস স্টাডি, টিম প্রোফাইল এবং কোটেশন রিকোয়েস্ট।",
    icon: "building",
    recommendedCapabilities: ["services", "portfolio_items", "team_profiles", "leads"],
  },
  SERVICE_PROVIDER: {
    key: "SERVICE_PROVIDER",
    labelEn: "Service Provider & Consultant",
    labelBn: "সার্ভিস প্রোভাইডার ও পরামর্শক",
    descriptionEn: "List of services with pricing, coverage area, customer reviews, and service quote requests.",
    descriptionBn: "মূল্যসহ সেবার তালিকা, সার্ভিস এরিয়া এবং কোট বা বুকিং রিকোয়েস্ট।",
    icon: "briefcase",
    recommendedCapabilities: ["services", "portfolio_items", "leads", "booking_requests"],
  },
  PERSONAL_PORTFOLIO: {
    key: "PERSONAL_PORTFOLIO",
    labelEn: "Personal Portfolio & Resume",
    labelBn: "ব্যক্তিগত পোর্টফোলিও ও সিভি",
    descriptionEn: "Showcase creative projects, career timeline, downloadable CV/PDF, and direct contact form.",
    descriptionBn: "প্রজেক্ট শোকেস, ক্যারিয়ার টাইমলাইন, ডাউনলোডযোগ্য সিভি এবং কন্টাক্ট ফর্ম।",
    icon: "folder",
    recommendedCapabilities: ["portfolio_items", "downloads", "credentials", "leads"],
  },
};

export function isSiteMode(val: unknown): val is SiteMode {
  return typeof val === "string" && (val === "ECOMMERCE" || val === "PORTFOLIO" || val === "HYBRID");
}

export function isBusinessVertical(val: unknown): val is BusinessVertical {
  return (
    typeof val === "string" &&
    (val === "RESTAURANT" ||
      val === "DOCTOR_CLINIC" ||
      val === "PUBLIC_FIGURE" ||
      val === "BUSINESS_COMPANY" ||
      val === "SERVICE_PROVIDER" ||
      val === "PERSONAL_PORTFOLIO")
  );
}

export function normalizeSiteMode(val: unknown): SiteMode {
  return isSiteMode(val) ? val : "ECOMMERCE";
}

export function normalizeBusinessVertical(val: unknown): BusinessVertical | null {
  return isBusinessVertical(val) ? val : null;
}

export async function getTenantModeAndVertical(
  tenantId: string
): Promise<{ siteMode: SiteMode; vertical: BusinessVertical | null }> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { siteMode: true, businessVertical: true },
    });
    return {
      siteMode: normalizeSiteMode(t?.siteMode),
      vertical: normalizeBusinessVertical(t?.businessVertical),
    };
  });
}
