import Link from "next/link";
import { setModuleAction } from "@/app/(admin)/settings/apps/actions";

interface Props {
  appName: string;
  appKey: string;
  planTier: string;
  minPlan?: string;
  description: string;
}

export function AppDisabledNotice({
  appName,
  appKey,
  planTier,
  minPlan = "PRO",
  description,
}: Props) {
  const isPlanLocked = planTier === "STARTER";

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "48px auto",
        padding: "36px 32px",
        borderRadius: 16,
        background: "var(--card, #ffffff)",
        border: "1px solid var(--border, #e5e7eb)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: isPlanLocked ? "rgba(239, 68, 68, 0.1)" : "rgba(91, 79, 232, 0.1)",
          color: isPlanLocked ? "#EF4444" : "#5B4FE8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          margin: "0 auto 20px",
        }}
      >
        {isPlanLocked ? "🔒" : "⚡"}
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>
        {isPlanLocked ? `Upgrade to ${minPlan} to Access ${appName}` : `${appName} is Currently Turned Off`}
      </h1>

      <p
        className="muted"
        style={{
          fontSize: 14.5,
          lineHeight: 1.6,
          maxWidth: 520,
          margin: "0 auto 24px",
          color: "var(--ink-2, #6B7280)",
        }}
      >
        {isPlanLocked
          ? `${appName} is an advanced feature included in the ${minPlan} and Business plans. ${description}`
          : `Your store plan includes ${appName}, but this module is currently disabled. Toggle it on to activate all terminal tools and sidebar navigation.`}
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        {isPlanLocked ? (
          <>
            <Link
              href="/billing"
              className="btn btn-primary"
              style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
            >
              Upgrade to {minPlan} Plan →
            </Link>
            <Link
              href="/settings/apps"
              className="btn btn-secondary"
              style={{ padding: "10px 20px", fontSize: 14 }}
            >
              Explore Apps & Integrations
            </Link>
          </>
        ) : (
          <>
            <form action={setModuleAction.bind(null, appKey, true)}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
              >
                Enable {appName} Now
              </button>
            </form>
            <Link
              href="/settings/apps"
              className="btn btn-secondary"
              style={{ padding: "10px 20px", fontSize: 14 }}
            >
              Manage in Apps Store
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
