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
    <div className="grid grid-2 gap-lg items-start">
      {/* Left Column: Input Controls */}
      <div className="card stack">
        {/* Tab Switcher */}
        <div className="pill-switcher mb-md">
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
              className={`pill-switcher-btn ${tab === t.id ? "active" : ""}`}
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
              className="input font-mono"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. EID20, FLASH100"
            />
          </label>
        </div>

        <label className="field">
          <span className="label">Key Selling Highlights</span>
          <textarea
            className="textarea"
            rows={2}
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="e.g. 100% Cotton, Cash on delivery all over Bangladesh, 7 days replacement"
          />
        </label>

        <label className="field">
          <span className="label">Custom Brand Voice / Store Policies <span className="opt">(optional)</span></span>
          <textarea
            className="textarea"
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
          className="btn btn-primary w-full"
        >
          {isPending ? "Generating Content…" : "Generate Content"}
        </button>
      </div>

      {/* Right Column: Output Previews & 1-Click Copy */}
      <div className="card stack">
        <div className="flex-between items-center border-bottom pb-sm mb-md">
          <h2 className="text-base font-bold m-0">Generated Marketing Copy</h2>
          <span className="pill info">Content Generator</span>
        </div>

        {/* Tab 1: Social Media Post */}
        {tab === "social" && (
          <div>
            {socialResult ? (
              <div className="stack gap-md">
                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-ink-3">Bengali Facebook Caption</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(socialResult.captionBn, "soc_bn")}
                    >
                      {copiedField === "soc_bn" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="p-md rounded-md border bg-subtle text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {socialResult.captionBn}
                  </pre>
                </div>

                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-ink-3">English Version</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(socialResult.captionEn, "soc_en")}
                    >
                      {copiedField === "soc_en" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="p-md rounded-md border bg-subtle text-sm whitespace-pre-wrap font-sans">
                    {socialResult.captionEn}
                  </pre>
                </div>

                <div>
                  <span className="text-xs font-bold text-ink-3 block mb-xs">
                    Suggested Hashtags
                  </span>
                  <div className="row gap-xs flex-wrap">
                    {socialResult.hashtags.map((h, i) => (
                      <span key={i} className="pill ok pointer" onClick={() => handleCopy(h, `h_${i}`)}>
                        {h} {copiedField === `h_${i}` ? "✓" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card empty border-none">
                Select a product or topic on the left and click <strong>Generate Content</strong>.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: WhatsApp Broadcast */}
        {tab === "whatsapp" && (
          <div>
            {whatsAppResult ? (
              <div className="stack gap-md">
                {whatsAppResult.headline && (
                  <div className="p-sm rounded-md text-sm border font-bold bg-warning-subtle text-warning">
                    {whatsAppResult.headline}
                  </div>
                )}

                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-success">Bengali WhatsApp Broadcast</span>
                    <div className="row gap-xs">
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
                        className="btn btn-secondary btn-sm text-success"
                      >
                        Web Share
                      </a>
                    </div>
                  </div>
                  <pre className="p-md rounded-md border text-sm whitespace-pre-wrap font-sans leading-relaxed bg-success-subtle text-success">
                    {whatsAppResult.messageBn}
                  </pre>
                </div>

                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-ink-3">English WhatsApp Version</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(whatsAppResult.messageEn, "wa_en")}
                    >
                      {copiedField === "wa_en" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="p-md rounded-md border bg-subtle text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {whatsAppResult.messageEn}
                  </pre>
                </div>

                {whatsAppResult.quickReplySuggestions?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-ink-3 block mb-xs">
                      Suggested Quick Replies
                    </span>
                    <div className="row gap-xs flex-wrap">
                      {whatsAppResult.quickReplySuggestions.map((qr, i) => (
                        <span key={i} className="pill ok pointer" onClick={() => handleCopy(qr, `qr_${i}`)}>
                          {qr} {copiedField === `qr_${i}` ? "✓" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card empty border-none">
                Select a product or topic on the left and click <strong>Generate Content</strong> to create ready-to-broadcast WhatsApp scripts.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: SMS Campaign */}
        {tab === "sms" && (
          <div>
            {smsResult ? (
              <div className="stack gap-md">
                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-ink-3">
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
                  <div className="p-md rounded-md border text-sm bg-success-subtle">
                    {smsResult.englishSms}
                  </div>
                  <div className="text-xs text-success mt-xs">
                    ✓ 1 SMS Part (Standard GSM-7 rate: lowest cost)
                  </div>
                </div>

                <div>
                  <div className="flex-between items-center mb-xs">
                    <span className="text-xs font-bold text-ink-3">
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
                  <div className="p-md rounded-md border text-sm bg-subtle">
                    {smsResult.banglaSms}
                  </div>
                  <div className="text-xs text-ink-3 mt-xs">
                    ✓ 1 SMS Part (Unicode single part)
                  </div>
                </div>

                <div className="mt-md">
                  <Link
                    href={`/marketing/campaigns?draftBody=${encodeURIComponent(smsResult.englishSms)}`}
                    className="btn btn-primary btn-sm w-full"
                  >
                    Use in Broadcast Campaign →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card empty border-none">
                Generate high-converting single-message SMS campaigns tailored for Bangladeshi telecommunications.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Banner Slogans */}
        {tab === "banner" && (
          <div>
            {bannerResult ? (
              <div className="stack gap-md">
                <div>
                  <span className="text-xs font-bold text-ink-3 block mb-xs">
                    Bengali Banner Headline
                  </span>
                  <div className="flex-between items-center p-md rounded-md border bg-subtle">
                    <strong className="text-base">{bannerResult.headlineBn}</strong>
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
                  <span className="text-xs font-bold text-ink-3 block mb-xs">
                    Bengali Sub-Headline
                  </span>
                  <div className="flex-between items-center p-md rounded-md border bg-subtle">
                    <span className="text-sm">{bannerResult.subheadlineBn}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(bannerResult.subheadlineBn, "b_sub")}
                    >
                      {copiedField === "b_sub" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-md">
                  <Link
                    href={`/marketing/banner?headline=${encodeURIComponent(bannerResult.headlineBn)}`}
                    className="btn btn-primary btn-sm w-full"
                  >
                    Apply to Storefront Announcement Banner →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card empty border-none">
                Generate attention-grabbing promotional slogans for your store hero banners and top bars.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
