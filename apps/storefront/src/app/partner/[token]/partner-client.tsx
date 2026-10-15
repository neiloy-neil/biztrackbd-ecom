"use client";

import { useState, useTransition } from "react";
import { submitPartnerPayoutAction, type PayoutActionState } from "./actions";

interface PartnerClientProps {
  token: string;
  partner: {
    id: string;
    name: string;
    code: string;
    couponCode: string | null;
    commissionType: "PERCENTAGE" | "FLAT";
    commissionValue: number;
    status: string;
    payoutMethod: string;
    payoutAccount: string | null;
    totalEarned: number;
    totalPaid: number;
    payableBalance: number;
  };
  referrals: Array<{
    id: string;
    orderId: string;
    customerPhone: string;
    orderSubtotal: number;
    commissionAmount: number;
    status: string;
    attributedVia: string;
    createdAt: Date | string;
    settledAt: Date | string | null;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    method: string;
    accountNumber: string;
    status: string;
    trxId: string | null;
    requestedAt: Date | string;
    processedAt: Date | string | null;
    notes: string | null;
  }>;
  storeName: string;
  origin: string;
}

export function PartnerClient({
  token,
  partner,
  referrals,
  payouts,
  storeName,
  origin,
}: PartnerClientProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "payouts">("orders");

  // Form states
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"BKASH" | "NAGAD" | "ROCKET" | "BANK">(
    (partner.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK") || "BKASH"
  );
  const [accountNumber, setAccountNumber] = useState(partner.payoutAccount || "");
  const [bankDetails, setBankDetails] = useState("");
  const [payoutState, setPayoutState] = useState<PayoutActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();

  const refUrl = `${origin}/ref/${partner.code}`;

  const pendingCommissions = referrals
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.commissionAmount, 0);

  const approvedCount = referrals.filter((r) => r.status === "APPROVED" || r.status === "PAID").length;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(refUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyCoupon = () => {
    if (!partner.couponCode) return;
    navigator.clipboard.writeText(partner.couponCode);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2200);
  };

  const handleOpenPayout = () => {
    setAmount(partner.payableBalance > 0 ? String(partner.payableBalance) : "");
    setPayoutState({ ok: true });
    setIsModalOpen(true);
  };

  const handlePayoutSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitPartnerPayoutAction(token, payoutState, formData);
      setPayoutState(res);
      if (res.ok) {
        setTimeout(() => {
          setIsModalOpen(false);
        }, 1500);
      }
    });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Delivered &amp; Approved</span>;
      case "PENDING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Pending Delivery</span>;
      case "PAID":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Paid Out</span>;
      case "VOID":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Canceled / Returned</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const payoutStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Disbursed</span>;
      case "REQUESTED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Processing</span>;
      case "REJECTED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const methodBadge = (m: string) => {
    switch (m) {
      case "BKASH":
        return <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">bKash</span>;
      case "NAGAD":
        return <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">Nagad</span>;
      case "ROCKET":
        return <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Rocket</span>;
      default:
        return <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Bank Wire</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {partner.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">{partner.name}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {partner.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Partner at <span className="font-semibold text-slate-700">{storeName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenPayout}
            disabled={partner.payableBalance < 100}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center space-x-2 ${
              partner.payableBalance >= 100
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Request Payout</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Commission Rate Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Commission Rate</span>
              <div className="text-3xl font-black mt-0.5 tracking-tight flex items-baseline space-x-2">
                <span>
                  {partner.commissionType === "PERCENTAGE"
                    ? `${partner.commissionValue}%`
                    : `৳${partner.commissionValue.toLocaleString()}`}
                </span>
                <span className="text-sm font-normal text-indigo-200">
                  {partner.commissionType === "PERCENTAGE" ? "of order subtotal" : "flat fee per delivered order"}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1">
                Commissions auto-clear to your payable balance once courier marks the parcel as Delivered.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Copy Referral Link */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs text-indigo-200 font-medium">Your Referral Link:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={refUrl}
                    className="bg-black/20 text-xs text-white rounded px-2.5 py-1.5 w-44 font-mono truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-white text-indigo-900 hover:bg-indigo-50 text-xs font-bold px-3 py-1.5 rounded transition shadow-xs whitespace-nowrap"
                  >
                    {copiedLink ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Copy Coupon Code if available */}
              {partner.couponCode && (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-xs text-indigo-200 font-medium">Influencer Promo Code:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="bg-amber-400 text-amber-950 text-xs font-black tracking-wider px-2.5 py-1.5 rounded font-mono">
                      {partner.couponCode}
                    </span>
                    <button
                      onClick={handleCopyCoupon}
                      className="bg-white text-indigo-900 hover:bg-indigo-50 text-xs font-bold px-3 py-1.5 rounded transition shadow-xs whitespace-nowrap"
                    >
                      {copiedCoupon ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available for Payout</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ৳{partner.payableBalance.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Min withdrawal: ৳100</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Delivery</span>
            <div className="text-2xl font-black text-amber-600 mt-1">
              ৳{pendingCommissions.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Held in transit escrow</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid Out</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ৳{partner.totalPaid.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Successfully disbursed</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivered Orders</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {approvedCount} <span className="text-sm font-normal text-slate-500">/ {referrals.length}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {referrals.length > 0 ? `${Math.round((approvedCount / referrals.length) * 100)}% delivery rate` : "No orders yet"}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 px-6 pt-4 flex space-x-8">
            <button
              onClick={() => setActiveTab("orders")}
              className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center space-x-2 ${
                activeTab === "orders"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Attributed Orders</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                {referrals.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("payouts")}
              className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center space-x-2 ${
                activeTab === "payouts"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Payout History</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                {payouts.length}
              </span>
            </button>
          </div>

          {/* Orders Table */}
          {activeTab === "orders" && (
            <div className="overflow-x-auto">
              {referrals.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No orders attributed yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Share your referral link or promo code on Facebook, Instagram, or YouTube to start earning commissions!
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Order Subtotal</th>
                      <th className="py-3 px-4">Your Commission</th>
                      <th className="py-3 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-5 text-slate-600 font-medium">
                          {new Date(r.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          {r.customerPhone}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              r.attributedVia === "COUPON"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {r.attributedVia === "COUPON" ? "Promo Code" : "Referral Link"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          ৳{r.orderSubtotal.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">
                          +৳{r.commissionAmount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {statusBadge(r.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Payouts Table */}
          {activeTab === "payouts" && (
            <div className="overflow-x-auto">
              {payouts.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No payout requests yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Once you accumulate at least ৳100 in payable balance, click &apos;Request Payout&apos; above.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-5">Requested Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Method &amp; Account</th>
                      <th className="py-3 px-4">TrxID / Reference</th>
                      <th className="py-3 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((py) => (
                      <tr key={py.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-5 text-slate-600 font-medium">
                          {new Date(py.requestedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ৳{py.amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            {methodBadge(py.method)}
                            <span className="font-mono text-slate-700 font-medium">{py.accountNumber}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                          {py.trxId ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
                              {py.trxId}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Processing</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {payoutStatusBadge(py.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Payout Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900">Request Commission Payout</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="p-6 space-y-4">
              {payoutState.error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium">
                  {payoutState.error}
                </div>
              )}
              {payoutState.message && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 font-medium">
                  {payoutState.message}
                </div>
              )}

              {/* Amount input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Withdraw Amount (BDT)</label>
                  <span className="text-xs text-slate-500">
                    Payable: <strong className="text-emerald-600">৳{partner.payableBalance.toLocaleString()}</strong>
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">৳</span>
                  <input
                    type="number"
                    name="amount"
                    min="100"
                    max={partner.payableBalance}
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Min 100"
                    className="w-full pl-8 pr-20 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(partner.payableBalance))}
                    className="absolute right-2 top-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700 transition"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Disbursement Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["BKASH", "NAGAD", "ROCKET", "BANK"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition ${
                        method === m
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {m === "BKASH" ? "bKash" : m === "NAGAD" ? "Nagad" : m === "ROCKET" ? "Rocket" : "Bank"}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="method" value={method} />
              </div>

              {/* Account Number */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {method === "BANK" ? "Bank Account Number" : `${method} Wallet Number`}
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={method === "BANK" ? "e.g. 151.110.12345" : "e.g. 017XXXXXXXX"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Bank Details if Bank */}
              {method === "BANK" && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Bank &amp; Branch Details
                  </label>
                  <textarea
                    name="bankDetails"
                    rows={2}
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="Bank Name, Branch Name, Account Holder Name, Routing No"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || partner.payableBalance < 100}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Confirm Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
