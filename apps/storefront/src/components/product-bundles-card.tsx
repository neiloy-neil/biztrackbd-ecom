"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StorefrontBundle } from "@biztrackbd/core";
import { fetchProductBundlesAction } from "@/app/actions";
import { money, type Lang } from "@/lib/i18n-core";
import { useCart } from "./cart-provider";

interface Props {
  productId: string;
  lang: Lang;
}

export function ProductBundlesCard({ productId, lang }: Props) {
  const router = useRouter();
  const cart = useCart();
  const [bundles, setBundles] = useState<StorefrontBundle[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [addedBundleId, setAddedBundleId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProductBundlesAction(productId)
      .then((res) => {
        if (!active) return;
        if (res.ok && res.bundles.length > 0) {
          setBundles(res.bundles);
          // Set initial variant selections
          const initialMap: Record<string, Record<string, string>> = {};
          for (const b of res.bundles) {
            const bMap: Record<string, string> = {};
            for (const it of b.items) {
              bMap[it.productId] = it.defaultVariantId;
            }
            initialMap[b.id] = bMap;
          }
          setSelectedVariants(initialMap);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  if (loading || bundles.length === 0) return null;

  const handleAddBundleToCart = (bundle: StorefrontBundle, buyNow = false) => {
    const bundleSelections = selectedVariants[bundle.id] || {};
    for (const item of bundle.items) {
      const vId = bundleSelections[item.productId] || item.defaultVariantId;
      cart.add(vId, item.quantity);
    }
    setAddedBundleId(bundle.id);
    setTimeout(() => setAddedBundleId(null), 2500);

    if (buyNow) {
      router.push("/checkout");
    }
  };

  return (
    <div className="product-bundles-container" style={{ marginTop: 24, marginBottom: 24 }} data-testid="product-bundles-section">
      {bundles.map((bundle) => {
        const title = (lang === "bn" && bundle.titleBn) ? bundle.titleBn : bundle.title;
        const desc = (lang === "bn" && bundle.descriptionBn) ? bundle.descriptionBn : bundle.description;
        const isAdded = addedBundleId === bundle.id;

        return (
          <div
            key={bundle.id}
            data-testid={`bundle-card-${bundle.id}`}
            style={{
              border: "1.5px solid rgba(16, 185, 129, 0.4)",
              background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 253, 244, 0.6) 100%)",
              borderRadius: 14,
              padding: "18px 20px",
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.08)",
              position: "relative",
              marginBottom: 16,
            }}
          >
            {/* Header / Offer Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#059669",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    padding: "3px 9px",
                    borderRadius: 20,
                  }}
                >
                  🎁 {lang === "bn" ? "কম্বো অফার" : "COMBO OFFER"}
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "6px 0 0", color: "var(--ink, #111827)" }}>
                  {title}
                </h3>
                {desc && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2, #4b5563)" }}>
                    {desc}
                  </p>
                )}
              </div>
              {bundle.savings > 0 && (
                <div
                  style={{
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  <div>{lang === "bn" ? "সাশ্রয়" : "SAVE"}</div>
                  <div style={{ fontSize: 15 }}>{money(bundle.savings, lang)}</div>
                </div>
              )}
            </div>

            {/* Bundle Items with Plus Connectors */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                padding: "12px 0",
                borderTop: "1px dashed rgba(16, 185, 129, 0.25)",
                borderBottom: "1px dashed rgba(16, 185, 129, 0.25)",
              }}
            >
              {bundle.items.map((it, idx) => {
                const itemTitle = (lang === "bn" && it.productTitleBn) ? it.productTitleBn : it.productTitle;
                const hasMultipleVariants = it.variants.length > 1;
                const selectedVId = selectedVariants[bundle.id]?.[it.productId] || it.defaultVariantId;

                return (
                  <div key={it.productId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {it.imageUrl && (
                        <div style={{ width: 56, height: 56, position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", flexShrink: 0 }}>
                          <Image src={it.imageUrl} alt={itemTitle} fill sizes="56px" style={{ objectFit: "cover" }} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink, #111827)", maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {it.quantity > 1 ? `${it.quantity}x ` : ""}{itemTitle}
                        </div>
                        {hasMultipleVariants && (
                          <select
                            value={selectedVId}
                            onChange={(e) => {
                              const newVId = e.target.value;
                              setSelectedVariants((prev) => ({
                                ...prev,
                                [bundle.id]: {
                                  ...prev[bundle.id],
                                  [it.productId]: newVId,
                                },
                              }));
                            }}
                            style={{
                              fontSize: 12,
                              marginTop: 3,
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db",
                              background: "#ffffff",
                            }}
                          >
                            {it.variants.map((v) => (
                              <option key={v.id} value={v.id} disabled={v.stockQuantity <= 0}>
                                {v.title} {v.stockQuantity <= 0 ? (lang === "bn" ? "(স্টক শেষ)" : "(Out of stock)") : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    {idx < bundle.items.length - 1 && (
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#10b981", margin: "0 4px" }}>+</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pricing & CTA Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-2, #6b7280)", fontWeight: 500 }}>
                  {lang === "bn" ? "কম্বো অফার মূল্য:" : "Bundle Offer Price:"}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>
                    {money(bundle.bundlePrice, lang)}
                  </span>
                  {bundle.regularTotal > bundle.bundlePrice && (
                    <del style={{ fontSize: 14, color: "var(--ink-muted, #9ca3af)" }}>
                      {money(bundle.regularTotal, lang)}
                    </del>
                  )}
                  {bundle.savingsPercent > 0 && (
                    <span className="pill green" style={{ fontSize: 11, padding: "1px 6px" }}>
                      {bundle.savingsPercent}% OFF
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAddBundleToCart(bundle, false)}
                  data-testid={`add-bundle-${bundle.id}`}
                  style={{
                    backgroundColor: isAdded ? "#047857" : "#059669",
                    padding: "9px 18px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    borderRadius: 8,
                  }}
                >
                  {isAdded
                    ? (lang === "bn" ? "✓ কার্টে যোগ হয়েছে!" : "✓ Added to Cart!")
                    : (lang === "bn" ? "কম্বো কার্টে যোগ করুন" : "Add Combo to Cart")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleAddBundleToCart(bundle, true)}
                  data-testid={`buy-bundle-now-${bundle.id}`}
                  style={{
                    borderColor: "#059669",
                    color: "#059669",
                    padding: "9px 16px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    borderRadius: 8,
                  }}
                >
                  {lang === "bn" ? "এখনই কিনুন" : "Buy Now"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
