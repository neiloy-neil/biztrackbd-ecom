import Link from "next/link";
import type { CustomerActivityItem } from "@biztrackbd/core";
import { friendlyDate } from "@/lib/format";

const TYPE_CONFIG: Record<CustomerActivityItem["type"], { color: string; bg: string; label: string }> = {
  ORDER: { color: "#5B4FE8", bg: "#EEF2FF", label: "ORD" },
  SMS: { color: "#2563EB", bg: "#EFF6FF", label: "SMS" },
  REVIEW: { color: "#D97706", bg: "#FEF3C7", label: "REV" },
  LOYALTY: { color: "#059669", bg: "#ECFDF5", label: "PTS" },
  CREDIT: { color: "#10B981", bg: "#D1FAE5", label: "৳" },
  STAFF: { color: "#64748B", bg: "#F1F5F9", label: "LOG" },
};

export function CustomerActivityTimeline({ items }: { items: CustomerActivityItem[] }) {
  if (items.length === 0) {
    return <p className="muted" style={{ padding: "12px 0" }}>No recorded activity yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item) => {
        const conf = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.STAFF;
        const content = (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              fontSize: 13.5,
              padding: "4px 0",
            }}
          >
            <div
              style={{
                width: 32,
                height: 24,
                borderRadius: 4,
                background: conf.bg,
                color: conf.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 32px",
                fontSize: 10,
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              {conf.label}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "var(--text, #1E293B)" }}>
                  {item.title}
                </span>
                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {friendlyDate(item.date)}
                </span>
              </div>
              {item.detail && (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2, wordBreak: "break-word" }}>
                  {item.detail}
                </div>
              )}
            </div>
          </div>
        );

        if (item.link) {
          return (
            <Link
              key={item.id}
              href={item.link}
              prefetch={false}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              {content}
            </Link>
          );
        }

        return content;
      })}
    </div>
  );
}
