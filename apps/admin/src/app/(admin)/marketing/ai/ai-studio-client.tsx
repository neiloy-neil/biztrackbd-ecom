"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  generateSocialPostAction,
  generateWhatsAppBroadcastAction,
  generateSmsCampaignAction,
  generateBannerCopyAction,
} from "./actions";
import type {
  GeneratedSocialPost,
  GeneratedWhatsAppBroadcast,
  GeneratedSmsCampaign,
  GeneratedBannerCopy,
  AiTonePreset,
} from "@biztrackbd/core";

interface ProductOption {
  id: string;
  title: string;
  price: number;
}

export function AiStudioClient({ products }: { products: ProductOption[] }) {
  const [tab, setTab] = useState<"social" | "whatsapp" | "sms" | "banner">("social");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");
  const [discountOffer, setDiscountOffer] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [customBrandVoice, setCustomBrandVoice] = useState("");
  const [tone, setTone] = useState<AiTonePreset>("DHAKA_YOUTH_TRENDY");

  // Output States
  const [socialResult, setSocialResult] = useState<GeneratedSocialPost | null>(null);
  const [whatsAppResult, setWhatsAppResult] = useState<GeneratedWhatsAppBroadcast | null>(null);
  const [smsResult, setSmsResult] = useState<GeneratedSmsCampaign | null>(null);
  const [bannerResult, setBannerResult] = useState<GeneratedBannerCopy | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const targetTopic = selectedProduct ? `${selectedProduct.title} (৳${selectedProduct.price})` : customTopic;

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = () => {
    setErrorMsg(null);
    if (!targetTopic.trim()) {
      setErrorMsg("Please select a product or enter a promotion topic.");
      return;
    }

    startTransition(async () => {
      const opts = {
        productName: targetTopic,
        discountOffer: discountOffer.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
        keyPoints: keyPoints.trim() || undefined,
        customBrandVoice: customBrandVoice.trim() || undefined,
        tone,
      };

      if (tab === "social") {
        const res = await generateSocialPostAction(opts);
        if (res.success && res.data) setSocialResult(res.data);
        else setErrorMsg(res.error || "Generation failed.");
      } else if (tab === "whatsapp") {
        const res = await generateWhatsAppBroadcastAction(opts);
        if (res.success && res.data) setWhatsAppResult(res.data);
        else setErrorMsg(res.error || "Generation failed.");
      } else if (tab === "sms") {
        const res = await generateSmsCampaignAction(opts);
        if (res.success && res.data) setSmsResult(res.data);
        else setErrorMsg(res.error || "Generation failed.");
      } else if (tab === "banner") {
        const res = await generateBannerCopyAction(opts);
        if (res.success && res.data) setBannerResult(res.data);
        else setErrorMsg(res.error || "Generation failed.");
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
      {/* Left Column: Input Controls */}
      <div className="card stack">
        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
          {[
            { id: "social", label: "Facebook / Instagram" },
            { id: "whatsapp", label: "WhatsApp Broadcast" },
            { id: "sms", label: "SMS Campaign" },
            { id: "banner", label: "Banner & Slogans" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id as any);
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: "12.5px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                background: tab === t.id ? "#FFFFFF" : "transparent",
                color: tab === t.id ? "#1E293B" : "#64748B",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Product Picker or Custom Topic */}
        <label className="field">
          <span className="label">Select Store Product (Optional)</span>
          <select
            className="input"
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              if (e.target.value) setCustomTopic("");
            }}
          >
            <option value="">-- Or enter custom campaign topic below --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (৳{p.price})
              </option>
            ))}
          </select>
        </label>

        {!selectedProductId && (
          <label className="field">
            <span className="label">Campaign Topic / Product Name</span>
            <input
              type="text"
              className="input"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Eid Punjabi Collection, Wireless Earbuds, Flash Sale"
              required
            />
          </label>
        )}

        <div className="row-2">
          <label className="field">
            <span className="label">Discount / Special Offer</span>
            <input
              type="text"
              className="input"
              value={discountOffer}
              onChange={(e) => setDiscountOffer(e.target.value)}
              placeholder="e.g. 20% Off, Buy 1 Get 1"
            />
          </label>

          <label className="field">
            <span className="label">Coupon Code</span>
            <input
              type="text"
              className="input"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g. EID20, FLASH100"
            />
          </label>
        </div>

        <label className="field">
          <span className="label">Key Selling Highlights</span>
          <textarea
            className="input"
            rows={2}
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="e.g. 100% Cotton, Cash on delivery all over Bangladesh, 7 days replacement"
          />
        </label>

        <label className="field">
          <span className="label">Custom Brand Voice / Store Policies <span className="opt">(optional)</span></span>
          <textarea
            className="input"
            rows={2}
            value={customBrandVoice}
            onChange={(e) => setCustomBrandVoice(e.target.value)}
            placeholder="e.g. Free home delivery in Dhaka, 24-hr dispatch, 100% genuine warranty"
          />
        </label>

        <label className="field">
          <span className="label">Cultural Tone Preset</span>
          <select
            className="input"
            value={tone}
            onChange={(e) => setTone(e.target.value as AiTonePreset)}
          >
            <option value="DHAKA_YOUTH_TRENDY">ট্রেন্ডি ও আধুনিক (Dhaka Youth &amp; Trendy)</option>
            <option value="TRADITIONAL_ELEGANT">মার্জিত ও ঐতিহ্যবাহী (Traditional &amp; Elegant)</option>
            <option value="LUXURY_PREMIUM">প্রিমিয়াম ও লাক্সারি (Luxury &amp; Premium)</option>
            <option value="TECH_MINIMALIST">প্রযুক্তি ও স্পেক্স-ফোকাসড (Tech &amp; Minimalist)</option>
            <option value="FLASH_SALE_URGENT">হট ডিল ও ফ্ল্যাশ সেল (Flash Sale &amp; Urgent FOMO)</option>
          </select>
        </label>

        {errorMsg && <div className="notice bad" role="alert">{errorMsg}</div>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {isPending ? "Generating Content…" : "Generate Content"}
        </button>
      </div>

      {/* Right Column: Output Previews & 1-Click Copy */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Generated Marketing Copy</h2>
          <span className="pill info">Content Generator</span>
        </div>

        {/* Tab 1: Social Media Post */}
        {tab === "social" && (
          <div>
            {socialResult ? (
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Bengali Facebook Caption</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(socialResult.captionBn, "soc_bn")}
                    >
                      {copiedField === "soc_bn" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      padding: "12px",
                      borderRadius: 8,
                      fontSize: 13.5,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      lineHeight: 1.5,
                    }}
                  >
                    {socialResult.captionBn}
                  </pre>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>English Version</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(socialResult.captionEn, "soc_en")}
                    >
                      {copiedField === "soc_en" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      padding: "12px",
                      borderRadius: 8,
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                    }}
                  >
                    {socialResult.captionEn}
                  </pre>
                </div>

                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                    Suggested Hashtags
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {socialResult.hashtags.map((h, i) => (
                      <span key={i} className="pill ok" style={{ cursor: "pointer" }} onClick={() => handleCopy(h, `h_${i}`)}>
                        {h} {copiedField === `h_${i}` ? "✓" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card empty" style={{ border: "none" }}>
                Select a product or topic on the left and click <strong>Generate Content</strong>.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: WhatsApp Broadcast */}
        {tab === "whatsapp" && (
          <div>
            {whatsAppResult ? (
              <div className="stack" style={{ gap: 14 }}>
                {whatsAppResult.headline && (
                  <div style={{ padding: "8px 12px", background: "#FEF9C3", borderRadius: 8, fontSize: 13, border: "1px solid #FEF08A", fontWeight: 700, color: "#854D0E" }}>
                    {whatsAppResult.headline}
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>Bengali WhatsApp Broadcast</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(whatsAppResult.messageBn, "wa_bn")}
                      >
                        {copiedField === "wa_bn" ? "✓ Copied" : "Copy"}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(whatsAppResult.messageBn)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ color: "#15803D", borderColor: "#86EFAC" }}
                      >
                        💬 Web Share
                      </a>
                    </div>
                  </div>
                  <pre
                    style={{
                      background: "#DCF8C6",
                      border: "1px solid #BBF7D0",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      lineHeight: "1.5",
                      color: "#064E3B",
                    }}
                  >
                    {whatsAppResult.messageBn}
                  </pre>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>English WhatsApp Version</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(whatsAppResult.messageEn, "wa_en")}
                    >
                      {copiedField === "wa_en" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      lineHeight: "1.5",
                    }}
                  >
                    {whatsAppResult.messageEn}
                  </pre>
                </div>

                {whatsAppResult.quickReplySuggestions?.length > 0 && (
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                      Suggested Quick Replies
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {whatsAppResult.quickReplySuggestions.map((qr, i) => (
                        <span key={i} className="pill ok" style={{ cursor: "pointer" }} onClick={() => handleCopy(qr, `qr_${i}`)}>
                          {qr} {copiedField === `qr_${i}` ? "✓" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card empty" style={{ border: "none" }}>
                Select a product or topic on the left and click <strong>Generate Content</strong> to create ready-to-broadcast WhatsApp scripts.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: SMS Campaign */}
        {tab === "sms" && (
          <div>
            {smsResult ? (
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                      English Single-Part SMS ({smsResult.englishSms.length}/160 chars)
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(smsResult.englishSms, "sms_en")}
                    >
                      {copiedField === "sms_en" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "12px", borderRadius: 8, fontSize: 13.5 }}>
                    {smsResult.englishSms}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#166534", marginTop: 4 }}>
                    ✓ 1 SMS Part (Standard GSM-7 rate: lowest cost)
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                      Bangla Unicode SMS ({smsResult.banglaSms.length}/70 chars)
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(smsResult.banglaSms, "sms_bn")}
                    >
                      {copiedField === "sms_bn" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px", borderRadius: 8, fontSize: 13.5 }}>
                    {smsResult.banglaSms}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                    ✓ 1 SMS Part (Unicode single part)
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link
                    href={`/marketing/campaigns?draftBody=${encodeURIComponent(smsResult.englishSms)}`}
                    className="btn btn-primary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Use in Broadcast Campaign →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card empty" style={{ border: "none" }}>
                Generate high-converting single-message SMS campaigns tailored for Bangladeshi telecommunications.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Banner Slogans */}
        {tab === "banner" && (
          <div>
            {bannerResult ? (
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Bengali Banner Headline
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <strong style={{ fontSize: 15 }}>{bannerResult.headlineBn}</strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(bannerResult.headlineBn, "b_bn")}
                    >
                      {copiedField === "b_bn" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Bengali Sub-Headline
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 13.5 }}>{bannerResult.subheadlineBn}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(bannerResult.subheadlineBn, "b_sub")}
                    >
                      {copiedField === "b_sub" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link
                    href={`/marketing/banner?headline=${encodeURIComponent(bannerResult.headlineBn)}`}
                    className="btn btn-primary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Apply to Storefront Announcement Banner →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card empty" style={{ border: "none" }}>
                Generate attention-grabbing promotional slogans for your store hero banners and top bars.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
