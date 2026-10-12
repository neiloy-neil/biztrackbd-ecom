import type { StoreInfo } from "@biztrackbd/core";

type T = (key: never, vars?: Record<string, string | number>) => string;

/** A thin strip on every page while the owner has paused orders. Browsing still works; checkout shows the full notice. */
export function PausedBanner({ t }: { t: (k: "pausedBanner") => string }) {
  return <div className="paused-banner" role="status" data-testid="paused-banner">{t("pausedBanner")}</div>;
}

/** What checkout shows while orders are paused: the same "short break" page as an offline store, with ways to reach the owner. */
export function PausedCard({ info, t }: { info: StoreInfo; t: (k: "offlineTitle" | "offlineText" | "callUs" | "whatsapp" | "facebook", v?: Record<string, string | number>) => string }) {
  return (
    <div className="card paused-card" data-testid="paused-card" style={{ textAlign: "center", display: "grid", gap: 12, justifyItems: "center", padding: 28 }}>
      <h2 style={{ margin: 0 }}>{t("offlineTitle")}</h2>
      <p className="muted" style={{ maxWidth: 420, margin: 0 }}>{info.offlineMessage ?? t("offlineText")}</p>
      {info.contactPhone && <a className="btn btn-primary btn-round" href={`tel:${info.contactPhone}`}>{t("callUs", { phone: info.contactPhone })}</a>}
      {info.whatsappNumber && <a className="btn btn-ghost btn-round" href={`https://wa.me/88${info.whatsappNumber}`} rel="noopener noreferrer">{t("whatsapp")}</a>}
      {info.facebookUrl && <a className="btn btn-ghost btn-round" href={info.facebookUrl} rel="noopener noreferrer">{t("facebook")}</a>}
    </div>
  );
}

export type { T };
