import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import "./admin.css";
import "@biztrackbd/ui/kit.css";
import "./shell.css";
import "./(admin)/menu/menu.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BizTrackBD Admin", template: "%s | BizTrackBD" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "BizTrack", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#5B4FE8" }, { media: "(prefers-color-scheme: dark)", color: "#0F0F2A" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // "light" or "dark" is the owner's choice; anything else follows the device.
  const choice = (await cookies()).get("bt_theme")?.value;
  return (
    <html lang={(await cookies()).get("bt_lang")?.value === "bn" ? "bn" : "en"} className={`${jakarta.variable} ${hind.variable}`} data-theme={choice === "light" || choice === "dark" ? choice : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
