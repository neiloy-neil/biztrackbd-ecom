"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createDropAction,
  updateDropAction,
  deleteDropAction,
  markStockReceivedAction,
  notifySubscribersAction,
  getDropSubscribersAction,
} from "./actions";

interface ProductOption {
  id: string;
  title: string;
  price: string | number;
  stockQuantity?: number;
}

interface DropProductItem {
  id: string;
  productId: string;
  variantId?: string | null;
  allocatedQty?: number | null;
  product?: {
    id: string;
    title: string;
    images?: { url: string }[];
  };
}

interface DropRow {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  mode: "TEASER_WAITLIST" | "LIVE_PREORDER";
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  computedStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  startsAt: string | Date;
  endsAt?: string | Date | null;
  estimatedShipDate?: string | Date | null;
  depositType: "NONE" | "FIXED" | "PERCENTAGE" | "FULL";
  depositValueNumber: number;
  allocationCap?: number | null;
  claimedUnits: number;
  subscriberCount: number;
  products: DropProductItem[];
}

interface Props {
  initialDrops: DropRow[];
  availableProducts: ProductOption[];
  storeDomain?: string;
}

export function DropsManagerClient({ initialDrops, availableProducts, storeDomain }: Props) {
  const [drops, setDrops] = useState<DropRow[]>(initialDrops);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrop, setEditingDrop] = useState<DropRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Waitlist drawer state
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [activeWaitlistDrop, setActiveWaitlistDrop] = useState<DropRow | null>(null);
  const [waitlistSubscribers, setWaitlistSubscribers] = useState<{ id: string; phone: string; name?: string | null; createdAt: string; notifiedAt?: string | null }[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"TEASER_WAITLIST" | "LIVE_PREORDER">("LIVE_PREORDER");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [estimatedShipDate, setEstimatedShipDate] = useState("");
  const [depositType, setDepositType] = useState<"NONE" | "FIXED" | "PERCENTAGE" | "FULL">("NONE");
  const [depositValue, setDepositValue] = useState<number>(0);
  const [allocationCap, setAllocationCap] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Summary counts
  const liveCount = drops.filter((d) => d.computedStatus === "LIVE").length;
  const totalSubscribers = drops.reduce((sum, d) => sum + (d.subscriberCount || 0), 0);
  const totalClaimed = drops.reduce((sum, d) => sum + (d.claimedUnits || 0), 0);

  function resetForm() {
    setEditingDrop(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setMode("LIVE_PREORDER");
    setStartsAt(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setEndsAt("");
    setEstimatedShipDate("");
    setDepositType("NONE");
    setDepositValue(0);
    setAllocationCap("");
    setSelectedProductIds([]);
    setError(null);
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(drop: DropRow) {
    setEditingDrop(drop);
    setTitle(drop.title);
    setSlug(drop.slug);
    setDescription(drop.description || "");
    setMode(drop.mode);
    setStartsAt(new Date(drop.startsAt).toISOString().slice(0, 16));
    setEndsAt(drop.endsAt ? new Date(drop.endsAt).toISOString().slice(0, 16) : "");
    setEstimatedShipDate(drop.estimatedShipDate ? new Date(drop.estimatedShipDate).toISOString().slice(0, 10) : "");
    setDepositType(drop.depositType);
    setDepositValue(drop.depositValueNumber || 0);
    setAllocationCap(drop.allocationCap ? String(drop.allocationCap) : "");
    setSelectedProductIds(drop.products.map((p) => p.productId));
    setError(null);
    setModalOpen(true);
  }

  async function handleSaveDrop(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the drop.");
      return;
    }
    if (selectedProductIds.length === 0) {
      setError("Please select at least 1 product for the drop.");
      return;
    }

    setBusy(true);
    setError(null);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      mode,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : undefined,
      estimatedShipDate: estimatedShipDate ? new Date(estimatedShipDate) : undefined,
      depositType,
      depositValue: Number(depositValue) || 0,
      allocationCap: allocationCap ? Number(allocationCap) : undefined,
      productItems: selectedProductIds.map((pId) => ({
        productId: pId,
      })),
    };

    try {
      if (editingDrop) {
        const res = await updateDropAction(editingDrop.id, payload);
        if (!res.ok) throw new Error(res.error || "Failed to update drop");
        setSuccess("Drop campaign updated successfully.");
      } else {
        const res = await createDropAction(payload);
        if (!res.ok) throw new Error(res.error || "Failed to create drop");
        setSuccess("New limited drop created successfully.");
      }
      setModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDrop(id: string) {
    if (!confirm("Are you sure you want to delete this drop campaign?")) return;
    setBusy(true);
    try {
      const res = await deleteDropAction(id);
      if (!res.ok) throw new Error(res.error);
      setDrops((prev) => prev.filter((d) => d.id !== id));
      setSuccess("Drop removed.");
    } catch (err: any) {
      alert(err.message || "Failed to delete drop.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkStockReceived(drop: DropRow) {
    if (
      !confirm(
        `Mark stock arrived for "${drop.title}"?\n\nThis will automatically release fulfillment holds on all pre-orders for this drop so they can be dispatched via Steadfast/Pathao.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await markStockReceivedAction(drop.id);
      if (!res.ok) throw new Error(res.error);
      const data: any = res.data;
      alert(`Success! Released fulfillment holds on ${data.releasedOrderCount} orders.`);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to release holds.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenWaitlist(drop: DropRow) {
    setActiveWaitlistDrop(drop);
    setWaitlistOpen(true);
    setWaitlistLoading(true);
    try {
      const res = await getDropSubscribersAction(drop.id);
      if (res.ok && Array.isArray(res.data)) {
        setWaitlistSubscribers(res.data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaitlistLoading(false);
    }
  }

  async function handleBroadcastAlert() {
    if (!activeWaitlistDrop) return;
    if (!confirm(`Send instant launch alert to all unnotified waitlist subscribers for "${activeWaitlistDrop.title}"?`)) return;

    setBusy(true);
    try {
      const res = await notifySubscribersAction(activeWaitlistDrop.id);
      if (!res.ok) throw new Error(res.error);
      const data: any = res.data;
      alert(`Dispatched launch alerts to ${data.count} waitlist subscribers.`);
      setWaitlistOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to dispatch alerts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Top Banner Notice */}
      {success && (
        <div className="notice good" style={{ marginBottom: 16 }}>
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Active Drops</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{liveCount}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{drops.length} total scheduled / ended</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Waitlist Subscribers</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#2563EB" }}>{totalSubscribers}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Interested prospective buyers</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Units Claimed</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#059669" }}>{totalClaimed}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Pre-orders placed across drops</div>
        </div>

        <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <button type="button" onClick={openCreateModal} className="btn btn-primary" style={{ width: "100%", fontWeight: 600 }}>
            + Create Limited Drop
          </button>
        </div>
      </div>

      {/* Drops Table / List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Drop Campaigns ({drops.length})</h2>
          <span className="muted" style={{ fontSize: 13 }}>Timed countdowns, pre-orders & deposit safeguards</span>
        </div>

        {drops.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-2)" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No limited drops created yet.</div>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 440, margin: "6px auto 16px" }}>
              Launch limited-edition products with teaser countdown clocks, buyer waitlists, and advance deposit pre-orders.
            </p>
            <button type="button" onClick={openCreateModal} className="btn btn-primary btn-sm">
              Create Your First Drop
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th>Drop Title & Link</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>Deposit Terms</th>
                  <th>Allocation & Claimed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drops.map((drop) => {
                  const isLive = drop.computedStatus === "LIVE";
                  const isScheduled = drop.computedStatus === "SCHEDULED";
                  const isEnded = drop.computedStatus === "ENDED";

                  let depositLabel = "Standard COD (0%)";
                  if (drop.depositType === "FULL") depositLabel = "100% Prepayment";
                  else if (drop.depositType === "FIXED") depositLabel = `৳${drop.depositValueNumber} Advance`;
                  else if (drop.depositType === "PERCENTAGE") depositLabel = `${drop.depositValueNumber}% Advance`;

                  const capPct = drop.allocationCap ? Math.min(100, Math.round((drop.claimedUnits / drop.allocationCap) * 100)) : null;

                  return (
                    <tr key={drop.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{drop.title}</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          <span className="muted">Slug: </span>
                          <a
                            href={`/drops/${drop.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link"
                            style={{ fontSize: 12 }}
                          >
                            /drops/{drop.slug} ↗
                          </a>
                        </div>
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {drop.products.length} {drop.products.length === 1 ? "Product" : "Products"} attached
                        </div>
                      </td>

                      <td>
                        <span
                          className="pill"
                          style={{
                            background: drop.mode === "LIVE_PREORDER" ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)",
                            color: drop.mode === "LIVE_PREORDER" ? "#059669" : "#2563EB",
                            fontSize: 11.5,
                          }}
                        >
                          {drop.mode === "LIVE_PREORDER" ? "Live Pre-Order" : "Teaser Waitlist"}
                        </span>
                      </td>

                      <td>
                        <span
                          className="pill"
                          style={{
                            background: isLive
                              ? "rgba(16, 185, 129, 0.15)"
                              : isScheduled
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(156, 163, 175, 0.15)",
                            color: isLive ? "#047857" : isScheduled ? "#B45309" : "#4B5563",
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          {isLive ? "LIVE NOW" : isScheduled ? "SCHEDULED" : isEnded ? "ENDED" : drop.status}
                        </span>
                      </td>

                      <td style={{ fontSize: 12.5 }}>
                        <div><b>Starts:</b> {new Date(drop.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                        {drop.endsAt && (
                          <div className="muted" style={{ marginTop: 2 }}>
                            <b>Ends:</b> {new Date(drop.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        )}
                        {drop.estimatedShipDate && (
                          <div style={{ color: "#059669", marginTop: 2 }}>
                            <b>Dispatches:</b> ~{new Date(drop.estimatedShipDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="pill grey" style={{ fontSize: 12, fontWeight: 600 }}>
                          {depositLabel}
                        </span>
                      </td>

                      <td style={{ minWidth: 150 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>Claimed: <b>{drop.claimedUnits}</b></span>
                          {drop.allocationCap && <span>Cap: {drop.allocationCap}</span>}
                        </div>
                        {capPct !== null && (
                          <div className="meter" style={{ height: 6, background: "var(--line)" }}>
                            <i style={{ width: `${capPct}%`, background: capPct >= 90 ? "#DC2626" : "#059669" }} />
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenWaitlist(drop)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12 }}
                            title="View waitlist subscribers"
                          >
                            Waitlist ({drop.subscriberCount})
                          </button>

                          {isLive && (
                            <button
                              type="button"
                              onClick={() => handleMarkStockReceived(drop)}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 12, background: "#059669", borderColor: "#059669" }}
                              title="Mark inventory arrived and release pre-order fulfillment holds"
                            >
                              Stock Arrived
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(drop)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12 }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDrop(drop.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, color: "var(--danger)" }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingDrop ? "Edit Drop Campaign" : "New Limited Drop / Pre-Order"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="notice bad" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSaveDrop} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Drop Title *</label>
                <input
                  type="text"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Exclusive Eid Silk Panjabi Drop"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Custom URL Slug (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. eid-silk-drop"
                  />
                </div>

                <div>
                  <label className="label">Drop Mode</label>
                  <select
                    className="input"
                    value={mode}
                    onChange={(e: any) => setMode(e.target.value)}
                  >
                    <option value="LIVE_PREORDER">Live Pre-Order (Purchase Open)</option>
                    <option value="TEASER_WAITLIST">Teaser Waitlist (Locked Countdown)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Description / Campaign Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain fabric details, production schedule, or limited allocation terms..."
                />
              </div>

              {/* Products Selector */}
              <div>
                <label className="label">Select Products for this Drop *</label>
                <div style={{ maxHeight: 130, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6, padding: 8 }}>
                  {availableProducts.length === 0 ? (
                    <div className="muted" style={{ fontSize: 13 }}>No products available in catalog.</div>
                  ) : (
                    availableProducts.map((p) => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedProductIds((prev) => [...prev, p.id]);
                              else setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                            }}
                          />
                          <span><b>{p.title}</b> (৳{Number(p.price).toLocaleString()})</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Timing */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Drop Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label">Drop End Date (optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Estimated Dispatch Date</label>
                  <input
                    type="date"
                    className="input"
                    value={estimatedShipDate}
                    onChange={(e) => setEstimatedShipDate(e.target.value)}
                  />
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Displayed on product page and checkout</div>
                </div>

                <div>
                  <label className="label">Allocation Cap (Max Units)</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={allocationCap}
                    onChange={(e) => setAllocationCap(e.target.value)}
                    placeholder="e.g. 50 (leave blank for unlimited)"
                  />
                </div>
              </div>

              {/* Deposit Terms */}
              <div style={{ padding: 12, background: "var(--bg-subtle, #F8FAFC)", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Advance Deposit Safeguard</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="label">Deposit Requirement</label>
                    <select
                      className="input"
                      value={depositType}
                      onChange={(e: any) => setDepositType(e.target.value)}
                    >
                      <option value="NONE">No Deposit (100% COD)</option>
                      <option value="FIXED">Fixed Amount (৳)</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FULL">100% Full Prepayment</option>
                    </select>
                  </div>

                  {depositType !== "NONE" && depositType !== "FULL" && (
                    <div>
                      <label className="label">{depositType === "FIXED" ? "Amount (৳)" : "Percentage (%)"}</label>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        value={depositValue}
                        onChange={(e) => setDepositValue(Number(e.target.value))}
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {depositType === "FIXED"
                    ? `Customers pay ৳${depositValue} online via bKash/Nagad at checkout; the remaining balance is collected via COD upon delivery.`
                    : depositType === "PERCENTAGE"
                    ? `Customers pay ${depositValue}% of item total online at checkout; remainder collected via COD.`
                    : depositType === "FULL"
                    ? "Full payment is required online prior to order confirmation. No COD balance."
                    : "Standard Cash-on-Delivery with 100% collected at the customer's doorstep."}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy ? "Saving…" : editingDrop ? "Update Drop" : "Create Drop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAITLIST ROSTER DRAWER / MODAL */}
      {waitlistOpen && activeWaitlistDrop && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  Waitlist Subscribers
                </h3>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {activeWaitlistDrop.title} ({waitlistSubscribers.length} total)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaitlistOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {waitlistLoading ? (
              <div style={{ padding: "30px 0", textAlign: "center" }} className="muted">
                Loading waitlist subscribers…
              </div>
            ) : waitlistSubscribers.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center" }} className="muted">
                No waitlist subscribers recorded yet for this drop.
              </div>
            ) : (
              <div>
                <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6, marginBottom: 16 }}>
                  <table className="table" style={{ width: "100%", margin: 0, fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        <th>Mobile Number</th>
                        <th>Name</th>
                        <th>Subscribed</th>
                        <th>Alert Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitlistSubscribers.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.phone}</td>
                          <td>{s.name || "—"}</td>
                          <td className="muted">{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                          <td>
                            {s.notifiedAt ? (
                              <span className="pill green" style={{ fontSize: 11 }}>Notified</span>
                            ) : (
                              <span className="pill grey" style={{ fontSize: 11 }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Alert sends direct SMS and WhatsApp links to launch.
                  </span>
                  <button
                    type="button"
                    onClick={handleBroadcastAlert}
                    className="btn btn-primary btn-sm"
                    disabled={busy || waitlistSubscribers.length === 0}
                  >
                    {busy ? "Broadcasting…" : "Send Launch Alerts"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
