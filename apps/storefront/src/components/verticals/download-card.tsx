"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Lang } from "@/lib/i18n-core";

export interface PublicDownloadItem {
  id: string;
  label: string;
  labelBn: string | null;
  kind: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  isPublic: boolean;
  requiresLead: boolean;
  downloadCount: number;
  sortOrder: number;
}

export interface DownloadCardSectionProps {
  title?: string;
  titleBn?: string;
  description?: string;
  descriptionBn?: string;
  fileUrl?: string;
  fileLabel?: string;
  buttonText?: string;
  buttonTextBn?: string;
  downloadId?: string;
  layout?: "single" | "grid";
  downloads?: PublicDownloadItem[];
  lang: Lang;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "PDF Document";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "CV":
      return "👤";
    case "BROCHURE":
      return "📑";
    case "PROFILE":
      return "🏢";
    case "MENU_PDF":
      return "🍽️";
    case "CATALOG":
      return "📦";
    default:
      return "📄";
  }
}

export function DownloadCardSection({
  title,
  titleBn,
  description,
  descriptionBn,
  fileUrl,
  fileLabel,
  buttonText,
  buttonTextBn,
  downloadId,
  layout = "single",
  downloads = [],
  lang,
}: DownloadCardSectionProps) {
  const isBn = lang === "bn";

  // Active modal state
  const [activeAsset, setActiveAsset] = useState<PublicDownloadItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Modal form fields & status
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [consent, setConsent] = useState(true);
  const [mountTime, setMountTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<{
    downloadUrl: string;
    fileName: string;
    whatsAppFollowUpUrl?: string | null;
  } | null>(null);

  // Determine primary asset
  const matchedAsset = downloadId
    ? downloads.find((d) => d.id === downloadId)
    : downloads[0];

  const primaryAsset: PublicDownloadItem = matchedAsset || {
    id: "default-download",
    label: title || (isBn ? "সিভি ডাউনলোড করুন" : "Download CV / Resume"),
    labelBn: titleBn || null,
    kind: "FILE",
    fileUrl: fileUrl || "#",
    fileName: "document.pdf",
    fileSize: null,
    mimeType: "application/pdf",
    isPublic: true,
    requiresLead: false,
    downloadCount: 0,
    sortOrder: 0,
  };

  const primaryHeading = isBn && primaryAsset.labelBn ? primaryAsset.labelBn : primaryAsset.label;
  const primaryDesc = isBn && descriptionBn ? descriptionBn : description || (isBn ? "সম্পূর্ণ তথ্য ও বিবরণ দেখতে ডাউনলোড করুন।" : "Get a comprehensive overview in downloadable format.");
  const primaryBtn = isBn && buttonTextBn ? buttonTextBn : buttonText || (isBn ? "ডাউনলোড করুন" : "Download");
  const primaryLabel = fileLabel || `${primaryAsset.fileName} · ${formatBytes(primaryAsset.fileSize)}`;

  // Open modal with W3C APG focus tracking
  const openModal = (asset: PublicDownloadItem, e: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = e.currentTarget;
    setActiveAsset(asset);
    setMountTime(Date.now());
    setErrorMessage(null);
    setDownloadResult(null);
    setName("");
    setContact("");
    setHoneypot("");
  };

  const closeModal = () => {
    setActiveAsset(null);
    setDownloadResult(null);
    setErrorMessage(null);
    // Restore focus to the trigger button
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation & Focus trap for W3C APG dialog
  useEffect(() => {
    if (!activeAsset) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first && last) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last && first) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAsset]);

  // Handle lead submission
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsset) return;

    const trimmedContact = contact.trim();
    if (!trimmedContact) {
      setErrorMessage(isBn ? "অনুগ্রহ করে আপনার মোবাইল নাম্বার বা ইমেইল দিন" : "Please provide your phone number or email");
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact);
    const phoneDigits = trimmedContact.replace(/[^0-9]/g, "");
    if (!isEmail && phoneDigits.length < 10) {
      setErrorMessage(isBn ? "অনুগ্রহ করে একটি সঠিক মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)" : "Please enter a valid phone number or email");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const elapsedMs = mountTime > 0 ? Date.now() - mountTime : 2000;

    try {
      const res = await fetch(`/api/downloads/${activeAsset.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: !isEmail ? trimmedContact : undefined,
          email: isEmail ? trimmedContact : undefined,
          hp: honeypot,
          elapsedMs,
          consentGiven: consent,
          sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
          locale: isBn ? "bn" : "en",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (isBn ? "অনুরোধ প্রক্রিয়া করতে ব্যর্থ হয়েছে" : "Failed to process request"));
      }

      setDownloadResult({
        downloadUrl: data.downloadUrl,
        fileName: data.fileName || activeAsset.fileName,
        whatsAppFollowUpUrl: data.whatsAppFollowUpUrl,
      });

      // Automatically trigger browser download
      if (data.downloadUrl) {
        const anchor = document.createElement("a");
        anchor.href = data.downloadUrl;
        anchor.setAttribute("download", data.fileName || activeAsset.fileName);
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isBn ? "একটি ত্রুটি হয়েছে, আবার চেষ্টা করুন" : "An error occurred, please try again"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectDownload = (asset: PublicDownloadItem) => {
    // If has asset id, use API route to increment counter and 302 redirect
    if (asset.id && asset.id !== "default-download") {
      window.location.assign(`/api/downloads/${asset.id}`);
    } else if (asset.fileUrl && asset.fileUrl !== "#") {
      window.open(asset.fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const displayList = showAll ? downloads : downloads.length > 0 ? [primaryAsset] : [];

  return (
    <section className="wrap" style={{ padding: "40px 0" }}>
      {/* Primary Featured Card */}
      <div
        style={{
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 16px)",
          background: "var(--tint-1, #f8fafc)",
          padding: "32px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", gap: 20, alignItems: "center", minWidth: 260, flex: 1 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {kindIcon(primaryAsset.kind)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{primaryHeading}</h3>
              {primaryAsset.requiresLead && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: "rgba(59, 130, 246, 0.1)",
                    color: "#2563eb",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                  }}
                >
                  🔒 {isBn ? "বিনামূল্যে আনলক" : "Free Gated"}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--muted, #64748b)", margin: "4px 0 6px", lineHeight: 1.4 }}>
              {primaryDesc}
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted, #94a3b8)", letterSpacing: "0.02em" }}>
              {primaryLabel}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {downloads.length > 1 && !showAll && layout === "single" && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                background: "transparent",
                border: "1px solid var(--border, #cbd5e1)",
                color: "var(--fg, #334155)",
                padding: "10px 18px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              {isBn ? `আরও ${downloads.length - 1}টি ফাইল` : `+${downloads.length - 1} More Files`}
            </button>
          )}

          {primaryAsset.requiresLead ? (
            <button
              type="button"
              onClick={(e) => openModal(primaryAsset, e)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--btn-bg, #0f172a)",
                color: "var(--btn-fg, #ffffff)",
                padding: "12px 26px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              }}
            >
              📥 {primaryBtn}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleDirectDownload(primaryAsset)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--btn-bg, #0f172a)",
                color: "var(--btn-fg, #ffffff)",
                padding: "12px 26px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              }}
            >
              📥 {primaryBtn}
            </button>
          )}
        </div>
      </div>

      {/* Multi-asset expansion list */}
      {(showAll || layout === "grid") && downloads.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--fg, #1e293b)" }}>
              {isBn ? "অন্যান্য ডাউনলোডযোগ্য ফাইলসমূহ" : "Available Download Assets"}
            </h4>
            {layout === "single" && showAll && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {isBn ? "সংক্ষেপ করুন" : "Collapse"}
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {downloads.map((asset) => {
              if (asset.id === primaryAsset.id && !showAll) return null;
              const assetTitle = isBn && asset.labelBn ? asset.labelBn : asset.label;
              return (
                <div
                  key={asset.id}
                  style={{
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 12,
                    background: "#ffffff",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>{kindIcon(asset.kind)}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginBottom: 4 }}>
                        {assetTitle}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {asset.fileName} · {formatBytes(asset.fileSize)}
                      </div>
                    </div>
                  </div>

                  <div>
                    {asset.requiresLead ? (
                      <button
                        type="button"
                        onClick={(e) => openModal(asset, e)}
                        style={{
                          width: "100%",
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #cbd5e1",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                      >
                        🔒 {isBn ? "আনলক ও ডাউনলোড" : "Unlock & Download"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDirectDownload(asset)}
                        style={{
                          width: "100%",
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #cbd5e1",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                      >
                        📥 {isBn ? "সরাসরি ডাউনলোড" : "Direct Download"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessible Gated Lead Magnet Modal (W3C APG Dialog) */}
      {activeAsset && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gated-modal-title"
            aria-describedby="gated-modal-desc"
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              padding: "28px 24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              aria-label={isBn ? "বন্ধ করুন" : "Close modal"}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "transparent",
                border: "none",
                fontSize: "1.4rem",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
              }}
            >
              ✕
            </button>

            {!downloadResult ? (
              /* Lead Capture Form */
              <form onSubmit={handleSubmitLead}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "#2563eb",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.6rem",
                      marginBottom: 12,
                    }}
                  >
                    🔒
                  </div>
                  <h3
                    id="gated-modal-title"
                    style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 6px", color: "#0f172a" }}
                  >
                    {isBn ? "ফাইলটি অবিলম্বে ডাউনলোড করুন" : "Instant File Download"}
                  </h3>
                  <p id="gated-modal-desc" style={{ fontSize: "0.88rem", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
                    {isBn
                      ? `"${isBn && activeAsset.labelBn ? activeAsset.labelBn : activeAsset.label}" ফাইলটি পেতে আপনার যোগাযোগের তথ্য দিন।`
                      : `Enter your contact details to instantly unlock "${activeAsset.label}".`}
                  </p>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      marginBottom: 16,
                      fontWeight: 500,
                    }}
                  >
                    ⚠️ {errorMessage}
                  </div>
                )}

                {/* Honeypot for bot protection */}
                <input
                  type="text"
                  name="hp"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div style={{ marginBottom: 14 }}>
                  <label
                    htmlFor="gated-name"
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}
                  >
                    {isBn ? "আপনার নাম (ঐচ্ছিক)" : "Your Name (Optional)"}
                  </label>
                  <input
                    id="gated-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isBn ? "যেমন: তানভীর আহমেদ" : "e.g. Tanvir Ahmed"}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.92rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="gated-contact"
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}
                  >
                    {isBn ? "মোবাইল নাম্বার বা ইমেইল *" : "Mobile Number or Email *"}
                  </label>
                  <input
                    id="gated-contact"
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={isBn ? "যেমন: 017XXXXXXXX বা you@email.com" : "e.g. 017XXXXXXXX or you@email.com"}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.92rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: "0.82rem",
                      color: "#64748b",
                      cursor: "pointer",
                      lineHeight: 1.35,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      {isBn
                        ? "আমি গুরুত্বপূর্ণ আপডেট ও সেবা সংক্রান্ত তথ্য পেতে সম্মত আছি।"
                        : "I agree to receive relevant updates and service communications."}
                    </span>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: "12px 18px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                    }}
                  >
                    {isBn ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      flex: 2,
                      padding: "12px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: isSubmitting ? "#94a3b8" : "var(--btn-bg, #0f172a)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {isSubmitting ? (
                      <span>{isBn ? "প্রক্রিয়াকরণ হচ্ছে..." : "Unlocking..."}</span>
                    ) : (
                      <span>📥 {isBn ? "আনলক ও ডাউনলোড" : "Unlock & Download"}</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Success & Unlock State */
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "#16a34a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    marginBottom: 16,
                  }}
                >
                  ✓
                </div>
                <h3
                  id="gated-modal-title"
                  style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 8px", color: "#0f172a" }}
                >
                  {isBn ? "ডাউনলোড সফলভাবে প্রস্তুত!" : "Your Download is Ready!"}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 20px" }}>
                  {isBn
                    ? "আপনার ফাইলটি স্বয়ংক্রিয়ভাবে ডাউনলোড হওয়া শুরু হয়েছে।"
                    : "The file download has started automatically in your browser."}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <a
                    href={downloadResult.downloadUrl}
                    download={downloadResult.fileName}
                    style={{
                      display: "inline-block",
                      background: "var(--btn-bg, #0f172a)",
                      color: "#ffffff",
                      padding: "12px 20px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      textDecoration: "none",
                    }}
                  >
                    📥 {isBn ? "ডাউনলোড না হলে এখানে ক্লিক করুন" : "Click here if download didn't start"}
                  </a>

                  {downloadResult.whatsAppFollowUpUrl && (
                    <a
                      href={downloadResult.whatsAppFollowUpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: "#25D366",
                        color: "#ffffff",
                        padding: "11px 20px",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        textDecoration: "none",
                      }}
                    >
                      <span>💬 {isBn ? "সরাসরি WhatsApp এ কথা বলুন" : "Chat on WhatsApp with Us"}</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      padding: "8px 0",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      marginTop: 4,
                    }}
                  >
                    {isBn ? "উইন্ডো বন্ধ করুন" : "Close Window"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
