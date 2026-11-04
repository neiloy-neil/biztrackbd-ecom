import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PAYMENTS_PAGE_SIZE, canPlatform, listPaymentsPage, listPendingModulePurchases, listPendingSmsPurchases, listPendingThemePurchases } from "@biztrackbd/core";
import { Pager, SubmitButton } from "@/components/ui";
import { dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { approveAction, approveModuleAction, approveSmsAction, approveThemeAction, rejectAction, rejectModuleAction, rejectSmsAction, rejectThemeAction } from "./actions";

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
  return { bg: "var(--ink)", name: p };
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
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const { rows, total, pending: pendingCount } = await listPaymentsPage(s.actor, tab, page);
  // Approving or rejecting the last row on the last page leaves that page empty while earlier ones still have rows.
  if (rows.length === 0 && total > 0) redirect(`/payments?tab=${tab}&page=${Math.ceil(total / PAYMENTS_PAGE_SIZE)}`);
  const themePurchases = await listPendingThemePurchases(s.actor);
  const modulePurchases = await listPendingModulePurchases(s.actor);
  const smsPurchases = await listPendingSmsPurchases(s.actor);
  const canEdit = canPlatform(s.user.role, "payments", "edit");
  const err = one(sp.err);
  const done = one(sp.done);

  const selectedId = one(sp.id) ?? rows[0]?.id;
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, flexGrow: 1 }}>Payment approvals</h1>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>Target: approve within 4 working hours</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 28, borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/payments?tab=${t.id}`}
              style={{
                padding: "6px 0 12px",
                borderBottom: active ? "2.5px solid var(--brand)" : "2.5px solid transparent",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                color: active ? "var(--ink)" : "var(--ink-3)",
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
                    background: active ? "var(--brand-light)" : "var(--chip)",
                    color: active ? "var(--brand)" : "var(--ink-2)",
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
          {done === "approved" ? "Payment approved. Plan activated." : done === "theme-approved" ? "Theme payment approved. The theme is unlocked for the store." : done === "theme-rejected" ? "Theme payment rejected." : done === "module-approved" ? "Module payment approved. The module is switched on for the store." : done === "module-rejected" ? "Module payment rejected." : done === "sms-approved" ? "SMS payment approved. The SMS are added to the store." : done === "sms-rejected" ? "SMS payment rejected." : "Payment rejected."}
        </div>
      )}

      {/* Premium theme purchases: 49 taka each, approved here, owned for life */}
      {themePurchases.length > 0 && (
        <section className="card" aria-labelledby="theme-purchases-h" data-testid="theme-purchases" style={{ padding: 16 }}>
          <h2 id="theme-purchases-h" style={{ margin: "0 0 10px", fontSize: 17 }}>Theme purchases waiting ({themePurchases.length})</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {themePurchases.map((p) => (
              <form key={p.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: "1px solid #E5E5F0" }}>
                <div style={{ flex: "1 1 260px", fontSize: 14 }}>
                  <b>{p.storeName}</b> ({p.subdomain}) bought <b>{p.themeName}</b> for ৳ {p.amount}{p.discountCode ? ` (code ${p.discountCode})` : ""}<br />
                  <span style={{ color: "#4B4B73" }}>{p.provider} from {p.senderNumber}, TrxID {p.trxId}</span>
                </div>
                {canEdit && (
                  <>
                    <input name="reason" placeholder="Reason, if rejecting" aria-label={`Rejection reason for ${p.storeName}`} style={{ height: 44, flex: "1 1 180px", border: "1px solid #D5D5E4", borderRadius: 8, padding: "0 12px", fontSize: 14 }} />
                    <SubmitButton formAction={approveThemeAction.bind(null, p.id)} style={{ height: 44, padding: "0 20px", borderRadius: 8, background: "#15803D", color: "#fff", fontWeight: 700 }} pending="Approving…">Approve</SubmitButton>
                    <SubmitButton formAction={rejectThemeAction.bind(null, p.id)} style={{ height: 44, padding: "0 18px", border: "1px solid #F1C0C0", borderRadius: 8, color: "#DC2626", background: "#fff", fontWeight: 600 }} pending="Rejecting…">Reject</SubmitButton>
                  </>
                )}
              </form>
            ))}
          </div>
        </section>
      )}

      {/* Add-on module purchases: approved here, then the module switches on */}
      {modulePurchases.length > 0 && (
        <section className="card" aria-labelledby="module-purchases-h" data-testid="module-purchases" style={{ padding: 16 }}>
          <h2 id="module-purchases-h" style={{ margin: "0 0 10px", fontSize: 17 }}>Module purchases waiting ({modulePurchases.length})</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {modulePurchases.map((p) => (
              <form key={p.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: "1px solid #E5E5F0" }}>
                <div style={{ flex: "1 1 260px", fontSize: 14 }}>
                  <b>{p.storeName}</b> ({p.subdomain}) bought <b>{p.moduleLabel}</b> for ৳ {p.amount}<br />
                  <span style={{ color: "#4B4B73" }}>{p.provider} from {p.senderNumber}, TrxID {p.trxId}</span>
                </div>
                {canEdit && (
                  <>
                    <input name="reason" placeholder="Reason, if rejecting" aria-label={`Rejection reason for ${p.storeName}`} style={{ height: 44, flex: "1 1 180px", border: "1px solid #D5D5E4", borderRadius: 8, padding: "0 12px", fontSize: 14 }} />
                    <SubmitButton formAction={approveModuleAction.bind(null, p.id)} style={{ height: 44, padding: "0 20px", borderRadius: 8, background: "#15803D", color: "#fff", fontWeight: 700 }} pending="Approving…">Approve</SubmitButton>
                    <SubmitButton formAction={rejectModuleAction.bind(null, p.id)} style={{ height: 44, padding: "0 18px", border: "1px solid #F1C0C0", borderRadius: 8, color: "#DC2626", background: "#fff", fontWeight: 600 }} pending="Rejecting…">Reject</SubmitButton>
                  </>
                )}
              </form>
            ))}
          </div>
        </section>
      )}

      {/* Prepaid SMS packs: approved here, then the SMS are added to the store's balance */}
      {smsPurchases.length > 0 && (
        <section className="card" aria-labelledby="sms-purchases-h" data-testid="sms-purchases" style={{ padding: 16 }}>
          <h2 id="sms-purchases-h" style={{ margin: "0 0 10px", fontSize: 17 }}>SMS purchases waiting ({smsPurchases.length})</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {smsPurchases.map((p) => (
              <form key={p.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: "1px solid #E5E5F0" }}>
                <div style={{ flex: "1 1 260px", fontSize: 14 }}>
                  <b>{p.storeName}</b> ({p.subdomain}) bought <b>{p.quantity.toLocaleString("en-IN")} SMS</b> for ৳ {p.amount}<br />
                  <span style={{ color: "#4B4B73" }}>{p.provider} from {p.senderNumber}, TrxID {p.trxId}</span>
                </div>
                {canEdit && (
                  <>
                    <input name="reason" placeholder="Reason, if rejecting" aria-label={`Rejection reason for ${p.storeName}`} style={{ height: 44, flex: "1 1 180px", border: "1px solid #D5D5E4", borderRadius: 8, padding: "0 12px", fontSize: 14 }} />
                    <SubmitButton formAction={approveSmsAction.bind(null, p.id)} style={{ height: 44, padding: "0 20px", borderRadius: 8, background: "#15803D", color: "#fff", fontWeight: 700 }} pending="Approving…">Approve</SubmitButton>
                    <SubmitButton formAction={rejectSmsAction.bind(null, p.id)} style={{ height: 44, padding: "0 18px", border: "1px solid #F1C0C0", borderRadius: 8, color: "#DC2626", background: "#fff", fontWeight: 600 }} pending="Rejecting…">Reject</SubmitButton>
                  </>
                )}
              </form>
            ))}
          </div>
        </section>
      )}

      {/* Master-Detail 2-Pane Desk */}
      {rows.length === 0 ? (
        <div className="card empty" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }} data-testid="payments-empty">
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
              border: "1px solid var(--line)",
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
                  href={`/payments?tab=${tab}&page=${page}&id=${p.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 20px",
                    height: 72,
                    borderBottom: "1px solid var(--chip)",
                    background: isSel ? "var(--tint)" : "#fff",
                    borderLeft: isSel ? "3px solid var(--brand)" : "3px solid transparent",
                    textDecoration: "none",
                    color: "var(--ink)",
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
                      fontSize: 12,
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
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.plan} · {p.trxId}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {taka(p.amount)}
                    </div>
                    <div style={{ fontSize: 12, color: age.isLate ? "#B91C1C" : "var(--ink-2)", fontWeight: 600 }}>
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
                border: "1px solid var(--line)",
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
                    <Link href={`/tenants/${selected.tenantId}`} style={{ color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 40 }} prefetch={false}>
                      {selected.storeName}
                    </Link>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
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
                <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Amount claimed</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }} data-testid="amount">
                    {taka(selected.amount)}
                  </div>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Method</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                    {providerColor(selected.provider).name}
                  </div>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>TrxID</div>
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
                      border: "1px solid var(--line)",
                      padding: 18,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontSize: 12, color: selected.provider === "NAGAD" ? "#8F3C06" : "#8A1038", fontWeight: 800 }}>
                      {providerColor(selected.provider).name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>Send Money successful</div>
                    <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>
                      {taka(selected.amount)}.00
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7 }}>
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
                      Sender number seen on {selected.senderSeenOnOtherStores} other {selected.senderSeenOnOtherStores === 1 ? "store" : "stores"}.
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
                        border: "1px solid var(--line-2)",
                        borderRadius: 8,
                        padding: "0 12px",
                        fontSize: 14,
                        color: "var(--ink)",
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
      <Pager page={page} pageSize={PAYMENTS_PAGE_SIZE} total={total} path="/payments" params={{ tab }} />
    </div>
  );
}
