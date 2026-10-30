import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { can, getMarketingOverview } from "@biztrackbd/core";
import { friendlyDate, taka } from "@/lib/format";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketing" };

const EVENT_TAGS: Record<string, string> = {
  COUPON: "Discount",
  ABANDONED_RECOVERED: "Recovery",
  REVIEW: "Review",
  LOYALTY: "Loyalty",
  CAMPAIGN: "Broadcast",
};

export default async function MarketingOverviewPage() {
  const s = await requireAccess("marketing");
  const o = await getMarketingOverview(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "marketing", "edit");

  return (
    <>
      <PageHeader
        title="Marketing Command Center"
        crumbs={[{ label: "Home", href: "/" }, { label: "Marketing" }]}
        sub="Promotions, ad tracking, broadcast campaigns, and customer retention."
        actions={
          <>
            {canEdit && (
              <Link href="/marketing/ai" className="btn btn-secondary" prefetch={false}>
                Content Studio
              </Link>
            )}
            {canEdit && (
              <Link href="/marketing/campaigns" className="btn btn-primary" prefetch={false} data-testid="new-campaign-btn">
                New Campaign
              </Link>
            )}
            {canEdit && (
              <Link href="/marketing/coupons?new=1" className="btn btn-secondary" prefetch={false}>
                Create Discount
              </Link>
            )}
          </>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Recovered Cart Revenue</div>
          <div className="v num">{taka(o.summary.recoveredRevenueBdt)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {o.summary.recoveryRatePercent != null ? `${o.summary.recoveryRatePercent}% recovery rate` : "No dropouts"}
          </div>
        </div>

        <div className="stat">
          <div className="k">Promotional Orders</div>
          <div className="v num">{o.summary.totalCouponOrders}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {taka(o.summary.totalDiscountGivenBdt)} saved by buyers
          </div>
        </div>

        <div className="stat">
          <div className="k">Ad Trackers & CAPI</div>
          <div className="v num" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {o.summary.activePixelsCount}
            <span
              className="pill"
              style={{
                fontSize: 11,
                background: o.summary.metaCapiStatus === "LIVE" ? "#ECFDF5" : "#F1F5F9",
                color: o.summary.metaCapiStatus === "LIVE" ? "#15803D" : "#475569",
              }}
            >
              CAPI: {o.summary.metaCapiStatus}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {o.pixels.eventsLast24h} events in last 24h
          </div>
        </div>

        <div className="stat">
          <div className="k">Loyalty Liability</div>
          <div className="v num">{taka(o.summary.loyaltyLiabilityBdt)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {o.summary.loyaltyPointsOutstanding.toLocaleString()} points · {o.summary.loyaltyAccounts} members
          </div>
        </div>
      </div>

      {/* 6 Channel Command Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Discounts & Coupons */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Discounts & Coupons</h3>
              <span className={`pill ${o.coupons.activeCount > 0 ? "ok" : "grey"}`}>
                {o.coupons.activeCount} Active
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              {o.coupons.topCoupon
                ? `Top code: ${o.coupons.topCoupon.code} (${o.coupons.topCoupon.usageCount} uses · ${o.coupons.topCoupon.discount})`
                : "Create promo codes with usage limits, date windows, and cart thresholds."}
            </p>
          </div>
          <Link href="/marketing/coupons" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Manage Discounts →
          </Link>
        </div>

        {/* Product Bundles & Order Bumps */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Bundles & Order Bumps</h3>
              <span className="pill green">AOV Booster</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              1-Click checkout order bumps and "Frequently Bought Together" combo deals with component stock tracking and margin protection.
            </p>
          </div>
          <Link href="/marketing/bundles" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Manage Bundles & Bumps →
          </Link>
        </div>

        {/* Limited Drops & Pre-Orders */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Limited Drops & Pre-Orders</h3>
              <span className="pill green">Hype & Deposits</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Timed launch countdown clocks, buyer waitlists, and pre-orders with partial advance deposit collection and fulfillment hold protection.
            </p>
          </div>
          <Link href="/marketing/drops" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Manage Limited Drops →
          </Link>
        </div>

        {/* Automated WhatsApp Commerce */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>WhatsApp Automation</h3>
              <span className="pill green">WhatsApp</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Direct WhatsApp engine. Automated COD order confirmation, shipping tracking alerts, 2-stage cart recovery, and smart bot.
            </p>
          </div>
          <Link href="/marketing/whatsapp" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Configure WhatsApp →
          </Link>
        </div>

        {/* Affiliate & Influencer Hub */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Affiliate & Influencers</h3>
              <span className="pill green">Growth</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Referral link tracking, dedicated influencer coupon attribution, live commission ledger, and bKash/Nagad payout management.
            </p>
          </div>
          <Link href="/marketing/affiliates" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Manage Affiliates & Payouts →
          </Link>
        </div>

        {/* Broadcast Campaigns */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Broadcast Campaigns</h3>
              <span className="pill info">{o.summary.campaignsCount} Sent</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              {o.campaigns.lastCampaignAt
                ? `Last blast sent on ${friendlyDate(o.campaigns.lastCampaignAt)}. Send promotional SMS or Email to customer segments.`
                : "Broadcast promotional SMS or Email blasts to VIPs, repeat buyers, or dormant customers."}
            </p>
          </div>
          <Link href="/marketing/campaigns" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Launch Broadcast →
          </Link>
        </div>

        {/* Automated Notifications */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Automated Notifications</h3>
              <span className="pill ok">Active</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Customizable order status SMS and Email notifications (Placed, Shipped, Delivered) in English and Bangla.
            </p>
          </div>
          <Link href="/marketing/notifications" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Configure Notifications →
          </Link>
        </div>

        {/* Banner & Flash Sale */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Banner & Flash Sale</h3>
              <span className="pill info">Storefront</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Storefront top announcement bar with real-time flash sale countdown timer and 1-click promo code copy badge.
            </p>
          </div>
          <Link href="/marketing/banner" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Edit Banner & Sale →
          </Link>
        </div>

        {/* Pixels & CAPI */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Pixels & CAPI</h3>
              <span className={`pill ${o.pixels.metaConnected ? "ok" : "grey"}`}>
                {o.pixels.metaConnected ? "CAPI Synced" : "Pending"}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Facebook Pixel, Server-side Conversions API, TikTok Pixel, and Google Tag Manager container sync.
            </p>
          </div>
          <Link href="/marketing/pixels" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Manage Pixels →
          </Link>
        </div>

        {/* Abandoned Recovery & Loyalty */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Cart Recovery & Loyalty</h3>
              <span className="pill ok">Retention</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              30-min SMS cart recovery, call queue, VIP tier reward rules, and customer referral codes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/abandoned" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: "center" }} prefetch={false}>
              Recovery List
            </Link>
            <Link href="/marketing/loyalty" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: "center" }} prefetch={false}>
              Loyalty
            </Link>
          </div>
        </div>

        {/* AI Copywriter Studio */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Marketing Content Studio</h3>
              <span className="pill ok">Content Studio</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Craft high-converting Facebook/Instagram post captions, single-part SMS campaigns, and hero banner slogans in 1 click.
            </p>
          </div>
          <Link href="/marketing/ai" className="btn btn-secondary btn-sm" style={{ width: "100%", textAlign: "center" }} prefetch={false}>
            Open Content Studio →
          </Link>
        </div>
      </div>

      {/* Recent Marketing Events Feed */}
      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Recent Marketing Activity</h2>
        </div>
        {o.recentEvents.length === 0 ? (
          <p className="muted" style={{ padding: "12px 0" }}>
            No marketing events recorded yet. Activity will appear as coupons are used, carts are recovered, or campaigns are sent.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {o.recentEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--line, #E2E8F0)",
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span className="pill grey" style={{ fontSize: 11, minWidth: 70, textAlign: "center" }}>
                    {EVENT_TAGS[evt.type] ?? "Activity"}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{evt.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{evt.detail}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{friendlyDate(evt.date)}</span>
                  {evt.link && (
                    <Link href={evt.link} className="link" style={{ fontSize: 12.5 }} prefetch={false}>
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
