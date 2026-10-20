"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dateOnly, taka, prettyPhone } from "@/lib/format";
import {
  approveApplicationAction,
  rejectApplicationAction,
  saveTierAction,
  deleteTierAction,
  savePriceOverrideAction,
  deletePriceOverrideAction,
  saveWholesaleSettingsAction,
} from "./actions";
import type { WholesaleTierInput, WholesalePriceOverrideInput, WholesaleSettingsInput } from "@biztrackbd/core";

interface Props {
  /** The store's own registration page (on the storefront address, not the admin one). */
  registerUrl: string;
  initialData: {
    overview: {
      totalApproved: number;
      totalPending: number;
      totalTiers: number;
      totalOrders: number;
      totalWholesaleGross: number;
      totalAdvanceCollected: number;
      totalPendingBalance: number;
    };
    applications: Array<{
      id: string;
      companyName: string;
      tradeLicense: string | null;
      businessType: string | null;
      taxId: string | null;
      whatsappNumber: string | null;
      address: string | null;
      district: string | null;
      status: "PENDING" | "APPROVED" | "REJECTED";
      approvedAt: Date | null;
      rejectionReason: string | null;
      creditLimit: number;
      createdAt: Date;
      customer: {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        totalOrders: number;
        totalSpent: any;
      };
      tier: {
        id: string;
        name: string;
        discountPercent: number;
      } | null;
    }>;
    tiers: Array<{
      id: string;
      name: string;
      discountPercent: number;
      minOrderAmount: number;
      allowCod: boolean;
      partialDepositPercent: number | null;
      customerCount: number;
      customPricesCount: number;
    }>;
    prices: Array<{
      id: string;
      variantId: string;
      tierId: string | null;
      minQuantity: number;
      price: number;
      tier: { id: string; name: string; discountPercent: number } | null;
      variant: {
        id: string;
        title: string;
        price: number;
        sku: string | null;
        product: { id: string; title: string; slug: string };
      };
    }>;
    settings: {
      wholesaleEnabled: boolean;
      wholesaleMinOrderAmount: number;
      wholesaleDefaultMoq: number;
      wholesaleAllowRegistration: boolean;
      wholesaleBankDetails: {
        bankName?: string;
        branchName?: string;
        accountName?: string;
        accountNumber?: string;
        routingNumber?: string;
        instructions?: string;
      } | null;
    };
  };
}

type Tab = "applications" | "tiers" | "prices" | "settings";

export function WholesaleManagerClient({ initialData, registerUrl }: Props) {
  const [tab, setTab] = useState<Tab>("applications");
  const [isPending, startTransition] = useTransition();
  const [appFilter, setAppFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Approval Modal State
  const [approvingApp, setApprovingApp] = useState<Props["initialData"]["applications"][0] | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>(initialData.tiers[0]?.id || "");
  const [creditLimit, setCreditLimit] = useState<number>(0);

  // Rejection Modal State
  const [rejectingApp, setRejectingApp] = useState<Props["initialData"]["applications"][0] | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Tier Edit Modal State
  const [editingTier, setEditingTier] = useState<WholesaleTierInput | null>(null);
  const [isTierModalOpen, setIsTierModalOpen] = useState<boolean>(false);

  // Price Override Modal State
  const [editingPrice, setEditingPrice] = useState<WholesalePriceOverrideInput | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState<boolean>(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState<WholesaleSettingsInput>({
    wholesaleEnabled: initialData.settings.wholesaleEnabled,
    wholesaleMinOrderAmount: initialData.settings.wholesaleMinOrderAmount,
    wholesaleDefaultMoq: initialData.settings.wholesaleDefaultMoq,
    wholesaleAllowRegistration: initialData.settings.wholesaleAllowRegistration,
    wholesaleBankDetails: initialData.settings.wholesaleBankDetails
      ? {
          bankName: initialData.settings.wholesaleBankDetails.bankName || "",
          branchName: initialData.settings.wholesaleBankDetails.branchName || "",
          accountName: initialData.settings.wholesaleBankDetails.accountName || "",
          accountNumber: initialData.settings.wholesaleBankDetails.accountNumber || "",
          routingNumber: initialData.settings.wholesaleBankDetails.routingNumber || "",
          instructions: initialData.settings.wholesaleBankDetails.instructions || "",
        }
      : null,
  });

  const filteredApps = initialData.applications.filter((a) => {
    if (appFilter === "ALL") return true;
    return a.status === appFilter;
  });

  const handleApprove = () => {
    if (!approvingApp || !selectedTierId) return;
    startTransition(async () => {
      await approveApplicationAction(approvingApp.id, selectedTierId, creditLimit);
      setApprovingApp(null);
    });
  };

  const handleReject = () => {
    if (!rejectingApp) return;
    startTransition(async () => {
      await rejectApplicationAction(rejectingApp.id, rejectionReason);
      setRejectingApp(null);
      setRejectionReason("");
    });
  };

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;
    startTransition(async () => {
      await saveTierAction(editingTier);
      setIsTierModalOpen(false);
      setEditingTier(null);
    });
  };

  const handleDeleteTier = (tierId: string) => {
    if (!confirm("Are you sure you want to delete this tier? Assigned resellers will lose their discount.")) return;
    startTransition(async () => {
      await deleteTierAction(tierId);
    });
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrice) return;
    startTransition(async () => {
      await savePriceOverrideAction(editingPrice);
      setIsPriceModalOpen(false);
      setEditingPrice(null);
    });
  };

  const handleDeletePrice = (priceId: string) => {
    if (!confirm("Remove this volume pricing rule?")) return;
    startTransition(async () => {
      await deletePriceOverrideAction(priceId);
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveWholesaleSettingsAction(settingsForm);
      alert("Wholesale settings saved successfully!");
    });
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Wholesale & B2B Hub</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Manage reseller tiers, bulk volume quantity breaks, applications, and direct bank settlement.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/orders?channel=WHOLESALE" className="btn btn-secondary btn-sm" prefetch={false}>
            Wholesale Orders →
          </Link>
          <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            Preview Reseller Portal ↗
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-4" style={{ gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Active Resellers</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: "var(--brand, #4f46e5)" }}>
            {initialData.overview.totalApproved}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Across {initialData.overview.totalTiers} trade tiers
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Pending Applications</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: initialData.overview.totalPending > 0 ? "#ea580c" : "inherit" }}>
            {initialData.overview.totalPending}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Awaiting trade verification
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Wholesale Gross</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: "#16a34a" }}>
            {taka(initialData.overview.totalWholesaleGross)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {initialData.overview.totalOrders} bulk orders placed
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Pending Balance Due</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: "#dc2626" }}>
            {taka(initialData.overview.totalPendingBalance)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            To collect via COD or bank
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="chips" style={{ borderBottom: "1px solid var(--line, #e5e7eb)", paddingBottom: 8, gap: 8 }}>
        <button
          type="button"
          className={`chip ${tab === "applications" ? "active" : ""}`}
          onClick={() => setTab("applications")}
          style={{ cursor: "pointer", fontWeight: tab === "applications" ? 700 : 500 }}
        >
          Reseller Applications {initialData.overview.totalPending > 0 && `(${initialData.overview.totalPending})`}
        </button>
        <button
          type="button"
          className={`chip ${tab === "tiers" ? "active" : ""}`}
          onClick={() => setTab("tiers")}
          style={{ cursor: "pointer", fontWeight: tab === "tiers" ? 700 : 500 }}
        >
          Wholesale Tiers ({initialData.tiers.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === "prices" ? "active" : ""}`}
          onClick={() => setTab("prices")}
          style={{ cursor: "pointer", fontWeight: tab === "prices" ? 700 : 500 }}
        >
          Volume Breaks & Variant Overrides ({initialData.prices.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === "settings" ? "active" : ""}`}
          onClick={() => setTab("settings")}
          style={{ cursor: "pointer", fontWeight: tab === "settings" ? 700 : 500 }}
        >
          Bank & Store Settings
        </button>
      </div>

      {/* TAB 1: APPLICATIONS QUEUE */}
      {tab === "applications" && (
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`btn btn-sm ${appFilter === filter ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAppFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredApps.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <p className="muted" style={{ margin: 0 }}>
                No {appFilter.toLowerCase()} reseller applications found.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle, #f9fafb)", borderBottom: "1px solid var(--line, #e5e7eb)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Business / Shop</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Contact Person</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Trade License / BIN</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tier / Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line, #e5e7eb)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700 }}>{a.companyName}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {a.businessType ?? "General Reseller"} · {a.district ?? "Bangladesh"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div>{a.customer.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{prettyPhone(a.customer.phone)}</div>
                        {a.whatsappNumber && (
                          <div style={{ fontSize: 11, color: "#16a34a" }}>WA: {prettyPhone(a.whatsappNumber)}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {a.tradeLicense ? <div>TL: <b>{a.tradeLicense}</b></div> : <span className="muted">—</span>}
                        {a.taxId && <div style={{ fontSize: 12, color: "#555" }}>BIN: {a.taxId}</div>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {a.status === "APPROVED" ? (
                          <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>
                            APPROVED · {a.tier?.name} ({a.tier?.discountPercent}%)
                          </span>
                        ) : a.status === "PENDING" ? (
                          <span className="badge" style={{ background: "#ffedd5", color: "#9a3412" }}>
                            PENDING REVIEW
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
                            REJECTED
                          </span>
                        )}
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                          {dateOnly(a.createdAt)}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {a.status === "PENDING" && (
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setApprovingApp(a);
                                setSelectedTierId(initialData.tiers[0]?.id || "");
                                setCreditLimit(0);
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#dc2626" }}
                              onClick={() => setRejectingApp(a)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {a.status === "APPROVED" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setApprovingApp(a);
                              setSelectedTierId(a.tier?.id || initialData.tiers[0]?.id || "");
                              setCreditLimit(a.creditLimit);
                            }}
                          >
                            Change Tier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TIERS MANAGER */}
      {tab === "tiers" && (
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Reseller Trade Tiers</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Configure global trade discounts, cart minimums, and COD eligibility per partner level.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingTier({
                  name: "",
                  discountPercent: 15,
                  minOrderAmount: 5000,
                  allowCod: false,
                  partialDepositPercent: 25,
                });
                setIsTierModalOpen(true);
              }}
            >
              + Create Wholesale Tier
            </button>
          </div>

          <div className="grid grid-3" style={{ gap: 14 }}>
            {initialData.tiers.map((t) => (
              <div key={t.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{t.name}</div>
                    <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 13 }}>
                      {t.discountPercent}% Off
                    </span>
                  </div>

                  <div className="stack" style={{ gap: 8, marginTop: 14, fontSize: 13.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">Minimum Order:</span>
                      <b>{taka(t.minOrderAmount)}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">COD Eligible:</span>
                      <span style={{ color: t.allowCod ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {t.allowCod ? "Yes (Collect Balance)" : "No (100% Advance)"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">Partial Deposit:</span>
                      <b>{t.partialDepositPercent ? `${t.partialDepositPercent}% Advance` : "Full Payment"}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line, #e5e7eb)", paddingTop: 8 }}>
                      <span className="muted">Approved Accounts:</span>
                      <b>{t.customerCount} resellers</b>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditingTier(t);
                      setIsTierModalOpen(true);
                    }}
                  >
                    Edit Tier
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: "#dc2626" }}
                    onClick={() => handleDeleteTier(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VOLUME BREAKS & OVERRIDES */}
      {tab === "prices" && (
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Volume Tier Pricing & Overrides</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Configure quantity break price tables open to general retail shoppers or specific reseller tiers.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingPrice({
                  variantId: "",
                  tierId: null,
                  minQuantity: 6,
                  price: 0,
                });
                setIsPriceModalOpen(true);
              }}
            >
              + Add Volume Price Break
            </button>
          </div>

          {initialData.prices.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <p className="muted" style={{ margin: "0 0 10px" }}>
                No variant quantity breaks configured yet. Flat tier discounts will apply by default.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditingPrice({
                    variantId: "",
                    tierId: null,
                    minQuantity: 6,
                    price: 0,
                  });
                  setIsPriceModalOpen(true);
                }}
              >
                Create First Volume Break
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle, #f9fafb)", borderBottom: "1px solid var(--line, #e5e7eb)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Product & Variant</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Target Group</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Min Quantity</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Regular Retail</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Bulk Rate</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.prices.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--line, #e5e7eb)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600 }}>{p.variant.product.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.variant.title} {p.variant.sku ? `· SKU: ${p.variant.sku}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {p.tier ? (
                          <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
                            {p.tier.name}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                            Public Volume Break (All Shoppers)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <b>{p.minQuantity}+ pcs</b>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {taka(p.variant.price)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <b style={{ color: "#16a34a" }}>{taka(p.price)}</b>
                        <div className="muted" style={{ fontSize: 11 }}>
                          Save {Math.round(((p.variant.price - p.price) / p.variant.price) * 100)}%
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: "#dc2626" }}
                          onClick={() => handleDeletePrice(p.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STOREWIDE & BANK SETTINGS */}
      {tab === "settings" && (
        <form onSubmit={handleSaveSettings} className="stack" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Storewide Wholesale Rules</h3>
            <div className="stack" style={{ gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settingsForm.wholesaleEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, wholesaleEnabled: e.target.checked })}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Enable Wholesale & B2B Features</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Activates wholesale pricing tables, MOQ checks, and reseller application portal across your store.
                  </div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settingsForm.wholesaleAllowRegistration}
                  onChange={(e) => setSettingsForm({ ...settingsForm, wholesaleAllowRegistration: e.target.checked })}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Allow Public Storefront Reseller Registration</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Permits boutique shops to submit wholesale applications via /wholesale/register.
                  </div>
                </div>
              </label>

              <div className="grid grid-2" style={{ gap: 14, marginTop: 10 }}>
                <div>
                  <label className="label">Default Storewide Cart Minimum (৳)</label>
                  <input
                    type="number"
                    className="input"
                    value={settingsForm.wholesaleMinOrderAmount}
                    onChange={(e) => setSettingsForm({ ...settingsForm, wholesaleMinOrderAmount: Number(e.target.value) })}
                    min={0}
                    required
                  />
                  <span className="muted" style={{ fontSize: 12 }}>Reseller orders below this threshold will be blocked at checkout.</span>
                </div>

                <div>
                  <label className="label">Default Minimum Order Quantity (MOQ pcs)</label>
                  <input
                    type="number"
                    className="input"
                    value={settingsForm.wholesaleDefaultMoq}
                    onChange={(e) => setSettingsForm({ ...settingsForm, wholesaleDefaultMoq: Number(e.target.value) })}
                    min={1}
                    required
                  />
                  <span className="muted" style={{ fontSize: 12 }}>Default quantity required per product line for wholesale orders.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Official Bank Transfer Account (for B2B Orders)</h3>
            <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
              These details are displayed to B2B buyers at checkout when selecting &quot;Bank Transfer / Direct Deposit&quot;.
            </p>

            <div className="grid grid-2" style={{ gap: 14 }}>
              <div>
                <label className="label">Bank Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. City Bank PLC, BRAC Bank"
                  value={settingsForm.wholesaleBankDetails?.bankName ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        bankName: e.target.value,
                        branchName: settingsForm.wholesaleBankDetails?.branchName ?? "",
                        accountName: settingsForm.wholesaleBankDetails?.accountName ?? "",
                        accountNumber: settingsForm.wholesaleBankDetails?.accountNumber ?? "",
                      },
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Branch Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Gulshan Branch"
                  value={settingsForm.wholesaleBankDetails?.branchName ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        branchName: e.target.value,
                        bankName: settingsForm.wholesaleBankDetails?.bankName ?? "",
                        accountName: settingsForm.wholesaleBankDetails?.accountName ?? "",
                        accountNumber: settingsForm.wholesaleBankDetails?.accountNumber ?? "",
                      },
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Account Holder Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. BizTrack Trade Ltd."
                  value={settingsForm.wholesaleBankDetails?.accountName ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        accountName: e.target.value,
                        bankName: settingsForm.wholesaleBankDetails?.bankName ?? "",
                        branchName: settingsForm.wholesaleBankDetails?.branchName ?? "",
                        accountNumber: settingsForm.wholesaleBankDetails?.accountNumber ?? "",
                      },
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Account Number</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1102938472001"
                  value={settingsForm.wholesaleBankDetails?.accountNumber ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        accountNumber: e.target.value,
                        bankName: settingsForm.wholesaleBankDetails?.bankName ?? "",
                        branchName: settingsForm.wholesaleBankDetails?.branchName ?? "",
                        accountName: settingsForm.wholesaleBankDetails?.accountName ?? "",
                      },
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Routing Number (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 225272635"
                  value={settingsForm.wholesaleBankDetails?.routingNumber ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        routingNumber: e.target.value,
                        bankName: settingsForm.wholesaleBankDetails?.bankName ?? "",
                        branchName: settingsForm.wholesaleBankDetails?.branchName ?? "",
                        accountName: settingsForm.wholesaleBankDetails?.accountName ?? "",
                        accountNumber: settingsForm.wholesaleBankDetails?.accountNumber ?? "",
                      },
                    })
                  }
                />
              </div>

              <div>
                <label className="label">Payment Instructions / Notes</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Please send deposit slip to 017XXXXXXXX via WhatsApp"
                  value={settingsForm.wholesaleBankDetails?.instructions ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      wholesaleBankDetails: {
                        ...settingsForm.wholesaleBankDetails,
                        instructions: e.target.value,
                        bankName: settingsForm.wholesaleBankDetails?.bankName ?? "",
                        branchName: settingsForm.wholesaleBankDetails?.branchName ?? "",
                        accountName: settingsForm.wholesaleBankDetails?.accountName ?? "",
                        accountNumber: settingsForm.wholesaleBankDetails?.accountNumber ?? "",
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? "Saving Settings..." : "Save Wholesale Settings"}
            </button>
          </div>
        </form>
      )}

      {/* APPROVE RESELLER MODAL */}
      {approvingApp && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3>Approve Wholesale Partner</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Assign a wholesale trade tier to <b>{approvingApp.companyName}</b> ({approvingApp.customer.name}).
            </p>

            <div className="stack" style={{ gap: 14, margin: "16px 0" }}>
              <div>
                <label className="label">Select Wholesale Tier</label>
                <select
                  className="input"
                  value={selectedTierId}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  required
                >
                  {initialData.tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.discountPercent}% flat discount · Min {taka(t.minOrderAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Credit Limit (৳, Optional)</label>
                <input
                  type="number"
                  className="input"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  min={0}
                />
                <span className="muted" style={{ fontSize: 12 }}>Allowed credit balance for trusted boutique partners.</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setApprovingApp(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleApprove} disabled={isPending}>
                {isPending ? "Approving…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT RESELLER MODAL */}
      {rejectingApp && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3>Decline Application</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Specify the reason for declining <b>{rejectingApp.companyName}</b>.
            </p>

            <div style={{ margin: "16px 0" }}>
              <label className="label">Decline Reason</label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Incomplete trade license or minimum shop verification requirement not met."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectingApp(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#dc2626" }} onClick={handleReject} disabled={isPending}>
                {isPending ? "Declining…" : "Decline Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TIER MODAL */}
      {isTierModalOpen && editingTier && (
        <div className="modal-backdrop">
          <form onSubmit={handleSaveTier} className="modal-card" style={{ maxWidth: 480 }}>
            <h3>{editingTier.id ? "Edit Wholesale Tier" : "Create Wholesale Tier"}</h3>

            <div className="stack" style={{ gap: 14, margin: "16px 0" }}>
              <div>
                <label className="label">Tier Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Standard Reseller, Gold Boutique, Super Distributor"
                  value={editingTier.name}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="label">Default Discount (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingTier.discountPercent}
                    onChange={(e) => setEditingTier({ ...editingTier, discountPercent: Number(e.target.value) })}
                    min={0}
                    max={95}
                    required
                  />
                </div>
                <div>
                  <label className="label">Minimum Order (৳)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingTier.minOrderAmount}
                    onChange={(e) => setEditingTier({ ...editingTier, minOrderAmount: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="label">Partial Advance Deposit (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingTier.partialDepositPercent ?? ""}
                    onChange={(e) =>
                      setEditingTier({
                        ...editingTier,
                        partialDepositPercent: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    min={0}
                    max={100}
                    placeholder="e.g. 25"
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editingTier.allowCod}
                      onChange={(e) => setEditingTier({ ...editingTier, allowCod: e.target.checked })}
                    />
                    <span style={{ fontSize: 13.5 }}>Allow Courier COD</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsTierModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save Tier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE / EDIT PRICE OVERRIDE MODAL */}
      {isPriceModalOpen && editingPrice && (
        <div className="modal-backdrop">
          <form onSubmit={handleSavePrice} className="modal-card" style={{ maxWidth: 480 }}>
            <h3>Add Volume Quantity Break</h3>

            <div className="stack" style={{ gap: 14, margin: "16px 0" }}>
              <div>
                <label className="label">Product Variant ID</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter Variant ID"
                  value={editingPrice.variantId}
                  onChange={(e) => setEditingPrice({ ...editingPrice, variantId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Target Tier (Optional)</label>
                <select
                  className="input"
                  value={editingPrice.tierId ?? ""}
                  onChange={(e) =>
                    setEditingPrice({
                      ...editingPrice,
                      tierId: e.target.value ? e.target.value : null,
                    })
                  }
                >
                  <option value="">Public Volume Break (All Retail Shoppers)</option>
                  {initialData.tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.discountPercent}% default)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="label">Minimum Quantity (pcs)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingPrice.minQuantity}
                    onChange={(e) => setEditingPrice({ ...editingPrice, minQuantity: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="label">Bulk Unit Price (৳)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingPrice.price || ""}
                    onChange={(e) => setEditingPrice({ ...editingPrice, price: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsPriceModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save Volume Break"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
