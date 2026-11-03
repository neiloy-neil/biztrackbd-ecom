"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener([...toasts]);
  }
}

export const toast = {
  show(message: string, type: ToastType = "info", duration = 3500): string {
    const id = Math.random().toString(36).slice(2, 9);
    toasts = [...toasts.filter((t) => t.type !== "loading"), { id, type, message, duration }];
    notify();

    if (duration > 0 && type !== "loading") {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },

  success(message: string, duration = 3500): string {
    return toast.show(message, "success", duration);
  },

  error(message: string, duration = 5000): string {
    return toast.show(message, "error", duration);
  },

  info(message: string, duration = 3500): string {
    return toast.show(message, "info", duration);
  },

  loading(message: string): string {
    return toast.show(message, "loading", 0);
  },

  update(id: string, message: string, type: ToastType, duration = 3500) {
    toasts = toasts.map((t) => (t.id === id ? { ...t, message, type, duration } : t));
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
  },

  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },

  clear() {
    toasts = [];
    notify();
  },
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  loading: "⏳",
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "#10b981",
  error: "#ef4444",
  info: "#3b82f6",
  loading: "var(--brand)",
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 20,
        right: 24,
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
        maxWidth: 380,
        width: "calc(100% - 48px)",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--surface, #ffffff)",
            color: "var(--ink, #0f172a)",
            border: `1px solid ${BORDER_COLORS[t.type]}`,
            borderLeft: `5px solid ${BORDER_COLORS[t.type]}`,
            borderRadius: 8,
            padding: "12px 16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
            fontSize: 13.5,
            fontWeight: 500,
            lineHeight: 1.4,
            animation: "toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: `${BORDER_COLORS[t.type]}15`,
              color: BORDER_COLORS[t.type],
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {ICONS[t.type]}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted, #64748b)",
              cursor: "pointer",
              padding: 4,
              fontSize: 14,
              lineHeight: 1,
              marginLeft: 4,
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
