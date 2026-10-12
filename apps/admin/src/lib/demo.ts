import { maybeDropDemoOrder } from "@biztrackbd/core";
import type { AdminSession } from "@/lib/session";

/** Where "Keep this store" goes from the demo: the signup, carrying this demo's secret code so its products and design come along. */
export const trialHref = (keep?: string | null) => `${process.env.NEXT_PUBLIC_MARKETING_URL || "https://biztrack.bd"}/start${keep ? `?from=${encodeURIComponent(keep)}` : ""}`;

/** In a visitor's demo copy, a new sample order may arrive each time the dashboard or orders list is opened. Does nothing anywhere else. */
export async function demoTick(s: AdminSession): Promise<void> {
  if (s.demo) await maybeDropDemoOrder(s.tenantId);
}
