import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import { getActiveThemeId } from "@biztrackbd/core";
import { getLang } from "@/lib/i18n";
import { findStore } from "@/lib/tenant";
import "./kapor.css";
import "./themes.css";

// Self-hosted by Next at build time: no request to Google when a customer opens the store.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const metadata: Metadata = { title: "BizTrackBD" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FBF8F3" };

/** Shell only. The store header lives in (store)/layout.tsx so marketing, offline and unknown-host pages stay separate. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await findStore();
  const [lang, themeId] = await Promise.all([getLang(store?.locale ?? "en"), store ? getActiveThemeId(store.id) : Promise.resolve("kapor" as const)]);
  return (
    <html lang={lang} className={`${jakarta.variable} ${hind.variable}`}>
      <body data-store-theme={themeId}>{children}</body>
    </html>
  );
}
