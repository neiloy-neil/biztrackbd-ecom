"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type {
  PublicMenuCategory,
  PublicMenuItem,
  StoreInfo,
  TableOrderResult,
} from "@biztrackbd/core";
import type { Lang } from "@/lib/i18n-core";

interface Props {
  categories: PublicMenuCategory[];
  table: string | null;
  storeInfo: StoreInfo;
  siteMode: string;
  lang: Lang;
}

function cleanWaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

function formatTableOrderMessage(options: {
  storeName?: string;
  table?: string | null;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  note?: string;
}): string {
  const lines: string[] = [];
  if (options.table) {
    lines.push(`🍽️ *Table Order — Table ${options.table}*`);
  } else {
    lines.push(`🛍️ *Takeaway / Dining Order*`);
  }
  if (options.storeName) {
    lines.push(`📍 *Restaurant:* ${options.storeName}`);
  }
  lines.push("");
  lines.push("*Ordered Items:*");
  for (const item of options.items) {
    lines.push(`• ${item.quantity}x ${item.name} — ৳${(item.price * item.quantity).toLocaleString("en-BD")}`);
  }
  lines.push("");
  lines.push(`*Total Bill:* ৳${options.total.toLocaleString("en-BD")}`);
  if (options.note?.trim()) {
    lines.push(`📝 *Note:* ${options.note.trim()}`);
  }
  lines.push("");
  lines.push(`_Sent via BizTrack Digital Menu at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}_`);
  return lines.join("\n");
}

export function MenuDiningClient({
  categories,
  table: initialTable,
  storeInfo,
  lang,
}: Props) {
  const [activeTable, setActiveTable] = useState<string | null>(initialTable);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [tableInput, setTableInput] = useState(initialTable || "");

  const [selectedCatId, setSelectedCatId] = useState<string>("ALL");
  const [selectedDietary, setSelectedDietary] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [tray, setTray] = useState<Record<string, number>>({});
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [specialNote, setSpecialNote] = useState("");

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<TableOrderResult | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem("biztrack_table_phone");
      const savedName = localStorage.getItem("biztrack_table_name");
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedName) setCustomerName(savedName);
    } catch {
      // ignore
    }
  }, []);

  const waNumber = storeInfo.whatsappNumber || storeInfo.contactPhone;

  // Flatten all items with their category name
  const allItems = useMemo(() => {
    const list: Array<PublicMenuItem & { categoryTitle: string; categoryTitleBn?: string | null }> = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        list.push({
          ...item,
          categoryTitle: cat.name,
          categoryTitleBn: cat.nameBn,
        });
      }
    }
    return list;
  }, [categories]);

  // Lookup map for fast item lookup in tray
  const itemsMap = useMemo(() => {
    const map = new Map<string, PublicMenuItem>();
    for (const it of allItems) {
      map.set(it.id, it);
    }
    return map;
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Category filter
      if (selectedCatId !== "ALL" && item.categoryId !== selectedCatId) {
        return false;
      }
      // Dietary filter
      if (selectedDietary !== "all") {
        const labels = item.dietaryLabels.map((l) => l.toLowerCase());
        if (!labels.includes(selectedDietary.toLowerCase())) {
          return false;
        }
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesNameBn = item.nameBn?.toLowerCase().includes(q) ?? false;
        const matchesDesc = item.description?.toLowerCase().includes(q) ?? false;
        const matchesDescBn = item.descriptionBn?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesNameBn && !matchesDesc && !matchesDescBn) {
          return false;
        }
      }
      return true;
    });
  }, [allItems, selectedCatId, selectedDietary, searchQuery]);

  // Tray calculations
  const trayEntries = useMemo(() => {
    return Object.entries(tray)
      .map(([id, qty]) => {
        const item = itemsMap.get(id);
        return item && qty > 0 ? { item, qty } : null;
      })
      .filter((x): x is { item: PublicMenuItem; qty: number } => x !== null);
  }, [tray, itemsMap]);

  const totalCount = trayEntries.reduce((acc, curr) => acc + curr.qty, 0);
  const totalPrice = trayEntries.reduce((acc, curr) => acc + curr.item.price * curr.qty, 0);

  const updateQuantity = (id: string, delta: number) => {
    setTray((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const clearTray = () => {
    setTray({});
    setIsTrayOpen(false);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tableInput.trim();
    if (clean) {
      setActiveTable(clean);
      setIsEditingTable(false);
    } else {
      setActiveTable(null);
      setIsEditingTable(false);
    }
  };

  const handleSendOrderWhatsApp = () => {
    if (!waNumber) return;
    const itemsSummary = trayEntries.map(({ item, qty }) => ({
      name: lang === "bn" && item.nameBn ? item.nameBn : item.name,
      quantity: qty,
      price: item.price,
    }));

    const message = formatTableOrderMessage({
      storeName: storeInfo.storeName,
      table: activeTable,
      items: itemsSummary,
      total: totalPrice,
      note: specialNote,
    });

    const url = `https://wa.me/${cleanWaPhone(waNumber)}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCallWaiterWhatsApp = () => {
    if (!waNumber) return;
    const msg = activeTable
      ? `Hello, I am at Table ${activeTable}. Please send a waiter / water / the bill.`
      : `Hello, I am dining at your restaurant and request waiter assistance.`;
    const url = `https://wa.me/${cleanWaPhone(waNumber)}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenKitchenCheckout = () => {
    setSubmitError(null);
    setIsTrayOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmTableOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTable = (activeTable || tableInput).trim();
    if (!effectiveTable) {
      setSubmitError(lang === "bn" ? "টেবিল নম্বর আবশ্যক।" : "Please specify your table number.");
      return;
    }

    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setSubmitError(
        lang === "bn"
          ? "সঠিক মোবাইল নম্বর লিখুন (যেমন: 01712345678)।"
          : "Please enter a valid mobile number (e.g. 01712345678)."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const itemsPayload = trayEntries.map(({ item, qty }) => ({
        menuItemId: item.id,
        quantity: qty,
        note: specialNote.trim() || undefined,
      }));

      const res = await fetch("/api/site/table-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: effectiveTable,
          customerPhone: customerPhone.trim(),
          customerName: customerName.trim() || undefined,
          notes: specialNote.trim() || undefined,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to submit table order.");
      }

      try {
        localStorage.setItem("biztrack_table_phone", customerPhone.trim());
        if (customerName.trim()) {
          localStorage.setItem("biztrack_table_name", customerName.trim());
        }
      } catch {
        // ignore
      }

      setActiveTable(effectiveTable);
      setTray({});
      setSpecialNote("");
      setIsCheckoutOpen(false);
      setActiveTicket(json.data);
      setIsTicketModalOpen(true);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to send order to kitchen. Please retry or call waiter.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f8fafc)", paddingBottom: totalCount > 0 ? 120 : 60 }}>
      {/* Top Restaurant Header */}
      <header
        style={{
          background: "var(--surface, #ffffff)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          padding: "16px 20px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {storeInfo.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeInfo.logoUrl}
                alt={storeInfo.storeName}
                style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain", background: "var(--tint-1, #f1f5f9)" }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "var(--btn-bg, #0f172a)",
                  color: "var(--btn-fg, #ffffff)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                🍽️
              </div>
            )}
            <div>
              <h1 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                {storeInfo.storeName}
              </h1>
              {storeInfo.addressLine && (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted, #64748b)" }}>
                  📍 {storeInfo.addressLine}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/"
              style={{
                fontSize: "0.82rem",
                color: "var(--muted, #64748b)",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              {lang === "bn" ? "হোম পেজ" : "Home"}
            </Link>
          </div>
        </div>
      </header>

      {/* Table & Service Bar */}
      <div style={{ maxWidth: 960, margin: "16px auto", padding: "0 16px" }}>
        {/* Active Dining Ticket Banner */}
        {activeTicket && !isTicketModalOpen && (
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              borderRadius: 14,
              padding: "12px 18px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                👨‍🍳
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {lang === "bn" ? `অর্ডার #${activeTicket.orderNumber} রান্নাঘরে তৈরি হচ্ছে` : `Order #${activeTicket.orderNumber} in Kitchen`}
                  </strong>
                  <span
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    Preparing
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Table {activeTicket.table} · ৳{activeTicket.totalAmount.toLocaleString("en-BD")}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTicketModalOpen(true)}
              style={{
                background: "#38bdf8",
                color: "#0f172a",
                border: "none",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {lang === "bn" ? "টিকিট দেখুন 🧾" : "View Ticket 🧾"}
            </button>
          </div>
        )}

        {activeTable ? (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: 14,
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🍽️</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: "1.05rem", color: "#065f46" }}>
                    {lang === "bn" ? `টেবিল নং ${activeTable}` : `Table ${activeTable}`}
                  </strong>
                  <span
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    Active
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#047857" }}>
                  {lang === "bn" ? "কন্টাক্টলেস টেবিল ডাইনিং মোড" : "Contactless In-Restaurant Table Dining"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {waNumber && (
                <button
                  type="button"
                  onClick={handleCallWaiterWhatsApp}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#065f46",
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🛎️ {lang === "bn" ? "ওয়েটার ডাকুন" : "Call Waiter"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingTable(!isEditingTable)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#047857",
                  fontSize: "0.8rem",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {lang === "bn" ? "টেবিল বদলান" : "Change"}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 14,
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🛍️</span>
              <div>
                <strong style={{ fontSize: "0.95rem" }}>
                  {lang === "bn" ? "টেকঅ্যাওয়ে / সাধারণ মেন্যু" : "Takeaway & Casual Browsing"}
                </strong>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted, #64748b)" }}>
                  {lang === "bn" ? "হোয়াটসঅ্যাপে পছন্দের খাবারের অর্ডার পাঠান" : "Order your meal directly via WhatsApp"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingTable(true)}
              style={{
                background: "var(--tint-1, #f1f5f9)",
                border: "1px solid var(--border, #cbd5e1)",
                color: "var(--fg, #0f172a)",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🍽️ {lang === "bn" ? "টেবিলে বসেছেন? টেবিল নং দিন" : "Seated at a table? Set Table #"}
            </button>
          </div>
        )}

        {/* Change / Set Table Modal Dropdown */}
        {isEditingTable && (
          <form
            onSubmit={handleSaveTable}
            style={{
              marginTop: 10,
              padding: 14,
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder={lang === "bn" ? "টেবিল নম্বর লিখুন (যেমন: 4 বা VIP-1)" : "Enter table # (e.g. 4 or VIP-1)"}
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "0.9rem",
              }}
            />
            <button
              type="submit"
              style={{
                background: "var(--btn-bg, #0f172a)",
                color: "var(--btn-fg, #ffffff)",
                border: "none",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              {lang === "bn" ? "সেভ" : "Set Table"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditingTable(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted, #64748b)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </button>
          </form>
        )}
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
        {/* Search & Dietary Filter Strip */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input
              type="search"
              placeholder={lang === "bn" ? "খাবারের নাম বা বিবরণ খুঁজুন..." : "Search menu items, ingredients..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px 12px 42px",
                borderRadius: 12,
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                fontSize: "0.95rem",
                outline: "none",
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
              }}
            />
            <span style={{ position: "absolute", left: 14, top: 12, fontSize: 18, color: "var(--muted, #94a3b8)" }}>
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 10,
                  border: "none",
                  background: "transparent",
                  color: "var(--muted, #94a3b8)",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Dietary Filter Buttons */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {[
              { id: "all", label: lang === "bn" ? "সবগুলো" : "All Dishes", icon: "🍽️" },
              { id: "halal", label: lang === "bn" ? "হালাল" : "Halal", icon: "🟢" },
              { id: "chef_special", label: lang === "bn" ? "শেফ স্পেশাল" : "Chef's Special", icon: "⭐" },
              { id: "spicy", label: lang === "bn" ? "ঝাল" : "Spicy", icon: "🌶️" },
              { id: "vegetarian", label: lang === "bn" ? "নিরামিষ" : "Vegetarian", icon: "🥬" },
            ].map((d) => {
              const active = selectedDietary === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDietary(d.id)}
                  style={{
                    border: "none",
                    background: active ? "var(--btn-bg, #0f172a)" : "var(--surface, #ffffff)",
                    color: active ? "var(--btn-fg, #ffffff)" : "var(--fg, #475569)",
                    padding: "6px 14px",
                    borderRadius: 9999,
                    fontSize: "0.82rem",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <span>{d.icon}</span> {d.label}
                </button>
              );
            })}
          </div>

          {/* Category Tabs */}
          {categories.length > 1 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingTop: 10, paddingBottom: 4 }}>
              <button
                type="button"
                onClick={() => setSelectedCatId("ALL")}
                style={{
                  border: "none",
                  background: selectedCatId === "ALL" ? "var(--accent, #3b82f6)" : "transparent",
                  color: selectedCatId === "ALL" ? "#ffffff" : "var(--muted, #64748b)",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  fontWeight: selectedCatId === "ALL" ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {lang === "bn" ? "সব ক্যাটাগরি" : "All Categories"}
              </button>
              {categories.map((cat) => {
                const active = selectedCatId === cat.id;
                const title = lang === "bn" && cat.nameBn ? cat.nameBn : cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCatId(cat.id)}
                    style={{
                      border: "none",
                      background: active ? "var(--accent, #3b82f6)" : "transparent",
                      color: active ? "#ffffff" : "var(--muted, #64748b)",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {title} ({cat.items.length})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dish Items Grid */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "var(--surface, #ffffff)",
              borderRadius: 16,
              border: "1px dashed var(--border, #cbd5e1)",
            }}
          >
            <span style={{ fontSize: 42, display: "block", marginBottom: 12 }}>🍽️</span>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>
              {lang === "bn" ? "কোনো খাবার পাওয়া যায়নি" : "No dishes found"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted, #64748b)" }}>
              {lang === "bn" ? "অন্য ফিল্টার বা ক্যাটাগরি বেছে নিন" : "Try clearing filters or search terms."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filteredItems.map((item) => {
              const name = lang === "bn" && item.nameBn ? item.nameBn : item.name;
              const desc = lang === "bn" && item.descriptionBn ? item.descriptionBn : item.description;
              const isAvailable = item.isAvailable !== false;
              const qty = tray[item.id] || 0;

              return (
                <div
                  key={item.id}
                  style={{
                    background: "var(--surface, #ffffff)",
                    borderRadius: 14,
                    border: "1px solid var(--border, #e2e8f0)",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                    opacity: isAvailable ? 1 : 0.6,
                    position: "relative",
                  }}
                >
                  <div>
                    {item.imageUrl && (
                      <div
                        style={{
                          width: "100%",
                          height: 140,
                          borderRadius: 10,
                          overflow: "hidden",
                          marginBottom: 12,
                          background: "var(--tint-1, #f1f5f9)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                        {name}
                      </h3>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "var(--accent, #d97706)" }}>
                          ৳{item.price.toLocaleString("en-BD")}
                        </div>
                        {item.compareAtPrice && item.compareAtPrice > item.price && (
                          <s style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)" }}>
                            ৳{item.compareAtPrice.toLocaleString("en-BD")}
                          </s>
                        )}
                      </div>
                    </div>

                    {!isAvailable && (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#dc2626",
                          background: "#fee2e2",
                          padding: "2px 6px",
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      >
                        {lang === "bn" ? "আজকের মতো শেষ" : "Sold Out"}
                      </span>
                    )}

                    {desc && (
                      <p style={{ fontSize: "0.85rem", color: "var(--muted, #64748b)", margin: "0 0 12px", lineHeight: 1.4 }}>
                        {desc}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      paddingTop: 12,
                      borderTop: "1px dashed var(--border, #f1f5f9)",
                    }}
                  >
                    {/* Dietary Badges */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {item.dietaryLabels.map((lbl) => {
                        const tag = lbl.toLowerCase();
                        return (
                          <span
                            key={tag}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 5px",
                              borderRadius: 4,
                              fontWeight: 600,
                              background: tag === "chef_special" ? "rgba(217, 119, 6, 0.1)" : "rgba(34, 197, 94, 0.1)",
                              color: tag === "chef_special" ? "#b45309" : "#15803d",
                            }}
                          >
                            {tag === "chef_special" ? "⭐ Special" : tag === "halal" ? "🟢 Halal" : tag === "spicy" ? "🌶️ Spicy" : tag === "vegetarian" ? "🥬 Veg" : tag}
                          </span>
                        );
                      })}
                    </div>

                    {/* Quantity Stepper or Add button */}
                    {isAvailable && (
                      <div>
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            style={{
                              background: "var(--btn-bg, #0f172a)",
                              color: "var(--btn-fg, #ffffff)",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: 8,
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            + {lang === "bn" ? "যোগ করুন" : "Add"}
                          </button>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              background: "var(--tint-1, #f1f5f9)",
                              borderRadius: 8,
                              border: "1px solid var(--border, #cbd5e1)",
                              overflow: "hidden",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              style={{
                                border: "none",
                                background: "transparent",
                                width: 32,
                                height: 32,
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: "0.9rem" }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              style={{
                                border: "none",
                                background: "transparent",
                                width: 32,
                                height: 32,
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Table Tray Bar */}
      {totalCount > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 600,
            background: "var(--btn-bg, #0f172a)",
            color: "var(--btn-fg, #ffffff)",
            borderRadius: 16,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🛒
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                {activeTable
                  ? lang === "bn"
                    ? `টেবিল ${activeTable} · ${totalCount}টি আইটেম`
                    : `Table ${activeTable} · ${totalCount} items`
                  : lang === "bn"
                  ? `${totalCount}টি আইটেম`
                  : `${totalCount} items`}
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                ৳{totalPrice.toLocaleString("en-BD")}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTrayOpen(true)}
            style={{
              background: "var(--accent, #38bdf8)",
              color: "#0f172a",
              border: "none",
              padding: "10px 18px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: "0.92rem",
              cursor: "pointer",
            }}
          >
            {lang === "bn" ? "অর্ডার দেখুন →" : "View Tray →"}
          </button>
        </div>
      )}

      {/* Slide-Up Tray Modal / Drawer */}
      {isTrayOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsTrayOpen(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "24px 20px",
              maxWidth: 640,
              width: "100%",
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 2px" }}>
                  {activeTable
                    ? lang === "bn"
                      ? `টেবিল ${activeTable} এর অর্ডার`
                      : `Table ${activeTable} Order Tray`
                    : lang === "bn"
                    ? "আপনার খাবারের ট্রে"
                    : "Your Dining Tray"}
                </h2>
                <span style={{ fontSize: "0.85rem", color: "var(--muted, #64748b)" }}>
                  {totalCount} {lang === "bn" ? "টি খাবার নির্বাচিত" : "dishes selected"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTrayOpen(false)}
                style={{
                  border: "none",
                  background: "var(--tint-1, #f1f5f9)",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* List of items in tray */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {trayEntries.map(({ item, qty }) => {
                const name = lang === "bn" && item.nameBn ? item.nameBn : item.name;
                const lineTotal = item.price * qty;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--tint-1, #f8fafc)",
                      borderRadius: 12,
                      border: "1px solid var(--border, #e2e8f0)",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{name}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted, #64748b)" }}>
                        ৳{item.price} x {qty} = ৳{lineTotal}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid var(--border, #cbd5e1)",
                          background: "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid var(--border, #cbd5e1)",
                          background: "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Special Instructions */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                📝 {lang === "bn" ? "বিশেষ কোনো অনুরোধ (অপশনাল)" : "Special Instructions / Notes"}
              </label>
              <input
                type="text"
                placeholder={lang === "bn" ? "যেমন: ঝাল কম, সালাদ বেশি, আলাদা গ্রেভি" : "e.g. Less spicy, extra sauce, well cooked"}
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            {/* Total and Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 0",
                borderTop: "2px dashed var(--border, #e2e8f0)",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {lang === "bn" ? "মোট বিল" : "Total Bill"}
              </span>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent, #d97706)" }}>
                ৳{totalPrice.toLocaleString("en-BD")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Primary: Send Order to Kitchen */}
              <button
                type="button"
                onClick={handleOpenKitchenCheckout}
                style={{
                  width: "100%",
                  background: "var(--btn-bg, #0f172a)",
                  color: "var(--btn-fg, #ffffff)",
                  border: "none",
                  padding: "14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.2)",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>👨‍🍳</span>
                {activeTable
                  ? lang === "bn"
                    ? `টেবিল ${activeTable} এর অর্ডার রান্নাঘরে পাঠান`
                    : `Send Table ${activeTable} Order to Kitchen`
                  : lang === "bn"
                  ? "রান্নাঘরে সরাসরি অর্ডার পাঠান"
                  : "Send Order Directly to Kitchen"}
              </button>

              {/* Secondary: Send Order via WhatsApp */}
              {waNumber ? (
                <button
                  type="button"
                  onClick={handleSendOrderWhatsApp}
                  style={{
                    width: "100%",
                    background: "rgba(22, 163, 74, 0.08)",
                    color: "#15803d",
                    border: "1px solid rgba(22, 163, 74, 0.25)",
                    padding: "12px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>💬</span>
                  {activeTable
                    ? lang === "bn"
                      ? `বা টেবিল ${activeTable} এর অর্ডার হোয়াটসঅ্যাপে পাঠান`
                      : `Or Send via WhatsApp`
                    : lang === "bn"
                    ? "বা হোয়াটসঅ্যাপে অর্ডার পাঠান"
                    : "Or Send via WhatsApp"}
                </button>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={clearTray}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid var(--border, #e2e8f0)",
                    color: "var(--muted, #64748b)",
                    padding: "10px",
                    borderRadius: 10,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  {lang === "bn" ? "ট্রে খালি করুন" : "Clear Tray"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTrayOpen(false)}
                  style={{
                    flex: 1,
                    background: "var(--tint-1, #f1f5f9)",
                    border: "none",
                    color: "var(--fg, #0f172a)",
                    padding: "10px",
                    borderRadius: 10,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {lang === "bn" ? "আরো খাবার যোগ করুন" : "Add More Items"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Table Checkout Modal */}
      {isCheckoutOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsCheckoutOpen(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              borderRadius: 20,
              maxWidth: 480,
              width: "100%",
              padding: "24px 22px",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.3)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>👨‍🍳</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
                    {lang === "bn" ? "রান্নাঘরে অর্ডার নিশ্চিতকরণ" : "Confirm Table Order"}
                  </h2>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted, #64748b)" }}>
                  {lang === "bn"
                    ? "অর্ডারটি সরাসরি কিচেন প্রিন্টার ও শেফ স্ক্রিনে চলে যাবে।"
                    : "Dispatched straight to the kitchen chef station & receipt printer."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                style={{
                  border: "none",
                  background: "var(--tint-1, #f1f5f9)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmTableOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Table Selection / Confirmation */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#065f46" }}>
                    🍽️ {lang === "bn" ? "টেবিল নম্বর" : "Dining Table #"} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  {activeTable && (
                    <button
                      type="button"
                      onClick={() => {
                        setTableInput(activeTable);
                        setActiveTable(null);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#047857",
                        fontSize: "0.78rem",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      {lang === "bn" ? "পরিবর্তন" : "Change"}
                    </button>
                  )}
                </div>
                {activeTable ? (
                  <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#065f46" }}>
                    Table {activeTable}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder={lang === "bn" ? "যেমন: 4 বা VIP-1" : "e.g. 4 or VIP-1"}
                    value={tableInput}
                    onChange={(e) => setTableInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #10b981",
                      background: "#ffffff",
                      fontSize: "1rem",
                      fontWeight: 700,
                    }}
                  />
                )}
              </div>

              {/* Customer Phone */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: 4 }}>
                  📱 {lang === "bn" ? "মোবাইল নম্বর (বিল ও SMS এর জন্য)" : "Mobile Phone Number"} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="017XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Guest Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: 4 }}>
                  👤 {lang === "bn" ? "আপনার নাম (অপশনাল)" : "Your Name (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "bn" ? "যেমন: তানভীর" : "e.g. Tanvir"}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Kitchen Notes */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: 4 }}>
                  📝 {lang === "bn" ? "শেফের জন্য বিশেষ বার্তা (অপশনাল)" : "Special Requests for Kitchen (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "bn" ? "যেমন: ঝাল কম, সালাদ বেশি" : "e.g. Less spicy, extra sauce"}
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Order Summary Strip */}
              <div style={{ background: "var(--tint-1, #f8fafc)", border: "1px dashed var(--border, #cbd5e1)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted, #64748b)" }}>
                    {totalCount} {lang === "bn" ? "টি খাবার" : "dishes"}
                  </div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                    ৳{totalPrice.toLocaleString("en-BD")}
                  </div>
                </div>
                <span style={{ fontSize: "0.78rem", background: "rgba(0,0,0,0.06)", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>
                  💵 Pay after Dining
                </span>
              </div>

              {submitError && (
                <div style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", padding: "10px 12px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                  ⚠️ {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "var(--btn-bg, #0f172a)",
                  color: "var(--btn-fg, #ffffff)",
                  border: "none",
                  padding: "14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.2)",
                }}
              >
                {isSubmitting ? (
                  <span>⏳ {lang === "bn" ? "অর্ডার পাঠানো হচ্ছে..." : "Sending to Kitchen..."}</span>
                ) : (
                  <>
                    <span>👨‍🍳</span>
                    <span>{lang === "bn" ? "অর্ডার নিশ্চিত করুন" : "Confirm & Send to Kitchen"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setIsTrayOpen(true);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted, #64748b)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ← {lang === "bn" ? "ব্যাগে ফিরে যান" : "Back to Tray"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Live Digital Dining Ticket Modal */}
      {activeTicket && isTicketModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsTicketModalOpen(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              borderRadius: 22,
              maxWidth: 480,
              width: "100%",
              padding: "26px 22px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              maxHeight: "90vh",
              overflowY: "auto",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Cooking / Confirmation Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                margin: "0 auto 14px",
                border: "2px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              👨‍🍳
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Kitchen Preparing
            </div>

            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>
              {lang === "bn" ? "অর্ডার রান্নাঘরে পৌঁছেছে!" : "Order Sent to Kitchen!"}
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: "0.86rem", color: "var(--muted, #64748b)" }}>
              {lang === "bn"
                ? `আপনার খাবার তৈরি হচ্ছে। রেডি হলে সরাসরি টেবিল ${activeTicket.table}-এ পরিবেশন করা হবে।`
                : `Our chefs are now preparing your order. Food will be served directly to Table ${activeTicket.table}.`}
            </p>

            {/* Ticket Details Box */}
            <div
              style={{
                background: "var(--tint-1, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 14,
                padding: 16,
                textAlign: "left",
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border, #cbd5e1)", paddingBottom: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", textTransform: "uppercase" }}>
                    Order Ticket
                  </div>
                  <strong style={{ fontSize: "1.1rem" }}>#{activeTicket.orderNumber}</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontSize: "0.95rem",
                      fontWeight: 900,
                    }}
                  >
                    🍽️ TABLE {activeTicket.table}
                  </span>
                </div>
              </div>

              {/* Items summary */}
              {activeTicket.items && activeTicket.items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {activeTicket.items.map((it, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <div>
                        <strong>{it.quantity}x</strong> {lang === "bn" && it.nameBn ? it.nameBn : it.name}
                        {it.note && <div style={{ fontSize: "0.75rem", color: "#c2410c" }}>⚠️ {it.note}</div>}
                      </div>
                      <div style={{ fontWeight: 600 }}>৳{it.lineTotal.toLocaleString("en-BD")}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: 10 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {lang === "bn" ? "মোট বিল" : "Total Bill"}
                </span>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent, #d97706)" }}>
                  ৳{activeTicket.totalAmount.toLocaleString("en-BD")}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(false)}
                style={{
                  width: "100%",
                  background: "var(--btn-bg, #0f172a)",
                  color: "var(--btn-fg, #ffffff)",
                  border: "none",
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                ➕ {lang === "bn" ? "টেবিলের জন্য আরো খাবার যোগ করুন" : `Order More Dishes for Table ${activeTicket.table}`}
              </button>

              {waNumber && (
                <button
                  type="button"
                  onClick={handleCallWaiterWhatsApp}
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    color: "#065f46",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    padding: "10px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  🛎️ {lang === "bn" ? "ওয়েটার ডাকুন বা জল চান" : "Call Waiter / Ask for Service"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
