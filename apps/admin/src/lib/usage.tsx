import type { MeterUsage } from "@biztrackbd/core";

const COLOR: Record<string, string> = {
  ok: "var(--brand)", warning: "var(--warning)", at_limit: "var(--danger)", over: "var(--warning)", exceeded: "var(--danger)", unlimited: "var(--success)",
};

export function Meter({ label, usage }: { label: string; usage: MeterUsage }) {
  const pct = Math.min(usage.percent ?? 0, 100);
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span className="muted">{usage.limit == null ? `${usage.used} used, no limit` : `${usage.used} of ${usage.limit}`}</span>
      </div>
      {usage.limit != null && (
        <div style={{ height: 8, background: "var(--tint)", borderRadius: 99, marginTop: 6 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div style={{ width: `${pct}%`, height: 8, borderRadius: 99, background: COLOR[usage.state] }} />
        </div>
      )}
    </div>
  );
}

/** The sentence under a meter, or null when nothing needs saying. Wording follows docs/07 section 21. */
export function limitNote(kind: "products" | "orders", u: MeterUsage): string | null {
  if (kind === "products") {
    if (u.state === "at_limit") return `You have reached your plan's ${u.limit} products. Upgrade to add more.`;
    if (u.state === "warning") return `You have used ${u.percent}% of your product limit.`;
    return null;
  }
  if (u.state === "warning") return `You have used ${u.percent}% of this month's orders. Customers can keep ordering.`;
  if (u.state === "over") return "You are over this month's order limit. Customers can keep ordering, but upgrade soon.";
  if (u.state === "exceeded") return `You are well over this month's limit (grace ends at ${u.graceLimit}). Orders still go through. Upgrade to stay on plan.`;
  return null;
}
