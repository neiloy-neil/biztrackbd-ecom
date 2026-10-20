"use client";

import { useEffect, useState } from "react";

export interface AnnouncementItem {
  id: string;
  title: string;
  titleBn: string | null;
  body: string;
  bodyBn: string | null;
}

interface BannerProps {
  announcements: AnnouncementItem[];
  lang: "en" | "bn";
}

const STORAGE_KEY = "biztrack_dismissed_announcements";

export function AnnouncementBanner({ announcements, lang }: BannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDismissed(new Set(JSON.parse(saved)));
      }
    } catch {
      // Ignore localStorage errors
    }
    setMounted(true);
  }, []);

  const handleDismiss = (id: string) => {
    const updated = new Set(dismissed);
    updated.add(id);
    setDismissed(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...updated]));
    } catch {
      // Ignore localStorage errors
    }
  };

  if (!mounted || !announcements || announcements.length === 0) return null;

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
      {visible.map((a) => {
        const title = (lang === "bn" && a.titleBn) ? a.titleBn : a.title;
        const body = (lang === "bn" && a.bodyBn) ? a.bodyBn : a.body;

        return (
          <div
            key={a.id}
            role="status"
            style={{
              background: "#FDF3E3",
              border: "1px solid #F0DDB8",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B45309"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flex: "0 0 18px", marginTop: 2 }}
            >
              <path d="M4 10v4h3l8 4V6L7 10H4zM18 9a4 4 0 010 6" />
            </svg>

            <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 13, lineHeight: 1.5, color: "#4B4B73" }}>
              <b style={{ color: "#B45309", display: "block", marginBottom: 2 }}>{title}</b>
              <div>{body}</div>
            </div>

            <button
              type="button"
              onClick={() => handleDismiss(a.id)}
              aria-label="Dismiss announcement"
              style={{
                background: "none",
                border: "none",
                padding: "2px 6px",
                cursor: "pointer",
                color: "#B45309",
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
