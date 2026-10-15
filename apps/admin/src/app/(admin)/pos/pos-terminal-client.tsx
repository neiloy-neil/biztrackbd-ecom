"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { taka } from "@/lib/format";
import {
  openPosShiftAction,
  recordPosMovementAction,
  closePosShiftAction,
  scanBarcodeAction,
  searchPosProductsAction,
  lookupCustomerForPosAction,
  checkoutPosAction,
} from "./actions";
import type { PosReceiptData, PosPaymentSplit } from "@biztrackbd/core";

function safeHtml(html: string): string {
  return html;
}

export interface PosProductItem {
  variantId: string;
  productId: string;
  productTitle: string;
  productTitleBn?: string | null;
  variantTitle: string;
  categoryName: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  imageUrl: string | null;
}

interface Props {
  initialData: {
    register: { id: string; name: string; code: string; receiptPrinterWidth: number };
    session: {
      id: string;
      status: string;
      openedAt: Date;
      openingFloat: number;
      totalSales: number;
      totalOrders: number;
      expectedCashInDrawer: number;
    } | null;
    store: {
      name: string;
      phone: string | null;
      address: string | null;
      bkashNumber: string | null;
      nagadNumber: string | null;
    };
    products: PosProductItem[];
    cashierName: string;
  };
}

interface CartLine {
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  quantity: number;
  stockQuantity: number;
}

interface ParkedCart {
  id: string;
  parkedAt: Date;
  customerName: string;
  lines: CartLine[];
  cartDiscount: number;
}

/**
 * Audio beep using Web Audio API for hardware/software barcode scans
 */
function playScanBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1.2 kHz crisp beep
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {
    // Ignore audio context autoplay restrictions
  }
}

export function PosTerminalClient({ initialData }: Props) {
  const [session, setSession] = useState(initialData.session);
  const [products, setProducts] = useState<PosProductItem[]>(initialData.products);
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [showParkedModal, setShowParkedModal] = useState(false);

  // Customer state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerLoyalty, setCustomerLoyalty] = useState<{
    id: string;
    points: number;
    tier: string;
    orders: number;
  } | null>(null);

  // Modals & payments
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<"CASH" | "BKASH" | "NAGAD" | "CARD" | "SPLIT">("CASH");
  const [tenderedCash, setTenderedCash] = useState<number>(0);
  const [mfsTrxId, setMfsTrxId] = useState("");
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitDigital, setSplitDigital] = useState<number>(0);
  const [splitMethod, setSplitMethod] = useState<"MANUAL_BKASH" | "MANUAL_NAGAD" | "CARD">("MANUAL_BKASH");
  const [splitTrxId, setSplitTrxId] = useState("");

  // Cash movement modal
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  // Shift modals
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [openingFloatInput, setOpeningFloatInput] = useState("2000");

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<PosReceiptData | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryName) set.add(p.categoryName);
    }
    return ["ALL", ...Array.from(set)];
  }, [products]);

  // Filtered products for grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "ALL" || p.categoryName === activeCategory;
      const matchQ =
        !search.trim() ||
        p.productTitle.toLowerCase().includes(search.toLowerCase()) ||
        p.variantTitle.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchQ;
    });
  }, [products, activeCategory, search]);

  // Cart financial calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    return Math.min(subtotal, Math.max(0, cartDiscount));
  }, [subtotal, cartDiscount]);

  const netPayable = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const changeDue = useMemo(() => {
    if (selectedPayMethod === "CASH") {
      return Math.max(0, (tenderedCash || 0) - netPayable);
    }
    if (selectedPayMethod === "SPLIT") {
      return Math.max(0, (tenderedCash || 0) - (splitCash || 0));
    }
    return 0;
  }, [selectedPayMethod, tenderedCash, netPayable, splitCash]);

  // Sync tendered cash default when opening payment modal
  useEffect(() => {
    if (showPaymentModal) {
      setTenderedCash(netPayable);
      setSplitCash(Math.floor(netPayable / 2));
      setSplitDigital(netPayable - Math.floor(netPayable / 2));
    }
  }, [showPaymentModal, netPayable]);

  // Hardware wedge barcode scanner global listener
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in regular text inputs unless it's fast wedge scan
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      // Global shortcuts
      if (!isInput) {
        if (e.key === "F2") {
          e.preventDefault();
          searchInputRef.current?.focus();
          return;
        }
        if (e.key === "F4") {
          e.preventDefault();
          if (cart.length > 0) handleParkCurrentCart();
          return;
        }
        if (e.code === "Space" || e.key === "F9") {
          e.preventDefault();
          if (cart.length > 0 && !showPaymentModal && session) {
            setShowPaymentModal(true);
          }
          return;
        }
      }

      if (e.key === "Escape") {
        setShowPaymentModal(false);
        setShowDiscountModal(false);
        setShowParkedModal(false);
        setShowMovementModal(false);
        return;
      }

      // Barcode wedge capture (< 45ms between chars ending with Enter)
      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (timeDiff > 50) {
        buffer = "";
      }

      if (e.key === "Enter") {
        if (buffer.length >= 4) {
          e.preventDefault();
          const scannedCode = buffer;
          buffer = "";
          void handleBarcodeAdd(scannedCode);
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, showPaymentModal, session]);

  // Customer phone lookup
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, "");
    if (clean.length === 11) {
      let live = true;
      lookupCustomerForPosAction(clean).then((cust) => {
        if (!live) return;
        if (cust) {
          setCustomerName(cust.name);
          setCustomerLoyalty({
            id: cust.id,
            points: cust.loyaltyPoints,
            tier: cust.tier,
            orders: cust.totalOrders,
          });
        } else {
          setCustomerLoyalty(null);
        }
      });
      return () => {
        live = false;
      };
    } else {
      setCustomerLoyalty(null);
    }
  }, [customerPhone]);

  // Search products when query changes
  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(async () => {
      const results = await searchPosProductsAction(search);
      setProducts(results);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  async function handleBarcodeAdd(code: string) {
    const clean = code.trim();
    if (!clean) return;

    setErrorNotice("");
    const res = await scanBarcodeAction(clean);
    if (res.ok && res.item) {
      playScanBeep();
      addItemToCart(res.item);
      setBarcodeInput("");
    } else {
      setErrorNotice(`Barcode not found: ${clean}`);
    }
  }

  function addItemToCart(item: {
    variantId: string;
    productId: string;
    productTitle: string;
    variantTitle: string;
    sku: string | null;
    barcode: string | null;
    price: number;
    stockQuantity: number;
  }) {
    setCart((prev) => {
      const existing = prev.find((x) => x.variantId === item.variantId);
      if (existing) {
        if (existing.quantity >= item.stockQuantity) {
          setErrorNotice(`Cannot add more. Only ${item.stockQuantity} in stock.`);
          return prev;
        }
        return prev.map((x) =>
          x.variantId === item.variantId ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      if (item.stockQuantity <= 0) {
        setErrorNotice(`Item is out of stock.`);
        return prev;
      }
      return [
        ...prev,
        {
          variantId: item.variantId,
          productId: item.productId,
          title: item.productTitle,
          variantTitle: item.variantTitle || null,
          sku: item.sku,
          barcode: item.barcode,
          price: item.price,
          quantity: 1,
          stockQuantity: item.stockQuantity,
        },
      ];
    });
  }

  function updateQuantity(variantId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.variantId === variantId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.stockQuantity) {
              setErrorNotice(`Maximum stock reached (${item.stockQuantity})`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  }

  function handleParkCurrentCart() {
    if (cart.length === 0) return;
    const newPark: ParkedCart = {
      id: `park-${Date.now()}`,
      parkedAt: new Date(),
      customerName: customerName || "Customer",
      lines: cart,
      cartDiscount,
    };
    setParkedCarts((prev) => [newPark, ...prev]);
    setCart([]);
    setCartDiscount(0);
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setCustomerLoyalty(null);
  }

  function handleRestoreParkedCart(parked: ParkedCart) {
    setCart(parked.lines);
    setCartDiscount(parked.cartDiscount);
    setCustomerName(parked.customerName);
    setParkedCarts((prev) => prev.filter((p) => p.id !== parked.id));
    setShowParkedModal(false);
  }

  async function handleOpenShift() {
    const floatNum = parseFloat(openingFloatInput) || 0;
    setBusy(true);
    setErrorNotice("");
    try {
      const res = await openPosShiftAction(initialData.register.id, floatNum);
      if (res.ok) {
        setSession({
          id: res.session.id,
          status: "OPEN",
          openedAt: new Date(),
          openingFloat: floatNum,
          totalSales: 0,
          totalOrders: 0,
          expectedCashInDrawer: floatNum,
        });
      } else {
        setErrorNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordCashMovement() {
    if (!session) return;
    const amt = parseFloat(movementAmount);
    if (!amt || amt <= 0 || !movementReason.trim()) {
      setErrorNotice("Enter a valid amount and reason.");
      return;
    }
    setBusy(true);
    try {
      const res = await recordPosMovementAction({
        sessionId: session.id,
        type: movementType,
        amount: amt,
        reason: movementReason.trim(),
      });
      if (res.ok) {
        setShowMovementModal(false);
        setMovementAmount("");
        setMovementReason("");
        // Update live cash in drawer
        setSession((prev) =>
          prev
            ? {
                ...prev,
                expectedCashInDrawer:
                  movementType === "CASH_IN"
                    ? prev.expectedCashInDrawer + amt
                    : prev.expectedCashInDrawer - amt,
              }
            : null
        );
      } else {
        setErrorNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShift() {
    if (!session) return;
    const counted = parseFloat(countedCash) || 0;
    setBusy(true);
    try {
      const res = await closePosShiftAction(session.id, counted);
      if (res.ok) {
        setShiftSummary(res.summary);
      } else {
        setErrorNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteCheckout() {
    if (!session || cart.length === 0 || busy) return;

    let payments: PosPaymentSplit[] = [];

    if (selectedPayMethod === "CASH") {
      payments = [{ method: "CASH", amount: netPayable }];
    } else if (selectedPayMethod === "BKASH") {
      payments = [{ method: "MANUAL_BKASH", amount: netPayable, trxId: mfsTrxId || undefined }];
    } else if (selectedPayMethod === "NAGAD") {
      payments = [{ method: "MANUAL_NAGAD", amount: netPayable, trxId: mfsTrxId || undefined }];
    } else if (selectedPayMethod === "CARD") {
      payments = [{ method: "CARD", amount: netPayable }];
    } else if (selectedPayMethod === "SPLIT") {
      payments = [
        { method: "CASH", amount: splitCash },
        { method: splitMethod, amount: splitDigital, trxId: splitTrxId || undefined },
      ];
    }

    setBusy(true);
    setErrorNotice("");

    try {
      const res = await checkoutPosAction({
        registerId: initialData.register.id,
        sessionId: session.id,
        customer: {
          name: customerName,
          phone: customerPhone || undefined,
        },
        items: cart.map((c) => ({
          variantId: c.variantId,
          quantity: c.quantity,
          unitPrice: c.price,
        })),
        payments,
        tenderedCash: selectedPayMethod === "CASH" ? (tenderedCash || netPayable) : splitCash,
        cartDiscount: totalDiscount,
      });

      if (res.ok) {
        setActiveReceipt(res.receipt);
        setShowPaymentModal(false);
        // Reset cart for next customer
        setCart([]);
        setCartDiscount(0);
        setCustomerName("Walk-in Customer");
        setCustomerPhone("");
        setCustomerLoyalty(null);
        setMfsTrxId("");

        // Update live session stats
        setSession((prev) =>
          prev
            ? {
                ...prev,
                totalOrders: prev.totalOrders + 1,
                totalSales: prev.totalSales + netPayable,
                expectedCashInDrawer:
                  selectedPayMethod === "CASH"
                    ? prev.expectedCashInDrawer + netPayable
                    : selectedPayMethod === "SPLIT"
                    ? prev.expectedCashInDrawer + splitCash
                    : prev.expectedCashInDrawer,
              }
            : null
        );
      } else {
        setErrorNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  // --- SHIFT GATE: If no open shift, force shift opening ---
  if (!session) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          className="card stack"
          style={{
            maxWidth: 440,
            width: "100%",
            padding: 30,
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
          }}
        >
          <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Start POS Shift</h1>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 20px" }}>
            Register: <strong>{initialData.register.name}</strong> ({initialData.register.code})
          </p>

          {errorNotice && <div className="notice bad" style={{ marginBottom: 12 }}>{errorNotice}</div>}

          <label className="field" style={{ textAlign: "left" }}>
            <span className="label">Opening Float / প্রারম্ভিক ক্যাশ (৳)</span>
            <input
              type="number"
              className="input input-lg"
              value={openingFloatInput}
              onChange={(e) => setOpeningFloatInput(e.target.value)}
              placeholder="e.g. 2000"
              autoFocus
            />
          </label>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            {["1000", "2000", "3000", "5000"].map((val) => (
              <button
                key={val}
                type="button"
                className="chip"
                onClick={() => setOpeningFloatInput(val)}
              >
                ৳{val}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy || !openingFloatInput}
            onClick={handleOpenShift}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {busy ? "Opening Shift..." : "Open Cash Drawer & Start Selling"}
          </button>

          <div style={{ marginTop: 16 }}>
            <Link href="/" className="link muted" style={{ fontSize: 13 }}>
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .pos-grid-container {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 16px;
          height: calc(100vh - 120px);
          overflow: hidden;
        }
        @media (max-width: 1024px) {
          .pos-grid-container {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
        }
        .pos-product-card {
          background: var(--card-bg, #ffffff);
          border: 1px solid var(--line-2, #e5e7eb);
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
          user-select: none;
        }
        .pos-product-card:hover {
          transform: translateY(-2px);
          border-color: #6366f1;
          box-shadow: 0 6px 12px rgba(99, 102, 241, 0.12);
        }
        .pos-product-card:active {
          transform: scale(0.98);
        }
        .pos-cart-panel {
          background: var(--card-bg, #ffffff);
          border: 1px solid var(--line-2, #e5e7eb);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 4mm 6mm;
            font-family: monospace, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
          }
        }
      `}</style>

      {/* Main Screen */}
      <div>
        {/* Top Cashier Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--card-bg, #ffffff)",
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid var(--line-2, #e5e7eb)",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{initialData.register.name}</span>
              <span className="pill green" style={{ fontSize: 11, padding: "1px 6px" }}>
                Shift Active
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2, #6b7280)" }}>
              Cashier: <strong>{initialData.cashierName}</strong> · Drawer Cash: <strong>{taka(session.expectedCashInDrawer)}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMovementModal(true)}
            >
              Cash In / Out
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowParkedModal(true)}
            >
              Parked ({parkedCarts.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ color: "#d97706" }}
              onClick={() => setShowShiftCloseModal(true)}
            >
              Close Shift
            </button>
          </div>
        </div>

        {errorNotice && (
          <div className="notice bad" style={{ marginBottom: 12 }}>
            {errorNotice}
          </div>
        )}

        {/* POS Grid: Catalog on Left, Cart on Right */}
        <div className="pos-grid-container">
          {/* Left Side: Search, Scanner, Category Tabs, Product Grid */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Search & Scanner Input Row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ position: "relative", flex: 1.2 }}>
                <input
                  ref={searchInputRef}
                  className="input"
                  style={{ width: "100%", paddingLeft: 34 }}
                  placeholder="Search products by title, SKU, or tag... (F2)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Barcode Scanner Input */}
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  ref={barcodeInputRef}
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="Scan barcode or type & Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleBarcodeAdd(barcodeInput);
                    }
                  }}
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                whiteSpace: "nowrap",
                paddingBottom: 8,
                marginBottom: 8,
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`chip ${activeCategory === cat ? "active" : ""}`}
                  style={{
                    background: activeCategory === cat ? "#6366f1" : "var(--card-subtle, #f3f4f6)",
                    color: activeCategory === cat ? "#ffffff" : "var(--ink-1, #1f2937)",
                    border: "none",
                    borderRadius: 20,
                    padding: "5px 12px",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === "ALL" ? "All Products" : cat}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 10,
                alignContent: "start",
                paddingRight: 4,
              }}
            >
              {filteredProducts.map((p) => {
                const inCart = cart.find((x) => x.variantId === p.variantId);
                return (
                  <div
                    key={p.variantId}
                    className="pos-product-card"
                    style={{ position: "relative" }}
                    onClick={() => addItemToCart(p)}
                  >
                    {inCart && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          background: "#6366f1",
                          color: "#fff",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {inCart.quantity}
                      </span>
                    )}
                    <div style={{ width: "100%", height: 75, background: "#f3f4f6", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>No image</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, maxHeight: 32, overflow: "hidden" }}>
                        {p.productTitle}
                      </div>
                      {p.variantTitle && (
                        <div style={{ fontSize: 11, color: "var(--ink-2, #6b7280)", margin: "2px 0" }}>
                          {p.variantTitle}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--brand, #4f46e5)" }}>
                        {taka(p.price)}
                      </span>
                      <span style={{ fontSize: 10.5, color: p.stockQuantity <= 5 ? "#d97706" : "#6b7280" }}>
                        {p.stockQuantity} left
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Active Cart & Checkout Panel */}
          <div className="pos-cart-panel">
            {/* Customer CRM Header */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line-2, #e5e7eb)", background: "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2, #6b7280)" }}>CUSTOMER (ওয়াক-ইন)</span>
                {customerLoyalty && (
                  <span className="pill green" style={{ fontSize: 10 }}>
                    VIP {customerLoyalty.tier} · {customerLoyalty.points} pts
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="input input-sm"
                  style={{ flex: 1 }}
                  placeholder="01XXXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <input
                  className="input input-sm"
                  style={{ flex: 1.2 }}
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            {/* Cart Line Items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {cart.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--ink-2, #9ca3af)", textAlign: "center" }}>
                  <div style={{ fontWeight: 600 }}>Cart is empty</div>
                  <div style={{ fontSize: 12 }}>Scan barcode or tap items to ring up</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cart.map((item) => (
                    <div
                      key={item.variantId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: "#ffffff",
                        border: "1px solid var(--line-2, #f3f4f6)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-2, #6b7280)" }}>
                          {item.variantTitle && `${item.variantTitle} · `}
                          {taka(item.price)}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: 26, height: 26, padding: 0 }}
                          onClick={() => updateQuantity(item.variantId, -1)}
                        >
                          -
                        </button>
                        <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: 26, height: 26, padding: 0 }}
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ width: 65, textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                        {taka(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Actions: Park & Clear */}
            {cart.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderTop: "1px solid var(--line-2, #f3f4f6)" }}>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--ink-2, #6b7280)" }}
                  onClick={handleParkCurrentCart}
                  title="Park current cart (F4)"
                >
                  ⏸️ Hold / Park Cart (F4)
                </button>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                  onClick={() => {
                    setCart([]);
                    setCartDiscount(0);
                  }}
                >
                  Clear Cart
                </button>
              </div>
            )}

            {/* Financial Summary & Checkout */}
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line-2, #e5e7eb)", background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span className="muted">Subtotal</span>
                <span>{taka(subtotal)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                <span className="muted">
                  Discount{" "}
                  <button
                    type="button"
                    className="link"
                    style={{ fontSize: 11, border: "none", background: "none", cursor: "pointer", padding: 0 }}
                    onClick={() => setShowDiscountModal(true)}
                  >
                    [Edit]
                  </button>
                </span>
                <span style={{ color: totalDiscount > 0 ? "#16a34a" : "inherit" }}>
                  {totalDiscount > 0 ? `- ${taka(totalDiscount)}` : taka(0)}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 18, fontWeight: 800, margin: "8px 0 12px" }}>
                <span>Net Total</span>
                <span style={{ color: "#4f46e5" }}>{taka(netPayable)}</span>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center", height: 44, fontSize: 16 }}
                disabled={cart.length === 0}
                onClick={() => setShowPaymentModal(true)}
              >
                Pay & Print Receipt (Space)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- PAYMENT & CHECKOUT MODAL --- */}
      {showPaymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPaymentModal(false);
          }}
        >
          <div
            className="card stack"
            style={{
              maxWidth: 520,
              width: "100%",
              padding: 24,
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6", paddingBottom: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Checkout & Settle</h2>
                <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                  Payable: <strong style={{ color: "#4f46e5" }}>{taka(netPayable)}</strong>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}
                onClick={() => setShowPaymentModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, margin: "14px 0" }}>
              {[
                ["CASH", "Cash"],
                ["BKASH", "bKash"],
                ["NAGAD", "Nagad"],
                ["CARD", "Card"],
                ["SPLIT", "Split"],
              ].map(([m, l]) => (
                <button
                  key={m}
                  type="button"
                  className={`btn ${selectedPayMethod === m ? "btn-primary" : "btn-secondary"} btn-sm`}
                  style={{ padding: "6px 2px", fontSize: 12, justifyContent: "center" }}
                  onClick={() => setSelectedPayMethod(m as any)}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* CASH PAYMENT UI */}
            {selectedPayMethod === "CASH" && (
              <div>
                <label className="field">
                  <span className="label">Amount Tendered / গ্রাহক দিলেন (৳)</span>
                  <input
                    type="number"
                    className="input input-lg"
                    style={{ fontSize: 20, fontWeight: 700 }}
                    value={tenderedCash || ""}
                    onChange={(e) => setTenderedCash(parseFloat(e.target.value) || 0)}
                    autoFocus
                  />
                </label>

                {/* Quick Cash Presets */}
                <div style={{ display: "flex", gap: 6, margin: "8px 0 14px", flexWrap: "wrap" }}>
                  <button type="button" className="chip" onClick={() => setTenderedCash(netPayable)}>
                    Exact (৳{netPayable})
                  </button>
                  {[500, 1000, 1500, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="chip"
                      onClick={() => setTenderedCash(amt)}
                    >
                      ৳{amt}
                    </button>
                  ))}
                </div>

                {/* Change Due Box */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: changeDue >= 0 ? "rgba(22, 163, 74, 0.08)" : "#fef2f2",
                    border: changeDue >= 0 ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #fecaca",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, color: changeDue >= 0 ? "#16a34a" : "#dc2626" }}>
                    Change Return / ফেরত দিন:
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: changeDue >= 0 ? "#16a34a" : "#dc2626" }}>
                    {taka(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {/* BKASH / NAGAD PAYMENT UI */}
            {(selectedPayMethod === "BKASH" || selectedPayMethod === "NAGAD") && (
              <div>
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <div>Send Money / Merchant Payment to:</div>
                  <strong style={{ fontSize: 16 }}>
                    {selectedPayMethod === "BKASH" ? initialData.store.bkashNumber || "Store bKash" : initialData.store.nagadNumber || "Store Nagad"}
                  </strong>
                </div>
                <label className="field">
                  <span className="label">Transaction ID (TrxID) <span className="opt">(optional)</span></span>
                  <input
                    className="input"
                    placeholder="e.g. 9J12K4L5"
                    value={mfsTrxId}
                    onChange={(e) => setMfsTrxId(e.target.value.toUpperCase())}
                  />
                </label>
              </div>
            )}

            {/* CARD PAYMENT UI */}
            {selectedPayMethod === "CARD" && (
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontWeight: 600, margin: "6px 0" }}>Swipe/Tap on Card Terminal</div>
                <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                  Collect {taka(netPayable)} via your physical bank POS terminal.
                </div>
              </div>
            )}

            {/* SPLIT PAYMENT UI */}
            {selectedPayMethod === "SPLIT" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label className="field">
                    <span className="label">Cash Amount (৳)</span>
                    <input
                      type="number"
                      className="input"
                      value={splitCash || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSplitCash(val);
                        setSplitDigital(Math.max(0, netPayable - val));
                      }}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Digital Amount (৳)</span>
                    <input
                      type="number"
                      className="input"
                      value={splitDigital || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSplitDigital(val);
                        setSplitCash(Math.max(0, netPayable - val));
                      }}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="label">Digital Payment Method</span>
                  <select
                    className="select"
                    value={splitMethod}
                    onChange={(e) => setSplitMethod(e.target.value as any)}
                  >
                    <option value="MANUAL_BKASH">bKash</option>
                    <option value="MANUAL_NAGAD">Nagad</option>
                    <option value="CARD">Card POS</option>
                  </select>
                </label>
              </div>
            )}

            {/* Settle Action Button */}
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={busy}
                onClick={handleCompleteCheckout}
              >
                {busy ? "Settling Sale..." : "✓ Complete Sale & Print Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIPT MODAL (80mm / 58mm Thermal layout) --- */}
      {activeReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card stack"
            style={{
              maxWidth: 380,
              width: "100%",
              padding: 20,
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="pill green">✓ Sale Completed</span>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}
                onClick={() => setActiveReceipt(null)}
              >
                ✕
              </button>
            </div>

            {/* Receipt Preview */}
            <div
              className="receipt-print-area"
              style={{
                background: "#f9fafb",
                border: "1px dashed #d1d5db",
                padding: "16px",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{activeReceipt.storeName}</div>
                {activeReceipt.storeAddress && <div style={{ fontSize: 11 }}>{activeReceipt.storeAddress}</div>}
                {activeReceipt.storePhone && <div style={{ fontSize: 11 }}>Phone: {activeReceipt.storePhone}</div>}
                <div style={{ margin: "6px 0", borderTop: "1px dashed #9ca3af" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>Inv: #{activeReceipt.orderNumber}</span>
                  <span>{new Date(activeReceipt.createdAt).toLocaleTimeString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>Cashier: {activeReceipt.cashierName}</span>
                  <span>Cust: {activeReceipt.customerName}</span>
                </div>
                <div style={{ margin: "6px 0", borderTop: "1px dashed #9ca3af" }} />
              </div>

              {/* Items Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {activeReceipt.items.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, paddingRight: 6 }}>
                      <div>{it.title}</div>
                      {it.variantTitle && <div style={{ fontSize: 10, color: "#666" }}>{it.variantTitle}</div>}
                      <div style={{ fontSize: 10, color: "#666" }}>
                        {it.quantity} × {it.unitPrice}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>৳{it.totalPrice}</div>
                  </div>
                ))}
              </div>

              <div style={{ margin: "6px 0", borderTop: "1px dashed #9ca3af" }} />

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Subtotal:</span>
                <span>৳{activeReceipt.subtotal}</span>
              </div>
              {activeReceipt.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, color: "#16a34a" }}>
                  <span>Discount:</span>
                  <span>- ৳{activeReceipt.discount}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, margin: "4px 0" }}>
                <span>TOTAL:</span>
                <span>৳{activeReceipt.total}</span>
              </div>

              {activeReceipt.tenderedCash > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>Cash Tendered:</span>
                  <span>৳{activeReceipt.tenderedCash}</span>
                </div>
              )}
              {activeReceipt.changeDue > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                  <span>Change Return:</span>
                  <span>৳{activeReceipt.changeDue}</span>
                </div>
              )}

              {/* Barcode on receipt for returns lookup */}
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <div
                  style={{ display: "flex", justifyContent: "center" }}
                  dangerouslySetInnerHTML={{ __html: safeHtml(activeReceipt.barcodeSvg) }}
                />
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  Thank you for shopping with us!
                </div>
              </div>
            </div>

            {/* Actions: Print and New Sale */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                Print Receipt
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setActiveReceipt(null)}
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CART DISCOUNT MODAL --- */}
      {showDiscountModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDiscountModal(false); }}
        >
          <div className="card stack" style={{ maxWidth: 360, width: "100%", padding: 20, borderRadius: 10, background: "#fff" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Cart Discount</h3>
            <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
              <button
                type="button"
                className={`btn ${discountType === "FLAT" ? "btn-primary" : "btn-secondary"} btn-sm`}
                onClick={() => setDiscountType("FLAT")}
              >
                Flat Taka (৳)
              </button>
              <button
                type="button"
                className={`btn ${discountType === "PERCENT" ? "btn-primary" : "btn-secondary"} btn-sm`}
                onClick={() => setDiscountType("PERCENT")}
              >
                Percentage (%)
              </button>
            </div>
            <input
              type="number"
              className="input"
              placeholder={discountType === "FLAT" ? "e.g. 100" : "e.g. 10"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDiscountModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const val = parseFloat(discountValue) || 0;
                  if (discountType === "FLAT") {
                    setCartDiscount(val);
                  } else {
                    setCartDiscount(Math.round((subtotal * val) / 100));
                  }
                  setShowDiscountModal(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PARKED CARTS MODAL --- */}
      {showParkedModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowParkedModal(false); }}
        >
          <div className="card stack" style={{ maxWidth: 440, width: "100%", padding: 20, borderRadius: 10, background: "#fff" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Parked / Held Sales ({parkedCarts.length})</h3>
            {parkedCarts.length === 0 ? (
              <p className="muted" style={{ padding: "20px 0", textAlign: "center" }}>No sales currently on hold.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", margin: "10px 0" }}>
                {parkedCarts.map((p) => {
                  const itemsCount = p.lines.reduce((s, l) => s + l.quantity, 0);
                  const pTotal = p.lines.reduce((s, l) => s + l.price * l.quantity, 0) - p.cartDiscount;
                  return (
                    <div
                      key={p.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}
                    >
                      <div>
                        <strong>{p.customerName}</strong>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          {itemsCount} items · {new Date(p.parkedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{taka(pTotal)}</span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleRestoreParkedCart(p)}
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowParkedModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CASH IN / CASH OUT MODAL --- */}
      {showMovementModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMovementModal(false); }}
        >
          <div className="card stack" style={{ maxWidth: 400, width: "100%", padding: 20, borderRadius: 10, background: "#fff" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Cash Drawer Adjustment</h3>
            <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
              <button
                type="button"
                className={`btn ${movementType === "CASH_IN" ? "btn-primary" : "btn-secondary"} btn-sm`}
                onClick={() => setMovementType("CASH_IN")}
              >
                + Cash In (Float Add)
              </button>
              <button
                type="button"
                className={`btn ${movementType === "CASH_OUT" ? "btn-primary" : "btn-secondary"} btn-sm`}
                onClick={() => setMovementType("CASH_OUT")}
              >
                - Cash Out (Expense)
              </button>
            </div>
            <label className="field">
              <span className="label">Amount (৳)</span>
              <input
                type="number"
                className="input"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                placeholder="e.g. 500"
                autoFocus
              />
            </label>
            <label className="field">
              <span className="label">Reason / বিবরণ</span>
              <input
                className="input"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={movementType === "CASH_IN" ? "e.g. Added change from bank" : "e.g. Tea, snacks, courier advance"}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMovementModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={handleRecordCashMovement}
              >
                {busy ? "Saving..." : "Record Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLOSE SHIFT & Z-REPORT MODAL --- */}
      {showShiftCloseModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShiftCloseModal(false); }}
        >
          <div className="card stack" style={{ maxWidth: 460, width: "100%", padding: 24, borderRadius: 12, background: "#fff" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Close POS Shift & Reconcile</h2>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
              Count physical cash in the drawer to calculate Over/Short variance.
            </p>

            {shiftSummary ? (
              <div>
                <div className="notice good" style={{ marginBottom: 12 }}>
                  Shift closed successfully.
                </div>
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Orders:</span><strong>{shiftSummary.totalOrders}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Sales:</span><strong>{taka(shiftSummary.totalSales)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cash Sales:</span><span>{taka(shiftSummary.totalCashSales)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>bKash/Nagad/Card:</span><span>{taka(shiftSummary.totalMfsSales + shiftSummary.totalCardSales)}</span></div>
                  <div style={{ margin: "4px 0", borderTop: "1px dashed #cbd5e1" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Opening Float:</span><span>{taka(shiftSummary.openingFloat)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Expected Cash:</span><strong>{taka(shiftSummary.expectedCash)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Counted Cash:</span><strong>{taka(shiftSummary.closingCounted)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: shiftSummary.cashDifference === 0 ? "#16a34a" : shiftSummary.cashDifference > 0 ? "#2563eb" : "#dc2626", fontWeight: 700 }}>
                    <span>Difference:</span>
                    <span>{shiftSummary.cashDifference === 0 ? "Balanced (৳0)" : `${shiftSummary.cashDifference > 0 ? "+ Over" : "- Short"} ${taka(Math.abs(shiftSummary.cashDifference))}`}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  <Link href="/" className="btn btn-primary">Done & Exit POS</Link>
                </div>
              </div>
            ) : (
              <div>
                <label className="field">
                  <span className="label">Physical Cash Counted in Drawer (৳)</span>
                  <input
                    type="number"
                    className="input input-lg"
                    style={{ fontSize: 20, fontWeight: 700 }}
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="e.g. 5400"
                    autoFocus
                  />
                </label>
                <div style={{ fontSize: 12.5, color: "#6b7280", margin: "6px 0 16px" }}>
                  System Expected Cash: <strong>{taka(session.expectedCashInDrawer)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowShiftCloseModal(false)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !countedCash}
                    onClick={handleCloseShift}
                  >
                    {busy ? "Closing Shift..." : "Reconcile & Close Shift"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
