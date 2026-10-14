"use client";

import { useActionState, useState } from "react";
import type { BannerSettingsView } from "@biztrackbd/core";
import { saveBannerAction, type BannerFormState } from "./actions";

export function BannerForm({
  initialSettings,
  canEdit,
  storeName,
}: {
  initialSettings: BannerSettingsView;
  canEdit: boolean;
  storeName: string;
}) {
  const [state, action, pending] = useActionState<BannerFormState, FormData>(
    saveBannerAction,
    {}
  );

  const [announcement, setAnnouncement] = useState(
    initialSettings.announcement ?? ""
  );
  const [announcementBn, setAnnouncementBn] = useState(
    initialSettings.announcementBn ?? ""
  );
  const [flashSaleActive, setFlashSaleActive] = useState(
    initialSettings.flashSaleActive
  );
  const [flashSaleEndsAt, setFlashSaleEndsAt] = useState(
    initialSettings.flashSaleEndsAt
      ? new Date(initialSettings.flashSaleEndsAt).toISOString().slice(0, 16)
      : ""
  );
  const [flashSaleCoupon, setFlashSaleCoupon] = useState(
    initialSettings.flashSaleCoupon ?? ""
  );
  const [previewLang, setPreviewLang] = useState<"en" | "bn">("en");
  const [copied, setCopied] = useState(false);

  const activeText =
    previewLang === "bn" && announcementBn
      ? announcementBn
      : announcement || "Special Offer: Enjoy free delivery on orders over ৳1,000!";

  function handleCopy() {
    if (!flashSaleCoupon) return;
    navigator.clipboard?.writeText(flashSaleCoupon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {state.error && <div className="notice bad">{state.error}</div>}
      {state.ok && <div className="notice good">Banner & Flash Sale settings saved successfully.</div>}

      {/* Live Storefront Simulation */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
              Live Storefront Header Simulation
            </span>
            {flashSaleActive && (
              <span className="pill orange" style={{ fontSize: 11 }}>
                Flash Sale Active
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`chip ${previewLang === "en" ? "active" : ""}`}
              onClick={() => setPreviewLang("en")}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 4,
                background: previewLang === "en" ? "#2563eb" : "#f1f5f9",
                color: previewLang === "en" ? "#fff" : "#334155",
                border: "none",
                cursor: "pointer",
              }}
            >
              English Preview
            </button>
            <button
              type="button"
              className={`chip ${previewLang === "bn" ? "active" : ""}`}
              onClick={() => setPreviewLang("bn")}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 4,
                background: previewLang === "bn" ? "#2563eb" : "#f1f5f9",
                color: previewLang === "bn" ? "#fff" : "#334155",
                border: "none",
                cursor: "pointer",
              }}
            >
              বাংলা প্রিভিউ
            </button>
          </div>
        </div>

        {/* Mock Storefront Header Container */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Top Announcement Bar */}
          <div
            style={{
              background: flashSaleActive
                ? "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)"
                : "#0f172a",
              color: "#ffffff",
              padding: "10px 16px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 13,
              fontWeight: 500,
              textAlign: "center",
              transition: "all 0.3s ease",
            }}
          >
            <span>{activeText}</span>

            {flashSaleActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                  }}
                >
                  ⏳ Ends in 05h : 42m : 19s
                </span>

                {flashSaleCoupon && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: "#ffffff",
                      color: "#b91c1c",
                      border: "none",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title="Click to copy coupon code"
                  >
                    <span>{flashSaleCoupon}</span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>
                      {copied ? "✓ Copied" : "[Copy]"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Simulated Store Navigation */}
          <div
            style={{
              background: "#ffffff",
              padding: "12px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
              {storeName}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: "#64748b",
                fontWeight: 500,
              }}
            >
              <span>Home</span>
              <span>Catalog</span>
              <span>Flash Deals</span>
              <span>Contact</span>
            </div>
            <div style={{ display: "flex", gap: 12, color: "#64748b", fontSize: 13 }}>
              <span>🔍 Search</span>
              <span>🛒 Cart (0)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {/* Banner Texts */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Announcement Bar Text</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Displays at the very top of every page across your customer storefront.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="announcement"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              English Announcement Text
            </label>
            <input
              id="announcement"
              name="announcement"
              type="text"
              className="input"
              value={announcement}
              disabled={!canEdit}
              maxLength={300}
              placeholder="e.g. 🎉 Grand Eid Sale: Flat 20% OFF sitewide! Use code EID20"
              onChange={(e) => setAnnouncement(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label
              htmlFor="announcementBn"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Bangla Announcement Text (বাংলা টেক্সট)
            </label>
            <input
              id="announcementBn"
              name="announcementBn"
              type="text"
              className="input"
              value={announcementBn}
              disabled={!canEdit}
              maxLength={300}
              placeholder="যেমন: 🎉 বিশেষ ঈদ ধামাকা অফার: সব অর্ডারে ফ্রি ডেলিভারি!"
              onChange={(e) => setAnnouncementBn(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>
        </div>

        {/* Flash Sale Controls */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Flash Sale Countdown & Coupon</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Adds high-urgency red styling, live ticking countdown, and 1-click coupon copy badge.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: canEdit ? "pointer" : "default",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                name="flashSaleActive"
                checked={flashSaleActive}
                disabled={!canEdit}
                onChange={(e) => setFlashSaleActive(e.target.checked)}
              />
              <span>Enable Flash Sale Mode</span>
            </label>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="flashSaleEndsAt"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Countdown End Time
            </label>
            <input
              id="flashSaleEndsAt"
              name="flashSaleEndsAt"
              type="datetime-local"
              className="input"
              value={flashSaleEndsAt}
              disabled={!canEdit || !flashSaleActive}
              onChange={(e) => setFlashSaleEndsAt(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label
              htmlFor="flashSaleCoupon"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Quick Copy Promo Code
            </label>
            <input
              id="flashSaleCoupon"
              name="flashSaleCoupon"
              type="text"
              className="input"
              value={flashSaleCoupon}
              disabled={!canEdit || !flashSaleActive}
              maxLength={40}
              placeholder="e.g. FLASH20"
              onChange={(e) => setFlashSaleCoupon(e.target.value.toUpperCase())}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border)", textTransform: "uppercase" }}
            />
          </div>
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
            aria-busy={pending}
            style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
          >
            {pending ? "Saving Changes..." : "Save Banner & Flash Sale"}
          </button>
        </div>
      )}
    </form>
  );
}
