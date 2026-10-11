import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./marketing.css";
import "./site.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002"),
  title: { default: "BizTrackBD: your online store, ready in minutes", template: "%s | BizTrackBD" },
  description: "Start an online store for your Bangladesh business. Cash on delivery, bKash and Nagad, courier booking and COD payout checks, and real profit. Free for 14 days.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5B4FE8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} ${hind.variable}`}>
      <body>
        <header className="site-head">
          <div className="wrap row-between">
            <Link href="/" className="brand" prefetch={false}><span className="logo-mark" aria-hidden="true">B</span> BizTrackBD</Link>
            <nav aria-label="Main" className="site-nav">
              <Link href="/templates" prefetch={false}>Templates</Link>
              <Link href="/pricing" prefetch={false}>Pricing</Link>
              <Link href="/start" className="btn btn-primary btn-sm" prefetch={false}>Start free</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            <div className="row-between" style={{ alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
              <div><b>BizTrackBD</b><p className="muted" style={{ marginTop: 6, maxWidth: 320 }}>Online stores for Bangladeshi businesses. Your customers pay you directly. We never hold your money.</p></div>
              <nav aria-label="Footer" className="foot-links">
                <Link href="/templates" prefetch={false}>Templates</Link>
                <Link href="/pricing" prefetch={false}>Pricing</Link>
                <Link href="/start" prefetch={false}>Start free</Link>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
