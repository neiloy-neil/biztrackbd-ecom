"use client";

import { useEffect, useState } from "react";

export function ImpersonationBanner({
  tenantName,
  tenantId,
  actorEmail,
  expiresAt,
}: {
  tenantName: string;
  tenantId: string;
  actorEmail: string;
  expiresAt: number;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const formatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <div
      role="alert"
      data-testid="impersonation-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 99999,
        background: "#FFFBEB",
        borderBottom: "1px solid #FCD34D",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        color: "#92400E",
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: "0 2px 6px rgba(180, 83, 9, 0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">⚠️</span>
        <span>
          <strong>IMPERSONATING:</strong> {tenantName} (Tenant ID: {tenantId})
        </span>
        <span style={{ color: "#D97706" }}>·</span>
        <span>
          Super Admin: <strong>{actorEmail}</strong>
        </span>
        <span style={{ color: "#D97706" }}>·</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          Session expires in <strong data-testid="impersonation-timer">{formatted}</strong>
        </span>
      </div>
      <form action="/api/auth/impersonate/exit" method="post" style={{ margin: 0 }}>
        <button
          type="submit"
          className="btn btn-danger btn-sm"
          style={{
            height: 30,
            padding: "0 12px",
            background: "#B45309",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
          data-testid="exit-impersonation-btn"
        >
          Exit Session
        </button>
      </form>
    </div>
  );
}
