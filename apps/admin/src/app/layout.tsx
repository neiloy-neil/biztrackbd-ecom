import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Baloo_Da_2, Hind_Siliguri } from "next/font/google";
import "@biztrackbd/ui/tokens.css";
import "@biztrackbd/ui/brand.css";
import "./admin.css";
import "@biztrackbd/ui/kit.css";
import "./shell.css";
import "./(admin)/menu/menu.css";
import { DoubleSubmitGuard } from "@biztrackbd/ui";
import { SpeedInsights } from "@vercel/speed-insights/next";

const baloo = Baloo_Da_2({ subsets: ["bengali", "latin"], weight: ["800"], variable: "--font-baloo", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const preferredRegion = ["bom1"];
export const metadata: Metadata = {
  title: { default: "BizTrackBD Admin", template: "%s | BizTrackBD" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "BizTrack", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0B4D3B" }, { media: "(prefers-color-scheme: dark)", color: "#0A1713" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // "light" or "dark" is the owner's choice; anything else follows the device.
  const choice = (await cookies()).get("bt_theme")?.value;
  return (
    <html lang={(await cookies()).get("bt_lang")?.value === "bn" ? "bn" : "en"} className={`${baloo.variable} ${hind.variable}`} data-theme={choice === "light" || choice === "dark" ? choice : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <DoubleSubmitGuard />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
