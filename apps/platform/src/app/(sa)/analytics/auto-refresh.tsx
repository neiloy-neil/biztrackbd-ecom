"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AutoRefreshControl() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [intervalSec, setIntervalSec] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.sessionStorage.getItem("bt_analytics_autorefresh");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  const handleSelect = (sec: number) => {
    setIntervalSec(sec);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("bt_analytics_autorefresh", String(sec));
    }
  };

  const triggerManualRefresh = () => {
    startTransition(() => {
      router.refresh();
      setLastRefreshed(new Date());
    });
  };

  useEffect(() => {
    if (intervalSec <= 0) return;
    const timer = setInterval(() => {
      startTransition(() => {
        router.refresh();
        setLastRefreshed(new Date());
      });
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [intervalSec, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--ink-3)", fontWeight: 600, marginRight: 2 }}>Auto-Refresh:</span>
        {[
          { label: "Off", value: 0 },
          { label: "15s", value: 15 },
          { label: "30s", value: 30 },
          { label: "60s", value: 60 },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            style={{
              border: "none",
              background: intervalSec === opt.value ? "var(--brand-primary, #0B4D3B)" : "transparent",
              color: intervalSec === opt.value ? "#fff" : "var(--ink-2)",
              fontWeight: intervalSec === opt.value ? 700 : 500,
              borderRadius: 4,
              padding: "2px 7px",
              cursor: "pointer",
              fontSize: 11.5,
              transition: "all 0.15s ease",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={triggerManualRefresh}
        disabled={isPending}
        className="btn btn-secondary btn-sm"
        title={`Last updated at ${lastRefreshed.toLocaleTimeString("en-GB")}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, height: 32 }}
      >
        <span
          style={{
            display: "inline-block",
            transform: isPending ? "rotate(360deg)" : "none",
            transition: isPending ? "transform 0.6s linear infinite" : "none",
          }}
        >
          🔄
        </span>
        {isPending ? "Updating..." : "Refresh"}
      </button>

      {intervalSec > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--success, #059669)", fontWeight: 600 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              boxShadow: "0 0 6px #10B981",
            }}
          />
          Live
        </span>
      )}
    </div>
  );
}
