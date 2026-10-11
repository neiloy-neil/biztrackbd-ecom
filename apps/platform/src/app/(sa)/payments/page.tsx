import type { Metadata } from "next";
import Link from "next/link";
import { canPlatform, listPayments } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { approveAction, rejectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Approvals" };

const TABS = [
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All payments" },
] as const;

function formatAge(date: Date): { text: string; isLate: boolean } {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const isLate = diffMins > 240; // 4 hours

  if (diffMins < 60) return { text: `${diffMins} min ago`, isLate };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { text: `${diffHours} hr ago`, isLate };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return { text: "Yesterday", isLate: true };
  return { text: `${diffDays} days ago`, isLate: true };
}

function providerColor(p: string): { bg: string; name: string } {
  const upper = p.toUpperCase();
  if (upper.includes("BKASH")) return { bg: "#E2136E", name: "bKash" };
  if (upper.includes("NAGAD")) return { bg: "#F6921E", name: "Nagad" };
  if (upper.includes("ROCKET")) return { bg: "#8C5A3C", name: "Rocket" };
  return { bg: "#1A1A4E", name: p };
}

export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("payments");
  const tabRaw = one(sp.tab) ?? "PENDING";
  const tab = (TABS.find((t) => t.id === tabRaw)?.id ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  const rows = await listPayments(s.actor, tab);
  const canEdit = canPlatform(s.user.role, "payments", "edit");
  const err = one(sp.err);
  const done = one(sp.done);

  const selectedId = one(sp.id) ?? rows[0]?.id;
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const pendingCount = tab === "PENDING" ? rows.length : (await listPayments(s.actor, "PENDING")).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, flexGrow: 1 }}>Payment approvals</h1>
        <div style={{ fontSize: 13.5, color: "#4B4B73" }}>Target: approve within 4 working hours</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #E7E7F0", overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/payments?tab=${t.id}`}
              style={{
                padding: "6px 0 12px",
                borderBottom: active ? "2.5px solid #5B4FE8" : "2.5px solid transparent",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                color: active ? "#1A1A4E" : "#6B6B8D",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
              prefetch={false}
            >
              <span>{t.label}</span>
              {t.id === "PENDING" && (
                <span
                  style={{
                    padding: "1px 8px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: active ? "#E9E7FD" : "#EFEFF6",
                    color: active ? "#5B4FE8" : "#4B4B73",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Flash Messages */}
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 4 }} data-testid="payment-error">{err}</div>}
      {done && (
        <div className="notice good" role="status" style={{ marginBottom: 4 }}>
          {done === "approved" ? "Payment approved. Plan activated." : "Payment rejected."}
        </div>
      )}

      {/* Master-Detail 2-Pane Desk */}
      {rows.length === 0 ? (
        <div className="card empty" style={{ padding: 40, textAlign: "center", color: "#6B6B8D" }} data-testid="payments-empty">
          {tab === "PENDING" ? "No payments waiting for approval. Queue is clear." : "No payments match this status."}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          {/* Left Pane (Payment Queue) */}
          <div
            style={{
              flex: "1 1 380px",
              minWidth: 0,
              background: "#fff",
              border: "1px solid #E7E7F0",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {rows.map((p) => {
              const prov = providerColor(p.provider);
              const isSel = p.id === selected?.id;
              const age = formatAge(p.createdAt);

              return (
                <Link
                  key={p.id}
                  href={`/payments?tab=${tab}&id=${p.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 20px",
                    height: 72,
                    borderBottom: "1px solid #F0F0F6",
                    background: isSel ? "#F4F3FF" : "#fff",
                    borderLeft: isSel ? "3px solid #5B4FE8" : "3px solid transparent",
                    textDecoration: "none",
                    color: "#1A1A4E",
                  }}
                  prefetch={false}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      background: prov.bg,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {prov.name}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.storeName}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#4B4B73", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.plan} · {p.trxId}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {taka(p.amount)}
                    </div>
                    <div style={{ fontSize: 12, color: age.isLate ? "#DC2626" : "#6B6B8D", fontWeight: 600 }}>
                      {age.text}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right Pane (Payment Detail & Verification Desk) */}
          {selected && (
            <div
              style={{
                flex: "1.3 1 480px",
                minWidth: 0,
                background: "#fff",
                border: "1px solid #E7E7F0",
                borderRadius: 12,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
              data-testid="payment-card"
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    <Link href={`/tenants/${selected.tenantId}`} style={{ color: "#1A1A4E", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 40 }} prefetch={false}>
                      {selected.storeName}
                    </Link>
                  </div>
                  <div style={{ fontSize: 13, color: "#4B4B73", marginTop: 2 }}>
                    {selected.plan} plan ({selected.interval.toLowerCase()}) · Submitted {dateTime(selected.createdAt)} · {selected.subdomain}
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 11px",
                    borderRadius: 11,
                    background: selected.status === "PENDING" ? "#FDF3E3" : selected.status === "APPROVED" ? "#E8F6EE" : "#FCEBEB",
                    color: selected.status === "PENDING" ? "#B45309" : selected.status === "APPROVED" ? "#15803D" : "#DC2626",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {selected.status === "PENDING" ? "Waiting" : selected.status}
                </span>
              </div>

              {/* 3 Metric Summary Boxes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <div style={{ background: "#FAFAFC", border: "1px solid #E7E7F0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6B6B8D", fontWeight: 600 }}>Amount claimed</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }} data-testid="amount">
                    {taka(selected.amount)}
                  </div>
                </div>
                <div style={{ background: "#FAFAFC", border: "1px solid #E7E7F0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6B6B8D", fontWeight: 600 }}>Method</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                    {providerColor(selected.provider).name}
                  </div>
                </div>
                <div style={{ background: "#FAFAFC", border: "1px solid #E7E7F0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6B6B8D", fontWeight: 600 }}>TrxID</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="trx">
                    {selected.trxId}
                  </div>
                </div>
              </div>

              {/* Screenshot & Verification Checklist */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                {/* Visual Screenshot Simulation */}
                <div style={{ flex: "1 1 220px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Payment receipt</div>
                  <div
                    style={{
                      height: 220,
                      borderRadius: 12,
                      background: selected.provider === "NAGAD" ? "#FFF8F2" : "#FFF5FA",
                      border: "1px solid #E7E7F0",
                      padding: 18,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontSize: 12, color: selected.provider === "NAGAD" ? "#8F3C06" : "#8A1038", fontWeight: 800 }}>
                      {providerColor(selected.provider).name}
                    </div>
                    <div style={{ fontSize: 12, color: "#4B4B73", marginTop: 8 }}>Send Money successful</div>
                    <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>
                      {taka(selected.amount)}.00
                    </div>
                    <div style={{ fontSize: 11.5, color: "#4B4B73", lineHeight: 1.7 }}>
                      Sender: {prettyPhone(selected.senderNumber)}<br />
                      TrxID: <code>{selected.trxId}</code><br />
                      {dateTime(selected.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Verification Checklist */}
                <div style={{ flex: "1 1 220px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Verification checklist</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: "#E8F6EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </div>
                      <span>Amount equals plan price</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: "#E8F6EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </div>
                      <span>TrxID not used before</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: "#FDF3E3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#B45309", fontSize: 13 }}>
                        !
                      </div>
                      <span>Confirm TrxID in merchant portal</span>
                    </div>
                  </div>

                  {selected.senderSeenOnOtherStores > 0 && (
                    <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: "#FDF3E3", color: "#B45309", fontSize: 12, lineHeight: 1.4 }}>
                      ⚠️ Sender number seen on {selected.senderSeenOnOtherStores} other {selected.senderSeenOnOtherStores === 1 ? "store" : "stores"}.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Form */}
              {canEdit && selected.status === "PENDING" && (
                <form style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }} htmlFor="reason">
                      Note to tenant (optional / rejection reason)
                    </label>
                    <input
                      id="reason"
                      name="reason"
                      placeholder="e.g. TrxID not found in bKash merchant account"
                      style={{
                        height: 40,
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #D5D5E4",
                        borderRadius: 8,
                        padding: "0 12px",
                        fontSize: 14,
                        color: "#1A1A4E",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <SubmitButton
                      formAction={approveAction.bind(null, selected.id)}
                      style={{
                        height: 44,
                        padding: "0 24px",
                        borderRadius: 8,
                        background: "#15803D",
                        color: "#fff",
                        fontSize: 14.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      pending="Approving…"
                    >
                      Approve and activate {selected.plan}
                    </SubmitButton>

                    <SubmitButton
                      formAction={rejectAction.bind(null, selected.id)}
                      style={{
                        height: 44,
                        padding: "0 20px",
                        border: "1px solid #F1C0C0",
                        borderRadius: 8,
                        color: "#DC2626",
                        background: "#fff",
                        fontSize: 14.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      pending="Rejecting…"
                    >
                      Reject
                    </SubmitButton>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
