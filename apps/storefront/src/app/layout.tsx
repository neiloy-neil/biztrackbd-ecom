import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Noto_Serif_Bengali, Playfair_Display, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { getActiveThemeId } from "@biztrackbd/core";
import { getLang } from "@/lib/i18n";
import { findStore } from "@/lib/tenant";
import "./kapor.css";
import "./themes.css";

// Self-hosted by Next at build time: no request to Google when a customer opens the store.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });
// The fonts of the other font pairs a merchant can choose (docs/47 part B). Not preloaded: a store's page fetches one only when its pair uses it.
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-playfair", display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap", preload: false });
const notoSerifBn = Noto_Serif_Bengali({ subsets: ["bengali", "latin"], weight: ["500", "600", "700"], variable: "--font-notoserifbn", display: "swap", preload: false });

export const metadata: Metadata = { title: "BizTrackBD" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FBF8F3" };

/** Shell only. The store header lives in (store)/layout.tsx so marketing, offline and unknown-host pages stay separate. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await findStore();
  const [lang, themeId] = await Promise.all([getLang(store?.locale ?? "en"), store ? getActiveThemeId(store.id) : Promise.resolve("kapor" as const)]);
  return (
    <html lang={lang} className={`${jakarta.variable} ${hind.variable} ${playfair.variable} ${poppins.variable} ${notoSerifBn.variable}`}>
      <body data-store-theme={themeId}>{children}</body>
    </html>
  );
}
