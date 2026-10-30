"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@biztrackbd/ui";
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
    <div>
      <PageHeader
        title="Affiliate & Influencer Hub"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Affiliates" }]}
        badge={<span className="pill ok">Live Telemetry</span>}
        sub="Manage affiliate partners, referral links, coupon attribution, and bKash/Nagad commission payouts."
        actions={
          canEdit ? (
            <button
              onClick={() => {
                setFormState({ ok: true });
                setIsAddModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Add Partner
            </button>
          ) : undefined
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-4 mb-lg">
        <div className="stat">
          <div className="k">Active Affiliates</div>
          <div className="v num">{activePartnersCount} <span className="text-xs text-ink-3">/ {partners.length} total</span></div>
          <div className="muted text-xs mt-xs">
            {referrals.length} orders tracked
          </div>
        </div>

        <div className="stat">
          <div className="k">Attributed GMV</div>
          <div className="v num">৳{totalAttributedGMV.toLocaleString()}</div>
          <div className="muted text-xs mt-xs">
            Direct referral revenue
          </div>
        </div>

        <div className="stat">
          <div className="k">Delivered Commissions</div>
          <div className="v num text-success">৳{totalEarnedCommissions.toLocaleString()}</div>
          <div className="muted text-xs mt-xs">
            Earned upon delivery clearance
          </div>
        </div>

        <div className="stat">
          <div className="k">Unpaid Payable Balance</div>
          <div className={`v num ${unpaidPayable > 0 ? "text-warning" : "text-ink-3"}`}>
            ৳{unpaidPayable.toLocaleString()}
          </div>
          <div className="muted text-xs mt-xs">
            {pendingPayouts.length > 0 ? `${pendingPayouts.length} payout requests waiting (৳${pendingPayoutsAmount.toLocaleString()})` : "All payouts clear"}
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {formState.message && (
        <div className="notice good mb-md">
          ✓ {formState.message}
        </div>
      )}
      {formState.error && (
        <div className="notice bad mb-md">
          {formState.error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-strip mb-md">
        <button
          onClick={() => setActiveTab("partners")}
          className={`tab-item ${activeTab === "partners" ? "active" : ""}`}
        >
          <span>Partners</span>
          <span className="tab-badge">
            {partners.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`tab-item ${activeTab === "payouts" ? "active" : ""}`}
        >
          <span>Payout Requests</span>
          {pendingPayouts.length > 0 && (
            <span className="tab-badge bg-warning-subtle text-warning font-bold">
              {pendingPayouts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("referrals")}
          className={`tab-item ${activeTab === "referrals" ? "active" : ""}`}
        >
          <span>Referral Audit Ledger</span>
          <span className="tab-badge">
            {referrals.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Partners */}
      {activeTab === "partners" && (
        <div>
          <div className="flex-between items-center mb-md gap-md">
            <div className="search-box-wrap">
              <span className="search-box-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search partner by name, code, phone, or coupon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-box-input"
              />
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="table-wrap">
              <table className="table m-0">
                <thead>
                  <tr>
                    <th>Partner Name &amp; Contact</th>
                    <th>Referral Link</th>
                    <th>Coupon Code</th>
                    <th>Commission</th>
                    <th>Total Earned</th>
                    <th>Payable Balance</th>
                    <th>Status</th>
                    <th className="r">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-xl text-center muted">
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
                            <div className="font-semibold text-ink">{p.name}</div>
                            <div className="text-xs text-ink-3">
                              {p.phone} {p.email && `• ${p.email}`}
                            </div>
                          </td>
                          <td>
                            <div className="row items-center gap-xs">
                              <code className="text-xs bg-subtle p-xs rounded-sm">
                                /ref/{p.code}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(refUrl, `ref-${p.id}`)}
                                className="btn btn-secondary btn-sm"
                                title="Copy full referral link"
                              >
                                {copiedId === `ref-${p.id}` ? "✓" : "Copy"}
                              </button>
                            </div>
                          </td>
                          <td>
                            {p.couponCode ? (
                              <span className="pill warn text-xs font-bold">
                                {p.couponCode}
                              </span>
                            ) : (
                              <span className="muted text-xs">—</span>
                            )}
                          </td>
                          <td className="font-semibold">
                            {p.commissionType === "PERCENTAGE" ? `${p.commissionValue}%` : `৳${p.commissionValue}`}
                          </td>
                          <td className="font-semibold text-ink">
                            ৳{p.totalEarned.toLocaleString()}
                          </td>
                          <td className={`font-bold ${p.payableBalance > 0 ? "text-success" : "text-ink-3"}`}>
                            ৳{p.payableBalance.toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`pill ${p.status === "ACTIVE" ? "ok" : p.status === "PAUSED" ? "warn" : "grey"}`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="r">
                            <div className="row gap-xs justify-end">
                              <button
                                onClick={() => copyToClipboard(portalUrl, `portal-${p.id}`)}
                                className="btn btn-secondary btn-sm"
                                title="Copy Magic Partner Portal Link to share with the influencer"
                              >
                                {copiedId === `portal-${p.id}` ? "✓ Copied" : "Portal Link"}
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
        </div>
      )}

      {/* Tab 2: Payout Requests Queue */}
      {activeTab === "payouts" && (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrap">
            <table className="table m-0">
              <thead>
                <tr>
                  <th>Requested Date</th>
                  <th>Partner Name</th>
                  <th>Amount</th>
                  <th>Disbursement Method</th>
                  <th>Wallet / Account</th>
                  <th>Status</th>
                  <th>TrxID / Reference</th>
                  <th className="r">Action</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-xl text-center muted">
                      No payout requests received yet.
                    </td>
                  </tr>
                ) : (
                  payouts.map((py) => (
                    <tr key={py.id}>
                      <td className="text-xs text-ink-3">
                        {new Date(py.requestedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="font-semibold">{py.affiliateName ?? "Affiliate"}</td>
                      <td className="font-bold text-ink">৳{py.amount.toLocaleString()}</td>
                      <td>
                        <span className={`pill ${py.method === "BKASH" ? "warn" : py.method === "NAGAD" ? "info" : "grey"}`}>
                          {py.method}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{py.accountNumber}</td>
                      <td>
                        <span
                          className={`pill ${py.status === "PAID" ? "ok" : py.status === "REQUESTED" ? "warn" : "bad"}`}
                        >
                          {py.status === "PAID" ? "Disbursed" : py.status === "REQUESTED" ? "Pending" : "Rejected"}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {py.trxId ?? <span className="muted">—</span>}
                      </td>
                      <td className="r">
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
                          <span className="muted text-xs">Completed</span>
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
        <div className="card p-0 overflow-hidden">
          <div className="table-wrap">
            <table className="table m-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Customer (Masked)</th>
                  <th>Attribution Channel</th>
                  <th>Order Subtotal</th>
                  <th>Commission</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-xl text-center muted">
                      No referral orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  referrals.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs text-ink-3">
                        {new Date(r.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="font-semibold">{r.affiliateName ?? r.affiliateId}</td>
                      <td className="font-mono text-sm">{r.customerPhone}</td>
                      <td>
                        <span
                          className={`pill ${r.attributedVia === "COUPON" ? "warn" : "info"}`}
                        >
                          {r.attributedVia === "COUPON" ? "Promo Code" : "Referral Link"}
                        </span>
                      </td>
                      <td className="font-semibold">৳{r.orderSubtotal.toLocaleString()}</td>
                      <td className="font-bold text-success">+৳{r.commissionAmount.toLocaleString()}</td>
                      <td className="r">
                        <span
                          className={`pill ${
                            r.status === "APPROVED"
                              ? "ok"
                              : r.status === "PENDING"
                              ? "warn"
                              : r.status === "PAID"
                              ? "info"
                              : "bad"
                          }`}
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
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <h2 className="text-base font-bold m-0">Add Affiliate Partner</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="stack gap-md">
              <div>
                <label className="label">Partner Full Name *</label>
                <input type="text" name="name" className="input" required placeholder="e.g. Tanvir Ahmed / TechReviewBD" />
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Mobile Number (BD) *</label>
                  <input type="text" name="phone" className="input" required placeholder="01712345678" />
                </div>
                <div>
                  <label className="label">Email (Optional)</label>
                  <input type="email" name="email" className="input" placeholder="partner@gmail.com" />
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Referral Slug *</label>
                  <input type="text" name="code" className="input font-mono" required placeholder="e.g. tanvir" />
                  <span className="hint">Generates /ref/[slug]</span>
                </div>
                <div>
                  <label className="label">Influencer Promo Code</label>
                  <input type="text" name="couponCode" className="input font-mono uppercase" placeholder="e.g. TANVIR10" />
                  <span className="hint">Direct coupon attribution</span>
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Commission Type</label>
                  <select name="commissionType" defaultValue="PERCENTAGE" className="input">
                    <option value="PERCENTAGE">Percentage (% of subtotal)</option>
                    <option value="FLAT">Flat Fee (৳ per order)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Commission Value</label>
                  <input type="number" name="commissionValue" defaultValue={10} min="1" step="0.5" className="input" />
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Payout Method</label>
                  <select name="payoutMethod" defaultValue="BKASH" className="input">
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="ROCKET">Rocket</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Account / Wallet</label>
                  <input type="text" name="payoutAccount" placeholder="017XXXXXXXX" className="input font-mono" />
                </div>
              </div>

              <div className="row justify-end gap-sm mt-sm">
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
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPartner(null);
          }}
        >
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <h2 className="text-base font-bold m-0">Edit Affiliate Partner</h2>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="stack gap-md">
              <div>
                <label className="label">Partner Full Name</label>
                <input type="text" name="name" defaultValue={editingPartner.name} className="input" />
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Mobile Number</label>
                  <input type="text" name="phone" defaultValue={editingPartner.phone} className="input" />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select name="status" defaultValue={editingPartner.status} className="input">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Influencer Promo Code</label>
                  <input type="text" name="couponCode" defaultValue={editingPartner.couponCode ?? ""} className="input font-mono uppercase" />
                </div>
                <div>
                  <label className="label">Commission Value</label>
                  <input type="number" name="commissionValue" defaultValue={editingPartner.commissionValue} min="1" step="0.5" className="input" />
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Payout Method</label>
                  <select name="payoutMethod" defaultValue={editingPartner.payoutMethod} className="input">
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="ROCKET">Rocket</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Account / Wallet</label>
                  <input type="text" name="payoutAccount" defaultValue={editingPartner.payoutAccount ?? ""} className="input font-mono" />
                </div>
              </div>

              <div className="row justify-end gap-sm mt-sm">
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
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProcessingPayout(null);
          }}
        >
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <h2 className="text-base font-bold m-0">Disburse Commission Payout</h2>
              <button
                type="button"
                onClick={() => setProcessingPayout(null)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-subtle p-md rounded-md mb-md">
              <div className="flex-between mb-xs">
                <span className="text-sm text-ink-3">Partner:</span>
                <span className="text-sm font-bold text-ink">{processingPayout.affiliateName}</span>
              </div>
              <div className="flex-between mb-xs">
                <span className="text-sm text-ink-3">Amount to Pay:</span>
                <span className="text-lg font-bold text-success">৳{processingPayout.amount.toLocaleString()}</span>
              </div>
              <div className="flex-between">
                <span className="text-sm text-ink-3">Method &amp; Account:</span>
                <span className="text-sm font-semibold font-mono">
                  {processingPayout.method} — {processingPayout.accountNumber}
                </span>
              </div>
              {processingPayout.bankDetails && (
                <div className="mt-xs pt-xs border-top-dashed text-xs text-ink-2">
                  {processingPayout.bankDetails}
                </div>
              )}
            </div>

            <div className="mb-md">
              <label className="label">
                MFS Transaction ID (TrxID) / Reference *
              </label>
              <input
                type="text"
                value={payoutTrxId}
                onChange={(e) => setPayoutTrxId(e.target.value)}
                placeholder="e.g. BL9A7XYZ"
                className="input font-mono"
              />
              <span className="hint">Required when marking as Paid. Partner will see this TrxID in their portal.</span>
            </div>

            <div className="mb-md">
              <label className="label">Notes (Optional)</label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Reason or reference notes"
                className="input"
              />
            </div>

            <div className="flex-between gap-sm">
              <button
                type="button"
                onClick={() => handleProcessPayout("REJECTED")}
                disabled={isPending}
                className="btn btn-danger btn-sm"
              >
                Reject &amp; Refund
              </button>
              <div className="row gap-xs">
                <button type="button" onClick={() => setProcessingPayout(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessPayout("PAID")}
                  disabled={isPending || !payoutTrxId.trim()}
                  className="btn btn-primary btn-sm"
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
