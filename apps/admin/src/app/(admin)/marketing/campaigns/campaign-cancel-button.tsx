"use client";

import { useTransition } from "react";
import { cancelCampaignAction } from "./actions";

export function CampaignCancelButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel this scheduled campaign?")) return;
    startTransition(async () => {
      const res = await cancelCampaignAction(campaignId);
      if (!res.success) {
        alert(res.error || "Failed to cancel campaign");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="btn btn-sm btn-danger"
      title="Cancel scheduled broadcast"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
