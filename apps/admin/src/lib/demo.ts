import { maybeDropDemoOrder } from "@biztrackbd/core";
import type { AdminSession } from "@/lib/session";

/** Where "Start your free trial" goes from the demo. */
export const trialHref = () => `${process.env.NEXT_PUBLIC_MARKETING_URL || "https://biztrack.bd"}/start?from=demo`;

/** In a visitor's demo copy, a new sample order may arrive each time the dashboard or orders list is opened. Does nothing anywhere else. */
export async function demoTick(s: AdminSession): Promise<void> {
  if (s.demo) await maybeDropDemoOrder(s.tenantId);
}
