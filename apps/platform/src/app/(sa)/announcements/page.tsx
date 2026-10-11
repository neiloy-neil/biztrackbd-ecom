import type { Metadata } from "next";
import { getPlatformPrisma } from "@biztrackbd/db";
import { listAnnouncements } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AnnouncementComposeForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireAccess("announcements");
  const sp = await searchParams;
  const db = getPlatformPrisma();

  const totalStores = await db.tenant.count({ where: { isDemo: false, status: { not: "SUSPENDED" } } });
  const announcements = await listAnnouncements(s.actor);

  const saved = sp.saved === "1";
  const err = typeof sp.err === "string" ? sp.err : null;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <h1>Announcements</h1>
      </div>

      {saved && (
        <div className="notice good" role="status" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--success-bg)", color: "var(--success)", fontWeight: 600 }}>
          Announcement published successfully.
        </div>
      )}

      {err && (
        <div className="notice bad" role="alert" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--danger-bg)", color: "var(--danger)", fontWeight: 600 }}>
          {err}
        </div>
      )}

      <AnnouncementComposeForm totalStores={totalStores} />

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 8 }}>
        <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Past announcements
        </div>

        {announcements.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
            No past announcements yet.
          </div>
        ) : (
          announcements.map((a) => {
            const isLive = a.status === "LIVE";
            const isEnded = a.status === "ENDED";
            const dateStr = a.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            const audienceLabel =
              a.audience.type === "ALL"
                ? "All stores"
                : a.audience.type === "PLAN"
                ? `${a.audience.value} plan`
                : a.audience.type === "INTEGRATION"
                ? `Stores with ${a.audience.value}`
                : "Single store";

            return (
              <div
                key={a.id}
                style={{
                  padding: "14px 22px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <b style={{ flex: 1, fontSize: 14 }}>{a.title}</b>
                  <span
                    style={{
                      padding: "2px 9px",
                      borderRadius: 10,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: isLive ? "var(--success-bg)" : "var(--bg)",
                      color: isLive ? "var(--success)" : "var(--ink-3)",
                    }}
                  >
                    {isLive ? "Live" : isEnded ? "Ended" : "Scheduled"}
                  </span>
                </div>
                {a.titleBn && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{a.titleBn}</div>}
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
                  {dateStr} · {audienceLabel} · {a.reachEstimate} stores targeted
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
