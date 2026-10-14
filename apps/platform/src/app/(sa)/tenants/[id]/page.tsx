import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACCESS_LABELS, canPlatform, getTenantDetail, listTenantQuotaAdjustments, APP_CATALOG } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import {
  addNoteAction,
  extendAction,
  impersonateAction,
  planAction,
  quarantineAction,
  reactivateAction,
  suspendAction,
  addQuotaAdjustmentAction,
  overrideTenantModuleAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store Detail" };

const DONE_MESSAGES: Record<string, string> = {
  suspended: "Store switched off.",
  reactivated: "Store switched back on.",
  extended: "Trial extended successfully.",
  plan: "Plan updated.",
  approved: "Store brand review approved.",
  noted: "Internal note saved.",
  quota_adjusted: "Quota adjustment applied successfully.",
  module_updated: "Tenant module entitlement updated.",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "subscription", label: "Subscription" },
  { id: "usage", label: "Usage" },
  { id: "domains", label: "Domains" },
  { id: "modules", label: "Modules" },
  { id: "support", label: "Support" },
  { id: "audit", label: "Audit log" },
];

export default async function TenantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("tenants");
  const t = await getTenantDetail(s.actor, id).catch(() => null);
  const quotaAdjustments = await listTenantQuotaAdjustments(s.actor, id).catch(() => []);
  if (!t) notFound();

  const canSuspend = canPlatform(s.user.role, "suspend", "edit");
  const canAdjust = canPlatform(s.user.role, "adjust", "edit");
  const a = t.access;
  const err = one(sp.err);
  const done = one(sp.done);
  const tab = one(sp.tab) ?? "overview";

  const isTrial = a.state === "TRIAL";
  const isPaying = a.state === "ACTIVE";
  const isOverdue = a.state === "GRACE";
  const isSuspended = Boolean(a.suspendedByPlatform);

  const statusPillText = isSuspended
    ? "Suspended"
    : isOverdue
    ? "Past due"
    : isTrial
    ? `Trial, ${a.daysLeft ?? 0} days left`
    : isPaying
    ? "Active"
    : ACCESS_LABELS[a.state];

  const statusBg = isSuspended ? "#FCEBEB" : isOverdue ? "#FDF3E3" : isTrial ? "#E9E7FD" : "#E8F6EE";
  const statusColor = isSuspended ? "#DC2626" : isOverdue ? "#B45309" : isTrial ? "#5B4FE8" : "#15803D";

  // Limits calculations for meters
  const pLimit = t.planLimits?.products ?? 2000;
  const pPct = Math.min(100, Math.round((t.usage.products / pLimit) * 100));

  const staffLimit = t.planLimits?.staff ?? 5;
  const staffPct = Math.min(100, Math.round((t.usage.staff / staffLimit) * 100));

  const smsLimit = t.planLimits?.smsCredits ?? 1000;
  const smsPct = Math.min(100, Math.round((t.usage.smsUsed / smsLimit) * 100));

  const storageLimitGb = t.planLimits?.storageGb ?? 20;
  const storageUsedGb = (t.usage.storageMb / 1024).toFixed(1);
  const storagePct = Math.min(100, Math.round(((t.usage.storageMb / 1024) / storageLimitGb) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
        <Link href="/tenants" style={{ display: "flex", alignItems: "center", gap: 6, color: "#4B4B73", textDecoration: "none" }} prefetch={false}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B8D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Tenants
        </Link>
      </div>

      {/* Notifications */}
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 4 }}>{err}</div>}
      {done && DONE_MESSAGES[done] && <div className="notice good" role="status" style={{ marginBottom: 4 }}>{DONE_MESSAGES[done]}</div>}
      {t.suspendedReason && <div className="notice bad" style={{ marginBottom: 4 }} data-testid="suspended-note">Switched off by platform: {t.suspendedReason}</div>}

      {/* Store Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "#E9DCCB",
            color: "#8C5A3C",
            fontWeight: 700,
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {t.name.charAt(0)}
        </div>
        <div style={{ flexGrow: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }} data-testid="tenant-title">{t.name}</h1>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 11,
                background: statusBg,
                color: statusColor,
                fontSize: 12,
                fontWeight: 600,
              }}
              data-testid="tenant-state"
            >
              {statusPillText}
            </span>
            {t.quarantined && <span style={{ padding: "3px 10px", borderRadius: 11, background: "#FDF3E3", color: "#B45309", fontSize: 12, fontWeight: 600 }}>Flagged for review</span>}
          </div>
          <div style={{ fontSize: 13, color: "#4B4B73", marginTop: 3 }}>
            {t.subdomain}.biztrack.bd · Owner {t.ownerName ?? "Unknown"} ({t.ownerEmail ?? "no email"}) · Joined {dateOnly(t.createdAt)}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href={`https://${t.subdomain}.biztrack.bd`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 38,
              padding: "0 16px",
              border: "1px solid #D5D5E4",
              borderRadius: 8,
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#1A1A4E",
              textDecoration: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B4B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
            </svg>
            Open store
          </a>

          <form action={impersonateAction.bind(null, t.id)} style={{ margin: 0 }}>
            <SubmitButton
              className="btn btn-primary"
              style={{ height: 38, padding: "0 16px", borderRadius: 8, background: "#5B4FE8", color: "#fff", fontSize: 14, fontWeight: 700 }}
              pending="Signing in…"
              data-testid="impersonate-btn"
            >
              Log in as owner
            </SubmitButton>
          </form>

          {canSuspend && (
            t.suspendedReason ? (
              <form action={reactivateAction.bind(null, t.id)} style={{ margin: 0 }}>
                <SubmitButton className="btn btn-secondary" style={{ height: 38, padding: "0 16px", borderRadius: 8 }} pending="…">
                  Switch back on
                </SubmitButton>
              </form>
            ) : (
              <form action={suspendAction.bind(null, t.id)} style={{ margin: 0 }}>
                <label className="sr-only" htmlFor="suspend-reason">Reason</label>
                <input id="suspend-reason" name="reason" required minLength={5} placeholder="Reason the owner will see" style={{ height: 38, width: 220, border: "1px solid #D5D5E4", borderRadius: 8, padding: "0 12px", fontSize: 13.5, color: "#1A1A4E", marginRight: 8 }} />
                <SubmitButton
                  style={{
                    height: 38,
                    padding: "0 16px",
                    border: "1px solid #F1C0C0",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#DC2626",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  pending="…"
                >
                  Suspend store
                </SubmitButton>
              </form>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #E7E7F0", overflowX: "auto" }}>
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              href={`/tenants/${t.id}?tab=${item.id}`}
              style={{
                padding: "6px 0 12px",
                borderBottom: active ? "2.5px solid #5B4FE8" : "2.5px solid transparent",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                color: active ? "#1A1A4E" : "#6B6B8D",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
              prefetch={false}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Top 4 KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} data-testid="usage-card">
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73" }}>Orders (30 days)</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {t.usage.orders30Days}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73" }}>Sales (GMV)</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {taka(t.usage.gmv30Days)}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73" }}>Products</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {t.usage.products}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73" }}>Customers</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {t.usage.customers}
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Main Tab Content + Right Rail */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Left Column (Main Tab Content) */}
        <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {tab === "overview" && (
            <>
              {/* Usage against limits card */}
              <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                  Usage against plan limits ({t.tier.charAt(0) + t.tier.slice(1).toLowerCase()})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>Products</span>
                      <span style={{ color: "#4B4B73", fontVariantNumeric: "tabular-nums" }}>
                        {t.usage.products} of {pLimit.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#E7E7F0" }}>
                      <div style={{ width: `${pPct}%`, height: 6, borderRadius: 3, background: "#5B4FE8" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>Staff accounts</span>
                      <span style={{ color: "#4B4B73", fontVariantNumeric: "tabular-nums" }}>
                        {t.usage.staff} of {staffLimit}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#E7E7F0" }}>
                      <div style={{ width: `${staffPct}%`, height: 6, borderRadius: 3, background: "#5B4FE8" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>SMS credits this month</span>
                      <span style={{ color: "#4B4B73", fontVariantNumeric: "tabular-nums" }}>
                        {t.usage.smsUsed} of {smsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#E7E7F0" }}>
                      <div style={{ width: `${smsPct}%`, height: 6, borderRadius: 3, background: smsPct > 80 ? "#B45309" : "#5B4FE8" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>Storage</span>
                      <span style={{ color: "#4B4B73", fontVariantNumeric: "tabular-nums" }}>
                        {storageUsedGb} of {storageLimitGb} GB
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#E7E7F0" }}>
                      <div style={{ width: `${storagePct}%`, height: 6, borderRadius: 3, background: "#5B4FE8" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent activity card */}
              <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", fontSize: 15, fontWeight: 700, borderBottom: "1px solid #E7E7F0" }}>
                  Recent activity
                </div>
                {t.audit.length === 0 ? (
                  <div style={{ padding: "20px 24px", color: "#6B6B8D", fontSize: 13.5 }}>No activity recorded yet.</div>
                ) : (
                  t.audit.slice(0, 8).map((aItem) => (
                    <div
                      key={aItem.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "0 24px",
                        height: 52,
                        borderBottom: "1px solid #F0F0F6",
                        fontSize: 13.5,
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: "#5B4FE8", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {aItem.action.replace(/_/g, " ").toLowerCase()}
                      </div>
                      <div style={{ color: "#6B6B8D", fontSize: 12.5, flexShrink: 0 }}>
                        {dateTime(aItem.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {tab === "subscription" && (
            <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Subscription & Plan Management</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5, marginBottom: 20 }}>
                <div><strong>Current Plan:</strong> {t.tier}</div>
                <div><strong>State:</strong> {ACCESS_LABELS[a.state]}</div>
                <div><strong>Trial Ends:</strong> {dateOnly(t.trialEndsAt)}</div>
                <div><strong>Subscription Interval:</strong> {t.subscription?.interval ?? "N/A"}</div>
              </div>

              {canAdjust && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid #E7E7F0", paddingTop: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Change Store Plan</h3>
                    <form action={planAction.bind(null, t.id)} style={{ display: "flex", gap: 10 }}>
                      <select name="tier" defaultValue={t.tier} className="select" style={{ width: 180 }}>
                        <option value="STARTER">Starter</option>
                        <option value="PRO">Pro</option>
                        <option value="BUSINESS">Business</option>
                      </select>
                      <SubmitButton className="btn btn-secondary" pending="…">Update Plan</SubmitButton>
                    </form>
                  </div>

                  <div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Extend Free Trial</h3>
                    <form action={extendAction.bind(null, t.id)} style={{ display: "flex", gap: 10 }}>
                      <input className="input" type="number" name="days" defaultValue={7} min={1} max={60} style={{ width: 100 }} />
                      <SubmitButton className="btn btn-secondary" pending="…">Add Days</SubmitButton>
                    </form>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Past Payment Proofs</h3>
                {t.proofs.length === 0 ? (
                  <div style={{ color: "#6B6B8D", fontSize: 13.5 }}>No payment proofs submitted yet.</div>
                ) : (
                  <table className="table" style={{ boxShadow: "none" }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Plan</th>
                        <th>TrxID</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.proofs.map((p) => (
                        <tr key={p.id}>
                          <td>{dateOnly(p.createdAt)}</td>
                          <td>{p.plan} ({p.interval.toLowerCase()})</td>
                          <td>{p.provider} · <code>{p.trxId}</code></td>
                          <td style={{ textAlign: "right" }}>{taka(p.amount)}</td>
                          <td>
                            <span className={`pill ${p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "bad" : "warn"}`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === "usage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Detailed Store Usage Metrics</div>
                <dl className="kv" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <dt>Products in Catalog</dt><dd className="num">{t.usage.products}</dd>
                  <dt>Active Staff Accounts</dt><dd className="num">{t.usage.staff}</dd>
                  <dt>Orders This Month</dt><dd className="num">{t.usage.ordersThisMonth}</dd>
                  <dt>All-time Total Orders</dt><dd className="num">{t.usage.ordersTotal}</dd>
                  <dt>Orders in Last 30 Days</dt><dd className="num">{t.usage.orders30Days}</dd>
                  <dt>Delivered Sales (30 Days)</dt><dd className="num">{taka(t.usage.gmv30Days)}</dd>
                  <dt>Registered Customers</dt><dd className="num">{t.usage.customers}</dd>
                  <dt>SMS Credits Used</dt><dd className="num">{t.usage.smsUsed}</dd>
                  <dt>Storage Consumed</dt><dd className="num">{t.usage.storageMb} MB ({storageUsedGb} GB)</dd>
                </dl>
              </div>

              {/* Manual Quota Adjustments Card */}
              <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Manual Quota Top-Ups & Overrides</div>
                <p style={{ fontSize: 13, color: "#6B6B8D", margin: "0 0 16px 0" }}>
                  Grant bonus SMS credits or additional product slots directly without altering the merchant's plan tier.
                </p>

                {canAdjust && (
                  <form action={addQuotaAdjustmentAction.bind(null, id)} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", paddingBottom: 16, borderBottom: "1px solid #E7E7F0" }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Quota Type</label>
                      <select name="type" className="select" defaultValue="SMS_CREDITS" style={{ height: 38, fontSize: 13 }}>
                        <option value="SMS_CREDITS">SMS Credits</option>
                        <option value="PRODUCT_LIMIT">Product Capacity</option>
                        <option value="STAFF_LIMIT">Staff Account Slots</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Amount (+)</label>
                      <input name="amount" type="number" required min="1" placeholder="500" className="input" style={{ width: 110, height: 38, fontSize: 13 }} />
                    </div>

                    <div style={{ flex: "1 1 200px" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Audit Reason</label>
                      <input name="reason" type="text" required placeholder="e.g. VIP goodwill top-up for Eid campaign" className="input" style={{ width: "100%", height: 38, fontSize: 13 }} />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>
                      Grant Quota
                    </button>
                  </form>
                )}

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Granted Overrides History:</div>
                  {quotaAdjustments.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#6B6B8D" }}>No custom quota overrides granted to this store.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {quotaAdjustments.map((q) => (
                        <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#FAFAFC", borderRadius: 6, fontSize: 12.5 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: "#5B4FE8" }}>+{q.amount} {q.type.replace("_", " ")}</span>
                            <span style={{ color: "#4B4B73", marginLeft: 8 }}>"{q.reason}"</span>
                          </div>
                          <span style={{ color: "#6B6B8D", fontSize: 11.5 }}>{dateTime(q.createdAt)} · {q.actorId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "domains" && (
            <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Configured Domains</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: "#FAFAFC", border: "1px solid #E7E7F0" }}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{t.subdomain}.biztrack.bd (System Subdomain)</div>
                  <span style={{ padding: "3px 10px", borderRadius: 10, background: "#E8F6EE", color: "#15803D", fontSize: 12, fontWeight: 600 }}>Active</span>
                </div>
                {t.domains.map((d) => (
                  <div key={d.domain} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: "#FAFAFC", border: "1px solid #E7E7F0" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{d.domain}</div>
                      <div style={{ fontSize: 12, color: "#6B6B8D" }}>SSL: {d.sslStatus} {d.isPrimary && "· Primary"}</div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 10, background: d.verified ? "#E8F6EE" : "#FDF3E3", color: d.verified ? "#15803D" : "#B45309", fontSize: 12, fontWeight: 600 }}>
                      {d.verified ? "Active" : "Waiting for DNS"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "modules" && (
            <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Module Entitlements & Overrides</div>
              <p style={{ fontSize: 13, color: "#6B6B8D", margin: "0 0 16px 0" }}>
                Super Admin can grant explicit VIP overrides to activate specialized apps regardless of the merchant's plan tier.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {APP_CATALOG.map((app) => {
                  const currentMod = t.modules.find((m) => m.key === app.key);
                  const isEnabled = currentMod ? currentMod.isEnabled : false;
                  return (
                    <div key={app.key} style={{ padding: 16, borderRadius: 8, border: isEnabled ? "1.5px solid #5B4FE8" : "1px solid #E7E7F0", background: isEnabled ? "#F4F3FF" : "#FAFAFC", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: isEnabled ? "#5B4FE8" : "#1A1A4E" }}>{app.label}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: isEnabled ? "#E8F6EE" : "#EFEFF6", color: isEnabled ? "#15803D" : "#5B5B7B" }}>
                            {isEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B6B8D", marginTop: 4 }}>
                          Tier: {app.tierLabel} {app.minPlan ? `(Min: ${app.minPlan})` : ""}
                        </div>
                      </div>

                      {canAdjust && (
                        <form action={overrideTenantModuleAction.bind(null, id, app.key, !isEnabled)} style={{ marginTop: 12 }}>
                          <button
                            type="submit"
                            className={`btn btn-sm ${isEnabled ? "btn-secondary" : "btn-primary"}`}
                            style={{ width: "100%", fontSize: 12 }}
                          >
                            {isEnabled ? "Revoke Entitlement" : "Grant VIP Access"}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "support" && (
            <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Support Tickets from this Store</div>
              {t.tickets.length === 0 ? (
                <div style={{ color: "#6B6B8D", fontSize: 13.5 }}>No support tickets filed by this store.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {t.tickets.map((tk) => (
                    <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, border: "1px solid #E7E7F0", background: "#fff" }}>
                      <div style={{ flex: 1 }}>
                        <Link href={`/tickets?id=${tk.id}`} style={{ fontWeight: 600, color: "#1A1A4E", textDecoration: "none" }} prefetch={false}>
                          {tk.subject}
                        </Link>
                        <div style={{ fontSize: 12, color: "#6B6B8D" }}>#{tk.code} · {dateOnly(tk.createdAt)}</div>
                      </div>
                      <span className={`pill ${tk.status === "OPEN" ? "warn" : tk.status === "RESOLVED" ? "ok" : "grey"}`}>
                        {tk.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "audit" && (
            <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Platform Audit Log & Impersonations</div>
              {t.audit.length === 0 ? (
                <div style={{ color: "#6B6B8D", fontSize: 13.5 }}>No audit log entries recorded.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {t.audit.map((al) => {
                    const isImpersonate = al.action === "IMPERSONATE";
                    return (
                      <div key={al.id} style={{ padding: "12px 14px", borderRadius: 8, background: isImpersonate ? "#FFF8F0" : "#FAFAFC", border: isImpersonate ? "1.5px solid #F59E0B" : "1px solid #E7E7F0", fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {al.action}
                            {isImpersonate && (
                              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 6, background: "#FEF3E2", color: "#92400E", fontWeight: 700 }}>
                                IMPERSONATION SESSION
                              </span>
                            )}
                          </span>
                          <span style={{ color: "#6B6B8D", fontSize: 12 }}>{dateTime(al.createdAt)}</span>
                        </div>
                        <div style={{ color: "#4B4B73", marginTop: 4 }}>
                          Actor: <b>{al.actorId}</b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (Sidebar Rails) */}
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Subscription Box */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }} data-testid="subscription-card">
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Subscription</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
              <div style={{ display: "flex" }}>
                <span style={{ flexGrow: 1, color: "#4B4B73" }}>Plan</span>
                <b>{t.tier.charAt(0) + t.tier.slice(1).toLowerCase()} {isTrial ? "(trial)" : ""}</b>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ flexGrow: 1, color: "#4B4B73" }}>{isTrial ? "Trial ends" : "Renewal due"}</span>
                <b>{dateOnly(t.subscription?.periodEnd ?? t.trialEndsAt)}</b>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ flexGrow: 1, color: "#4B4B73" }}>Payment method</span>
                <b>{t.subscription && t.subscription.amount > 0 ? "bKash / Nagad" : "None yet"}</b>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ flexGrow: 1, color: "#4B4B73" }}>Next invoice</span>
                <b>{t.subscription && t.subscription.amount > 0 ? taka(t.subscription.amount) : "৳ 1,499"}</b>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Link
                href={`/tenants/${t.id}?tab=subscription`}
                style={{
                  height: 36,
                  padding: "0 14px",
                  border: "1px solid #D5D5E4",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  color: "#1A1A4E",
                  textDecoration: "none",
                }}
                prefetch={false}
              >
                Change plan
              </Link>
              {isTrial && (
                <form action={extendAction.bind(null, t.id)} style={{ margin: 0 }}>
                  <input type="hidden" name="days" value={7} />
                  <SubmitButton
                    style={{
                      height: 36,
                      padding: "0 14px",
                      border: "1px solid #D5D5E4",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                    pending="…"
                  >
                    Extend trial
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>

          {/* Domains Card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Domains</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, marginBottom: 10 }}>
              <div style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.subdomain}.biztrack.bd
              </div>
              <span style={{ padding: "2px 9px", borderRadius: 10, background: "#E8F6EE", color: "#15803D", fontSize: 12, fontWeight: 600 }}>Active</span>
            </div>
            {t.domains.slice(0, 3).map((d) => (
              <div key={d.domain} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, marginBottom: 10 }}>
                <div style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{d.domain}</div>
                <span style={{ padding: "2px 9px", borderRadius: 10, background: d.verified ? "#E8F6EE" : "#FDF3E3", color: d.verified ? "#15803D" : "#B45309", fontSize: 12, fontWeight: 600 }}>
                  {d.verified ? "Active" : "Waiting for DNS"}
                </span>
              </div>
            ))}
          </div>

          {/* Modules Card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Modules</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {t.modules.filter((m) => m.isEnabled).length === 0 ? (
                <span style={{ color: "#6B6B8D", fontSize: 13 }}>Standard core features</span>
              ) : (
                t.modules.filter((m) => m.isEnabled).map((m) => (
                  <span
                    key={m.key}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 14,
                      background: "#F4F3FF",
                      color: "#5B4FE8",
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {m.label}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Internal Notes Card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }} data-testid="internal-notes-card">
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Internal notes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {t.notes.length === 0 ? (
                <div style={{ fontSize: 13.5, color: "#6B6B8D" }}>No internal notes yet. Leave context for teammates below.</div>
              ) : (
                t.notes.map((n) => (
                  <div key={n.id} style={{ padding: "10px 12px", borderRadius: 8, background: "#FAFAFC", border: "1px solid #E7E7F0", fontSize: 13 }}>
                    <div style={{ color: "#1A1A4E", lineHeight: 1.5 }}>{n.body}</div>
                    <div style={{ fontSize: 11.5, color: "#6B6B8D", marginTop: 4 }}>
                      {n.authorName ?? "Staff"} · {dateTime(n.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form action={addNoteAction.bind(null, t.id)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                name="body"
                required
                rows={2}
                placeholder="Add an internal note about this store…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #D5D5E4",
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
                data-testid="add-note-input"
              />
              <SubmitButton className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-end" }} pending="Saving…" data-testid="save-note-btn">
                Add note
              </SubmitButton>
            </form>
          </div>

          {/* Brand review hold card if flagged */}
          {t.quarantined && canSuspend && (
            <div style={{ background: "#fff", border: "1px solid #FCD34D", borderRadius: 12, padding: "20px 24px" }} data-testid="quarantine-card">
              <div style={{ fontSize: 15, fontWeight: 700, color: "#B45309", marginBottom: 8 }}>Brand review hold</div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6B6B8D" }}>{t.quarantineReason}</p>
              <form style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="input" name="note" aria-label="Review note" required minLength={3} maxLength={200} placeholder="What you checked (e.g. verified trade license)" />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <SubmitButton formAction={quarantineAction.bind(null, t.id, "APPROVE")} className="btn btn-success btn-sm" pending="…">
                    Approve store
                  </SubmitButton>
                  <SubmitButton formAction={quarantineAction.bind(null, t.id, "SUSPEND")} className="btn btn-danger btn-sm" pending="…">
                    Suspend
                  </SubmitButton>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
