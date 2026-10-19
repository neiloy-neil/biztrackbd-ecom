"use server";

import { getRealtimeStudioMetrics, type RealtimeStudioPayload } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface FetchRealtimeResult {
  ok: boolean;
  error?: string;
  data?: RealtimeStudioPayload;
}

export async function fetchRealtimeMetricsAction(): Promise<FetchRealtimeResult> {
  try {
    const s = await requireAction("reports", "view");
    const data = await getRealtimeStudioMetrics(s.tenantId, s.actor);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to load real-time metrics." };
  }
}
