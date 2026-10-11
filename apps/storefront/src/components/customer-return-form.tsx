"use client";

import { useState } from "react";
import type { CustomerReturnableInfo } from "@biztrackbd/core";
import { submitCustomerReturnAction } from "../app/(store)/order/[orderId]/return-action";

const RETURN_REASONS = [
  "Wrong size",
  "Wrong item sent",
  "Damaged or defective",
  "Not as described",
  "Changed my mind",
  "Other",
] as const;

export function CustomerReturnFormComponent({
  orderId,
  token,
  returnable,
  exchangeVariants,
  lang,
}: {
  orderId: string;
  token?: string;
  returnable: CustomerReturnableInfo;
  exchangeVariants: Array<{ id: string; productId: string; title: string; stock: number }>;
  lang: "en" | "bn";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  // Form state
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [type, setType] = useState<"REFUND" | "EXCHANGE" | "STORE_CREDIT">("REFUND");
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [customerNote, setCustomerNote] = useState("");
  const [exchangeVariantId, setExchangeVariantId] = useState<string>(exchangeVariants[0]?.id ?? "");
  const [payoutMethod, setPayoutMethod] = useState<"BKASH" | "NAGAD" | "ROCKET">("BKASH");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const t = {
    requestReturn: lang === "bn" ? "পণ্য ফেরত বা পরিবর্তনের অনুরোধ" : "Request Return / Exchange",
    windowNote: lang === "bn"
      ? `ডেলিভারির পর ৭ দিনের মধ্যে ফেরত অনুরোধ করা যাবে (${returnable.daysRemaining ?? 7} দিন বাকি)`
      : `Returns eligible within 7 days of delivery (${returnable.daysRemaining ?? 7} days left)`,
    selectItems: lang === "bn" ? "ফেরত দিতে চান এমন পণ্য নির্বাচন করুন" : "Select items to return",
    resolution: lang === "bn" ? "ফেরতের ধরণ" : "Preferred Resolution",
    refund: lang === "bn" ? "টাকা রিফান্ড" : "Refund",
    exchange: lang === "bn" ? "সাইজ/রঙ পরিবর্তন (এক্সচেঞ্জ)" : "Exchange",
    credit: lang === "bn" ? "স্টোর ক্রেডিট" : "Store Credit",
    replacementVariant: lang === "bn" ? "পরিবর্তিত সাইজ বা কালার নির্বাচন করুন" : "Select replacement variant",
    noStock: lang === "bn" ? "স্টক নেই" : "Out of stock",
    payoutProvider: lang === "bn" ? "রিফান্ড অ্যাকাউন্ট মাধ্যম" : "Refund Payout Method",
    payoutNumberLabel: lang === "bn" ? "মোবাইল নম্বর" : "Account Number",
    reasonLabel: lang === "bn" ? "ফেরতের কারণ" : "Reason for Return",
    notes: lang === "bn" ? "অতিরিক্ত বিবরণ (ঐচ্ছিক)" : "Additional notes (optional)",
    photoProof: lang === "bn" ? "পণ্যটির ছবি যুক্ত করুন" : "Upload item photos",
    photoMandatoryNotice: lang === "bn"
      ? "ত্রুটিপূর্ণ বা ভুল পণ্যের জন্য অন্তত একটি ছবি আপলোড আবশ্যক"
      : "At least one photo is required for damaged or incorrect items",
    uploadingPhoto: lang === "bn" ? "ছবি আপলোড হচ্ছে…" : "Uploading photo…",
    submit: lang === "bn" ? "অনুরোধ জমা দিন" : "Submit Return Request",
    submitting: lang === "bn" ? "জমা হচ্ছে…" : "Submitting…",
    cancel: lang === "bn" ? "বাতিল" : "Cancel",
    successMsg: lang === "bn"
      ? "আপনার ফেরত অনুরোধটি সফলভাবে জমা হয়েছে।"
      : "Your return request has been submitted successfully.",
  };

  const reasonTranslations: Record<string, string> = {
    "Wrong size": lang === "bn" ? "সাইজ মেলেনি" : "Wrong size",
    "Wrong item sent": lang === "bn" ? "ভুল পণ্য পাঠানো হয়েছে" : "Wrong item sent",
    "Damaged or defective": lang === "bn" ? "পণ্য ক্ষতিগ্রস্ত বা ত্রুটিপূর্ণ" : "Damaged or defective",
    "Not as described": lang === "bn" ? "বিবরণের সাথে মেলেনি" : "Not as described",
    "Changed my mind": lang === "bn" ? "পছন্দ পরিবর্তন হয়েছে" : "Changed my mind",
    "Other": lang === "bn" ? "অন্যান্য কারণ" : "Other",
  };

  const isDefect = reason === "Damaged or defective" || reason === "Wrong item sent";

  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const setQty = (itemId: string, qty: number, max: number) => {
    if (qty < 1 || qty > max) return;
    setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 3) {
      setError(lang === "bn" ? "সর্বোচ্চ ৩টি ছবি আপলোড করা যাবে" : "Maximum 3 photos allowed");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("orderId", orderId);
      if (token) fd.append("token", token);
      fd.append("file", file);

      const res = await fetch("/api/returns/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setPhotos((prev) => [...prev, data.url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const items = Object.entries(selectedItems).map(([orderItemId, qty]) => ({ orderItemId, qty }));
    if (items.length === 0) {
      setError(lang === "bn" ? "অনুগ্রহ করে অন্তত একটি পণ্য নির্বাচন করুন" : "Please select at least one item to return");
      return;
    }

    if (type === "EXCHANGE" && !exchangeVariantId) {
      setError(lang === "bn" ? "অনুগ্রহ করে পরিবর্তিত সাইজ নির্বাচন করুন" : "Please select a replacement variant");
      return;
    }

    if (isDefect && photos.length === 0) {
      setError(t.photoMandatoryNotice);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        orderId,
        reason,
        customerNote: customerNote.trim() || undefined,
        type,
        items,
        exchangeVariantId: type === "EXCHANGE" ? exchangeVariantId : undefined,
        payoutMethod: type === "REFUND" ? payoutMethod : undefined,
        payoutNumber: type === "REFUND" && payoutNumber.trim() ? payoutNumber.trim() : undefined,
        photos,
      };

      const res = await submitCustomerReturnAction(orderId, payload, token);
      if (!res.ok) {
        throw new Error(res.error || "Could not submit return");
      }
      setSubmittedCode(res.code ?? "RT-NEW");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit return request");
    } finally {
      setBusy(false);
    }
  };

  if (submittedCode) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center", background: "var(--tint-2)", borderColor: "var(--success)" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t.successMsg}</h3>
        <p style={{ marginTop: 6, fontSize: 13.5 }}>
          {lang === "bn" ? "ট্র্যাকিং কোড: " : "Tracking Code: "}<b>{submittedCode}</b>
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary"
          style={{ marginTop: 14, fontSize: 13.5 }}
        >
          {lang === "bn" ? "পেজটি রিলোড করুন" : "Refresh Page"}
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }} data-testid="customer-return-section">
      {!open ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t.requestReturn}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{t.windowNote}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: 13.5 }}
            data-testid="open-return-modal"
          >
            {t.requestReturn}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.requestReturn}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--muted)" }}
            >
              {t.cancel}
            </button>
          </div>

          {error && (
            <div style={{ background: "var(--tint-4)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* 1. Item Selection */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{t.selectItems}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {returnable.items.filter((i) => i.returnableQty > 0).map((item) => {
                const isSelected = Boolean(selectedItems[item.id]);
                const qty = selectedItems[item.id] ?? 1;
                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid",
                      borderColor: isSelected ? "var(--accent)" : "var(--line)",
                      background: isSelected ? "var(--tint-1)" : "var(--surface)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item.id, item.returnableQty)}
                        style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {item.variantTitle && item.variantTitle.toLowerCase() !== "default" ? `${item.variantTitle} · ` : ""}
                          ৳{item.unitPrice}
                        </div>
                      </div>
                    </label>

                    {isSelected && item.returnableQty > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setQty(item.id, qty - 1, item.returnableQty)}
                          disabled={qty <= 1}
                          style={{ width: 24, height: 24, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 4, cursor: "pointer" }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.id, qty + 1, item.returnableQty)}
                          disabled={qty >= item.returnableQty}
                          style={{ width: 24, height: 24, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 4, cursor: "pointer" }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Resolution Type Tabs */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{t.resolution}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {(["REFUND", "EXCHANGE", "STORE_CREDIT"] as const).map((rType) => (
                <button
                  key={rType}
                  type="button"
                  onClick={() => setType(rType)}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: type === rType ? 700 : 500,
                    border: "1px solid",
                    borderColor: type === rType ? "var(--accent)" : "var(--line)",
                    background: type === rType ? "var(--accent)" : "var(--surface)",
                    color: type === rType ? "#fff" : "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  {rType === "REFUND" ? t.refund : rType === "EXCHANGE" ? t.exchange : t.credit}
                </button>
              ))}
            </div>

            {/* Exchange Variant Picker */}
            {type === "EXCHANGE" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  {t.replacementVariant}
                </label>
                <select
                  value={exchangeVariantId}
                  onChange={(e) => setExchangeVariantId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--field)", background: "var(--surface)", fontSize: 13.5 }}
                >
                  {exchangeVariants.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                      {v.title} {v.stock > 0 ? `(Stock: ${v.stock})` : `(${t.noStock})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Refund Payout Details */}
            {type === "REFUND" && (
              <div style={{ marginTop: 12, background: "var(--tint-1)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{t.payoutProvider}</div>
                <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
                  {(["BKASH", "NAGAD", "ROCKET"] as const).map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="payoutMethod"
                        checked={payoutMethod === m}
                        onChange={() => setPayoutMethod(m)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder={lang === "bn" ? "01XXXXXXXXX নম্বরটি লিখুন" : "e.g. 01712345678"}
                  value={payoutNumber}
                  onChange={(e) => setPayoutNumber(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--field)", background: "var(--surface)", fontSize: 13 }}
                />
              </div>
            )}
          </div>

          {/* 3. Reason & Notes */}
          <div>
            <label style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 6 }}>
              {t.reasonLabel}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--field)", background: "var(--surface)", fontSize: 13.5 }}
            >
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {reasonTranslations[r] ?? r}
                </option>
              ))}
            </select>

            <textarea
              placeholder={t.notes}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--field)", background: "var(--surface)", fontSize: 13 }}
            />
          </div>

          {/* 4. Photo Proof */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{t.photoProof}</span>
              {isDefect && <span style={{ color: "var(--danger)", fontSize: 11.5 }}>* {lang === "bn" ? "আবশ্যক" : "Required"}</span>}
            </div>
            {isDefect && (
              <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.photoMandatoryNotice}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position: "relative", width: 60, height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Proof" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      border: "none",
                      fontSize: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {photos.length < 3 && (
                <label
                  style={{
                    width: 60,
                    height: 60,
                    border: "1px dashed var(--field)",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: uploading ? "wait" : "pointer",
                    background: "var(--surface)",
                  }}
                >
                  <span style={{ fontSize: 18, color: "var(--muted)" }}>+</span>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={uploading}
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>
            {uploading && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.uploadingPhoto}</div>}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="submit"
              disabled={busy || uploading}
              className="btn btn-primary"
              style={{ flex: 1 }}
              data-testid="submit-return-btn"
            >
              {busy ? t.submitting : t.submit}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
