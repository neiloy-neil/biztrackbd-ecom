import { ImageResponse } from "next/og";
import { getLiveTheme, getStoreInfo } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Black or white, whichever reads on this colour (WCAG relative luminance). */
function inkOn(hex: string): string {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "8C5A3C";
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1A1A1A" : "#FFFFFF";
}

/**
 * The favicon of the store being asked: the first letter of its name on its accent colour. A store that has uploaded a logo is given that logo by
 * the store layout instead (generateMetadata), so this is the fallback. Without a store (the marketing and unknown-host pages this app also serves)
 * it is the BizTrackBD tile. The default font has no Bangla glyphs, so a name that does not start with a Latin letter gets a plain shop mark.
 */
export default async function Icon() {
  const store = await findStore();
  if (!store) {
    return new ImageResponse(
      (
        <svg width="64" height="64" viewBox="0 0 1440 1440">
          <rect width="1440" height="1440" rx="330" fill="#0B4D3B" />
          <g transform="translate(14 8)">
            <rect x="472" y="527" width="124" height="495" rx="26" fill="#FFFFFF" />
            <path fill="#FFFFFF" fillRule="evenodd" d="M789 596a233 233 0 1 0 0 466a233 233 0 1 0 0-466zM789 719a110 110 0 1 1 0 220a110 110 0 1 1 0-220z" />
            <path fill="#F2A900" d="M534 362L678 527H390z" />
          </g>
        </svg>
      ),
      size,
    );
  }
  const [info, theme] = await Promise.all([getStoreInfo(store.id).catch(() => null), getLiveTheme(store.id).catch(() => null)]);
  const accent = theme?.accent && /^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : "#8C5A3C";
  const ink = inkOn(accent);
  const initial = (info?.storeName ?? "").trim().charAt(0).toUpperCase();
  const latin = /^[A-Z0-9]$/.test(initial);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: accent, borderRadius: 14, color: ink, fontSize: 42, fontWeight: 800 }}>
        {latin ? (
          initial
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        )}
      </div>
    ),
    size,
  );
}
