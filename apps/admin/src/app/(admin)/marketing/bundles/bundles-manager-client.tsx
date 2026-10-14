"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { taka } from "@/lib/format";
import {
  createBundleAction,
  updateBundleAction,
  deleteBundleAction,
  createOrderBumpAction,
  updateOrderBumpAction,
  deleteOrderBumpAction,
} from "./actions";

interface ProductVariantOption {
  id: string;
  title: string;
  price: number;
  stockQuantity: number;
}

interface ProductOption {
  id: string;
  title: string;
  titleBn: string | null;
  basePrice: number;
  categoryId: string | null;
  imageUrl: string | null;
  variants: ProductVariantOption[];
}

interface CategoryOption {
  id: string;
  name: string;
}

interface BundleItemView {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: {
    id: string;
    title: string;
    titleBn: string | null;
    slug: string;
    basePrice: number;
    images: { url: string }[];
  };
  variant: {
    id: string;
    title: string;
    price: number;
  } | null;
}

interface BundleView {
  id: string;
  title: string;
  titleBn: string | null;
  slug: string;
  description: string | null;
  descriptionBn: string | null;
  discountType: "PERCENTAGE" | "FIXED_DISCOUNT" | "FIXED_PRICE";
  discountValue: number;
  allowCoupon: boolean;
  status: "ACTIVE" | "INACTIVE";
  items: BundleItemView[];
  createdAt: Date | string;
}

interface OrderBumpView {
  id: string;
  title: string;
  titleBn: string | null;
  highlightText: string | null;
  highlightTextBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  productId: string;
  variantId: string;
  bumpPrice: number;
  allowCoupon: boolean;
  triggerType: "GLOBAL" | "SPECIFIC_PRODUCTS" | "CATEGORIES";
  triggerIds: string[];
  status: "ACTIVE" | "INACTIVE";
  displayOrder: number;
  acceptedCount: number;
  revenueGenerated: number;
  product: {
    id: string;
    title: string;
    titleBn: string | null;
    images: { url: string }[];
  };
  variant: {
    id: string;
    title: string;
    price: number;
    stockQuantity: number;
  };
}

interface AnalyticsView {
  totalBumpRevenue: number;
  totalBumpsAccepted: number;
  totalBundleRevenue: number;
  totalBundleItemsSold: number;
  totalOrders: number;
  ordersWithBumpCount: number;
  bumpAcceptanceRate: number;
}

interface Props {
  initialBundles: BundleView[];
  initialOrderBumps: OrderBumpView[];
  analytics: AnalyticsView;
  products: ProductOption[];
  categories: CategoryOption[];
  planTier: string;
  isTrial: boolean;
  canEdit: boolean;
  storeUrl?: string;
}

export function BundlesManagerClient({
  initialBundles,
  initialOrderBumps,
  analytics,
  products,
  categories,
  planTier,
  isTrial,
  canEdit,
  storeUrl,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"bundles" | "bumps" | "analytics">("bundles");
  const [bundles, setBundles] = useState<BundleView[]>(initialBundles);
  const [bumps, setBumps] = useState<OrderBumpView[]>(initialOrderBumps);

  const isStarter = planTier === "STARTER" && !isTrial;

  // Bundle Drawer / Modal State
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleView | null>(null);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleTitleBn, setBundleTitleBn] = useState("");
  const [bundleSlug, setBundleSlug] = useState("");
  const [bundleDesc, setBundleDesc] = useState("");
  const [bundleDescBn, setBundleDescBn] = useState("");
  const [bundleDiscountType, setBundleDiscountType] = useState<"PERCENTAGE" | "FIXED_DISCOUNT" | "FIXED_PRICE">("PERCENTAGE");
  const [bundleDiscountValue, setBundleDiscountValue] = useState<number>(15);
  const [bundleAllowCoupon, setBundleAllowCoupon] = useState(false);
  const [bundleStatus, setBundleStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [bundleItems, setBundleItems] = useState<{ productId: string; variantId?: string; quantity: number }[]>([]);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleError, setBundleError] = useState("");

  // Order Bump Drawer / Modal State
  const [bumpModalOpen, setBumpModalOpen] = useState(false);
  const [editingBump, setEditingBump] = useState<OrderBumpView | null>(null);
  const [bumpTitle, setBumpTitle] = useState("");
  const [bumpTitleBn, setBumpTitleBn] = useState("");
  const [bumpHl, setBumpHl] = useState("🔥 EXCLUSIVE 1-TIME OFFER");
  const [bumpHlBn, setBumpHlBn] = useState("🔥 এককালীন বিশেষ অফার");
  const [bumpDesc, setBumpDesc] = useState("");
  const [bumpDescBn, setBumpDescBn] = useState("");
  const [bumpProductId, setBumpProductId] = useState(products[0]?.id || "");
  const [bumpVariantId, setBumpVariantId] = useState(products[0]?.variants[0]?.id || "");
  const [bumpPrice, setBumpPrice] = useState<number>(0);
  const [bumpAllowCoupon, setBumpAllowCoupon] = useState(false);
  const [bumpTriggerType, setBumpTriggerType] = useState<"GLOBAL" | "SPECIFIC_PRODUCTS" | "CATEGORIES">("GLOBAL");
  const [bumpTriggerIds, setBumpTriggerIds] = useState<string[]>([]);
  const [bumpStatus, setBumpStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [bumpBusy, setBumpBusy] = useState(false);
  const [bumpError, setBumpError] = useState("");

  const selectedBumpProduct = products.find((p) => p.id === bumpProductId);
  const selectedBumpVariant = selectedBumpProduct?.variants.find((v) => v.id === bumpVariantId) || selectedBumpProduct?.variants[0];

  function openCreateBundle() {
    setEditingBundle(null);
    setBundleTitle("");
    setBundleTitleBn("");
    setBundleSlug("");
    setBundleDesc("");
    setBundleDescBn("");
    setBundleDiscountType("PERCENTAGE");
    setBundleDiscountValue(15);
    setBundleAllowCoupon(false);
    setBundleStatus("ACTIVE");
    if (products.length >= 2) {
      setBundleItems([
        { productId: products[0]!.id, variantId: products[0]!.variants[0]?.id, quantity: 1 },
        { productId: products[1]!.id, variantId: products[1]!.variants[0]?.id, quantity: 1 },
      ]);
    } else {
      setBundleItems([]);
    }
    setBundleError("");
    setBundleModalOpen(true);
  }

  function openEditBundle(b: BundleView) {
    setEditingBundle(b);
    setBundleTitle(b.title);
    setBundleTitleBn(b.titleBn || "");
    setBundleSlug(b.slug);
    setBundleDesc(b.description || "");
    setBundleDescBn(b.descriptionBn || "");
    setBundleDiscountType(b.discountType);
    setBundleDiscountValue(Number(b.discountValue));
    setBundleAllowCoupon(b.allowCoupon);
    setBundleStatus(b.status);
    setBundleItems(
      b.items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId || undefined,
        quantity: it.quantity,
      }))
    );
    setBundleError("");
    setBundleModalOpen(true);
  }

  async function handleSaveBundle(e: React.FormEvent) {
    e.preventDefault();
    if (!bundleTitle.trim()) {
      setBundleError("Bundle title is required");
      return;
    }
    if (bundleItems.length < 2) {
      setBundleError("A bundle must contain at least 2 distinct products");
      return;
    }
    setBundleBusy(true);
    setBundleError("");

    const payload = {
      title: bundleTitle.trim(),
      titleBn: bundleTitleBn.trim() || undefined,
      slug: bundleSlug.trim() || undefined,
      description: bundleDesc.trim() || undefined,
      descriptionBn: bundleDescBn.trim() || undefined,
      discountType: bundleDiscountType,
      discountValue: bundleDiscountValue,
      allowCoupon: bundleAllowCoupon,
      status: bundleStatus,
      items: bundleItems.map((it, idx) => ({
        productId: it.productId,
        variantId: it.variantId || undefined,
        quantity: it.quantity,
        sortOrder: idx,
      })),
    };

    const res = editingBundle
      ? await updateBundleAction(editingBundle.id, payload)
      : await createBundleAction(payload);

    setBundleBusy(false);
    if (!res.ok) {
      setBundleError(res.error || "Failed to save bundle");
      return;
    }
    setBundleModalOpen(false);
    router.refresh();
  }

  async function handleDeleteBundle(id: string) {
    if (!confirm("Are you sure you want to delete this bundle?")) return;
    const res = await deleteBundleAction(id);
    if (res.ok) {
      setBundles((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    }
  }

  function openCreateBump() {
    setEditingBump(null);
    setBumpTitle("");
    setBumpTitleBn("");
    setBumpHl("🔥 EXCLUSIVE 1-TIME OFFER");
    setBumpHlBn("🔥 এককালীন বিশেষ অফার");
    setBumpDesc("");
    setBumpDescBn("");
    const defaultProd = products[0];
    const defaultVar = defaultProd?.variants[0];
    setBumpProductId(defaultProd?.id || "");
    setBumpVariantId(defaultVar?.id || "");
    setBumpPrice(defaultVar ? Math.round(Number(defaultVar.price) * 0.8) : 0);
    setBumpAllowCoupon(false);
    setBumpTriggerType("GLOBAL");
    setBumpTriggerIds([]);
    setBumpStatus("ACTIVE");
    setBumpError("");
    setBumpModalOpen(true);
  }

  function openEditBump(b: OrderBumpView) {
    setEditingBump(b);
    setBumpTitle(b.title);
    setBumpTitleBn(b.titleBn || "");
    setBumpHl(b.highlightText || "🔥 EXCLUSIVE 1-TIME OFFER");
    setBumpHlBn(b.highlightTextBn || "🔥 এককালীন বিশেষ অফার");
    setBumpDesc(b.description || "");
    setBumpDescBn(b.descriptionBn || "");
    setBumpProductId(b.productId);
    setBumpVariantId(b.variantId);
    setBumpPrice(Number(b.bumpPrice));
    setBumpAllowCoupon(b.allowCoupon);
    setBumpTriggerType(b.triggerType);
    setBumpTriggerIds(b.triggerIds || []);
    setBumpStatus(b.status);
    setBumpError("");
    setBumpModalOpen(true);
  }

  async function handleSaveBump(e: React.FormEvent) {
    e.preventDefault();
    if (!bumpTitle.trim()) {
      setBumpError("Order bump title is required");
      return;
    }
    if (!bumpProductId || !bumpVariantId) {
      setBumpError("Select a valid product and variant");
      return;
    }
    if (bumpPrice <= 0) {
      setBumpError("Bump price must be greater than 0");
      return;
    }
    setBumpBusy(true);
    setBumpError("");

    const payload = {
      title: bumpTitle.trim(),
      titleBn: bumpTitleBn.trim() || undefined,
      highlightText: bumpHl.trim() || undefined,
      highlightTextBn: bumpHlBn.trim() || undefined,
      description: bumpDesc.trim() || undefined,
      descriptionBn: bumpDescBn.trim() || undefined,
      productId: bumpProductId,
      variantId: bumpVariantId,
      bumpPrice,
      allowCoupon: bumpAllowCoupon,
      triggerType: bumpTriggerType,
      triggerIds: bumpTriggerIds,
      status: bumpStatus,
    };

    const res = editingBump
      ? await updateOrderBumpAction(editingBump.id, payload)
      : await createOrderBumpAction(payload);

    setBumpBusy(false);
    if (!res.ok) {
      setBumpError(res.error || "Failed to save order bump");
      return;
    }
    setBumpModalOpen(false);
    router.refresh();
  }

  async function handleDeleteBump(id: string) {
    if (!confirm("Are you sure you want to delete this order bump?")) return;
    const res = await deleteOrderBumpAction(id);
    if (res.ok) {
      setBumps((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    }
  }

  return (
    <div>
      {/* Top Header */}
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Bundles & 1-Click Checkout Upsells</h1>
            <span className="pill green" style={{ fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
              AOV Booster
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Increase average order value with combo packages, frequently bought together deals, and 1-click checkout order bumps.
          </p>
        </div>
        <div className="actions">
          {canEdit && tab === "bundles" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateBundle}
              data-testid="create-bundle-btn"
            >
              + Create Product Bundle
            </button>
          )}
          {canEdit && tab === "bumps" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateBump}
              data-testid="create-bump-btn"
            >
              + Create Order Bump
            </button>
          )}
        </div>
      </div>

      {/* Starter Plan Gating Banner */}
      {isStarter && (
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.06) 100%)",
            border: "1.5px solid rgba(245, 158, 11, 0.4)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>🚀</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#b45309" }}>
                Unlock Product Bundles & 1-Click Checkout Order Bumps
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2, #4b5563)", maxWidth: 640 }}>
                High-converting stores on BizTrack generate <b>+18% to +32% higher profit per checkout</b> using checkout order bumps and combo savings. Upgrade to <b>Pro</b> or <b>Business</b> to launch unlimited deals.
              </p>
            </div>
          </div>
          <Link href="/billing" className="btn btn-primary" style={{ padding: "8px 20px", fontWeight: 700 }}>
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Total Bump Revenue</div>
          <div className="v num">{taka(analytics.totalBumpRevenue)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {analytics.totalBumpsAccepted} upsells accepted at checkout
          </div>
        </div>

        <div className="stat">
          <div className="k">Bump Acceptance Rate</div>
          <div className="v num">{analytics.bumpAcceptanceRate}%</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {analytics.ordersWithBumpCount} of {analytics.totalOrders} total orders included a bump
          </div>
        </div>

        <div className="stat">
          <div className="k">Total Bundle Revenue</div>
          <div className="v num">{taka(analytics.totalBundleRevenue)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {analytics.totalBundleItemsSold} bundle items sold
          </div>
        </div>

        <div className="stat">
          <div className="k">Active Growth Campaigns</div>
          <div className="v num">
            {bundles.filter((b) => b.status === "ACTIVE").length + bumps.filter((b) => b.status === "ACTIVE").length}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {bundles.length} bundles · {bumps.length} order bumps
          </div>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab("bundles")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: tab === "bundles" ? 700 : 500,
            color: tab === "bundles" ? "var(--brand, #059669)" : "var(--ink-2, #6b7280)",
            borderBottom: tab === "bundles" ? "2px solid var(--brand, #059669)" : "2px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          data-testid="tab-bundles"
        >
          🎁 Product Bundles & Combos
          <span className="pill grey" style={{ fontSize: 11, padding: "1px 6px" }}>{bundles.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("bumps")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: tab === "bumps" ? 700 : 500,
            color: tab === "bumps" ? "var(--brand, #059669)" : "var(--ink-2, #6b7280)",
            borderBottom: tab === "bumps" ? "2px solid var(--brand, #059669)" : "2px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          data-testid="tab-bumps"
        >
          ⚡ 1-Click Checkout Order Bumps
          <span className="pill grey" style={{ fontSize: 11, padding: "1px 6px" }}>{bumps.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("analytics")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: tab === "analytics" ? 700 : 500,
            color: tab === "analytics" ? "var(--brand, #059669)" : "var(--ink-2, #6b7280)",
            borderBottom: tab === "analytics" ? "2px solid var(--brand, #059669)" : "2px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          data-testid="tab-analytics"
        >
          📊 AOV & Conversion Analytics
        </button>
      </div>

      {/* Tab 1: Product Bundles */}
      {tab === "bundles" && (
        <div>
          {bundles.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎁</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>No Product Bundles Created Yet</h3>
              <p className="muted" style={{ margin: "0 0 20px", fontSize: 14, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                Combine 2 or more complementary products into an attractive combo package with an exclusive discount.
              </p>
              {canEdit && (
                <button type="button" className="btn btn-primary" onClick={openCreateBundle} data-testid="empty-create-bundle">
                  + Create Your First Bundle
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Bundle Deal</th>
                    <th>Included Products</th>
                    <th>Discount</th>
                    <th>Coupon Stacking</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bundles.map((b) => (
                    <tr key={b.id} data-testid={`bundle-row-${b.id}`}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.title}</div>
                        {b.titleBn && <div style={{ fontSize: 12, color: "var(--ink-2, #6b7280)" }}>{b.titleBn}</div>}
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>slug: /{b.slug}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {b.items.map((it) => (
                            <span
                              key={it.id}
                              className="pill grey"
                              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              {it.quantity > 1 ? `${it.quantity}x ` : ""}
                              {it.product.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="pill green" style={{ fontWeight: 700 }}>
                          {b.discountType === "PERCENTAGE"
                            ? `${b.discountValue}% OFF`
                            : b.discountType === "FIXED_DISCOUNT"
                            ? `−${taka(b.discountValue)}`
                            : `Fixed ${taka(b.discountValue)}`}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${b.allowCoupon ? "blue" : "grey"}`} style={{ fontSize: 11 }}>
                          {b.allowCoupon ? "Allowed" : "Protected (No Stacking)"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${b.status === "ACTIVE" ? "ok" : "grey"}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditBundle(b)}
                              data-testid={`edit-bundle-${b.id}`}
                            >
                              Edit
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#ef4444" }}
                              onClick={() => handleDeleteBundle(b.id)}
                              data-testid={`delete-bundle-${b.id}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Order Bumps */}
      {tab === "bumps" && (
        <div>
          {bumps.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⚡</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>No Order Bumps Configured</h3>
              <p className="muted" style={{ margin: "0 0 20px", fontSize: 14, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                Add a 1-click impulse buy offer directly on your checkout page right before customers confirm their Cash on Delivery order.
              </p>
              {canEdit && (
                <button type="button" className="btn btn-primary" onClick={openCreateBump} data-testid="empty-create-bump">
                  + Create 1-Click Order Bump
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Bump Offer</th>
                    <th>Product & Variant</th>
                    <th>Bump Price</th>
                    <th>Trigger Rule</th>
                    <th>Acceptance</th>
                    <th>Revenue</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bumps.map((b) => (
                    <tr key={b.id} data-testid={`bump-row-${b.id}`}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>
                            {b.highlightText || "OFFER"}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.title}</div>
                        {b.titleBn && <div style={{ fontSize: 12, color: "var(--ink-2, #6b7280)" }}>{b.titleBn}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{b.product.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Variant: {b.variant.title} (Stock: {b.variant.stockQuantity})
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#059669", fontSize: 14 }}>
                          {taka(b.bumpPrice)}
                        </div>
                        <del style={{ fontSize: 12, color: "var(--ink-muted, #9ca3af)" }}>
                          {taka(b.variant.price)}
                        </del>
                      </td>
                      <td>
                        <span className="pill grey" style={{ fontSize: 11 }}>
                          {b.triggerType === "GLOBAL" ? "All Checkouts (Global)" : b.triggerType}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{b.acceptedCount} orders</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#059669", fontSize: 14 }}>
                          {taka(b.revenueGenerated)}
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${b.status === "ACTIVE" ? "ok" : "grey"}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditBump(b)}
                              data-testid={`edit-bump-${b.id}`}
                            >
                              Edit
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#ef4444" }}
                              onClick={() => handleDeleteBump(b.id)}
                              data-testid={`delete-bump-${b.id}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Analytics */}
      {tab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="grid grid-3">
            <div className="card">
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Total Incremental Upsell Revenue</h3>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#059669", margin: "8px 0" }}>
                {taka(analytics.totalBumpRevenue + analytics.totalBundleRevenue)}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                Combined top-line revenue generated directly through order bumps and combo offers.
              </p>
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Checkout Bump Conversion Rate</h3>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#2563eb", margin: "8px 0" }}>
                {analytics.bumpAcceptanceRate}%
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                {analytics.ordersWithBumpCount} checkouts added an impulse order bump out of {analytics.totalOrders} total completed orders.
              </p>
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Bundle Items Volume</h3>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#7c3aed", margin: "8px 0" }}>
                {analytics.totalBundleItemsSold} units
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                Total SKU items packed and delivered as part of bundled combo deals.
              </p>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Order Bump Performance Leaderboard</h3>
            {bumps.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No order bumps active to report.</p>
            ) : (
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Offer Title</th>
                    <th>Product</th>
                    <th>Bump Price</th>
                    <th>Orders Accepted</th>
                    <th>Revenue Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {bumps.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.title}</td>
                      <td>{b.product.title}</td>
                      <td>{taka(b.bumpPrice)}</td>
                      <td><b>{b.acceptedCount}</b> orders</td>
                      <td style={{ fontWeight: 700, color: "#059669" }}>{taka(b.revenueGenerated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Drawer: Create / Edit Product Bundle */}
      {bundleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setBundleModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: 14,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="bundle-modal"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingBundle ? "Edit Product Bundle" : "Create Product Bundle"}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setBundleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {bundleError && (
              <div className="notice" role="alert" style={{ marginBottom: 14, background: "#fef2f2", color: "#b91c1c" }}>
                {bundleError}
              </div>
            )}

            <form onSubmit={handleSaveBundle} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Bundle Title (English) *</label>
                <input
                  type="text"
                  className="input"
                  value={bundleTitle}
                  onChange={(e) => setBundleTitle(e.target.value)}
                  placeholder="e.g. Complete Skincare Trio (Cleanser + Toner + Serum)"
                  required
                  data-testid="bundle-title-input"
                />
              </div>

              <div>
                <label className="label">Bundle Title (Bangla)</label>
                <input
                  type="text"
                  className="input"
                  value={bundleTitleBn}
                  onChange={(e) => setBundleTitleBn(e.target.value)}
                  placeholder="যেমন: সম্পূর্ণ স্কিনকেয়ার কম্বো প্যাক"
                />
              </div>

              <div>
                <label className="label">Custom Slug (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={bundleSlug}
                  onChange={(e) => setBundleSlug(e.target.value)}
                  placeholder="e.g. skincare-trio"
                />
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={bundleDesc}
                  onChange={(e) => setBundleDesc(e.target.value)}
                  placeholder="Brief pitch highlighting the savings and value..."
                />
              </div>

              {/* Component Products Selection */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label className="label" style={{ margin: 0 }}>Included Products (Minimum 2) *</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (products.length > 0) {
                        setBundleItems((prev) => [
                          ...prev,
                          { productId: products[0]!.id, variantId: products[0]!.variants[0]?.id, quantity: 1 },
                        ]);
                      }
                    }}
                  >
                    + Add Product
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {bundleItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: 8,
                          borderRadius: 8,
                          border: "1px solid var(--border, #e5e7eb)",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <select
                          className="input"
                          style={{ flex: 2 }}
                          value={item.productId}
                          onChange={(e) => {
                            const newPId = e.target.value;
                            const newProd = products.find((p) => p.id === newPId);
                            setBundleItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? { ...it, productId: newPId, variantId: newProd?.variants[0]?.id }
                                  : it
                              )
                            );
                          }}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} ({taka(p.basePrice)})
                            </option>
                          ))}
                        </select>

                        {prod && prod.variants.length > 1 && (
                          <select
                            className="input"
                            style={{ flex: 1.5 }}
                            value={item.variantId || ""}
                            onChange={(e) => {
                              const newVId = e.target.value;
                              setBundleItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, variantId: newVId } : it))
                              );
                            }}
                          >
                            {prod.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.title}
                              </option>
                            ))}
                          </select>
                        )}

                        <input
                          type="number"
                          className="input"
                          style={{ width: 65, textAlign: "center" }}
                          min={1}
                          max={10}
                          value={item.quantity}
                          onChange={(e) => {
                            const q = Math.max(1, parseInt(e.target.value) || 1);
                            setBundleItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: q } : it))
                            );
                          }}
                        />

                        {bundleItems.length > 2 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: "#ef4444" }}
                            onClick={() => {
                              setBundleItems((prev) => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pricing & Discount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Discount Type *</label>
                  <select
                    className="input"
                    value={bundleDiscountType}
                    onChange={(e) => setBundleDiscountType(e.target.value as any)}
                  >
                    <option value="PERCENTAGE">Percentage (% Off)</option>
                    <option value="FIXED_DISCOUNT">Fixed Discount (BDT Off)</option>
                    <option value="FIXED_PRICE">Fixed Bundle Price (Total BDT)</option>
                  </select>
                </div>

                <div>
                  <label className="label">
                    {bundleDiscountType === "PERCENTAGE"
                      ? "Discount Percentage (%)"
                      : bundleDiscountType === "FIXED_DISCOUNT"
                      ? "Discount Amount (BDT)"
                      : "Total Bundle Price (BDT)"} *
                  </label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={bundleDiscountValue}
                    onChange={(e) => setBundleDiscountValue(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Margin & Coupon Stacking Toggle */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border, #e5e7eb)",
                  backgroundColor: "rgba(99, 102, 241, 0.04)",
                }}
              >
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={bundleAllowCoupon}
                    onChange={(e) => setBundleAllowCoupon(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                      Allow Additional Coupons to Stack on this Deal
                    </span>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-2, #6b7280)" }}>
                      Recommended OFF. Keeping this disabled protects your profit margin by preventing buyers from stacking promo codes on top of combo discounts.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={bundleStatus}
                  onChange={(e) => setBundleStatus(e.target.value as any)}
                >
                  <option value="ACTIVE">Active (Live on Storefront)</option>
                  <option value="INACTIVE">Inactive (Draft / Hidden)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBundleModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bundleBusy}
                  data-testid="save-bundle-submit"
                >
                  {bundleBusy ? "Saving..." : editingBundle ? "Update Bundle" : "Create Bundle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Drawer: Create / Edit 1-Click Order Bump */}
      {bumpModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setBumpModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: 14,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="bump-modal"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingBump ? "Edit 1-Click Order Bump" : "Create 1-Click Order Bump"}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setBumpModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {bumpError && (
              <div className="notice" role="alert" style={{ marginBottom: 14, background: "#fef2f2", color: "#b91c1c" }}>
                {bumpError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Form Column */}
              <form onSubmit={handleSaveBump} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="label">Offer Headline (English) *</label>
                  <input
                    type="text"
                    className="input"
                    value={bumpTitle}
                    onChange={(e) => setBumpTitle(e.target.value)}
                    placeholder="e.g. Add Premium Silk Scrunchie"
                    required
                    data-testid="bump-title-input"
                  />
                </div>

                <div>
                  <label className="label">Offer Headline (Bangla)</label>
                  <input
                    type="text"
                    className="input"
                    value={bumpTitleBn}
                    onChange={(e) => setBumpTitleBn(e.target.value)}
                    placeholder="যেমন: প্রিমিয়াম সিল্ক স্ক্রাঞ্চি যোগ করুন"
                  />
                </div>

                <div>
                  <label className="label">Highlight Badge Text</label>
                  <input
                    type="text"
                    className="input"
                    value={bumpHl}
                    onChange={(e) => setBumpHl(e.target.value)}
                    placeholder="🔥 EXCLUSIVE 1-TIME OFFER"
                  />
                </div>

                <div>
                  <label className="label">Punchy Benefit Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={bumpDesc}
                    onChange={(e) => setBumpDesc(e.target.value)}
                    placeholder="100% pure mulberry silk. Protects hair from breakage."
                  />
                </div>

                <div>
                  <label className="label">Upsell Product *</label>
                  <select
                    className="input"
                    value={bumpProductId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const prod = products.find((p) => p.id === pId);
                      setBumpProductId(pId);
                      if (prod?.variants[0]) {
                        setBumpVariantId(prod.variants[0].id);
                        setBumpPrice(Math.round(Number(prod.variants[0].price) * 0.8));
                      }
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBumpProduct && selectedBumpProduct.variants.length > 0 && (
                  <div>
                    <label className="label">Product Variant *</label>
                    <select
                      className="input"
                      value={bumpVariantId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const v = selectedBumpProduct.variants.find((x) => x.id === vId);
                        setBumpVariantId(vId);
                        if (v) setBumpPrice(Math.round(Number(v.price) * 0.8));
                      }}
                    >
                      {selectedBumpProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} — Regular {taka(v.price)} (Stock: {v.stockQuantity})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Special Bump Price (BDT) *</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={bumpPrice}
                    onChange={(e) => setBumpPrice(Number(e.target.value))}
                    required
                    data-testid="bump-price-input"
                  />
                  {selectedBumpVariant && Number(selectedBumpVariant.price) > bumpPrice && (
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 }}>
                      Savings: {taka(Number(selectedBumpVariant.price) - bumpPrice)} off regular price
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Trigger Condition</label>
                  <select
                    className="input"
                    value={bumpTriggerType}
                    onChange={(e) => setBumpTriggerType(e.target.value as any)}
                  >
                    <option value="GLOBAL">Global (Show on all checkouts)</option>
                    <option value="SPECIFIC_PRODUCTS">Specific Cart Products</option>
                    <option value="CATEGORIES">Specific Categories</option>
                  </select>
                </div>

                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={bumpStatus}
                    onChange={(e) => setBumpStatus(e.target.value as any)}
                  >
                    <option value="ACTIVE">Active (Live at Checkout)</option>
                    <option value="INACTIVE">Inactive (Draft / Hidden)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBumpModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bumpBusy}
                    data-testid="save-bump-submit"
                  >
                    {bumpBusy ? "Saving..." : editingBump ? "Update Bump" : "Create Bump"}
                  </button>
                </div>
              </form>

              {/* Live Checkout Preview Column */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2, #6b7280)", marginBottom: 8, textTransform: "uppercase" }}>
                  Live Checkout Preview
                </div>
                <div
                  style={{
                    border: "2px dashed #f59e0b",
                    backgroundColor: "rgba(245, 158, 11, 0.05)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>
                      {bumpHl || "🔥 EXCLUSIVE 1-TIME OFFER"}
                    </span>
                    {selectedBumpVariant && Number(selectedBumpVariant.price) > bumpPrice && (
                      <span className="pill green" style={{ fontSize: 10, padding: "2px 6px", fontWeight: 700 }}>
                        SAVE {taka(Number(selectedBumpVariant.price) - bumpPrice)}!
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "#10b981" }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {bumpTitle || "Add Exclusive Upsell Item"}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
                          {taka(bumpPrice || 0)}
                        </span>
                        {selectedBumpVariant && Number(selectedBumpVariant.price) > bumpPrice && (
                          <del style={{ fontSize: 12, color: "#9ca3af" }}>
                            {taka(Number(selectedBumpVariant.price))}
                          </del>
                        )}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#4b5563" }}>
                        {bumpDesc || "One-click add-on seamlessly added into customer order with zero friction."}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    color: "#475569",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                    ⚡ Why this converts at 20%+
                  </div>
                  Customers don't have to fill out another form or re-enter payment details. When this box is checked, the order total updates immediately and component inventory is atomically locked on order submission.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
