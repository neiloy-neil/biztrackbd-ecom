"use client";

import { useEffect, useRef } from "react";
import { trackPlatformEvent } from "@/components/platform-tracker";

export function SignupDoneTracker({
  eventId,
  plan,
  storeName,
}: {
  eventId?: string;
  plan?: string;
  storeName?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    trackPlatformEvent(
      "CompleteRegistration",
      {
        plan: plan || "PRO",
        store_name: storeName,
      },
      { eventId }
    );
  }, [eventId, plan, storeName]);

  return null;
}
