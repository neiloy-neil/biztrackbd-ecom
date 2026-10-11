import type { ReturnRow } from "@biztrackbd/core";

export function ReturnStatusTrackerComponent({
  returnRow,
  lang,
}: {
  returnRow: ReturnRow;
  lang: "en" | "bn";
}) {
  const isPending = returnRow.status === "PENDING";
  const isApproved = returnRow.status === "APPROVED";
  const isPickupBooked = returnRow.status === "PICKUP_BOOKED";
  const isReceived = returnRow.status === "RECEIVED";
  const isRefunded = returnRow.status === "REFUNDED";
  const isExchanged = returnRow.status === "EXCHANGED";
  const isDeclined = returnRow.status === "DECLINED";

  const statusTone = isRefunded || isExchanged ? "ok" : isDeclined ? "bad" : "warn";

  const statusLabels: Record<string, { en: string; bn: string }> = {
    PENDING: { en: "Review in Progress", bn: "অনুরোধ পর্যালোচনা চলছে" },
    APPROVED: { en: "Return Approved", bn: "অনুরোধ অনুমোদিত হয়েছে" },
    PICKUP_BOOKED: { en: "Pickup Scheduled", bn: "কুরিয়ার পিকআপ নির্ধারিত হয়েছে" },
    RECEIVED: { en: "Parcel Received", bn: "পার্সেল মার্চেন্টের কাছে পৌঁছেছে" },
    REFUNDED: { en: "Refund Completed", bn: "টাকা রিফান্ড করা হয়েছে" },
    EXCHANGED: { en: "Exchange Complete", bn: "এক্সচেঞ্জ পণ্য পাঠানো হয়েছে" },
    DECLINED: { en: "Request Declined", bn: "অনুরোধ গ্রহণ করা সম্ভব হয়নি" },
  };

  const currentLabel = statusLabels[returnRow.status] ?? { en: returnRow.status, bn: returnRow.status };

  return (
    <div
      className="card"
      style={{
        padding: 20,
        borderColor: isRefunded || isExchanged ? "var(--success)" : isDeclined ? "var(--danger)" : "var(--warn)",
        background: isRefunded || isExchanged ? "var(--tint-2)" : isDeclined ? "var(--tint-4)" : "var(--tint-1)",
      }}
      data-testid="return-status-card"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{returnRow.code}</span>
          <span className={`pill ${statusTone}`}>
            {lang === "bn" ? currentLabel.bn : currentLabel.en}
          </span>
        </div>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {returnRow.type === "EXCHANGE" ? (lang === "bn" ? "এক্সচেঞ্জ অনুরোধ" : "Exchange Request") : returnRow.type === "STORE_CREDIT" ? (lang === "bn" ? "স্টোর ক্রেডিট" : "Store Credit") : (lang === "bn" ? "রিফান্ড অনুরোধ" : "Refund Request")}
        </span>
      </div>

      <div style={{ fontSize: 13.5, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <span className="muted">{lang === "bn" ? "কারণ: " : "Reason: "}</span>
          <b>{returnRow.reason}</b>
        </div>

        {returnRow.lines && returnRow.lines.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.7)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
              {lang === "bn" ? "ফেরতের পণ্যসমূহ:" : "Items for return:"}
            </div>
            {returnRow.lines.map((l, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{l.title} {l.variantTitle && l.variantTitle.toLowerCase() !== "default" ? `(${l.variantTitle})` : ""} × {l.qty}</span>
                <span className="num font-semibold">৳{l.unitPrice * l.qty}</span>
              </div>
            ))}
          </div>
        )}

        {returnRow.type === "EXCHANGE" && returnRow.exchangeLabel && (
          <div>
            <span className="muted">{lang === "bn" ? "পরিবর্তিত পণ্য: " : "Replacement item: "}</span>
            <b style={{ color: "var(--accent)" }}>{returnRow.exchangeLabel}</b>
          </div>
        )}

        {returnRow.returnTrackingCode && (
          <div style={{ background: "var(--surface)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
            <span className="muted">{lang === "bn" ? "পিকআপ ট্র্যাকিং কোড: " : "Pickup Tracking Code: "}</span>
            <code style={{ fontWeight: 700 }}>{returnRow.returnTrackingCode}</code>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {lang === "bn"
                ? "কুরিয়ার রাইডার আপনার সাথে যোগাযোগ করবেন। অনুগ্রহ করে মূল ট্যাগসহ পণ্যটি প্রস্তুত রাখুন।"
                : "Courier rider will contact you for parcel pickup. Please keep the item packed with original tags."}
            </p>
          </div>
        )}

        {isRefunded && (
          <div style={{ background: "var(--surface)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: 700, color: "var(--success)" }}>
              {lang === "bn" ? `৳${returnRow.refundAmount} রিফান্ড সফল হয়েছে` : `৳${returnRow.refundAmount} Refund Processed`}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              {returnRow.refundMethod ?? "bKash"} {returnRow.refundTrxId ? `· TrxID: ${returnRow.refundTrxId}` : ""}
            </div>
          </div>
        )}

        {isPending && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {lang === "bn"
              ? "আমাদের টিম আপনার অনুরোধটি যাচাই করছে। সাধারণত ২৪-৪৮ ঘণ্টার মধ্যে আপডেট জানানো হবে।"
              : "Our team is reviewing your return request. We will update you within 24-48 business hours."}
          </p>
        )}

        {returnRow.adminNote && (
          <div style={{ marginTop: 6, padding: "8px 10px", background: "rgba(0,0,0,0.03)", borderRadius: 6, fontSize: 12.5 }}>
            <span className="muted">{lang === "bn" ? "দোকানের বার্তা: " : "Store message: "}</span>
            <span>{returnRow.adminNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}
