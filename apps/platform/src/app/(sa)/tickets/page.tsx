import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformTicketDetail, listPlatformTickets, type TicketStatusType } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { TicketReplyBox } from "./reply-box";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support tickets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireAccess("tickets");
  const sp = await searchParams;

  const currentTab = typeof sp.tab === "string" ? sp.tab : "open";
  let statusFilter: TicketStatusType | "MINE" | undefined = undefined;
  if (currentTab === "open") statusFilter = "OPEN";
  else if (currentTab === "waiting") statusFilter = "WAITING_ON_TENANT";
  else if (currentTab === "solved") statusFilter = "SOLVED";
  else if (currentTab === "mine") statusFilter = "MINE";

  const allTickets = await listPlatformTickets(s.actor);
  const openCount = allTickets.filter((t) => t.status === "OPEN").length;
  const filteredTickets = allTickets.filter((t) => {
    if (currentTab === "open") return t.status === "OPEN";
    if (currentTab === "waiting") return t.status === "WAITING_ON_TENANT";
    if (currentTab === "solved") return t.status === "SOLVED";
    if (currentTab === "mine") return t.assigneeId === s.user.id;
    return true;
  });

  const selectedId = typeof sp.id === "string" ? sp.id : filteredTickets[0]?.id;
  const activeTicket = selectedId ? await getPlatformTicketDetail(s.actor, selectedId).catch(() => null) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Support tickets</h1>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>Median first reply today: 38 min</div>
      </div>

      <div
        className="card"
        style={{
          padding: 0,
          borderRadius: 12,
          overflow: "hidden",
          minHeight: 760,
          display: "flex",
          flexWrap: "wrap",
        }}
      >
        {/* Left Pane: Ticket Queue */}
        <div
          style={{
            flex: "0 0 380px",
            borderRight: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/tickets?tab=open"
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                background: currentTab === "open" ? "var(--brand)" : "transparent",
                color: currentTab === "open" ? "#fff" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: currentTab === "open" ? 700 : 600,
                border: currentTab === "open" ? "none" : "1px solid var(--line)",
              }}
            >
              Open {openCount}
            </Link>
            <Link
              href="/tickets?tab=mine"
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                background: currentTab === "mine" ? "var(--brand)" : "transparent",
                color: currentTab === "mine" ? "#fff" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: currentTab === "mine" ? 700 : 600,
                border: currentTab === "mine" ? "none" : "1px solid var(--line)",
              }}
            >
              Mine
            </Link>
            <Link
              href="/tickets?tab=waiting"
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                background: currentTab === "waiting" ? "var(--brand)" : "transparent",
                color: currentTab === "waiting" ? "#fff" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: currentTab === "waiting" ? 700 : 600,
                border: currentTab === "waiting" ? "none" : "1px solid var(--line)",
              }}
            >
              Waiting on tenant
            </Link>
            <Link
              href="/tickets?tab=solved"
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                background: currentTab === "solved" ? "var(--brand)" : "transparent",
                color: currentTab === "solved" ? "#fff" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: currentTab === "solved" ? 700 : 600,
                border: currentTab === "solved" ? "none" : "1px solid var(--line)",
              }}
            >
              Solved
            </Link>
          </div>

          {/* Cards List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredTickets.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                No tickets in this tab.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedId;
                const pColor = t.priority === "HIGH" ? "#DC2626" : "#4B4B73";
                const pBg = t.priority === "HIGH" ? "#FCEBEB" : "#EFEFF6";
                const dateStr = t.lastMessageAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                return (
                  <Link
                    key={t.id}
                    href={`/tickets?tab=${currentTab}&id=${t.id}`}
                    style={{
                      display: "block",
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--line)",
                      background: isSelected ? "#F4F3FF" : "#fff",
                      borderLeft: isSelected ? "3px solid #5B4FE8" : "3px solid transparent",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, flexGrow: 1, color: "var(--ink)" }}>{t.storeName}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{dateStr}</div>
                    </div>
                    <div style={{ fontSize: 13.5, marginTop: 4, fontWeight: isSelected ? 700 : 500, color: "var(--ink)" }}>
                      {t.subject}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 11.5, fontWeight: 600, background: pBg, color: pColor }}>
                        {t.priority}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {t.code} {t.ownerName ? `· ${t.ownerName}` : ""}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Ticket Conversation */}
        <div style={{ flex: "1 1 500px", minWidth: 0, display: "flex", flexDirection: "column", background: "#fff" }}>
          {!activeTicket ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", padding: 40 }}>
              Select a ticket on the left to view the thread.
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 280px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{activeTicket.subject}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3 }}>
                    {activeTicket.storeName} · {activeTicket.planTier} · {activeTicket.code} · Opened {activeTicket.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <span
                  style={{
                    padding: "3px 11px",
                    borderRadius: 11,
                    background: activeTicket.priority === "HIGH" ? "#FCEBEB" : "#EFEFF6",
                    color: activeTicket.priority === "HIGH" ? "#DC2626" : "#4B4B73",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {activeTicket.priority}
                </span>

                <Link
                  href={`/tenants/${activeTicket.tenantId}`}
                  className="btn btn-secondary btn-sm"
                  style={{ height: 36, padding: "0 14px", fontWeight: 600 }}
                >
                  Open tenant
                </Link>
              </div>

              {/* Message Feed */}
              <div
                style={{
                  flex: 1,
                  padding: "22px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  background: "var(--bg)",
                  overflowY: "auto",
                }}
              >
                {activeTicket.messages.map((m) => {
                  const timeStr = m.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                  if (m.authorType === "SYSTEM") {
                    return (
                      <div key={m.id} style={{ display: "flex", gap: 12 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            background: "#F0F0F6",
                            color: "var(--ink-2)",
                            fontWeight: 700,
                            fontSize: 11,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: "0 0 34px",
                          }}
                        >
                          SYS
                        </div>
                        <div
                          style={{
                            background: "#FDF3E3",
                            border: "1px solid #F0DDB8",
                            borderRadius: 10,
                            padding: "12px 14px",
                            maxWidth: 540,
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: "var(--ink-2)",
                          }}
                        >
                          <b style={{ color: "#B45309" }}>System Diagnostics</b>
                          <div>{m.body}</div>
                        </div>
                      </div>
                    );
                  }

                  if (m.isInternal) {
                    return (
                      <div key={m.id} style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <div
                          style={{
                            background: "#FFFBEB",
                            border: "1px solid #FCD34D",
                            borderRadius: 8,
                            padding: "10px 14px",
                            maxWidth: 600,
                            width: "100%",
                            fontSize: 13,
                            color: "#92400E",
                          }}
                        >
                          <b>Internal Note ({m.authorName} · {timeStr}):</b> {m.body}
                        </div>
                      </div>
                    );
                  }

                  if (m.authorType === "PLATFORM") {
                    return (
                      <div key={m.id} style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <div
                          style={{
                            background: "#F4F3FF",
                            border: "1px solid #D9D5FA",
                            borderRadius: "14px 4px 14px 14px",
                            padding: "14px 16px",
                            maxWidth: 520,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
                            <b style={{ color: "var(--ink)" }}>{m.authorName}</b> · {timeStr}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.65 }}>{m.body}</div>
                        </div>
                      </div>
                    );
                  }

                  // Merchant message
                  const initials = m.authorName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "MC";
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 12 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          background: "#E9E7FD",
                          color: "var(--brand)",
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 34px",
                        }}
                      >
                        {initials}
                      </div>
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid var(--line)",
                          borderRadius: "4px 14px 14px 14px",
                          padding: "14px 16px",
                          maxWidth: 520,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
                          <b style={{ color: "var(--ink)" }}>{m.authorName}</b> · {timeStr}
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.65 }}>{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Component */}
              <TicketReplyBox ticketId={activeTicket.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
