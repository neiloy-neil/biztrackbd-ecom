import type { ReactNode } from "react";

const ORDER: Record<string, [string, string]> = {
  PENDING: ["New", "info"], CONFIRMED: ["To pack", "warn"], PROCESSING: ["Packed", ""], SHIPPED: ["Shipped", ""], DELIVERED: ["Delivered", "ok"],
  CANCELLED: ["Cancelled", "grey"], RETURNED: ["Returned", "bad"], REFUNDED: ["Refunded", "bad"],
};

export function OrderPill({ status }: { status: string }): ReactNode {
  const [label, tone] = ORDER[status] ?? [status, "grey"];
  return <span className={`pill ${tone}`}>{label}</span>;
}

const METHOD: Record<string, string> = { COD: "COD", CASH: "Cash", MANUAL_BKASH: "bKash", MANUAL_NAGAD: "Nagad", MANUAL_ROCKET: "Rocket", GATEWAY_SSLCOMMERZ: "Card", GATEWAY_UDDOKTAPAY: "Online payment", GATEWAY_BKASH: "bKash (online)", GATEWAY_STRIPE: "Card", BANK_TRANSFER: "Bank Transfer", POS_CASH: "Cash", POS_CARD: "Card", POS_MFS: "MFS" };
export const methodName = (m: string) => METHOD[m] ?? m;

/** What the owner needs to know about payment at a glance: "Check bKash" asks them to act, "Paid" and "COD" do not. */
export function PaymentPill({ method, status }: { method: string; status: string }): ReactNode {
  if (status === "PENDING_VERIFICATION") return <span className="pill warn">Check {methodName(method)}</span>;
  if (status === "PAID") return <span className="pill ok">Paid</span>;
  if (status === "PARTIALLY_PAID") return <span className="pill info">Partially Paid</span>;
  if (status === "FAILED") return <span className="pill bad">Not received</span>;
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return <span className="pill bad">Refunded</span>;
  return <span className="pill grey">{methodName(method)}</span>;
}

export const CHANNEL: Record<string, string> = {
  STOREFRONT: "Online store", LANDING_PAGE: "Landing page", WHATSAPP_BOT: "WhatsApp", MESSENGER_BOT: "Messenger", TELEMARKETING: "Phone",
  QUICK_MESSENGER: "Messenger", QUICK_WHATSAPP: "WhatsApp", QUICK_PHONE: "Phone call", QUICK_INSTAGRAM: "Instagram", TABLE_ORDER: "Dining Table",
};
