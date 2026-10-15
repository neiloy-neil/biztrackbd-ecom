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
        clearInterval(timer);
        window.location.href = "/api/auth/impersonate/exit";
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "#D97706" }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
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
