import type { Metadata } from "next";
import Link from "next/link";
import {
  canPlatform,
  listPlans,
  listSubscriptionPromos,
  type SubscriptionPromoView,
} from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import {
  savePlanAction,
  createPromoAction,
  togglePromoAction,
  deletePromoAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans and promo codes" };

const LIMITS: [string, string][] = [
  ["products", "Products"],
  ["ordersPerMonth", "Orders a month"],
  ["staff", "Staff"],
  ["storageGb", "Photo storage (GB)"],
  ["smsCredits", "SMS credits"],
  ["landingPages", "Landing pages"],
];

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("plans");
  const tab = one(sp.tab) ?? "plans";
  const canEdit = canPlatform(s.actor.role, "plans", "edit");

  const [plans, promos] = await Promise.all([
    listPlans(s.actor),
    listSubscriptionPromos(s.actor),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <h1>Plans and promo codes</h1>
      </div>

      {one(sp.saved) && (
        <div className="notice good" role="status">
          Plan {one(sp.saved)} saved successfully.
        </div>
      )}
      {one(sp.done) && <div className="notice good" role="status">{one(sp.done)}</div>}
      {one(sp.err) && <div className="notice bad" role="alert">{one(sp.err)}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #E7E7F0", paddingBottom: 2 }}>
        <Link
          href="/plans?tab=plans"
          prefetch={false}
          style={{
            padding: "8px 16px",
            borderBottom: tab === "plans" ? "3px solid #5B4FE8" : "3px solid transparent",
            color: tab === "plans" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Subscription Plans ({plans.length})
        </Link>
        <Link
          href="/plans?tab=promos"
          prefetch={false}
          style={{
            padding: "8px 16px",
            borderBottom: tab === "promos" ? "3px solid #5B4FE8" : "3px solid transparent",
            color: tab === "promos" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Promo Codes & Discounts ({promos.length})
        </Link>
      </div>

      {/* TAB 1: PLANS */}
      {tab === "plans" && (
        <div className="stack">
          <p className="page-sub" style={{ margin: 0 }}>
            Prices and limits live here, not in code. A change applies at once to every store on the plan. Leave a limit blank for unlimited.
          </p>
          {plans.map((p) => (
            <form
              key={p.tier}
              action={savePlanAction.bind(null, p.tier)}
              className="card stack"
              data-testid={`plan-${p.tier}`}
            >
              <div className="card-head">
                <h2>{p.name}</h2>
                <span className="muted">
                  {p.stores} {p.stores === 1 ? "store" : "stores"}
                </span>
              </div>
              <div className="row-3">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Monthly price (৳)</span>
                  <input className="input" name="priceMonthly" inputMode="decimal" defaultValue={p.priceMonthly} disabled={!canEdit} required />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Yearly price (৳)</span>
                  <input className="input" name="priceYearly" inputMode="decimal" defaultValue={p.priceYearly} disabled={!canEdit} required />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Trial days</span>
                  <input className="input" name="trialDays" inputMode="numeric" defaultValue={p.trialDays} disabled={!canEdit} required />
                </label>
              </div>
              <div className="row-3">
                {LIMITS.map(([k, l]) => (
                  <label key={k} className="field" style={{ marginBottom: 0 }}>
                    <span className="label">{l}</span>
                    <input
                      className="input"
                      name={k}
                      inputMode="numeric"
                      defaultValue={(p.limits as Record<string, number | null>)[k] ?? ""}
                      placeholder="Unlimited"
                      disabled={!canEdit}
                    />
                  </label>
                ))}
              </div>
              <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <input
                  type="checkbox"
                  name="isPublic"
                  defaultChecked={p.isPublic}
                  disabled={!canEdit}
                  style={{ width: 20, height: 20 }}
                />
                Shown on the public pricing page and in signup
              </label>
              {canEdit && (
                <div>
                  <SubmitButton className="btn btn-primary" pending="Saving…">
                    Save {p.name}
                  </SubmitButton>
                </div>
              )}
            </form>
          ))}
        </div>
      )}

      {/* TAB 2: PROMO CODES */}
      {tab === "promos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p className="page-sub" style={{ margin: 0 }}>
            Create custom coupon codes for merchant plan upgrades and subscription renewals with usage limits and expiry dates.
          </p>

          {/* Promo Codes Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
              Active Subscription Coupons
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 840 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.6fr) 110px 110px 110px 100px 130px 140px",
                    padding: "10px 24px",
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink-3)",
                    letterSpacing: "0.3px",
                  }}
                >
                  <div>CODE / CREATOR</div>
                  <div>DISCOUNT</div>
                  <div>PLANS</div>
                  <div>INTERVAL</div>
                  <div style={{ textAlign: "right" }}>USES</div>
                  <div>EXPIRATION</div>
                  <div style={{ textAlign: "right" }}>ACTIONS</div>
                </div>

                {promos.length === 0 ? (
                  <div style={{ padding: 24, color: "#6B6B8D", fontSize: 13.5 }}>
                    No subscription promo codes created yet.
                  </div>
                ) : (
                  promos.map((pr: SubscriptionPromoView) => (
                    <div
                      key={pr.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.6fr) 110px 110px 110px 100px 130px 140px",
                        padding: "14px 24px",
                        alignItems: "center",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13.5,
                        opacity: pr.isActive ? 1 : 0.6,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14.5, color: "#5B4FE8" }}>
                          {pr.code}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                          By {pr.createdBy || "System"}
                        </div>
                      </div>

                      <div style={{ fontWeight: 700 }}>
                        {pr.discountType === "PERCENTAGE" ? `${pr.discountValue}% OFF` : `৳${pr.discountValue} OFF`}
                      </div>

                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {pr.applicableTiers.join(", ")}
                      </div>

                      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                        {pr.billingInterval}
                      </div>

                      <div className="num" style={{ textAlign: "right", fontWeight: 700 }}>
                        {pr.usedCount} {pr.maxUses ? `/ ${pr.maxUses}` : ""}
                      </div>

                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {pr.validUntil ? dateOnly(pr.validUntil) : "Never expires"}
                      </div>

                      <div style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {canEdit && (
                          <>
                            <form action={togglePromoAction.bind(null, pr.id, !pr.isActive)} style={{ margin: 0 }}>
                              <button
                                type="submit"
                                className={`btn btn-sm ${pr.isActive ? "btn-secondary" : "btn-primary"}`}
                                style={{ fontSize: 11 }}
                              >
                                {pr.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </form>
                            <form action={deletePromoAction.bind(null, pr.id)} style={{ margin: 0 }}>
                              <button
                                type="submit"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: 11, color: "#DC2626" }}
                              >
                                Delete
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Create Promo Code Form Card */}
          {canEdit && (
            <form action={createPromoAction} className="card stack" style={{ padding: 24, maxWidth: 680 }}>
              <h2 style={{ fontSize: 16 }}>Create New Subscription Promo Code</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Promo Code</span>
                  <input
                    className="input"
                    name="code"
                    required
                    placeholder="e.g. EID50, PROMO2026"
                    style={{ textTransform: "uppercase" }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="label">Discount Type</span>
                    <select className="select" name="discountType" defaultValue="PERCENTAGE">
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_BDT">Fixed Amount (৳)</option>
                    </select>
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="label">Value</span>
                    <input className="input" name="discountValue" type="number" required min="1" placeholder="50" />
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Applicable Plan Tier</span>
                  <select className="select" name="applicableTier" defaultValue="ALL">
                    <option value="ALL">All Plans (Starter, Pro, Business)</option>
                    <option value="PRO">Pro Plan Only</option>
                    <option value="BUSINESS">Business Plan Only</option>
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Billing Interval</span>
                  <select className="select" name="billingInterval" defaultValue="ANY">
                    <option value="ANY">Any Interval (Monthly & Yearly)</option>
                    <option value="MONTHLY">Monthly Billing Only</option>
                    <option value="YEARLY">Yearly Billing Only</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Max Redemptions (Blank = Unlimited)</span>
                  <input className="input" name="maxUses" type="number" min="1" placeholder="100" />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Expiration Date (Optional)</span>
                  <input className="input" name="validUntil" type="date" />
                </label>
              </div>

              <div>
                <button type="submit" className="btn btn-primary">
                  Create Subscription Promo Code
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
