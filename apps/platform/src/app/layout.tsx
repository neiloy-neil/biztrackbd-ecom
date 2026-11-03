import type { Metadata, Viewport } from "next";
import { Baloo_Da_2, Hind_Siliguri } from "next/font/google";
import "@biztrackbd/ui/tokens.css";
import "@biztrackbd/ui/brand.css";
import "./platform.css";
import "@biztrackbd/ui/kit.css";
import { DoubleSubmitGuard } from "@biztrackbd/ui";
import { PostHogProvider } from "@/components/posthog-provider";
import { NativeAnalyticsTracker } from "@/components/native-analytics-tracker";
import { SpeedInsights } from "@vercel/speed-insights/next";

const baloo = Baloo_Da_2({ subsets: ["bengali", "latin"], weight: ["800"], variable: "--font-baloo", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

export const metadata: Metadata = { title: { default: "BizTrackBD Platform", template: "%s | Platform" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B4D3B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${baloo.variable} ${hind.variable}`}>
      <body>
        <PostHogProvider>
          <DoubleSubmitGuard />
          <NativeAnalyticsTracker />
          <SpeedInsights />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
