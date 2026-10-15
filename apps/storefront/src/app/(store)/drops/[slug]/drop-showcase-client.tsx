"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { Countdown } from "@/components/countdown";

interface Variant {
  id: string;
  title: string;
  price: string | number;
  stockQuantity: number;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  images: { url: string; altText?: string | null }[];
  variants: Variant[];
}

interface DropData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  bannerImage?: string | null;
  mode: "TEASER_WAITLIST" | "LIVE_PREORDER";
  status: string;
  startsAt: string;
  endsAt?: string | null;
  estimatedShipDate?: string | null;
  depositType: "NONE" | "FIXED" | "PERCENTAGE" | "FULL";
  depositValueNumber: number;
  allocationCap?: number | null;
  claimedUnits: number;
  isLive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  subscriberCount: number;
  products: {
    product: Product;
  }[];
}

interface Props {
  drop: DropData;
  lang?: "en" | "bn";
}

export function DropShowcaseClient({ drop, lang = "en" }: Props) {
  const router = useRouter();
  const cart = useCart();

  // Waitlist form state
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistName, setWaitlistName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  // Selected product & variant for direct purchase
  const firstProduct = drop.products[0]?.product;
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    firstProduct?.variants[0]?.id || ""
  );

  const activeVariant = firstProduct?.variants.find((v) => v.id === selectedVariantId) || firstProduct?.variants[0];
  const unitPrice = activeVariant ? Number(activeVariant.price) : 0;

  // Deposit calculations
  let depositAmount = 0;
  let balanceDue = unitPrice;
  if (drop.depositType === "FULL") {
    depositAmount = unitPrice;
    balanceDue = 0;
  } else if (drop.depositType === "FIXED") {
    depositAmount = Math.min(unitPrice, drop.depositValueNumber);
    balanceDue = Math.max(0, unitPrice - depositAmount);
  } else if (drop.depositType === "PERCENTAGE") {
    depositAmount = Math.round((unitPrice * drop.depositValueNumber) / 100);
    balanceDue = Math.max(0, unitPrice - depositAmount);
  }

  const claimPercent = drop.allocationCap
    ? Math.min(100, Math.round((drop.claimedUnits / drop.allocationCap) * 100))
    : null;

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistPhone.trim()) return;

    setSubmitting(true);
    setSubscribeError(null);

    try {
      const res = await fetch("/api/drops/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropId: drop.id,
          phone: waitlistPhone.trim(),
          name: waitlistName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to join waitlist");
      }

      setSubscribed(true);
    } catch (err: any) {
      setSubscribeError(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePreOrderNow() {
    if (!selectedVariantId) return;
    cart.add(selectedVariantId, 1);
    router.push("/checkout");
  }

  const labels = lang === "bn"
    ? { d: "দিন", h: "ঘন্টা", m: "মিনিট", s: "সেকেন্ড" }
    : { d: "Days", h: "Hours", m: "Mins", s: "Secs" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 64px" }}>
      {/* Hero Drop Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.04) 0%, rgba(30, 41, 59, 0.02) 100%)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 16,
          padding: "36px 24px",
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "inline-flex", gap: 8, marginBottom: 12 }}>
          {drop.isLive ? (
            <span className="pill green" style={{ fontWeight: 700, padding: "4px 12px" }}>
              DROP LIVE NOW
            </span>
          ) : drop.isUpcoming ? (
            <span className="pill warn" style={{ fontWeight: 700, padding: "4px 12px" }}>
              UPCOMING LAUNCH
            </span>
          ) : (
            <span className="pill grey" style={{ fontWeight: 700, padding: "4px 12px" }}>
              DROP CONCLUDED
            </span>
          )}

          <span className="pill grey" style={{ padding: "4px 12px" }}>
            {drop.mode === "LIVE_PREORDER" ? "Pre-Order Available" : "VIP Waitlist"}
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 800, margin: "0 0 12px" }}>
          {drop.title}
        </h1>

        {drop.description && (
          <p
            className="muted"
            style={{
              maxWidth: 650,
              margin: "0 auto 24px",
              fontSize: "clamp(14px, 1.8vw, 16px)",
              lineHeight: 1.6,
            }}
          >
            {drop.description}
          </p>
        )}

        {/* Countdown Timer */}
        {(drop.isUpcoming || (drop.isLive && drop.endsAt)) && (
          <div style={{ margin: "24px auto 16px", maxWidth: 440 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              {drop.isUpcoming ? "Drop Unlocks In:" : "Drop Closes In:"}
            </div>
            <Countdown
              endsAt={drop.isUpcoming ? drop.startsAt : drop.endsAt!}
              labels={labels}
            />
          </div>
        )}

        {/* Live Scarcity Claim Bar */}
        {drop.isLive && claimPercent !== null && (
          <div style={{ maxWidth: 420, margin: "20px auto 0", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Allocation Claimed</span>
              <span className="muted">
                {drop.claimedUnits} of {drop.allocationCap} units ({claimPercent}%)
              </span>
            </div>
            <div className="meter" style={{ height: 8, background: "var(--line, #e2e8f0)", borderRadius: 4 }}>
              <i style={{ width: `${claimPercent}%`, background: claimPercent >= 90 ? "#DC2626" : "#059669" }} />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Split: Showcase & Purchase/Waitlist */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
        {/* Left: Product Images & Specs */}
        <div>
          {firstProduct?.images && firstProduct.images.length > 0 ? (
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
              <Image
                src={firstProduct.images[0]?.url || "/placeholder.png"}
                alt={firstProduct.images[0]?.altText || firstProduct.title}
                width={600}
                height={600}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
                priority
              />
            </div>
          ) : (
            <div
              style={{
                height: 380,
                background: "var(--bg-subtle, #f1f5f9)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-2)",
              }}
            >
              Limited Drop Item
            </div>
          )}

          {/* Additional Attached Products */}
          {drop.products.length > 1 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>All Items in this Drop:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                {drop.products.map(({ product }) => (
                  <div key={product.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 6, textAlign: "center", fontSize: 12 }}>
                    {product.images[0] && (
                      <Image
                        src={product.images[0].url}
                        alt={product.title}
                        width={80}
                        height={80}
                        style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 4, marginBottom: 4 }}
                      />
                    )}
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {product.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Purchase or Waitlist Action Panel */}
        <div>
          {/* A. TEASER / UPCOMING WAITLIST MODE */}
          {(drop.mode === "TEASER_WAITLIST" || drop.isUpcoming) && !drop.isLive ? (
            <div className="card" style={{ padding: 28, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                Join the VIP Drop Waitlist
              </div>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
                Be the first to access this limited release when the countdown reaches zero. We will dispatch an automated SMS and WhatsApp link the second inventory unlocks.
              </p>

              {subscribed ? (
                <div className="notice good" style={{ padding: 18, textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>You are on the VIP Waitlist</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    We have registered <b>{waitlistPhone}</b>. You will receive an instant launch notification when the drop unlocks.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {subscribeError && (
                    <div className="notice bad" style={{ fontSize: 13 }}>
                      {subscribeError}
                    </div>
                  )}

                  <div>
                    <label className="label">Full Name (optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Arif Hossain"
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">Mobile Number (01XXXXXXXXX) *</label>
                    <div style={{ display: "flex", alignItems: "stretch" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0 12px",
                          background: "var(--bg-subtle, #f1f5f9)",
                          border: "1px solid var(--line, #cbd5e1)",
                          borderRight: "none",
                          borderRadius: "6px 0 0 6px",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        +880
                      </span>
                      <input
                        type="tel"
                        className="input"
                        style={{ borderRadius: "0 6px 6px 0" }}
                        placeholder="1712345678"
                        value={waitlistPhone}
                        onChange={(e) => setWaitlistPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ marginTop: 8, padding: "12px 20px", fontWeight: 700 }}
                    disabled={submitting}
                  >
                    {submitting ? "Joining Waitlist…" : "Notify Me on Launch"}
                  </button>

                  <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 4 }}>
                    {drop.subscriberCount > 0 ? `${drop.subscriberCount} shoppers currently on the waitlist.` : "Direct notification via SMS & WhatsApp."}
                  </div>
                </form>
              )}
            </div>
          ) : drop.isLive ? (
            /* B. LIVE PRE-ORDER / PURCHASE MODE */
            <div className="card" style={{ padding: 28, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
                {firstProduct?.title}
              </div>

              {/* Price display */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 16px" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>
                  ৳{unitPrice.toLocaleString()}
                </span>
                {drop.depositType !== "NONE" && (
                  <span className="pill green" style={{ fontSize: 12 }}>
                    Pre-Order Safeguard
                  </span>
                )}
              </div>

              {/* Estimated Dispatch Schedule */}
              {drop.estimatedShipDate && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#047857",
                    marginBottom: 16,
                  }}
                >
                  <b>Estimated Dispatch:</b> ~{new Date(drop.estimatedShipDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}

              {/* Variant selection */}
              {firstProduct?.variants && firstProduct.variants.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <label className="label">Select Size / Variant:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {firstProduct.variants.map((v) => {
                      const selected = v.id === selectedVariantId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`btn btn-sm ${selected ? "btn-primary" : "btn-secondary"}`}
                          style={{ minWidth: 70 }}
                        >
                          {v.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Deposit Financial Breakdown Card */}
              <div
                style={{
                  padding: 14,
                  background: "var(--bg-subtle, #f8fafc)",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  marginBottom: 20,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Payment Breakdown:</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Advance Online Deposit:</span>
                  <b>৳{depositAmount.toLocaleString()}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Due on Delivery (COD):</span>
                  <b>৳{balanceDue.toLocaleString()}</b>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.4 }}>
                  {depositAmount > 0
                    ? "Advance deposit payable online via bKash, Nagad or Card to confirm production allocation. Remaining balance collected when parcel arrives at your door."
                    : "100% Cash-on-Delivery. Pay the full amount to the courier when parcel arrives."}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handlePreOrderNow}
                className="btn btn-primary btn-lg"
                style={{ width: "100%", padding: "14px 24px", fontSize: 16, fontWeight: 700 }}
              >
                Pre-Order Now →
              </button>
            </div>
          ) : (
            /* C. CONCLUDED DROP */
            <div className="card" style={{ padding: 28, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>This Drop Has Ended</div>
              <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>
                All allocated units have been claimed or the drop campaign deadline has passed.
              </p>
              <button type="button" onClick={() => router.push("/")} className="btn btn-secondary">
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
