"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { checkAddressAction, signupAction, type SignupState } from "./actions";

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
    hint: "শাড়ি, পাঞ্জাবি, থ্রি-পিস, জুতা ও ক্লোথিং",
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
    hint: "মোবাইল এক্সেসরিজ, অডিও ও স্মার্ট ডিভাইস",
    theme: "boithok",
  },
  {
    id: "GROCERY" as StoreCategory,
    name: "Grocery & Organics",
    bn: "মুদি ও অর্গানিক ফুড",
    icon: "🍯",
    hint: "মধু, ঘি, মসলা ও খাঁটি অর্গানিক ফুড",
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
    hint: "Digital menu, table reservations & location showcase",
    recommendedTheme: "dhaka-bistro",
  },
  {
    id: "DOCTOR_CLINIC",
    name: "Doctor, Specialist & Clinic",
    bn: "ডাক্তার, চেম্বার ও ক্লিনিক",
    icon: "🩺",
    hint: "Degrees, chamber schedules & appointment requests",
    recommendedTheme: "modern-clinic",
  },
  {
    id: "BUSINESS_COMPANY",
    name: "Company & Corporate Agency",
    bn: "কোম্পানি, কর্পোরেট ও এজেন্সি",
    icon: "🏢",
    hint: "Company overview, services, case studies & client quotes",
    recommendedTheme: "apex-corporate",
  },
  {
    id: "SERVICE_PROVIDER",
    name: "Service Provider & Consultant",
    bn: "সার্ভিস প্রোভাইডার ও কনসালট্যান্ট",
    icon: "💼",
    hint: "Services with pricing, coverage area & booking leads",
    recommendedTheme: "local-service-pro",
  },
  {
    id: "PERSONAL_PORTFOLIO",
    name: "Personal Portfolio & Resume",
    bn: "ব্যক্তিগত পোর্টফোলিও ও সিভি",
    icon: "📁",
    hint: "Showcase creative work, career milestones & CV download",
    recommendedTheme: "portfolio-focus",
  },
  {
    id: "PUBLIC_FIGURE",
    name: "Public Figure & Creator",
    bn: "পাবলিক ফিগার ও কনটেন্ট ক্রিয়েটর",
    icon: "⭐",
    hint: "Press links, biography, event schedule & speaking booking",
    recommendedTheme: "axionwear",
  },
];

const COMMERCE_STEPS = ["Store & Category", "Store Address", "Account & Launch"] as const;
const BUSINESS_STEPS = ["Business & Industry", "Website Address", "Account & Launch"] as const;

const FIELD_STEP: Record<string, number> = {
  storeName: 0,
  siteMode: 0,
  businessVertical: 0,
  category: 0,
  tagline: 0,
  theme: 0,
  subdomain: 1,
  ownerName: 2,
  email: 2,
  phone: 2,
  password: 2,
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
  const [touchedTheme, setTouchedTheme] = useState(false);
  const [address, setAddress] = useState<{ ok: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const checkId = useRef(0);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));

  const [migrationInfo, setMigrationInfo] = useState<{ platform: string; totalProducts: number } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("biztrack_migration_catalog");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.totalProducts > 0) {
          setMigrationInfo({ platform: parsed.platform, totalProducts: parsed.totalProducts });
        }
      }
    } catch {}
  }, []);

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

  // Server error fallback
  useEffect(() => {
    if (state.error && state.field && FIELD_STEP[state.field] !== undefined) {
      setStep(FIELD_STEP[state.field]!);
    }
  }, [state]);

  function handleCategorySelect(catId: StoreCategory) {
    const cat = CATEGORY_OPTIONS.find((c) => c.id === catId);
    set("category", catId);
    if (!touchedTheme && cat && v.siteMode === "ECOMMERCE") {
      const matching = themes.find((t) => t.id === cat.theme && t.live);
      if (matching) {
        set("theme", matching.id);
      }
    }
  }

  function handleVerticalSelect(vertId: BusinessVertical) {
    const vert = VERTICAL_OPTIONS.find((c) => c.id === vertId);
    set("businessVertical", vertId);
    if (!touchedTheme && vert) {
      const matching = themes.find((t) => t.id === vert.recommendedTheme && t.live);
      if (matching) {
        set("theme", matching.id);
      }
    }
  }

  function handleModeSelect(mode: "ECOMMERCE" | "PORTFOLIO" | "HYBRID") {
    set("siteMode", mode);
    if (mode === "PORTFOLIO" && !touchedTheme) {
      const vert = VERTICAL_OPTIONS.find((o) => o.id === v.businessVertical) ?? VERTICAL_OPTIONS[0]!;
      const matching = themes.find((t) => t.id === vert.recommendedTheme && t.live);
      if (matching) set("theme", matching.id);
    } else if (mode === "ECOMMERCE" && !touchedTheme) {
      const cat = CATEGORY_OPTIONS.find((c) => c.id === v.category) ?? CATEGORY_OPTIONS[0]!;
      const matching = themes.find((t) => t.id === cat.theme && t.live);
      if (matching) set("theme", matching.id);
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
      if (v.subdomain.length < 3) return "Choose an address of at least 3 letters or numbers";
      if (address && !address.ok) return address.message;
    }
    if (s === 2) {
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
    setStep(step + 1);
  }

  const chosenCat = CATEGORY_OPTIONS.find((c) => c.id === v.category) ?? CATEGORY_OPTIONS[0]!;
  const chosenVertical = VERTICAL_OPTIONS.find((c) => c.id === v.businessVertical) ?? VERTICAL_OPTIONS[0]!;
  const isPortfolio = v.siteMode === "PORTFOLIO";
  const isHybrid = v.siteMode === "HYBRID";
  const steps = isPortfolio ? BUSINESS_STEPS : COMMERCE_STEPS;
  const plans = isPortfolio ? businessPlans : commercePlans;
  const defaultTheme: Theme = { id: "kapor", name: "Kapor", blurb: "Modern fashion & apparel theme", live: true };
  const chosenTheme: Theme = themes.find((t) => t.id === v.theme) ?? themes[0] ?? defaultTheme;
  const defaultPlan: Plan = isPortfolio
    ? { tier: "PRO", name: "Business", priceMonthly: 799, blurb: "Business website features with a 14-day free trial" }
    : { tier: "PRO", name: "Pro", priceMonthly: 1499, blurb: "Commerce features with a 14-day free trial" };
  const chosenPlan: Plan = plans.find((p) => p.tier === v.plan) ?? plans[0] ?? defaultPlan;
  const displayHost = rootDomain.replace(/:\d+$/, "");

  return (
    <div className="split-start">
      <div className="split-form">
        {keepCode && keptProductsCount !== undefined && (
          <div className="notice" role="status" data-testid="keep-note" style={{ marginBottom: 20 }}>
            Your demo store comes with you: {keptProductsCount}{" "}
            {keptProductsCount === 1 ? "product" : "products"}, pictures, and home page settings. Finish signing up to keep it active.
          </div>
        )}

        <form action={action} className="wizard" data-testid="wizard" noValidate>
          <div style={{ marginBottom: 20 }}>
            <span
              className="eyebrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 99,
                background: "var(--tint)",
                color: "var(--brand)",
                fontWeight: 700,
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <span>✨</span> 14-Day Free Pro Trial · No Credit Card Required
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.2 }}>
              {isPortfolio
                ? "Launch your business website in 30 seconds"
                : isHybrid
                ? "Launch your hybrid store & website in 30 seconds"
                : "Launch your online store in 30 seconds"}
            </h1>
            <p className="muted" style={{ marginTop: 6, fontSize: 14.5 }}>
              {isPortfolio
                ? "Showcase your services, menu, portfolio, and capture direct customer leads & booking requests."
                : isHybrid
                ? "Showcase your business while selling merchandise and products with online checkout."
                : "Sell online across Bangladesh with Cash on Delivery, bKash, and automated courier pickup."}
            </p>
          </div>

          {/* Stepper Indicator */}
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
            aria-label={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
            style={{ marginBottom: 24 }}
          >
            {steps.map((s, i) => (
              <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <i className={i <= step ? "on" : ""} style={{ height: 6 }} />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: i === step ? 700 : 500,
                    color: i === step ? "var(--brand)" : i < step ? "var(--ink-2)" : "var(--ink-3)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {i + 1}. {s}
                </span>
              </div>
            ))}
          </div>

          {/* Hidden Form Inputs */}
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
          {v.demoData && <input type="hidden" name="demoData" value="on" />}
          {keepCode && <input type="hidden" name="from" value={keepCode} />}

          {/* Honeypot field */}
          <div className="hp" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {migrationInfo && (
            <div
              style={{
                background: "var(--tint)",
                border: "1px solid var(--tint-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13.5,
                color: "var(--ink)",
              }}
            >
              <span style={{ fontSize: 16 }}>📦</span>
              <div>
                <b>{migrationInfo.totalProducts} products detected from {migrationInfo.platform.toUpperCase()}</b>.
                After your store is created, your catalog can be imported directly in Store Admin &rarr; Products &rarr; Import.
              </div>
            </div>
          )}

          {/* STEP 1: Store & Category / Business Mode */}
          {step === 0 && (
            <div data-testid="step-store-category">
              <h2 style={{ fontSize: 19, marginBottom: 14, color: "var(--ink)", fontWeight: 700 }}>
                1. What are you building & what is your business called?
              </h2>

              {/* Mode Selector */}
              <div style={{ marginBottom: 18 }}>
                <span className="label" style={{ display: "block", marginBottom: 8 }}>
                  Select what you are creating *
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    data-testid="mode-ecommerce"
                    onClick={() => handleModeSelect("ECOMMERCE")}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: v.siteMode === "ECOMMERCE" ? "2px solid var(--brand)" : "1.5px solid var(--line)",
                      background: v.siteMode === "ECOMMERCE" ? "var(--tint)" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 22 }}>🛍️</span>
                      {v.siteMode === "ECOMMERCE" && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: "var(--brand)", padding: "2px 6px", borderRadius: 6 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Online Store</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.3 }}>
                      Cart, checkout, bKash & courier booking
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="mode-portfolio"
                    onClick={() => handleModeSelect("PORTFOLIO")}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: v.siteMode === "PORTFOLIO" ? "2px solid var(--brand)" : "1.5px solid var(--line)",
                      background: v.siteMode === "PORTFOLIO" ? "var(--tint)" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 22 }}>💼</span>
                      {v.siteMode === "PORTFOLIO" && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: "var(--brand)", padding: "2px 6px", borderRadius: 6 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Website & Portfolio</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.3 }}>
                      Showcase services, menu, bookings & leads
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="mode-hybrid"
                    onClick={() => handleModeSelect("HYBRID")}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: v.siteMode === "HYBRID" ? "2px solid var(--brand)" : "1.5px solid var(--line)",
                      background: v.siteMode === "HYBRID" ? "var(--tint)" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 22 }}>⚡</span>
                      {v.siteMode === "HYBRID" && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: "var(--brand)", padding: "2px 6px", borderRadius: 6 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Hybrid Business + Store</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.3 }}>
                      Website with direct online merchandise sales
                    </div>
                  </button>
                </div>
              </div>

              <label className="field">
                <span className="label">
                  {isPortfolio ? "Website or business name *" : "Store name *"}
                </span>
                <input
                  className="input"
                  autoFocus
                  placeholder={
                    isPortfolio
                      ? "e.g. Dhaka Bistro, Dr. Sarah Clinic, Apex Legal Counsel"
                      : "e.g. Dhaka Artisan Crafts, Aarohi Fashion, Gadget Pulse"
                  }
                  value={v.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  data-testid="f-storeName"
                />
                <span className="hint">
                  {isPortfolio
                    ? "This appears on your website header, meta tags, and visitor contact responses."
                    : "This appears on your storefront, customer invoices, and SMS receipts."}
                </span>
              </label>

              {/* Vertical Selection for Portfolio or Hybrid */}
              {(isPortfolio || isHybrid) && (
                <div className="field" style={{ marginTop: 14 }}>
                  <span className="label">Select your business type & industry *</span>
                  <span className="hint" style={{ marginBottom: 6 }}>
                    Pre-configures your starter layout, pages, credentials, and lead forms.
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {VERTICAL_OPTIONS.map((vert) => {
                      const selected = v.businessVertical === vert.id;
                      return (
                        <button
                          key={vert.id}
                          type="button"
                          data-testid={`vertical-${vert.id.toLowerCase()}`}
                          onClick={() => handleVerticalSelect(vert.id)}
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: selected ? "2px solid var(--brand)" : "1.5px solid var(--line)",
                            background: selected ? "var(--tint)" : "#FFFFFF",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 22 }}>{vert.icon}</span>
                            {selected && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#FFFFFF",
                                  background: "var(--brand)",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                }}
                              >
                                Selected
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{vert.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 600 }}>{vert.bn}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.3, marginTop: 2 }}>
                            {vert.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Selection for Ecommerce or Hybrid */}
              {(!isPortfolio || isHybrid) && (
                <div className="field" style={{ marginTop: 14 }}>
                  <span className="label">
                    {isHybrid ? "Select merchandise product category *" : "Select your business category *"}
                  </span>
                  <span className="hint" style={{ marginBottom: 6 }}>
                    Pre-configures your starter catalog, sizes, attributes, and courier shipping zones.
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {CATEGORY_OPTIONS.map((cat) => {
                      const selected = v.category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          data-testid={`category-${cat.id.toLowerCase()}`}
                          onClick={() => handleCategorySelect(cat.id)}
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: selected ? "2px solid var(--brand)" : "1.5px solid var(--line)",
                            background: selected ? "var(--tint)" : "#FFFFFF",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 22 }}>{cat.icon}</span>
                            {selected && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#FFFFFF",
                                  background: "var(--brand)",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                }}
                              >
                                Selected
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{cat.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 600 }}>{cat.bn}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.3, marginTop: 2 }}>
                            {cat.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="field" style={{ marginTop: 16 }}>
                <span className="label">
                  One-line tagline <span className="hint" style={{ fontWeight: 400 }}>(optional)</span>
                </span>
                <input
                  className="input"
                  maxLength={120}
                  placeholder={
                    isPortfolio
                      ? "e.g. Modern wood-fired artisan pizza & Italian espresso in Gulshan 2"
                      : "e.g. Authentic handloom sarees & pure cotton panjabi from Narayanganj"
                  }
                  value={v.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  data-testid="f-tagline"
                />
              </label>

              {/* Collapsible Storefront / Website Template Selection */}
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                      {isPortfolio ? "Website Template" : "Storefront Template"}: <b>{chosenTheme.name}</b>
                    </span>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
                      Tailored for {isPortfolio ? chosenVertical.name : chosenCat.name}. You can switch themes at any time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowThemePicker(!showThemePicker)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--brand)",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    {showThemePicker ? "Hide options ▲" : "Change template ▼"}
                  </button>
                </div>

                {showThemePicker && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: 8,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTouchedTheme(true);
                          set("theme", t.id);
                        }}
                        disabled={!t.live}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: v.theme === t.id ? "2px solid var(--brand)" : "1px solid var(--line)",
                          background: v.theme === t.id ? "#FFFFFF" : "transparent",
                          cursor: t.live ? "pointer" : "not-allowed",
                          opacity: t.live ? 1 : 0.5,
                        }}
                      >
                        <b style={{ fontSize: 12.5, color: "var(--ink)" }}>{t.name}</b>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{t.blurb}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Store Web Address */}
          {step === 1 && (
            <div data-testid="step-address">
              <h2 style={{ fontSize: 19, marginBottom: 14, color: "var(--ink)", fontWeight: 700 }}>
                2. Choose your {isPortfolio ? "website" : "store"} web address
              </h2>
              <div className="field">
                <label className="label" htmlFor="sub">
                  {isPortfolio ? "Website" : "Store"} subdomain URL *
                </label>
                <div className="addr">
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
                  />
                  <span>.{displayHost}</span>
                </div>

                <div id="sub-msg" aria-live="polite" data-testid="address-status" style={{ marginTop: 8 }}>
                  {address &&
                    (address.ok ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          borderRadius: 8,
                          padding: "6px 12px",
                          color: "#065F46",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <span>✓</span>
                        <span>{v.subdomain}.{displayHost} is free & ready to claim!</span>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            borderRadius: 8,
                            padding: "6px 12px",
                            color: "#991B1B",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          <span>✗</span>
                          <span>{address.message}</span>
                        </div>
                        {address.message.toLowerCase().includes("taken") && (
                          <div style={{ marginTop: 10, fontSize: 13 }}>
                            <span className="muted" style={{ marginRight: 6 }}>Available suggestions:</span>
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
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    padding: "4px 10px",
                                    border: "1px solid var(--line, #e2e8f0)",
                                    borderRadius: 6,
                                    background: "#fff",
                                    color: "var(--brand)",
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

                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 14px",
                    background: "var(--soft)",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  💡 <b>Custom domain:</b> You can connect your own domain (e.g.{" "}
                  <code style={{ background: "#fff", padding: "1px 5px", borderRadius: 4 }}>www.{v.subdomain || "yourbrand"}.com</code>
                  ) with an automated SSL certificate from your BizTrackBD dashboard.
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Owner Credentials & Launch */}
          {step === 2 && (
            <div data-testid="step-account">
              <h2 style={{ fontSize: 19, marginBottom: 14, color: "var(--ink)", fontWeight: 700 }}>
                3. {isPortfolio ? "Website" : "Store"} owner credentials &amp; password
              </h2>

              <label className="field">
                <span className="label">Your full name *</span>
                <input
                  className="input"
                  autoComplete="name"
                  placeholder="e.g. Tanvir Ahmed"
                  value={v.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  data-testid="f-ownerName"
                />
              </label>

              <label className="field">
                <span className="label">Mobile number *</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01712345678"
                  value={v.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  data-testid="f-phone"
                />
                <span className="hint">Used for SMS order alerts, courier sync, and Dhaka support.</span>
              </label>

              <label className="field">
                <span className="label">Email address *</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="tanvir@example.com"
                  value={v.email}
                  onChange={(e) => set("email", e.target.value)}
                  data-testid="f-email"
                />
                <span className="hint">Your main BizTrackBD dashboard login email.</span>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="label">Choose password *</span>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 chars"
                      value={v.password}
                      onChange={(e) => set("password", e.target.value)}
                      data-testid="f-password"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        color: "var(--ink-3)",
                      }}
                      tabIndex={-1}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span className="label">Confirm password *</span>
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={v.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    data-testid="f-confirmPassword"
                  />
                </label>
              </div>

              {/* Starter Catalog Pre-seeding checkbox */}
              <label
                className="opt"
                style={{
                  marginTop: 10,
                  marginBottom: 16,
                  borderColor: v.demoData ? "var(--brand)" : "var(--line)",
                  background: v.demoData ? "var(--tint)" : "#FFFFFF",
                }}
              >
                <input
                  type="checkbox"
                  checked={v.demoData}
                  onChange={(e) => set("demoData", e.target.checked)}
                  data-testid="f-demo"
                />
                <div>
                  <b style={{ color: "var(--ink)", fontSize: 14 }}>
                    {isPortfolio
                      ? `Pre-populate sample ${chosenVertical.name} content (${chosenVertical.icon})`
                      : `Pre-populate ${chosenCat.name} sample catalog (${chosenCat.icon})`}
                  </b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>
                    {isPortfolio
                      ? "Includes clearly labelled sample services, profile content, and enquiry examples for your selected industry. You can edit or remove them before publishing."
                      : "Includes 3 sample products with Bangladeshi pricing, variants, and delivery rates. You can test orders and edit or remove them anytime."}
                  </div>
                </div>
              </label>

              {/* 14-day Free Pro Trial Banner */}
              <div
                style={{
                  border: "1.5px solid #A7F3D0",
                  background: "#ECFDF5",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 22 }}>🎁</span>
                <div style={{ flex: 1, fontSize: 13.5, color: "#065F46" }}>
                  <b style={{ display: "block", fontSize: 14, marginBottom: 2 }}>
                    {chosenPlan.name} Trial Selected (14 Days · ৳0 Today)
                  </b>
                  <span>
                    {isPortfolio
                      ? "Includes your website builder, custom-domain path, structured content, and enquiry inbox. No credit card required."
                      : "Includes POS billing, barcode tools, courier booking, and bKash/Nagad checkout. No credit card required."}
                  </span>
                </div>
              </div>

              {state.error && (
                <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="signup-error">
                  ⚠️ {state.error}
                </div>
              )}
            </div>
          )}

          {problem && (
            <div className="err" role="alert" style={{ marginBottom: 14 }} data-testid="step-problem">
              ⚠️ {problem}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="nav-row" style={{ marginTop: 20 }}>
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
              >
                ← Back
              </button>
            )}
            {step < 2 ? (
              <button
                key="next"
                type="button"
                className="btn btn-primary btn-lg"
                onClick={next}
                disabled={pending}
                data-testid="next"
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
                  background: pending ? "#4338CA" : "var(--brand)",
                  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.35)",
                }}
              >
                {pending
                  ? "Creating your website…"
                  : isPortfolio
                  ? "Launch My Website 🚀"
                  : "Launch My Store 🚀"}
              </button>
            )}
          </div>

          <p className="hint" style={{ marginTop: 18, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            By creating an account, you agree to BizTrackBD Terms. 100% of customer payments go directly to your personal or merchant account. 0% sales commission.
          </p>
        </form>
      </div>

      {/* Right Column: Dynamic Live Preview & Timeline Sidebar */}
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
                color: "#065F46",
                background: "#D1FAE5",
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
              src={`/templates/${chosenTheme?.look ?? v.theme}.webp`}
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
                boxShadow: "0 4px 12px rgba(26,26,78,0.2)",
              }}
            >
              <Image
                src={`/templates/${chosenTheme?.look ?? v.theme}-phone.webp`}
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
              <span style={{ color: "var(--brand)", fontWeight: 700, fontFamily: "monospace" }}>
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
                {chosenPlan?.name} (Free Trial, {taka(chosenPlan?.priceMonthly || 699)}/mo after)
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
                  You will be signed in to your BizTrackBD dashboard after account verification and setup complete.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">2</div>
              <div>
                <b style={{ fontSize: 13.5, color: "var(--ink)" }}>{isPortfolio ? "Starter Website Content" : "Starter Catalog Ready"}</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                  {isPortfolio
                    ? `Sample ${chosenVertical.name} sections and content are pre-loaded for you to review before publishing.`
                    : `Your ${chosenCat.name} starter items, variants, and delivery fees are pre-loaded to test orders.`}
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">3</div>
              <div>
                <b style={{ fontSize: 13.5, color: "var(--ink)" }}>{isPortfolio ? "Enquiry & Contact Setup" : "bKash & Courier Integration"}</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                  {isPortfolio
                    ? "Add your WhatsApp number, contact details, service information, and enquiry preferences from one setup area."
                    : "Connect your supported courier account and payment details from the integrations area."}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line)",
              marginTop: 16,
              paddingTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 12,
              color: "var(--ink-2)",
              fontWeight: 600,
            }}
          >
            {isPortfolio ? (
              <>
                <div>🌐 Custom-domain connection path with managed SSL</div>
                <div>📥 Enquiry inbox with private status and notes</div>
                <div>🇧🇩 Bangla and English website content support</div>
              </>
            ) : (
              <>
                <div>🔒 Customer payments go directly to you (0% commission)</div>
                <div>🚚 Supported courier booking from the order desk</div>
                <div>🇧🇩 Bangladesh-focused commerce setup</div>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
