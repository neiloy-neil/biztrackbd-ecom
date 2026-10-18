"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import type { BusinessAccountSummary } from "@biztrackbd/core";
import { switchBusinessAction, createBusinessAction, type CreateBusinessState } from "@/app/(admin)/business-actions";
import { ChevronIcon, PlusIcon } from "./icons";

export interface BusinessSwitcherProps {
  businesses: BusinessAccountSummary[];
  currentTenantId: string;
  currentSubdomain: string;
  storeName: string;
  rootDomain?: string;
  lang?: "en" | "bn";
  compact?: boolean;
}

interface VerticalInfo {
  icon: string;
  label: string;
  labelBn: string;
  color: string;
  bg: string;
}

function getVerticalInfo(siteMode: string, vertical?: string | null): VerticalInfo {
  if (siteMode === "PORTFOLIO") {
    switch (vertical) {
      case "RESTAURANT":
        return { icon: "🍽️", label: "Restaurant", labelBn: "রেস্তোরাঁ", color: "#f97316", bg: "rgba(249,115,22,0.12)" };
      case "DOCTOR_CLINIC":
        return { icon: "🏥", label: "Healthcare", labelBn: "ক্লিনিক", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" };
      case "BUSINESS_COMPANY":
        return { icon: "🏢", label: "Company", labelBn: "কোম্পানি", color: "#6366f1", bg: "rgba(99,102,241,0.12)" };
      case "SERVICE_PROVIDER":
        return { icon: "💼", label: "Services", labelBn: "সেবা", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
      case "PUBLIC_FIGURE":
        return { icon: "🎤", label: "Public Figure", labelBn: "পাবলিক ফিগার", color: "#ec4899", bg: "rgba(236,72,153,0.12)" };
      case "PERSONAL_PORTFOLIO":
        return { icon: "🎨", label: "Portfolio", labelBn: "পোর্টফোলিও", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" };
      default:
        return { icon: "🌐", label: "Business Website", labelBn: "ওয়েবসাইট", color: "#64748b", bg: "rgba(100,116,139,0.12)" };
    }
  }
  return { icon: "🛍️", label: "Ecommerce Store", labelBn: "ই-কমার্স শপ", color: "#10b981", bg: "rgba(16,185,129,0.12)" };
}

export function BusinessSwitcher({
  businesses,
  currentTenantId,
  currentSubdomain,
  storeName,
  rootDomain = "localhost:3000",
  lang = "en",
  compact = false,
}: BusinessSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        if (modalOpen) setModalOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  // Current active business
  const activeBiz = businesses.find((b) => b.tenantId === currentTenantId || b.subdomain === currentSubdomain) || {
    tenantId: currentTenantId,
    subdomain: currentSubdomain,
    storeName,
    role: "STORE_OWNER" as any,
    name: "Owner",
    isActive: true,
    tenantStatus: "ACTIVE",
    siteMode: "ECOMMERCE",
    businessVertical: null,
    customDomain: null,
    isCurrent: true,
  };

  const vInfo = getVerticalInfo(activeBiz.siteMode, activeBiz.businessVertical);

  const handleSwitch = (tenantId: string, subdomain: string) => {
    setSwitchingTo(tenantId);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("tenantId", tenantId);
      fd.append("subdomain", subdomain);
      await switchBusinessAction(fd);
    });
  };

  return (
    <div
      ref={containerRef}
      className={`biz-switcher-wrapper ${compact ? "compact" : ""}`}
      style={{ position: "relative" }}
    >
      {/* Trigger Button inside .store-chip to keep design & e2e intact */}
      <button
        type="button"
        className="store-chip biz-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Switch Business"
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: isOpen ? "1px solid var(--accent, #0070f3)" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "var(--sb-chip, rgba(255,255,255,0.06))",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(0,112,243,0.18)" : "none",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: "14px" }} role="img" aria-label={vInfo.label}>
              {vInfo.icon}
            </span>
            <b
              style={{
                fontSize: "14px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "inline-block",
                maxWidth: compact ? "140px" : "180px",
              }}
            >
              {activeBiz.storeName || storeName}
            </b>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", opacity: 0.85 }}>
            <span
              style={{
                display: "inline-block",
                padding: "1px 5px",
                borderRadius: "4px",
                fontWeight: 600,
                fontSize: "10px",
                color: vInfo.color,
                backgroundColor: vInfo.bg,
              }}
            >
              {lang === "bn" ? vInfo.labelBn : vInfo.label}
            </span>
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: compact ? "110px" : "150px",
              }}
            >
              {activeBiz.customDomain || `${activeBiz.subdomain}.${rootDomain}`}
            </span>
          </div>
        </div>

        <div
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            opacity: 0.7,
            flexShrink: 0,
          }}
        >
          <ChevronIcon width={16} height={16} />
        </div>
      </button>

      {/* Switcher Dropdown */}
      {isOpen && (
        <div
          className="biz-switcher-dropdown card"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: compact ? 280 : 310,
            maxWidth: "92vw",
            zIndex: 1000,
            padding: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            borderRadius: "12px",
            border: "1px solid var(--line, rgba(255,255,255,0.1))",
            backgroundColor: "var(--bg-card, #1c1d21)",
            backdropFilter: "blur(16px)",
            animation: "bizFadeIn 0.15s ease-out",
          }}
        >
          <div
            style={{
              padding: "6px 8px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--line, rgba(255,255,255,0.08))",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.65 }}>
              {lang === "bn" ? "আপনার প্রতিষ্ঠানসমূহ" : "Your Businesses"}
            </span>
            <span
              style={{
                fontSize: "11px",
                background: "var(--tint, rgba(255,255,255,0.08))",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {businesses.length || 1}
            </span>
          </div>

          <div
            className="biz-list"
            style={{
              maxHeight: "260px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {businesses.length === 0 ? (
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  background: "rgba(0,112,243,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{vInfo.icon}</span>
                <div>
                  <b>{activeBiz.storeName}</b>
                  <div style={{ fontSize: "11px", opacity: 0.7 }}>{activeBiz.subdomain} (Active)</div>
                </div>
              </div>
            ) : (
              businesses.map((biz) => {
                const isCurrent = biz.tenantId === currentTenantId || biz.subdomain === currentSubdomain;
                const bizVInfo = getVerticalInfo(biz.siteMode, biz.businessVertical);
                const isSwitchingThis = isPending && switchingTo === biz.tenantId;

                if (isCurrent) {
                  return (
                    <div
                      key={biz.tenantId}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,112,243,0.3)",
                        background: "rgba(0,112,243,0.12)",
                        color: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>{bizVInfo.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {biz.storeName}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", opacity: 0.7 }}>
                            <span style={{ color: bizVInfo.color, fontWeight: 600 }}>
                              {lang === "bn" ? bizVInfo.labelBn : bizVInfo.label}
                            </span>
                            <span>•</span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {biz.customDomain || biz.subdomain}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#0070f3",
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        ✓ {lang === "bn" ? "চলমান" : "Active"}
                      </span>
                    </div>
                  );
                }

                return (
                  <form key={biz.tenantId} action={switchBusinessAction} style={{ width: "100%" }}>
                    <input type="hidden" name="tenantId" value={biz.tenantId} />
                    <input type="hidden" name="subdomain" value={biz.subdomain} />
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid transparent",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--tint, rgba(255,255,255,0.06))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>{bizVInfo.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {biz.storeName}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", opacity: 0.7 }}>
                            <span style={{ color: bizVInfo.color, fontWeight: 600 }}>
                              {lang === "bn" ? bizVInfo.labelBn : bizVInfo.label}
                            </span>
                            <span>•</span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {biz.customDomain || biz.subdomain}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--accent, #0070f3)", opacity: 0.85, fontWeight: 600 }}>
                        {lang === "bn" ? "যান →" : "Switch →"}
                      </span>
                    </button>
                  </form>
                );
              })
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line, rgba(255,255,255,0.08))",
              marginTop: 6,
              paddingTop: 6,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setIsOpen(false);
                setModalOpen(true);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontWeight: 600,
              }}
            >
              <PlusIcon width={14} height={14} />
              <span>{lang === "bn" ? "নতুন প্রতিষ্ঠান যোগ করুন" : "+ Add New Business"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add New Business Modal Wizard */}
      {modalOpen && (
        <AddBusinessModal
          lang={lang}
          rootDomain={rootDomain}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Add New Business Modal Component (2-Step Wizard)
// -------------------------------------------------------------------------------------------------

interface AddBusinessModalProps {
  lang: "en" | "bn";
  rootDomain: string;
  onClose: () => void;
}

type VerticalChoice = {
  id: string;
  siteMode: "ECOMMERCE" | "PORTFOLIO";
  vertical: string | null;
  icon: string;
  title: string;
  titleBn: string;
  desc: string;
  descBn: string;
};

const VERTICAL_OPTIONS: VerticalChoice[] = [
  {
    id: "ecommerce",
    siteMode: "ECOMMERCE",
    vertical: null,
    icon: "🛍️",
    title: "Ecommerce Store",
    titleBn: "অনলাইন রিটেল শপ",
    desc: "Physical products, cart & checkout, bKash/Nagad, and courier home delivery.",
    descBn: "পণ্য বিক্রি, শপিং কার্ট, অনলাইন পেমেন্ট ও পাঠাও/স্টেডফাস্ট কুরিয়ার ডেলিভারি।",
  },
  {
    id: "restaurant",
    siteMode: "PORTFOLIO",
    vertical: "RESTAURANT",
    icon: "🍽️",
    title: "Restaurant & Dining",
    titleBn: "রেস্তোরাঁ ও ক্যাফে",
    desc: "Digital QR table ordering, kitchen print tickets (KOT), and visual food menu.",
    descBn: "ডিজিটাল কিউআর মেনু, টেবিল অর্ডার, কিচেন টোকেন (KOT) ও ফুড ক্যাটালগ।",
  },
  {
    id: "services",
    siteMode: "PORTFOLIO",
    vertical: "SERVICE_PROVIDER",
    icon: "💼",
    title: "Services & Agency",
    titleBn: "সার্ভিস ও এজেন্সি",
    desc: "Service packages, client inquiries, quote leads, and appointment bookings.",
    descBn: "সেবার তালিকা, কাস্টমার ইনকোয়ারি, কোটেশন লিড ও অ্যাপয়েন্টমেন্ট রিকোয়েস্ট।",
  },
  {
    id: "healthcare",
    siteMode: "PORTFOLIO",
    vertical: "DOCTOR_CLINIC",
    icon: "🏥",
    title: "Clinic & Healthcare",
    titleBn: "ক্লিনিক ও ডাক্তার চেম্বার",
    desc: "Doctor profiles, treatments, consultation bookings, and clinic location.",
    descBn: "ডাক্তার প্রোফাইল, পরামর্শ বুকিং, চিকিৎসা সেবা ও চেম্বার তথ্য।",
  },
];

function AddBusinessModal({ lang, rootDomain, onClose }: AddBusinessModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedVertical, setSelectedVertical] = useState<VerticalChoice>(VERTICAL_OPTIONS[0]!);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate subdomain from business name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!subdomainTouched) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
      setSubdomain(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError(lang === "bn" ? "প্রতিষ্ঠানের নাম লিখুন (কমপক্ষে ২ অক্ষর)" : "Please enter a valid business name.");
      return;
    }
    if (!subdomain.trim() || subdomain.trim().length < 3) {
      setError(lang === "bn" ? "সাবডোমেইন লিখুন (কমপক্ষে ৩ অক্ষর)" : "Subdomain must be at least 3 characters.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("subdomain", subdomain.trim().toLowerCase());
    fd.append("siteMode", selectedVertical.siteMode);
    if (selectedVertical.vertical) {
      fd.append("businessVertical", selectedVertical.vertical);
    }

    try {
      const res: CreateBusinessState = await createBusinessAction({}, fd);
      if (res?.error) {
        setError(res.error);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      // In Next.js redirect throws a NEXT_REDIRECT error which is expected on success
      if (err?.message?.includes("NEXT_REDIRECT")) {
        return;
      }
      setError(err?.message || "Failed to create business.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="card modal-dialog"
        style={{
          width: "100%",
          maxWidth: "540px",
          backgroundColor: "var(--bg-card, #1c1d21)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.36)",
          border: "1px solid var(--line, rgba(255,255,255,0.12))",
          position: "relative",
          animation: "bizModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px" }}>
              {lang === "bn" ? "নতুন প্রতিষ্ঠান যুক্ত করুন" : "Add Another Business"}
            </h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              {step === 1
                ? lang === "bn"
                  ? "ধাপ ১/২: প্রতিষ্ঠানের ধরন নির্বাচন করুন"
                  : "Step 1 of 2: Select business type & operating mode"
                : lang === "bn"
                ? "ধাপ ২/২: নাম ও নিজস্ব ওয়েবসাইট ঠিকানা দিন"
                : "Step 2 of 2: Business name & separate domain"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ borderRadius: "50%", width: 32, height: 32, padding: 0 }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="notice notice-bad"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: 16,
              fontSize: "13px",
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1: Select Vertical */}
        {step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {VERTICAL_OPTIONS.map((opt) => {
                const isSelected = selectedVertical.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedVertical(opt)}
                    style={{
                      textAlign: "left",
                      padding: "14px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #0070f3" : "1px solid var(--line, rgba(255,255,255,0.1))",
                      background: isSelected ? "rgba(0,112,243,0.08)" : "var(--tint, rgba(255,255,255,0.03))",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      color: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "24px" }}>{opt.icon}</span>
                      {isSelected && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0070f3" }}>● Selected</span>
                      )}
                    </div>
                    <b style={{ fontSize: "14px" }}>{lang === "bn" ? opt.titleBn : opt.title}</b>
                    <span style={{ fontSize: "11px", opacity: 0.75, lineHeight: 1.4 }}>
                      {lang === "bn" ? opt.descBn : opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                style={{ minWidth: 100 }}
              >
                {lang === "bn" ? "পরবর্তী ধাপ →" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Name & Subdomain */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "8px", background: "rgba(0,112,243,0.08)", marginBottom: 16 }}>
              <span style={{ fontSize: "18px" }}>{selectedVertical.icon}</span>
              <div style={{ fontSize: "13px" }}>
                <b>{lang === "bn" ? selectedVertical.titleBn : selectedVertical.title}</b>
                <span className="muted"> — {selectedVertical.siteMode === "ECOMMERCE" ? "Ecommerce" : "Business Website"}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "প্রতিষ্ঠানের নাম *" : "Business Name *"}
              </label>
              <input
                type="text"
                className="input"
                required
                autoFocus
                placeholder={
                  selectedVertical.id === "restaurant"
                    ? "e.g. Dhaka Bistro Lounge"
                    : selectedVertical.id === "ecommerce"
                    ? "e.g. Dhaka Bistro Goods & Merch"
                    : "e.g. Gulshan Consulting"
                }
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                style={{ width: "100%", padding: "10px 12px" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "ওয়েবসাইট সাবডোমেইন *" : "Storefront Subdomain *"}
              </label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="mybusiness"
                  value={subdomain}
                  onChange={(e) => {
                    setSubdomainTouched(true);
                    setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  style={{ flex: 1, padding: "10px 12px", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                />
                <span
                  style={{
                    padding: "10px 12px",
                    background: "var(--tint, rgba(255,255,255,0.08))",
                    border: "1px solid var(--line, rgba(255,255,255,0.15))",
                    borderLeft: "none",
                    borderTopRightRadius: "8px",
                    borderBottomRightRadius: "8px",
                    fontSize: "13px",
                    opacity: 0.8,
                  }}
                >
                  .{rootDomain}
                </span>
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: 4 }}>
                {lang === "bn"
                  ? "আপনার প্রতিষ্ঠানের আলাদা ওয়েবসাইট এই ঠিকানায় চালু হবে। পরে নিজস্ব ডোমেইন যোগ করতে পারবেন।"
                  : "Each business gets its own dedicated domain. You can connect a custom .com/.com.bd domain anytime."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => setStep(1)}
              >
                {lang === "bn" ? "← পেছনে" : "← Back"}
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={onClose}
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ minWidth: 140 }}
                >
                  {isSubmitting
                    ? lang === "bn"
                      ? "তৈরি হচ্ছে..."
                      : "Creating..."
                    : lang === "bn"
                    ? "প্রতিষ্ঠান তৈরি করুন"
                    : "Create Business"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
