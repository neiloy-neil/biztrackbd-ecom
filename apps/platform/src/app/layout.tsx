import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import "./platform.css";
import "@biztrackbd/ui/kit.css";
import { DoubleSubmitGuard } from "@biztrackbd/ui";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const metadata: Metadata = { title: { default: "BizTrackBD Platform", template: "%s | Platform" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A4E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${hind.variable}`}>
      <body>
        <DoubleSubmitGuard />
        {children}
      </body>
    </html>
  );
}
