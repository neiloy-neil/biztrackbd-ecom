import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import "./platform.css";
import "@biztrackbd/ui/kit.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

import { getPlatformSiteVerificationCode } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const googleVerification = await getPlatformSiteVerificationCode();
  return {
    title: { default: "BizTrackBD Platform", template: "%s | Platform" },
    robots: { index: false, follow: false },
    verification: googleVerification ? { google: googleVerification } : undefined,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1A4E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const googleVerification = await getPlatformSiteVerificationCode();
  return (
    <html lang="en" className={`${jakarta.variable} ${hind.variable}`}>
      <head>
        {googleVerification && <meta name="google-site-verification" content={googleVerification} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
