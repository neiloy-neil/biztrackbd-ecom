"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { checkCourierFraudAction, type FraudCheckResult } from "./actions";
import type { ExternalCourierFraudData } from "@biztrackbd/core";

const SAMPLE_NUMBERS = [
  { label: "নমুনা ১ (উচ্চ ডেলিভারি)", phone: "01712345678" },
  { label: "নমুনা ২ (মাঝারি স্কোর)", phone: "01987654321" },
  { label: "নমুনা ৩ (নতুন ক্রেতা)", phone: "01811223344" },
];

const SCAN_STEPS = [
  "Steadfast নেটওয়ার্ক যাচাই হচ্ছে...",
  "Pathao ও RedX পার্সেল ডাটা স্ক্যান করা হচ্ছে...",
  "CarryBee ও Paperfly রেকর্ড একীভূত করা হচ্ছে...",
  "ঝুঁকি সূচক ও ফ্রড স্কোর চূড়ান্ত করা হচ্ছে...",
];

export function FraudCheckerTool() {
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [result, setResult] = useState<FraudCheckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(5);

  const handleCheck = (targetPhone?: string) => {
    const query = (targetPhone ?? phone).trim();
    if (!query) {
      setErrorMsg("একটি মোবাইল নম্বর লিখুন।");
      return;
    }
    setErrorMsg(null);
    setResult(null);
    setScanStepIndex(0);

    // Animate progress steps while pending
    const stepInterval = setInterval(() => {
      setScanStepIndex((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    startTransition(async () => {
      try {
        const res = await checkCourierFraudAction(query);
        clearInterval(stepInterval);
        setResult(res);
        if (typeof res.remainingChecks === "number") {
          setRemaining(res.remainingChecks);
        }
        if (!res.success && res.error) {
          setErrorMsg(res.error);
        }
      } catch {
        clearInterval(stepInterval);
        setErrorMsg("যাচাই করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
      }
    });
  };

  const data: ExternalCourierFraudData | undefined = result?.data;

  // Courier brand styling helper
  const couriers = [
    { key: "steadfast", name: "Steadfast Courier", logoColor: "#059669", bg: "#ECFDF5", stats: data?.response?.steadfast },
    { key: "pathao", name: "Pathao Courier", logoColor: "#DC2626", bg: "#FEF2F2", stats: data?.response?.pathao },
    { key: "redx", name: "RedX Delivery", logoColor: "#EA580C", bg: "#FFF7ED", stats: data?.response?.redx },
    { key: "carrybee", name: "CarryBee Logistics", logoColor: "#2563EB", bg: "#EFF6FF", stats: data?.response?.carrybee },
    { key: "paperfly", name: "Paperfly Courier", logoColor: "#4F46E5", bg: "#EEF2FF", stats: data?.response?.paperfly },
  ];

  const score = data?.score ?? 0;
  const isSafe = score >= 80;
  const isModerate = score >= 50 && score < 80;
  const isHighRisk = score < 50;

  return (
    <div style={{ width: "100%", maxWidth: "960px", margin: "0 auto" }}>
      {/* Search Input Box */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "18px",
          padding: "28px 24px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 12px 36px -8px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🇧🇩</span>
            <label htmlFor="phone-input" style={{ fontWeight: 700, fontSize: "15px", color: "#1E293B" }}>
              গ্রাহকের মোবাইল নম্বর লিখুন
            </label>
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: "20px",
              background: remaining > 1 ? "#F1F5F9" : "#FEF2F2",
              color: remaining > 1 ? "#475569" : "#DC2626",
              border: remaining > 1 ? "1px solid #CBD5E1" : "1px solid #FECACA",
            }}
          >
            আজকের ফ্রি সার্চ বাকি: <strong style={{ color: remaining > 0 ? "#2563EB" : "#DC2626" }}>{remaining}</strong>/৫
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCheck();
          }}
          style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
        >
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <span
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                fontWeight: 600,
                color: "#64748B",
                fontSize: "15px",
                pointerEvents: "none",
              }}
            >
              +88
            </span>
            <input
              id="phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712345678 বা 019..."
              disabled={isPending}
              style={{
                width: "100%",
                padding: "14px 14px 14px 50px",
                fontSize: "17px",
                fontWeight: 600,
                borderRadius: "12px",
                border: "2px solid #CBD5E1",
                outline: "none",
                background: "#F8FAFC",
                color: "#0F172A",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "14px 28px",
              fontSize: "16px",
              fontWeight: 700,
              color: "#FFFFFF",
              background: isPending
                ? "#94A3B8"
                : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              borderRadius: "12px",
              border: "none",
              cursor: isPending ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "transform 0.1s, box-shadow 0.2s",
            }}
          >
            {isPending ? (
              <>
                <span className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                স্ক্যান করা হচ্ছে...
              </>
            ) : (
              <>
                <span>⚡</span>
                যাচাই করুন
              </>
            )}
          </button>
        </form>

        {/* Quick sample buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>দ্রুত টেস্ট করুন:</span>
          {SAMPLE_NUMBERS.map((s) => (
            <button
              key={s.phone}
              type="button"
              disabled={isPending}
              onClick={() => {
                setPhone(s.phone);
                handleCheck(s.phone);
              }}
              style={{
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "12.5px",
                color: "#334155",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {s.label} ({s.phone})
            </button>
          ))}
        </div>

        {/* Real-time Scanning Progress Feedback */}
        {isPending && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px 20px",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={{ width: "24px", height: "24px", border: "3px solid #2563EB", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#1E40AF" }}>
                {SCAN_STEPS[scanStepIndex]}
              </div>
              <div style={{ fontSize: "12px", color: "#3B82F6", marginTop: "2px" }}>
                Steadfast, Pathao, RedX, CarryBee ও Paperfly সার্ভার থেকে লাইভ হিস্ট্রি একত্রিত হচ্ছে
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && !isPending && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px 18px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "12px",
              color: "#991B1B",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Results View */}
      {data && !isPending && (
        <div
          style={{
            marginTop: "28px",
            background: "#FFFFFF",
            borderRadius: "20px",
            padding: "32px 24px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 16px 40px -10px rgba(15, 23, 42, 0.09)",
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          {/* Top Banner: Verification Metadata */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "20px",
              borderBottom: "1px solid #F1F5F9",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                যাচাইকৃত ফোন নম্বর
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                {data.phone}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: "#ECFDF5",
                  color: "#059669",
                  border: "1px solid #A7F3D0",
                }}
              >
                ⚡ রেসপন্স টাইম: &lt;২০ms (ক্যাশড)
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: "#F8FAFC",
                  color: "#475569",
                  border: "1px solid #E2E8F0",
                }}
              >
                ৫টি কুরিয়ার নেটওয়ার্ক
              </span>
            </div>
          </div>

          {/* Primary Score & Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginTop: "24px",
            }}
          >
            {/* Score Card */}
            <div
              style={{
                gridColumn: "span 1",
                background: isSafe ? "#F0FDF4" : isModerate ? "#FFFBEB" : "#FEF2F2",
                border: `2px solid ${isSafe ? "#86EFAC" : isModerate ? "#FDE68A" : "#FECACA"}`,
                borderRadius: "16px",
                padding: "20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: isSafe ? "#166534" : isModerate ? "#92400E" : "#991B1B" }}>
                সার্বিক ডেলিভারি স্কোর
              </div>
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: 900,
                  color: isSafe ? "#15803D" : isModerate ? "#D97706" : "#DC2626",
                  lineHeight: 1.1,
                  margin: "8px 0",
                }}
              >
                {data.score}%
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background: isSafe ? "#DCFCE7" : isModerate ? "#FEF3C7" : "#FEE2E2",
                  color: isSafe ? "#15803D" : isModerate ? "#B45309" : "#B91C1C",
                }}
              >
                {isSafe ? "✓ নিরাপদ ক্রেতা (Safe)" : isModerate ? "⚠️ মাঝারি ঝুঁকি (Call)" : "🚨 উচ্চ ঝুঁকি (High Risk)"}
              </div>
            </div>

            {/* Total Parcels */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px" }}>
              <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600 }}>মোট অর্ডার পার্সেল</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#1E293B", marginTop: "6px" }}>
                {data.total_parcel} টি
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                ৫টি শীর্ষ কুরিয়ার রেকর্ডে
              </div>
            </div>

            {/* Delivered Parcels */}
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "16px", padding: "18px" }}>
              <div style={{ fontSize: "13px", color: "#166534", fontWeight: 600 }}>সফল ডেলিভারি</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#15803D", marginTop: "6px" }}>
                {data.success_parcel} টি
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "4px" }}>
                গ্রহীতা রিসিভ করেছেন
              </div>
            </div>

            {/* Cancelled/Returned Parcels */}
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "16px", padding: "18px" }}>
              <div style={{ fontSize: "13px", color: "#991B1B", fontWeight: 600 }}>রিটার্ন / ক্যানসেল</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#DC2626", marginTop: "6px" }}>
                {data.cancel_parcel} টি
              </div>
              <div style={{ fontSize: "12px", color: "#991B1B", marginTop: "4px" }}>
                পার্সেল ফেরত বা প্রত্যাখ্যাত
              </div>
            </div>
          </div>

          {/* 5-Courier Network Breakdown Cards */}
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📦</span> কুরিয়ার নেটওয়ার্ক ভিত্তিক পার্সেল রিপোর্ট
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
              {couriers.map((c) => {
                const s = c.stats;
                const hasData = s && s.status && s.data.total > 0;
                const delivered = s?.data.success ?? 0;
                const cancelled = s?.data.cancel ?? 0;
                const total = s?.data.total ?? 0;
                const successRate = s?.data.deliveredPercentage ?? 0;

                return (
                  <div
                    key={c.key}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "14px",
                      padding: "16px",
                      background: hasData ? "#FFFFFF" : "#F8FAFC",
                      transition: "box-shadow 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: c.logoColor,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: "15px", color: "#1E293B" }}>{c.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: hasData ? "#DCFCE7" : "#F1F5F9",
                          color: hasData ? "#15803D" : "#64748B",
                        }}
                      >
                        {hasData ? "ডাটা পাওয়া গেছে" : "কোন রেকর্ড নেই"}
                      </span>
                    </div>

                    {hasData ? (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#475569", marginBottom: "6px" }}>
                          <span>মোট: <strong>{total}</strong> টি</span>
                          <span>সফল: <strong style={{ color: "#15803D" }}>{delivered}</strong></span>
                          <span>রিটার্ন: <strong style={{ color: "#DC2626" }}>{cancelled}</strong></span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: "100%", height: "8px", background: "#FEE2E2", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${successRate}%`, background: "#10B981", height: "100%" }} />
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", textAlign: "right" }}>
                          সাফল্যের হার: <strong style={{ color: "#0F172A" }}>{successRate}%</strong>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: "13px", color: "#94A3B8", margin: "10px 0 0" }}>
                        এই কুরিয়ারে গ্রাহকের কোনো পূর্ববর্তী পার্সেল ডেলিভারি হিস্ট্রি পাওয়া যায়নি।
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Community Complaints / Reports Banner */}
          {data.community_reports && data.community_reports.length > 0 && (
            <div
              style={{
                marginTop: "24px",
                padding: "16px 20px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "14px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#991B1B", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🚨</span> অন্যান্য মার্চেন্টদের কমপ্লেন রিপোর্ট ({data.community_reports.length} টি)
              </div>
              <ul style={{ margin: "10px 0 0", paddingLeft: "20px", fontSize: "13.5px", color: "#7F1D1D" }}>
                {data.community_reports.map((rep) => (
                  <li key={rep.id} style={{ marginBottom: "4px" }}>
                    {rep.details || "পার্সেল রিসিভ না করে ফেরত পাঠানো হয়েছে।"} {rep.merchant ? `(${rep.merchant})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conversion CTA Hook */}
          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
              borderRadius: "16px",
              color: "#FFFFFF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "18px",
            }}
          >
            <div style={{ maxWidth: "560px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                ম্যানুয়াল চেক বন্ধ করুন · স্বয়ংক্রিয় ফ্রড প্রোটেকশন
              </div>
              <h4 style={{ fontSize: "19px", fontWeight: 800, margin: "6px 0 8px", color: "#FFFFFF" }}>
                প্রতিটি অর্ডারে কি এভাবে আলাদা নম্বর চেক করবেন?
              </h4>
              <p style={{ fontSize: "14px", color: "#E0E7FF", lineHeight: 1.5, margin: 0 }}>
                BizTrackBD-তে আপনার স্টোর তৈরি করলে প্রতিটি ক্যাশ-অন-ডেলিভারি অর্ডারে এই ৫টি কুরিয়ার ডাটা অটোমেটিক ব্যাকগ্রাউন্ডে চেক হয় এবং ঝুঁকিপূর্ণ অর্ডার স্বয়ংক্রিয়ভাবে হোল্ড হয়ে যায়।
              </p>
            </div>

            <Link
              href="/start"
              style={{
                padding: "14px 24px",
                background: "#FFFFFF",
                color: "#1E1B4B",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "15px",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
                whiteSpace: "nowrap",
                transition: "transform 0.15s, background 0.15s",
              }}
            >
              ফ্রি স্টোর শুরু করুন →
            </Link>
          </div>
        </div>
      )}

      {/* Rate Limited State Gate */}
      {result?.rateLimited && (
        <div
          style={{
            marginTop: "24px",
            padding: "32px 24px",
            background: "#FFFBEB",
            border: "2px solid #FCD34D",
            borderRadius: "18px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🛑</div>
          <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#92400E", margin: "0 0 8px" }}>
            আজকের ৫টি ফ্রি সার্চ শেষ হয়েছে!
          </h3>
          <p style={{ fontSize: "15px", color: "#78350F", maxWidth: "600px", margin: "0 auto 20px", lineHeight: 1.6 }}>
            পাবলিক টুলে প্রতিদিন সর্বোচ্চ ৫টি নম্বর ফ্রিতে চেক করা যায়। আপনার স্টোরের শত শত দৈনিক অর্ডারে আনলিমিটেড রিয়েল-টাইম ফ্রড গার্ড সক্রিয় করতে আজই বিজট্র্যাকবিডিতে ফ্রি একাউন্ট খুলুন।
          </p>

          <Link
            href="/start"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#2563EB",
              color: "#FFFFFF",
              borderRadius: "12px",
              fontWeight: 800,
              fontSize: "16px",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
            }}
          >
            আনলিমিটেড ফ্রড গার্ড পেতে রেজিস্টার করুন →
          </Link>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
