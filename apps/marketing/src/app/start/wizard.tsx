"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { checkAddressAction, signupAction, type SignupState } from "./actions";
import { generateTrackingEventId, getAttributionForPayload } from "@/lib/client-attribution";
import { trackFunnelEvent } from "@/components/platform-tracker";

interface Plan {
  tier: string;
  name: string;
  priceMonthly: number;
  blurb: string;
}

interface Theme {
  id: string;
  name: string;
  blurb: string;
  live: boolean;
  look?: string;
}

export type StoreCategory = "FASHION" | "BEAUTY" | "ELECTRONICS" | "GROCERY" | "GENERAL";

export const CATEGORY_OPTIONS = [
  {
    id: "FASHION" as StoreCategory,
    name: "Fashion & Apparel",
    bn: "ফ্যাশন ও পোশাক",
    icon: "👗",
    hint: "শাড়ি, পাঞ্জাবি, জুতা ও ক্লোথিং",
    theme: "kapor",
  },
  {
    id: "BEAUTY" as StoreCategory,
    name: "Beauty & Cosmetics",
    bn: "রূপচর্চা ও প্রসাধনী",
    icon: "💄",
    hint: "স্কিনকেয়ার, মেকআপ ও পার্সোনাল কেয়ার",
    theme: "shondor",
  },
  {
    id: "ELECTRONICS" as StoreCategory,
    name: "Electronics & Gadgets",
    bn: "ইলেকট্রনিক্স ও গ্যাজেট",
    icon: "📱",
    hint: "মোবাইল এক্সেসরিজ ও স্মার্ট ডিভাইস",
    theme: "boithok",
  },
  {
    id: "GROCERY" as StoreCategory,
    name: "Grocery & Organics",
    bn: "মুদি ও অর্গানিক ফুড",
    icon: "🍯",
    hint: "মধু, ঘি, মসলা ও খাঁটি খাবার",
    theme: "rokomari",
  },
  {
    id: "GENERAL" as StoreCategory,
    name: "General Store",
    bn: "জেনারেল স্টোর",
    icon: "🛍️",
    hint: "সব ধরণের পণ্য ও বহুমুখী কালেকশন",
    theme: "kapor",
  },
] as const;

export type BusinessVertical =
  | "RESTAURANT"
  | "DOCTOR_CLINIC"
  | "PUBLIC_FIGURE"
  | "BUSINESS_COMPANY"
  | "SERVICE_PROVIDER"
  | "PERSONAL_PORTFOLIO";

export interface BusinessVerticalOption {
  id: BusinessVertical;
  name: string;
  bn: string;
  icon: string;
  hint: string;
  recommendedTheme: string;
}

export const VERTICAL_OPTIONS: BusinessVerticalOption[] = [
  {
    id: "RESTAURANT",
    name: "Restaurant, Café & Food",
    bn: "রেস্তোরাঁ, ক্যাফে ও ফুড",
    icon: "🍽️",
    hint: "Digital menu & table reservations",
    recommendedTheme: "dhaka-bistro",
  },
  {
    id: "DOCTOR_CLINIC",
    name: "Doctor, Specialist & Clinic",
    bn: "ডাক্তার, চেম্বার ও ক্লিনিক",
    icon: "🩺",
    hint: "Chambers & appointment booking",
    recommendedTheme: "modern-clinic",
  },
  {
    id: "BUSINESS_COMPANY",
    name: "Company & Corporate Agency",
    bn: "কোম্পানি, কর্পোরেট ও এজেন্সি",
    icon: "🏢",
    hint: "Company overview & client inquiries",
    recommendedTheme: "apex-corporate",
  },
  {
    id: "SERVICE_PROVIDER",
    name: "Service Provider & Consultant",
    bn: "সার্ভিস প্রোভাইডার ও কনসালট্যান্ট",
    icon: "💼",
    hint: "Service pricing & booking leads",
    recommendedTheme: "local-service-pro",
  },
  {
    id: "PERSONAL_PORTFOLIO",
    name: "Personal Portfolio & Resume",
    bn: "ব্যক্তিগত পোর্টফোলিও ও সিভি",
    icon: "📁",
    hint: "Showcase creative work & milestones",
    recommendedTheme: "portfolio-focus",
  },
  {
    id: "PUBLIC_FIGURE",
    name: "Public Figure & Creator",
    bn: "পাবলিক ফিগার ও কনটেন্ট ক্রিয়েটর",
    icon: "⭐",
    hint: "Biography, press & speaking bookings",
    recommendedTheme: "public-profile",
  },
];

const COMMERCE_STEPS = ["Business & Category", "Selling Channel", "Web Address & Plan", "Account & Launch"] as const;
const BUSINESS_STEPS = ["Business & Category", "Website Type", "Web Address & Plan", "Account & Launch"] as const;

const FIELD_STEP: Record<string, number> = {
  storeName: 0,
  category: 0,
  tagline: 0,
  theme: 0,
  siteMode: 1,
  businessVertical: 1,
  subdomain: 2,
  plan: 2,
  ownerName: 3,
  email: 3,
  phone: 3,
  password: 3,
};

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

export function Wizard({
  commercePlans,
  businessPlans,
  themes,
  rootDomain,
  initialPlan,
  initialTheme,
  initialMode = "ECOMMERCE",
  initialVertical = "RESTAURANT",
  keepCode = "",
  keptProductsCount,
}: {
  verify?: boolean;
  keepCode?: string;
  keptProductsCount?: number;
  commercePlans: Plan[];
  businessPlans: Plan[];
  themes: Theme[];
  rootDomain: string;
  initialPlan: string;
  initialTheme: string;
  initialMode?: "ECOMMERCE" | "PORTFOLIO" | "HYBRID";
  initialVertical?: BusinessVertical;
}) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [step, setStep] = useState(0);
  const startedTracked = useRef(false);
  const [eventId] = useState(() => generateTrackingEventId("reg"));
  const [attr, setAttr] = useState(() => getAttributionForPayload());
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    setAttr(getAttributionForPayload());
    if (typeof window !== "undefined") {
      const sid =
        window.sessionStorage.getItem("bt_native_session_v1") ||
        (document.cookie.match(/bt_native_session_v1=([^;]+)/) || [])[1] ||
        "";
      setSessionId(sid);
    }
  }, []);

  const [v, setV] = useState({
    storeName: "",
    siteMode: (initialMode || "ECOMMERCE") as "ECOMMERCE" | "PORTFOLIO" | "HYBRID",
    businessVertical: (initialVertical || "RESTAURANT") as BusinessVertical,
    category: "FASHION" as StoreCategory,
    tagline: "",
    subdomain: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    plan: initialPlan || "PRO",
    theme: initialTheme || "kapor",
    demoData: true,
  });

  const [touchedAddress, setTouchedAddress] = useState(false);
  const [address, setAddress] = useState<{ ok: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPlanSwitcher, setShowPlanSwitcher] = useState(false);
  const checkId = useRef(0);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));

  // Suggest an address from the store name until the owner types their own
  useEffect(() => {
    if (!touchedAddress && v.storeName) {
      setV((o) => ({ ...o, subdomain: slug(o.storeName) }));
    }
  }, [v.storeName, touchedAddress]);

  // Live address check, a moment after typing stops
  useEffect(() => {
    if (v.subdomain.length < 3) {
      setAddress(null);
      return;
    }
    const id = ++checkId.current;
    const t = setTimeout(async () => {
      const r = await checkAddressAction(v.subdomain).catch(() => null);
      if (id === checkId.current && r) setAddress(r);
    }, 350);
    return () => clearTimeout(t);
  }, [v.subdomain]);

  // Server error fallback navigation
  useEffect(() => {
    if (state.error && state.field && FIELD_STEP[state.field] !== undefined) {
      setStep(FIELD_STEP[state.field]!);
    }
  }, [state]);

  function handleCategorySelect(catId: StoreCategory) {
    const cat = CATEGORY_OPTIONS.find((c) => c.id === catId);
    set("category", catId);
    if (cat && v.siteMode === "ECOMMERCE") {
      set("theme", cat.theme);
    }
  }

  function handleVerticalSelect(vertId: BusinessVertical) {
    const vert = VERTICAL_OPTIONS.find((c) => c.id === vertId);
    set("businessVertical", vertId);
    if (vert) {
      set("theme", vert.recommendedTheme);
    }
  }

  function handleModeSelect(mode: "ECOMMERCE" | "PORTFOLIO" | "HYBRID") {
    set("siteMode", mode);
    if (mode === "PORTFOLIO") {
      const vert = VERTICAL_OPTIONS.find((o) => o.id === v.businessVertical) ?? VERTICAL_OPTIONS[0]!;
      set("theme", vert.recommendedTheme);
      set("plan", "PRO");
    } else if (mode === "ECOMMERCE") {
      const cat = CATEGORY_OPTIONS.find((c) => c.id === v.category) ?? CATEGORY_OPTIONS[0]!;
      set("theme", cat.theme);
      set("plan", "PRO");
    } else if (mode === "HYBRID") {
      set("plan", "PRO");
    }
  }

  function validate(s: number): string | null {
    if (s === 0) {
      if (v.storeName.trim().length < 2) {
        return v.siteMode === "PORTFOLIO"
          ? "Enter your website or business name (at least 2 letters)"
          : "Enter your store name (at least 2 letters)";
      }
    }
    if (s === 1) {
      // Selling Channel / Vertical is always pre-selected with defaults
    }
    if (s === 2) {
      if (v.subdomain.length < 3) return "Choose a web address of at least 3 letters or numbers";
      if (address && !address.ok) return address.message;
    }
    if (s === 3) {
      if (v.ownerName.trim().length < 2) return "Enter your full name";
      if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return "Enter a valid email address for store admin login";
      const cleanPhone = v.phone.replace(/[\s-]/g, "");
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
        return "Enter a valid Bangladeshi mobile number (e.g. 01712345678)";
      }
      if (v.password.length < 8) return "Password must be at least 8 characters";
      if (v.password !== v.confirmPassword) return "The two passwords do not match";
    }
    return null;
  }

  function next() {
    const p = validate(step);
    setProblem(p);
    if (p) return;
    setProblem(null);
    if (!startedTracked.current) {
      startedTracked.current = true;
      trackFunnelEvent("InitiateCheckout", { content_name: "signup_wizard", site_mode: v.siteMode });
    }
    setStep(step + 1);
  }

  const isPortfolio = v.siteMode === "PORTFOLIO";
  const isHybrid = v.siteMode === "HYBRID";
  const steps = isPortfolio ? BUSINESS_STEPS : COMMERCE_STEPS;
  const plans = isPortfolio ? businessPlans : commercePlans;

  const chosenCat = CATEGORY_OPTIONS.find((c) => c.id === v.category) ?? CATEGORY_OPTIONS[0]!;
  const chosenVertical = VERTICAL_OPTIONS.find((o) => o.id === v.businessVertical) ?? VERTICAL_OPTIONS[0]!;
  const defaultTheme: Theme = themes[0] ?? { id: "kapor", name: "Kapor", blurb: "Modern Bangladeshi ecommerce", live: true };
  const chosenTheme: Theme = themes.find((t) => t.id === v.theme) ?? defaultTheme;

  const defaultPlan: Plan = isPortfolio
    ? { tier: "PRO", name: "Business", priceMonthly: 799, blurb: "Business website features with a 14-day free trial" }
    : { tier: "PRO", name: "Pro", priceMonthly: 1499, blurb: "Commerce features with a 14-day free trial" };
  const chosenPlan: Plan = plans.find((p) => p.tier === v.plan) ?? plans[0] ?? defaultPlan;
  const displayHost = rootDomain.replace(/:\d+$/, "");

  return (
    <div className="split-start">
      <div className="split-form" style={{ position: "relative" }}>
        {keepCode && keptProductsCount !== undefined && (
          <div className="notice" role="status" data-testid="keep-note" style={{ marginBottom: 20 }}>
            Your demo store comes with you: {keptProductsCount}{" "}
            {keptProductsCount === 1 ? "product" : "products"}, pictures, and home page settings. Finish signing up to keep it active.
          </div>
        )}

        <form action={action} className="wizard" data-testid="wizard" noValidate>
          {/* Synchronized state for multi-step server action submission */}
          <input type="hidden" name="storeName" value={v.storeName} />
          <input type="hidden" name="siteMode" value={v.siteMode} />
          <input type="hidden" name="businessVertical" value={v.businessVertical || ""} />
          <input type="hidden" name="category" value={v.category} />
          <input type="hidden" name="tagline" value={v.tagline} />
          <input type="hidden" name="subdomain" value={v.subdomain} />
          <input type="hidden" name="ownerName" value={v.ownerName} />
          <input type="hidden" name="email" value={v.email} />
          <input type="hidden" name="phone" value={v.phone} />
          <input type="hidden" name="password" value={v.password} />
          <input type="hidden" name="plan" value={v.plan} />
          <input type="hidden" name="theme" value={v.theme} />
          <input type="hidden" name="demoData" value={v.demoData ? "on" : "off"} />
          {keepCode && <input type="hidden" name="from" value={keepCode} />}

          {/* Attribution & Meta CAPI Deduplication fields */}
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="utmSource" value={attr.utmSource || ""} />
          <input type="hidden" name="utmMedium" value={attr.utmMedium || ""} />
          <input type="hidden" name="utmCampaign" value={attr.utmCampaign || ""} />
          <input type="hidden" name="referrer" value={attr.referrer || ""} />
          <input type="hidden" name="fbp" value={attr.fbp || ""} />
          <input type="hidden" name="fbc" value={attr.fbc || ""} />

          {/* Header & Step Counter */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--brand, #11795A)",
                }}
              >
                Step {step + 1} of 4 • {steps[step]}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#0B4D3B",
                  background: "#E3F1EA",
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                14-Day Free Trial
              </span>
            </div>

            {/* 4-Segment Progress Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
                marginBottom: 16,
              }}
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step + 1}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: i <= step ? "var(--brand, #11795A)" : "var(--line, #E2E8F0)",
                    transition: "background 0.25s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* =========================================================================
              STEP 1 (Index 0): Business Identity & Category
              ========================================================================= */}
          {step === 0 && (
            <div data-testid="step-store-category">
              <h2 style={{ fontSize: 18, marginBottom: 4, color: "var(--ink, #0F172A)", fontWeight: 700 }}>
                1. What is your business called & what do you sell?
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3, #64748B)", marginBottom: 16 }}>
                Enter your brand name and select your category to personalize your store setup.
              </p>

              <label className="field" style={{ marginBottom: 18 }}>
                <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  {isPortfolio ? "Website or business name *" : "Store name *"}
                </span>
                <input
                  className="input"
                  autoFocus
                  placeholder={
                    isPortfolio
                      ? "e.g. Dhaka Bistro, Dr. Sarah Clinic, Apex Legal"
                      : "e.g. Aarohi Fashion, Gadget Pulse, Dhaka Organics"
                  }
                  value={v.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  data-testid="f-storeName"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    fontSize: 15,
                    borderRadius: 10,
                    border: "1.5px solid var(--line, #CBD5E1)",
                  }}
                />
                <span className="hint" style={{ fontSize: 11.5, color: "var(--ink-3, #64748B)", marginTop: 4, display: "block" }}>
                  {isPortfolio
                    ? "Appears on your website header and visitor contact responses."
                    : "Appears on your storefront header, customer invoices, and SMS receipts."}
                </span>
              </label>

              {/* Compact Category Selection (52px List Tiles) */}
              <div style={{ marginBottom: 16 }}>
                <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 8 }}>
                  Choose your primary business category *
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CATEGORY_OPTIONS.map((cat) => {
                    const selected = v.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        data-testid={`category-${cat.id.toLowerCase()}`}
                        onClick={() => handleCategorySelect(cat.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          minHeight: 52,
                          borderRadius: 10,
                          border: selected ? "2px solid var(--brand, #11795A)" : "1.5px solid var(--line, #E2E8F0)",
                          background: selected ? "var(--tint, #F0FDF4)" : "#FFFFFF",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink, #0F172A)" }}>{cat.name}</span>
                              <span style={{ fontSize: 12, color: "var(--brand, #11795A)", fontWeight: 600 }}>({cat.bn})</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--ink-3, #64748B)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                              {cat.hint}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            border: selected ? "5px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                            background: "#FFFFFF",
                            flexShrink: 0,
                            marginLeft: 10,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart Auto-theme Badge */}
              <div
                style={{
                  padding: "10px 14px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "#334155",
                }}
              >
                <span>✨</span>
                <span>
                  Pre-configured with <b>{chosenTheme.name}</b> high-conversion template. (You can swap themes in Admin with 1 click).
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 2 (Index 1): Selling Channel / Business Model
              ========================================================================= */}
          {step === 1 && (
            <div data-testid="step-store-mode">
              <h2 style={{ fontSize: 18, marginBottom: 4, color: "var(--ink, #0F172A)", fontWeight: 700 }}>
                2. How do you plan to sell and connect with customers?
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3, #64748B)", marginBottom: 16 }}>
                Pick the model that fits your business today. You can always expand features later.
              </p>

              {/* Mode Options (Compact 54px List Tiles) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {/* 1. Ecommerce */}
                <button
                  type="button"
                  data-testid="mode-ecommerce"
                  onClick={() => handleModeSelect("ECOMMERCE")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    minHeight: 54,
                    borderRadius: 10,
                    border: v.siteMode === "ECOMMERCE" ? "2px solid var(--brand, #11795A)" : "1.5px solid var(--line, #E2E8F0)",
                    background: v.siteMode === "ECOMMERCE" ? "var(--tint, #F0FDF4)" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🛍️</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink, #0F172A)" }}>Online Store (Ecommerce)</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#15803D", background: "#DCFCE7", padding: "1px 6px", borderRadius: 4 }}>
                          Recommended
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3, #64748B)", marginTop: 1 }}>
                        Cart, checkout, bKash/Nagad & automated courier pickup
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      border: v.siteMode === "ECOMMERCE" ? "5px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                      background: "#FFFFFF",
                      flexShrink: 0,
                      marginLeft: 10,
                    }}
                  />
                </button>

                {/* 2. Portfolio / Website */}
                <button
                  type="button"
                  data-testid="mode-portfolio"
                  onClick={() => handleModeSelect("PORTFOLIO")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    minHeight: 54,
                    borderRadius: 10,
                    border: v.siteMode === "PORTFOLIO" ? "2px solid var(--brand, #11795A)" : "1.5px solid var(--line, #E2E8F0)",
                    background: v.siteMode === "PORTFOLIO" ? "var(--tint, #F0FDF4)" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>💼</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink, #0F172A)" }}>Website & Service Showcase</span>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3, #64748B)", marginTop: 1 }}>
                        Showcase services, menu, bookings & direct inquiry leads
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      border: v.siteMode === "PORTFOLIO" ? "5px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                      background: "#FFFFFF",
                      flexShrink: 0,
                      marginLeft: 10,
                    }}
                  />
                </button>

                {/* 3. Hybrid */}
                <button
                  type="button"
                  data-testid="mode-hybrid"
                  onClick={() => handleModeSelect("HYBRID")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    minHeight: 54,
                    borderRadius: 10,
                    border: v.siteMode === "HYBRID" ? "2px solid var(--brand, #11795A)" : "1.5px solid var(--line, #E2E8F0)",
                    background: v.siteMode === "HYBRID" ? "var(--tint, #F0FDF4)" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>⚡</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink, #0F172A)" }}>Hybrid Business + Online Store</span>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3, #64748B)", marginTop: 1 }}>
                        Full company website with integrated merchandise checkout
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      border: v.siteMode === "HYBRID" ? "5px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                      background: "#FFFFFF",
                      flexShrink: 0,
                      marginLeft: 10,
                    }}
                  />
                </button>
              </div>

              {/* Vertical Selection (If Portfolio or Hybrid) */}
              {(isPortfolio || isHybrid) && (
                <div style={{ marginTop: 16 }}>
                  <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 8 }}>
                    Select your business industry *
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {VERTICAL_OPTIONS.map((vert) => {
                      const selected = v.businessVertical === vert.id;
                      return (
                        <button
                          key={vert.id}
                          type="button"
                          data-testid={`vertical-${vert.id.toLowerCase()}`}
                          onClick={() => handleVerticalSelect(vert.id)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "9px 12px",
                            minHeight: 48,
                            borderRadius: 10,
                            border: selected ? "2px solid var(--brand, #11795A)" : "1.5px solid var(--line, #E2E8F0)",
                            background: selected ? "var(--tint, #F0FDF4)" : "#FFFFFF",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{vert.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink, #0F172A)" }}>{vert.name}</span>
                              <div style={{ fontSize: 11, color: "var(--ink-3, #64748B)" }}>{vert.hint}</div>
                            </div>
                          </div>
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              border: selected ? "4px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                              background: "#FFFFFF",
                              flexShrink: 0,
                              marginLeft: 8,
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              STEP 3 (Index 2): Web Address & Pro Trial
              ========================================================================= */}
          {step === 2 && (
            <div data-testid="step-address">
              <h2 style={{ fontSize: 18, marginBottom: 4, color: "var(--ink, #0F172A)", fontWeight: 700 }}>
                3. Claim your free web address &amp; 14-day trial
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3, #64748B)", marginBottom: 16 }}>
                Your store starts on a free BizTrackBD subdomain. You can connect your custom .com anytime.
              </p>

              {/* Subdomain Address Field */}
              <div className="field" style={{ marginBottom: 16 }}>
                <label className="label" htmlFor="sub" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  {isPortfolio ? "Website" : "Store"} subdomain address *
                </label>
                <div className="addr" style={{ display: "flex", alignItems: "center", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--line, #CBD5E1)", background: "#FFFFFF" }}>
                  <input
                    id="sub"
                    className="input"
                    value={v.subdomain}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      setTouchedAddress(true);
                      set("subdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    aria-invalid={address ? !address.ok : undefined}
                    aria-describedby="sub-msg"
                    data-testid="f-subdomain"
                    placeholder="yourshop"
                    style={{ flex: 1, padding: "11px 14px", border: "none", outline: "none", fontSize: 14.5 }}
                  />
                  <span style={{ padding: "0 12px", color: "var(--ink-3, #64748B)", fontWeight: 600, fontSize: 13.5, background: "#F8FAFC", borderLeft: "1px solid #E2E8F0", height: "100%", display: "flex", alignItems: "center" }}>
                    .{displayHost}
                  </span>
                </div>

                {/* Subdomain Status Pill */}
                <div id="sub-msg" aria-live="polite" data-testid="address-status" style={{ marginTop: 8 }}>
                  {address &&
                    (address.ok ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#E3F1EA",
                          border: "1px solid #C6DFD3",
                          borderRadius: 8,
                          padding: "5px 10px",
                          color: "#0B4D3B",
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      >
                        <span>✓</span>
                        <span>{v.subdomain}.{displayHost} is free &amp; ready to claim!</span>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#FDF1EA",
                            border: "1px solid #F2C9B3",
                            borderRadius: 8,
                            padding: "5px 10px",
                            color: "#9A3412",
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          <span>✗</span>
                          <span>{address.message}</span>
                        </div>
                        {address.message.toLowerCase().includes("taken") && (
                          <div style={{ marginTop: 8, fontSize: 12 }}>
                            <span className="muted" style={{ marginRight: 6 }}>Try an available alternative:</span>
                            {[
                              `${v.subdomain}-bd`,
                              `shop-${v.subdomain}`,
                              `${v.subdomain}-store`,
                            ]
                              .map((s) => s.slice(0, 30))
                              .map((alt) => (
                                <button
                                  key={alt}
                                  type="button"
                                  className="chip"
                                  style={{
                                    cursor: "pointer",
                                    marginRight: 6,
                                    marginTop: 4,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "3px 8px",
                                    border: "1px solid var(--line, #DCE7E1)",
                                    borderRadius: 6,
                                    background: "#fff",
                                    color: "var(--brand, #11795A)",
                                  }}
                                  onClick={() => {
                                    setTouchedAddress(true);
                                    set("subdomain", alt);
                                  }}
                                >
                                  {alt}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Free Custom Domain Note */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 12,
                  color: "#475569",
                  lineHeight: 1.4,
                  marginBottom: 16,
                }}
              >
                💡 <b>Custom Domain:</b> Connect your own domain (e.g. <code>www.{v.subdomain || "yourbrand"}.com</code>) with free automated SSL from your dashboard anytime.
              </div>

              {/* 14-Day Free Pro Trial Highlight Card */}
              <div
                style={{
                  padding: "16px",
                  background: "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)",
                  borderRadius: 12,
                  border: "1.5px solid #86EFAC",
                  boxShadow: "0 2px 8px rgba(17, 121, 90, 0.06)",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#15803D",
                      background: "#DCFCE7",
                      padding: "2px 8px",
                      borderRadius: 99,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    🎉 14-Day Full Pro Trial — ৳0 Today
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#11795A" }}>৳0 Today</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A", marginBottom: 4 }}>
                  All {chosenPlan.name} features unlocked free for 14 days
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4, marginBottom: 10 }}>
                  Enjoy unlimited products, automated courier booking, fraud check, and marketing tools.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11.5, color: "#166534", fontWeight: 600 }}>
                  <div>✓ No credit card required</div>
                  <div>✓ Zero setup charges</div>
                  <div>✓ Keep all sample data</div>
                  <div>✓ Cancel or switch anytime</div>
                </div>
              </div>

              {/* Collapsible Plan Switcher */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPlanSwitcher(!showPlanSwitcher)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand, #11795A)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{showPlanSwitcher ? "Hide plan options ▲" : "Need Starter (৳799) or Enterprise (৳2,999) instead? ▼"}</span>
                </button>

                {showPlanSwitcher && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {plans.map((p) => {
                      const selected = v.plan === p.tier;
                      return (
                        <button
                          key={p.tier}
                          type="button"
                          onClick={() => set("plan", p.tier)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "9px 12px",
                            borderRadius: 8,
                            border: selected ? "2px solid var(--brand, #11795A)" : "1px solid #CBD5E1",
                            background: selected ? "#F0FDF4" : "#FFFFFF",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>{p.name}</span>
                              {p.tier === "PRO" && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#15803D", background: "#DCFCE7", padding: "1px 5px", borderRadius: 4 }}>
                                  Popular
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{taka(p.priceMonthly)}/month after 14-day trial</div>
                          </div>
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              border: selected ? "4px solid var(--brand, #11795A)" : "2px solid #CBD5E1",
                              background: "#FFFFFF",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 4 (Index 3): Owner Account & Instant Launch
              ========================================================================= */}
          {step === 3 && (
            <div data-testid="step-account">
              <h2 style={{ fontSize: 18, marginBottom: 4, color: "var(--ink, #0F172A)", fontWeight: 700 }}>
                4. Create your secure owner login
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3, #64748B)", marginBottom: 16 }}>
                You will use these credentials to log in to your BizTrackBD admin dashboard.
              </p>

              <label className="field" style={{ marginBottom: 14 }}>
                <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  Your full name *
                </span>
                <input
                  className="input"
                  autoComplete="name"
                  placeholder="e.g. Tanvir Ahmed"
                  value={v.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  data-testid="f-ownerName"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}
                />
              </label>

              <label className="field" style={{ marginBottom: 14 }}>
                <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  Mobile number *
                </span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01712345678"
                  value={v.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  data-testid="f-phone"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}
                />
                <span className="hint" style={{ fontSize: 11.5, color: "#64748B", marginTop: 4, display: "block" }}>
                  Used for instant SMS order alerts, courier sync, and merchant support.
                </span>
              </label>

              <label className="field" style={{ marginBottom: 14 }}>
                <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  Email address *
                </span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="tanvir@example.com"
                  value={v.email}
                  onChange={(e) => set("email", e.target.value)}
                  data-testid="f-email"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}
                />
                <span className="hint" style={{ fontSize: 11.5, color: "#64748B", marginTop: 4, display: "block" }}>
                  Your primary BizTrackBD dashboard login email.
                </span>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <label className="field">
                  <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                    Choose password *
                  </span>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 chars"
                      value={v.password}
                      onChange={(e) => set("password", e.target.value)}
                      data-testid="f-password"
                      style={{ width: "100%", padding: "10px 34px 10px 12px", borderRadius: 8, fontSize: 14 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: 2,
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span className="label" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                    Confirm password *
                  </span>
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={v.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    data-testid="f-confirmPassword"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}
                  />
                </label>
              </div>

              {/* Sample Data Toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={v.demoData}
                  onChange={(e) => set("demoData", e.target.checked)}
                  data-testid="f-demo"
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--brand, #11795A)" }}
                />
                <span style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.4 }}>
                  <b>Pre-load starter sample products &amp; delivery zones</b> so you can test orders and invoices immediately.
                </span>
              </label>

              {state.error && (
                <div
                  className="err"
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 8,
                    color: "#DC2626",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                  data-testid="signup-error"
                >
                  ⚠️ {state.error}
                </div>
              )}
            </div>
          )}

          {/* Validation Alert */}
          {problem && (
            <div
              className="err"
              role="alert"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                color: "#DC2626",
                fontSize: 13,
                fontWeight: 600,
              }}
              data-testid="step-problem"
            >
              ⚠️ {problem}
            </div>
          )}

          {/* =========================================================================
              STICKY BOTTOM ACTION BAR (Above virtual keyboard with safe area)
              ========================================================================= */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "#FFFFFF",
              borderTop: "1px solid var(--line, #E2E8F0)",
              padding: "12px 0 env(safe-area-inset-bottom, 12px)",
              marginTop: 20,
              display: "flex",
              gap: 10,
              zIndex: 30,
              boxShadow: "0 -4px 12px rgba(0,0,0,0.03)",
            }}
          >
            {step > 0 && (
              <button
                key="back"
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => {
                  setProblem(null);
                  setStep(step - 1);
                }}
                disabled={pending}
                data-testid="back"
                style={{
                  minWidth: 84,
                  padding: "11px 16px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1.5px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            )}

            {step < 3 ? (
              <button
                key="next"
                type="button"
                className="btn btn-primary btn-lg"
                onClick={next}
                disabled={pending}
                data-testid="next"
                style={{
                  flex: 1,
                  padding: "11px 20px",
                  borderRadius: 10,
                  fontSize: 14.5,
                  fontWeight: 700,
                  background: "var(--brand, #11795A)",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(17, 121, 90, 0.25)",
                }}
              >
                Continue to {steps[step + 1]} →
              </button>
            ) : (
              <button
                key="create"
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={pending}
                data-testid="create"
                style={{
                  flex: 1,
                  padding: "11px 20px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  background: pending ? "#0F766E" : "var(--brand, #11795A)",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(17, 121, 90, 0.35)",
                }}
              >
                {pending
                  ? "Creating your store…"
                  : isPortfolio
                  ? "Launch My Website 🚀"
                  : "Launch My Store (14-Day Free Trial) 🚀"}
              </button>
            )}
          </div>

          <p className="hint" style={{ marginTop: 14, fontSize: 11.5, lineHeight: 1.4, textAlign: "center", color: "var(--ink-3, #64748B)" }}>
            By creating an account, you agree to BizTrackBD Terms. 100% of customer payments go directly to your personal or merchant account. 0% sales commission.
          </p>
        </form>
      </div>

      {/* Right Column: Live Store Preview & Setup Summary */}
      <aside className="split-side" aria-label={isPortfolio ? "Website preview and setup summary" : "Store preview and setup summary"}>
        <div className="side-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="eyebrow" style={{ margin: 0, fontSize: 11.5 }}>
              {isPortfolio ? "Live Website Preview" : "Live Store Preview"}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#0B4D3B",
                background: "#E3F1EA",
                padding: "2px 8px",
                borderRadius: 99,
              }}
            >
              14 Days Free Pro
            </span>
          </div>

          <div
            style={{
              position: "relative",
              height: 185,
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--soft)",
              border: "1px solid var(--line)",
              marginBottom: 14,
            }}
          >
            <Image
              src={`/templates/${isPortfolio ? v.theme : (chosenTheme?.look ?? v.theme)}.webp`}
              alt={`${chosenTheme?.name} preview`}
              fill
              sizes="340px"
              style={{ objectFit: "cover", objectPosition: "top" }}
            />
            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: -6,
                width: "28%",
                height: "75%",
                borderRadius: 8,
                overflow: "hidden",
                border: "2px solid #FFFFFF",
                boxShadow: "0 4px 12px rgba(11, 77, 59, 0.2)",
              }}
            >
              <Image
                src={`/templates/${isPortfolio ? v.theme : (chosenTheme?.look ?? v.theme)}-phone.webp`}
                alt={`${chosenTheme?.name} phone preview`}
                fill
                sizes="90px"
                style={{ objectFit: "cover", objectPosition: "top" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                {isPortfolio ? "Website name:" : "Store name:"}
              </span>
              <b style={{ color: "var(--ink)", textAlign: "right" }}>
                {v.storeName || (isPortfolio ? "My Business Website" : "My Online Store")}
              </b>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                {isPortfolio ? "Industry:" : "Category:"}
              </span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                {isPortfolio
                  ? `${chosenVertical.icon} ${chosenVertical.name}`
                  : `${chosenCat.icon} ${chosenCat.name}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Web address:</span>
              <span style={{ color: "var(--brand, #11795A)", fontWeight: 700, fontFamily: "monospace" }}>
                {v.subdomain ? `${v.subdomain}.${displayHost}` : `yourshop.${displayHost}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Template:</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{chosenTheme?.name || "Kapor"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Plan:</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                {chosenPlan?.name || "Pro"} (Free 14-day trial, then {taka(chosenPlan?.priceMonthly || 1499)}/mo)
              </span>
            </div>
          </div>
        </div>

        <div className="side-card">
          <span className="eyebrow" style={{ fontSize: 11.5, marginBottom: 12 }}>
            What happens immediately
          </span>
          <div style={{ display: "grid", gap: 14 }}>
            <div className="timeline-item">
              <div className="timeline-dot">1</div>
              <div>
                <b style={{ fontSize: 13.5, color: "var(--ink)" }}>1-Click Auto Login</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                  You are instantly signed in to your BizTrackBD admin dashboard.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">2</div>
              <div>
                <b style={{ fontSize: 13.5, color: "var(--ink)" }}>{isPortfolio ? "Starter Website Content" : "Starter Catalog Ready"}</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                  {isPortfolio
                    ? `Sample ${chosenVertical.name} pages and booking inquiry forms are pre-loaded.`
                    : `Your ${chosenCat.name} sample products, sizes, and courier delivery zones are ready to test.`}
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">3</div>
              <div>
                <b style={{ fontSize: 13.5, color: "var(--ink)" }}>bKash, Nagad &amp; Couriers</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                  Connect Steadfast, Pathao, RedX, and payment numbers directly from the settings area.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
