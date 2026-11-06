"use client";

import { useState } from "react";
import { retryAdvancePaymentAction } from "@/app/(store)/checkout/actions";

/** "Pay the advance" for an order whose online payment page was closed or failed. Sends the customer to a fresh payment page. */
export function AdvancePayButton({ orderId, token, label }: { orderId: string; token?: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await retryAdvancePaymentAction(orderId, token);
    if (r.ok) {
      window.location.href = r.paymentUrl;
      return;
    }
    setBusy(false);
    setError(r.error);
  }
  return (
    <div>
      <button type="button" className="btn btn-primary" onClick={go} disabled={busy} data-testid="advance-pay-button">{busy ? "…" : label}</button>
      {error && <div className="error" role="alert" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
