"use client";

import { useState, useTransition } from "react";
import {
  createAffiliatePartnerAction,
  updateAffiliatePartnerAction,
  processAffiliatePayoutAction,
  type AffiliateActionState,
} from "./actions";
import type { AffiliatePartnerDto, AffiliatePayoutDto, AffiliateReferralDto } from "@biztrackbd/core";

interface AffiliatesClientProps {
  partners: AffiliatePartnerDto[];
  payouts: AffiliatePayoutDto[];
  referrals: AffiliateReferralDto[];
  storeOrigin: string;
  canEdit: boolean;
}

export function AffiliatesClient({
  partners,
  payouts,
  referrals,
  storeOrigin,
  canEdit,
}: AffiliatesClientProps) {
  const [activeTab, setActiveTab] = useState<"partners" | "payouts" | "referrals">("partners");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<AffiliatePartnerDto | null>(null);
  const [processingPayout, setProcessingPayout] = useState<AffiliatePayoutDto | null>(null);
  const [payoutTrxId, setPayoutTrxId] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  const [formState, setFormState] = useState<AffiliateActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();

  // Summary Metrics
  const activePartnersCount = partners.filter((p) => p.status === "ACTIVE").length;
  const totalAttributedGMV = referrals.reduce((sum, r) => sum + r.orderSubtotal, 0);
  const totalEarnedCommissions = partners.reduce((sum, p) => sum + p.totalEarned, 0);
  const unpaidPayable = partners.reduce((sum, p) => sum + p.payableBalance, 0);
  const pendingPayouts = payouts.filter((py) => py.status === "REQUESTED");
  const pendingPayoutsAmount = pendingPayouts.reduce((sum, py) => sum + py.amount, 0);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAffiliatePartnerAction(formState, formData);
      setFormState(res);
      if (res.ok) {
        setIsAddModalOpen(false);
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPartner) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateAffiliatePartnerAction(editingPartner.id, formState, formData);
      setFormState(res);
      if (res.ok) {
        setEditingPartner(null);
      }
    });
  };

  const handleProcessPayout = (status: "PAID" | "REJECTED") => {
    if (!processingPayout) return;
    startTransition(async () => {
      const res = await processAffiliatePayoutAction(processingPayout.id, status, payoutTrxId, payoutNotes);
      setFormState(res);
      if (res.ok) {
        setProcessingPayout(null);
        setPayoutTrxId("");
        setPayoutNotes("");
      }
    });
  };

  const filteredPartners = partners.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.couponCode && p.couponCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.phone.includes(searchTerm)
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Affiliate & Influencer Hub</h1>
            <span className="pill green">Live Telemetry</span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Manage affiliate partners, referral links, coupon attribution, and bKash/Nagad commission payouts.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canEdit && (
            <button
              onClick={() => {
                setFormState({ ok: true });
                setIsAddModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Add Partner
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className="k">Active Affiliates</div>
          <div className="v num">{activePartnersCount} <span style={{ fontSize: 13, color: "#64748B" }}>/ {partners.length} total</span></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {referrals.length} orders tracked
          </div>
        </div>

        <div className="stat">
          <div className="k">Attributed GMV</div>
          <div className="v num">৳{totalAttributedGMV.toLocaleString()}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Direct referral revenue
          </div>
        </div>

        <div className="stat">
          <div className="k">Delivered Commissions</div>
          <div className="v num" style={{ color: "#059669" }}>৳{totalEarnedCommissions.toLocaleString()}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Earned upon delivery clearance
          </div>
        </div>

        <div className="stat">
          <div className="k">Unpaid Payable Balance</div>
          <div className="v num" style={{ color: unpaidPayable > 0 ? "#D97706" : "#475569" }}>
            ৳{unpaidPayable.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {pendingPayouts.length > 0 ? `${pendingPayouts.length} payout requests waiting (৳${pendingPayoutsAmount.toLocaleString()})` : "All payouts clear"}
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {formState.message && (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "12px 16px", borderRadius: 8, color: "#065F46", fontSize: 13.5, marginBottom: 20 }}>
          ✓ {formState.message}
        </div>
      )}
      {formState.error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", padding: "12px 16px", borderRadius: 8, color: "#991B1B", fontSize: 13.5, marginBottom: 20 }}>
          ⚠ {formState.error}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", marginBottom: 20, gap: 24 }}>
        <button
          onClick={() => setActiveTab("partners")}
          style={{
            padding: "8px 0 12px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "partners" ? "2px solid #4F46E5" : "2px solid transparent",
            color: activeTab === "partners" ? "#4F46E5" : "#64748B",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Partners</span>
          <span style={{ background: "#F1F5F9", color: "#475569", fontSize: 11, padding: "2px 6px", borderRadius: 10 }}>
            {partners.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          style={{
            padding: "8px 0 12px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "payouts" ? "2px solid #4F46E5" : "2px solid transparent",
            color: activeTab === "payouts" ? "#4F46E5" : "#64748B",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Payout Requests</span>
          {pendingPayouts.length > 0 && (
            <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>
              {pendingPayouts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("referrals")}
          style={{
            padding: "8px 0 12px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "referrals" ? "2px solid #4F46E5" : "2px solid transparent",
            color: activeTab === "referrals" ? "#4F46E5" : "#64748B",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Referral Audit Ledger</span>
          <span style={{ background: "#F1F5F9", color: "#475569", fontSize: 11, padding: "2px 6px", borderRadius: 10 }}>
            {referrals.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Partners */}
      {activeTab === "partners" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
            <input
              type="text"
              placeholder="Search partner by name, code, phone, or coupon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, width: 340 }}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" style={{ margin: 0, width: "100%" }}>
              <thead>
                <tr>
                  <th>Partner Name &amp; Contact</th>
                  <th>Referral Link</th>
                  <th>Coupon Code</th>
                  <th>Commission</th>
                  <th>Total Earned</th>
                  <th>Payable Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                      No affiliate partners found. Click &apos;+ Add Partner&apos; to onboard your first influencer!
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((p) => {
                    const refUrl = `${storeOrigin}/ref/${p.code}`;
                    const portalUrl = `${storeOrigin}/partner/${p.portalToken}`;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>
                            {p.phone} {p.email && `• ${p.email}`}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <code style={{ fontSize: 11, background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>
                              /ref/{p.code}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(refUrl, `ref-${p.id}`)}
                              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#4F46E5" }}
                              title="Copy full referral link"
                            >
                              {copiedId === `ref-${p.id}` ? "✓" : "Copy"}
                            </button>
                          </div>
                        </td>
                        <td>
                          {p.couponCode ? (
                            <span style={{ fontWeight: 700, color: "#B45309", background: "#FEF3C7", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
                              {p.couponCode}
                            </span>
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {p.commissionType === "PERCENTAGE" ? `${p.commissionValue}%` : `৳${p.commissionValue}`}
                        </td>
                        <td style={{ fontWeight: 600, color: "#0F172A" }}>
                          ৳{p.totalEarned.toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 700, color: p.payableBalance > 0 ? "#059669" : "#64748B" }}>
                          ৳{p.payableBalance.toLocaleString()}
                        </td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              fontSize: 11,
                              background: p.status === "ACTIVE" ? "#ECFDF5" : p.status === "PAUSED" ? "#FEF3C7" : "#F1F5F9",
                              color: p.status === "ACTIVE" ? "#065F46" : p.status === "PAUSED" ? "#92400E" : "#475569",
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              onClick={() => copyToClipboard(portalUrl, `portal-${p.id}`)}
                              className="btn btn-secondary btn-sm"
                              title="Copy Magic Partner Portal Link to share with the influencer"
                            >
                              {copiedId === `portal-${p.id}` ? "✓ Link Copied" : "Portal Link"}
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setFormState({ ok: true });
                                  setEditingPartner(p);
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payout Requests Queue */}
      {activeTab === "payouts" && (
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" style={{ margin: 0, width: "100%" }}>
              <thead>
                <tr>
                  <th>Requested Date</th>
                  <th>Partner Name</th>
                  <th>Amount</th>
                  <th>Disbursement Method</th>
                  <th>Wallet / Account</th>
                  <th>Status</th>
                  <th>TrxID / Reference</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                      No payout requests received yet.
                    </td>
                  </tr>
                ) : (
                  payouts.map((py) => (
                    <tr key={py.id}>
                      <td style={{ fontSize: 12.5, color: "#64748B" }}>
                        {new Date(py.requestedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{py.affiliateName ?? "Affiliate"}</td>
                      <td style={{ fontWeight: 700, color: "#0F172A" }}>৳{py.amount.toLocaleString()}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: py.method === "BKASH" ? "#FDF2F8" : py.method === "NAGAD" ? "#FFF7ED" : "#F1F5F9",
                            color: py.method === "BKASH" ? "#BE185D" : py.method === "NAGAD" ? "#C2410C" : "#334155",
                          }}
                        >
                          {py.method}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 13 }}>{py.accountNumber}</td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            fontSize: 11,
                            background: py.status === "PAID" ? "#ECFDF5" : py.status === "REQUESTED" ? "#FEF3C7" : "#FEF2F2",
                            color: py.status === "PAID" ? "#065F46" : py.status === "REQUESTED" ? "#92400E" : "#991B1B",
                          }}
                        >
                          {py.status === "PAID" ? "Disbursed" : py.status === "REQUESTED" ? "Pending" : "Rejected"}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {py.trxId ?? <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {py.status === "REQUESTED" && canEdit ? (
                          <button
                            onClick={() => {
                              setProcessingPayout(py);
                              setPayoutTrxId("");
                              setPayoutNotes("");
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            Process Payout
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>Completed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Referral Audit Ledger */}
      {activeTab === "referrals" && (
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" style={{ margin: 0, width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Customer (Masked)</th>
                  <th>Attribution Channel</th>
                  <th>Order Subtotal</th>
                  <th>Commission</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                      No referral orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  referrals.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12.5, color: "#64748B" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.affiliateName ?? r.affiliateId}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 13 }}>{r.customerPhone}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: r.attributedVia === "COUPON" ? "#FEF3C7" : "#E0F2FE",
                            color: r.attributedVia === "COUPON" ? "#92400E" : "#0369A1",
                          }}
                        >
                          {r.attributedVia === "COUPON" ? "Promo Code" : "Referral Link"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>৳{r.orderSubtotal.toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: "#059669" }}>+৳{r.commissionAmount.toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="pill"
                          style={{
                            fontSize: 11,
                            background:
                              r.status === "APPROVED"
                                ? "#ECFDF5"
                                : r.status === "PENDING"
                                ? "#FEF3C7"
                                : r.status === "PAID"
                                ? "#EEF2FF"
                                : "#FEF2F2",
                            color:
                              r.status === "APPROVED"
                                ? "#065F46"
                                : r.status === "PENDING"
                                ? "#92400E"
                                : r.status === "PAID"
                                ? "#4338CA"
                                : "#991B1B",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Partner Modal */}
      {isAddModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 520, width: "100%", background: "#fff", padding: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Add Affiliate Partner</h2>
            <form onSubmit={handleAddSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Partner Full Name *</label>
                  <input type="text" name="name" required placeholder="e.g. Tanvir Ahmed / TechReviewBD" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Mobile Number (BD) *</label>
                    <input type="text" name="phone" required placeholder="01712345678" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Email (Optional)</label>
                    <input type="email" name="email" placeholder="partner@gmail.com" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Referral Slug *</label>
                    <input type="text" name="code" required placeholder="e.g. tanvir" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: "#64748B" }}>Generates /ref/[slug]</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Influencer Promo Code</label>
                    <input type="text" name="couponCode" placeholder="e.g. TANVIR10" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: "#64748B" }}>Direct coupon attribution</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Commission Type</label>
                    <select name="commissionType" defaultValue="PERCENTAGE" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}>
                      <option value="PERCENTAGE">Percentage (% of subtotal)</option>
                      <option value="FLAT">Flat Fee (৳ per order)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Commission Value</label>
                    <input type="number" name="commissionValue" defaultValue={10} min="1" step="0.5" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Payout Method</label>
                    <select name="payoutMethod" defaultValue="BKASH" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}>
                      <option value="BKASH">bKash</option>
                      <option value="NAGAD">Nagad</option>
                      <option value="ROCKET">Rocket</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Account / Wallet</label>
                    <input type="text" name="payoutAccount" placeholder="017XXXXXXXX" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? "Saving..." : "Create Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Partner Modal */}
      {editingPartner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 520, width: "100%", background: "#fff", padding: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Edit Affiliate Partner</h2>
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Partner Full Name</label>
                  <input type="text" name="name" defaultValue={editingPartner.name} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Mobile Number</label>
                    <input type="text" name="phone" defaultValue={editingPartner.phone} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Status</label>
                    <select name="status" defaultValue={editingPartner.status} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Influencer Promo Code</label>
                    <input type="text" name="couponCode" defaultValue={editingPartner.couponCode ?? ""} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Commission Value</label>
                    <input type="number" name="commissionValue" defaultValue={editingPartner.commissionValue} min="1" step="0.5" style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Payout Method</label>
                    <select name="payoutMethod" defaultValue={editingPartner.payoutMethod} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}>
                      <option value="BKASH">bKash</option>
                      <option value="NAGAD">Nagad</option>
                      <option value="ROCKET">Rocket</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Account / Wallet</label>
                    <input type="text" name="payoutAccount" defaultValue={editingPartner.payoutAccount ?? ""} style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setEditingPartner(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? "Updating..." : "Update Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Payout Modal */}
      {processingPayout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", background: "#fff", padding: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Disburse Commission Payout</h2>

            <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>Partner:</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{processingPayout.affiliateName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>Amount to Pay:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>৳{processingPayout.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>Method &amp; Account:</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>
                  {processingPayout.method} — {processingPayout.accountNumber}
                </span>
              </div>
              {processingPayout.bankDetails && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #CBD5E1", fontSize: 12, color: "#475569" }}>
                  {processingPayout.bankDetails}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                MFS Transaction ID (TrxID) / Reference *
              </label>
              <input
                type="text"
                value={payoutTrxId}
                onChange={(e) => setPayoutTrxId(e.target.value)}
                placeholder="e.g. BL9A7XYZ"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}
              />
              <span style={{ fontSize: 11, color: "#64748B" }}>Required when marking as Paid. Partner will see this TrxID in their portal.</span>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Notes (Optional)</label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Reason or reference notes"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button
                type="button"
                onClick={() => handleProcessPayout("REJECTED")}
                disabled={isPending}
                style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Reject &amp; Refund
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setProcessingPayout(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessPayout("PAID")}
                  disabled={isPending || !payoutTrxId.trim()}
                  className="btn btn-primary"
                  style={{ background: "#059669" }}
                >
                  {isPending ? "Processing..." : "Mark as Paid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
