"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { switchToCodAction } from "@/app/(store)/checkout/actions";
import { money } from "@/lib/i18n";

export interface PaymentRecoveryCardProps {
  orderId: string;
  token?: string;
  lang: "en" | "bn";
  isCancelledOrFailed: boolean;
  totalAmount: number;
}

export function PaymentRecoveryCard({
  orderId,
  token,
  lang,
  isCancelledOrFailed,
  totalAmount,
}: PaymentRecoveryCardProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function handleSwitchToCod() {
    if (!token || switching) return;
    setSwitching(true);
    setError("");
    try {
      const res = await switchToCodAction(orderId, token);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error || "Could not switch payment method. Please try again.");
        setSwitching(false);
      }
    } catch {
      setError("An unexpected error occurred. Please contact support.");
      setSwitching(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        borderColor: isCancelledOrFailed ? "#f59e0b" : "var(--primary, #0f766e)",
        background: isCancelledOrFailed ? "#fffbeb" : "#f0fdf4",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: isCancelledOrFailed ? "#fef3c7" : "#dcfce7",
            color: isCancelledOrFailed ? "#b45309" : "#15803d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {isCancelledOrFailed ? "!" : "৳"}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px 0", color: "#1e293b" }}>
            {isCancelledOrFailed
              ? lang === "bn"
                ? "অনলাইন পেমেন্ট সম্পন্ন হয়নি"
                : "Online Payment Incomplete"
              : lang === "bn"
              ? "পেমেন্ট অপেক্ষমাণ"
              : "Payment Pending"}
          </h2>
          <p style={{ fontSize: 13.5, color: "#475569", margin: "0 0 14px 0", lineHeight: 1.5 }}>
            {lang === "bn"
              ? "চিন্তার কোনো কারণ নেই! আপনার অর্ডারটি সেভ করা আছে। আপনি চাইলে ক্যাশ অন ডেলিভারিতে (পণ্য হাতে পেয়ে টাকা) পরিবর্তন করতে পারেন।"
              : "Your order details are safe. You can immediately switch to Cash on Delivery (pay upon delivery) without re-entering checkout."}
          </p>

          {error && (
            <div
              style={{
                color: "#b91c1c",
                fontSize: 13,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {token && (
              <button
                type="button"
                onClick={handleSwitchToCod}
                disabled={switching}
                className="btn btn-primary"
                style={{
                  padding: "9px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  borderRadius: 8,
                }}
              >
                {switching
                  ? lang === "bn"
                    ? "পরিবর্তন হচ্ছে..."
                    : "Switching to COD..."
                  : lang === "bn"
                  ? "ক্যাশ অন ডেলিভারিতে পরিবর্তন করুন"
                  : "Switch to Cash on Delivery (COD)"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
