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

export function DropsManagerClient({ initialDrops, availableProducts }: Props) {
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
    if (busy) return;
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
    if (busy) return;
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
        <div className="notice good mb-md flex-between items-center">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="btn-close-sm">✕</button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-4 mb-md">
        <div className="stat">
          <div className="k">Active Drops</div>
          <div className="v num">{liveCount}</div>
          <div className="muted text-xs mt-xs">{drops.length} total scheduled / ended</div>
        </div>

        <div className="stat">
          <div className="k">Waitlist Subscribers</div>
          <div className="v num text-primary">{totalSubscribers}</div>
          <div className="muted text-xs mt-xs">Interested prospective buyers</div>
        </div>

        <div className="stat">
          <div className="k">Units Claimed</div>
          <div className="v num text-success">{totalClaimed}</div>
          <div className="muted text-xs mt-xs">Pre-orders placed across drops</div>
        </div>

        <div className="card p-md flex-col-center">
          <button type="button" onClick={openCreateModal} className="btn btn-primary w-full">
            + Create Limited Drop
          </button>
        </div>
      </div>

      {/* Drops Table / List */}
      <div className="card p-0 overflow-hidden">
        <div className="p-md border-bottom flex-between items-center">
          <h2 className="text-base font-bold m-0">Drop Campaigns ({drops.length})</h2>
          <span className="muted text-sm">Timed countdowns, pre-orders &amp; deposit safeguards</span>
        </div>

        {drops.length === 0 ? (
          <div className="empty p-xl text-center">
            <div className="text-base font-semibold">No limited drops created yet.</div>
            <p className="muted text-sm max-w-460 m-auto mt-xs mb-md">
              Launch limited-edition products with teaser countdown clocks, buyer waitlists, and advance deposit pre-orders.
            </p>
            <button type="button" onClick={openCreateModal} className="btn btn-primary btn-sm">
              Create Your First Drop
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table m-0">
              <thead>
                <tr>
                  <th>Drop Title &amp; Link</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>Deposit Terms</th>
                  <th>Allocation &amp; Claimed</th>
                  <th className="r">Actions</th>
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
                        <div className="font-semibold">{drop.title}</div>
                        <div className="text-xs mt-xs">
                          <span className="muted">Slug: </span>
                          <a
                            href={`/drops/${drop.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link text-xs"
                          >
                            /drops/{drop.slug} ↗
                          </a>
                        </div>
                        <div className="muted text-xs mt-xs">
                          {drop.products.length} {drop.products.length === 1 ? "Product" : "Products"} attached
                        </div>
                      </td>

                      <td>
                        <span className={`pill ${drop.mode === "LIVE_PREORDER" ? "ok" : "info"}`}>
                          {drop.mode === "LIVE_PREORDER" ? "Live Pre-Order" : "Teaser Waitlist"}
                        </span>
                      </td>

                      <td>
                        <span className={`pill ${isLive ? "ok" : isScheduled ? "warn" : isEnded ? "grey" : "info"}`}>
                          {isLive ? "LIVE NOW" : isScheduled ? "SCHEDULED" : isEnded ? "ENDED" : drop.status}
                        </span>
                      </td>

                      <td className="text-sm">
                        <div><b>Starts:</b> {new Date(drop.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                        {drop.endsAt && (
                          <div className="muted mt-xs">
                            <b>Ends:</b> {new Date(drop.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        )}
                        {drop.estimatedShipDate && (
                          <div className="text-success mt-xs">
                            <b>Dispatches:</b> ~{new Date(drop.estimatedShipDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="pill grey text-xs font-semibold">
                          {depositLabel}
                        </span>
                      </td>

                      <td className="min-w-160">
                        <div className="flex-between text-xs mb-xs">
                          <span>Claimed: <b>{drop.claimedUnits}</b></span>
                          {drop.allocationCap && <span>Cap: {drop.allocationCap}</span>}
                        </div>
                        {capPct !== null && (
                          <div className="meter-track">
                            <div
                              className={`meter-fill ${capPct >= 90 ? "bg-error" : "bg-success"}`}
                              style={{ width: `${capPct}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="r nowrap">
                        <div className="row gap-xs items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenWaitlist(drop)}
                            className="btn btn-secondary btn-sm"
                            title="View waitlist subscribers"
                          >
                            Waitlist ({drop.subscriberCount})
                          </button>

                          {isLive && (
                            <button
                              type="button"
                              onClick={() => handleMarkStockReceived(drop)}
                              disabled={busy}
                              className="btn btn-primary btn-sm"
                              title="Mark inventory arrived and release pre-order fulfillment holds"
                            >
                              Stock Arrived
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(drop)}
                            className="btn btn-secondary btn-sm"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDrop(drop.id)}
                            disabled={busy}
                            className="btn btn-secondary btn-sm text-error"
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <h3 className="m-0 text-base font-bold">
                {editingDrop ? "Edit Drop Campaign" : "New Limited Drop / Pre-Order"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="notice bad mb-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveDrop} className="stack gap-md">
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

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Custom URL Slug (optional)</label>
                  <input
                    type="text"
                    className="input font-mono"
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
                  className="textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain fabric details, production schedule, or limited allocation terms..."
                />
              </div>

              {/* Products Selector */}
              <div>
                <label className="label">Select Products for this Drop *</label>
                <div className="table-scroll-280 border rounded-md p-sm bg-subtle">
                  {availableProducts.length === 0 ? (
                    <div className="muted text-sm">No products available in catalog.</div>
                  ) : (
                    availableProducts.map((p) => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="row items-center gap-sm p-xs text-sm pointer">
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
              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Drop Start Date &amp; Time *</label>
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

              <div className="grid grid-2 gap-md">
                <div>
                  <label className="label">Estimated Dispatch Date</label>
                  <input
                    type="date"
                    className="input"
                    value={estimatedShipDate}
                    onChange={(e) => setEstimatedShipDate(e.target.value)}
                  />
                  <div className="muted text-xs mt-xs">Displayed on product page and checkout</div>
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
              <div className="p-md bg-subtle rounded-md border">
                <div className="font-semibold text-sm mb-sm">Advance Deposit Safeguard</div>
                <div className="grid grid-2 gap-md">
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
                <div className="muted text-xs mt-xs">
                  {depositType === "FIXED"
                    ? `Customers pay ৳${depositValue} online via bKash/Nagad at checkout; the remaining balance is collected via COD upon delivery.`
                    : depositType === "PERCENTAGE"
                    ? `Customers pay ${depositValue}% of item total online at checkout; remainder collected via COD.`
                    : depositType === "FULL"
                    ? "Full payment is required online prior to order confirmation. No COD balance."
                    : "Standard Cash-on-Delivery with 100% collected at the customer's doorstep."}
                </div>
              </div>

              <div className="row justify-end gap-sm mt-sm">
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setWaitlistOpen(false);
          }}
        >
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <div>
                <h3 className="m-0 text-base font-bold">
                  Waitlist Subscribers
                </h3>
                <div className="muted text-sm mt-xs">
                  {activeWaitlistDrop.title} ({waitlistSubscribers.length} total)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaitlistOpen(false)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>

            {waitlistLoading ? (
              <div className="p-xl text-center muted">
                Loading waitlist subscribers…
              </div>
            ) : waitlistSubscribers.length === 0 ? (
              <div className="p-xl text-center muted">
                No waitlist subscribers recorded yet for this drop.
              </div>
            ) : (
              <div>
                <div className="table-scroll-280 border rounded-md mb-md">
                  <table className="table m-0 text-sm">
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
                          <td className="font-semibold">{s.phone}</td>
                          <td>{s.name || "—"}</td>
                          <td className="muted">{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                          <td>
                            {s.notifiedAt ? (
                              <span className="pill ok text-xs">Notified</span>
                            ) : (
                              <span className="pill grey text-xs">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex-between items-center">
                  <span className="muted text-xs">
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
