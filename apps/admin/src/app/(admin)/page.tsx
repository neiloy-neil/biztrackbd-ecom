import type { Metadata } from "next";
import Link from "next/link";
import {
  DASHBOARD_RANGES, can, changePercent, getDashboard, getTenantActiveModules, listConnectedCouriers,
  getTenantModeAndVertical, listSiteLeads,
  type SetupStep,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { BoltIcon, BoxIcon, PlusIcon, SearchIcon, TagIcon } from "@/components/icons";
import { friendlyDate, taka } from "@/lib/format";
import { demoTick } from "@/lib/demo";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { OrderPill, PaymentPill } from "@/lib/status";
import { storefrontOrigin } from "@/lib/store-url";
import { DashboardOperationsClient } from "./dashboard-operations-client";
import { PortfolioCommandCenter } from "./portfolio-command-center";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merchant Command Center" };

const SETUP: Record<SetupStep["key"], { label: string; href: string }> = {
  products: { label: "Add your first products", href: "/products/new" },
  details: { label: "Set your store name and phone", href: "/settings/store" },
  payments: { label: "Choose how customers pay", href: "/settings/payments" },
  delivery: { label: "Set delivery charges", href: "/settings/shipping" },
  courier: { label: "Connect Pathao or Steadfast", href: "/settings/apps?open=steadfast_courier" },
  publish: { label: "Publish your store", href: "/settings/store" },
};

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  await demoTick(s);
  const now = new Date();
  const range = Number(one(sp.range)) || 7;
  const hybridTab = one(sp.tab) || "store";

  const [d, activeModules, connectedCouriers, modeMeta] = await Promise.all([
    getDashboard(s.tenantId, s.actor, now, { range }),
    getTenantActiveModules(s.tenantId),
    listConnectedCouriers(s.tenantId),
    getTenantModeAndVertical(s.tenantId),
  ]);

  const storeOrigin = storefrontOrigin(s.tenantSubdomain);

  // If Portfolio mode or Hybrid in Website tab, load lead and vertical metrics
  let portfolioData: any = null;
  if (modeMeta.siteMode === "PORTFOLIO" || modeMeta.siteMode === "HYBRID") {
    const [leadsRes, bookingCount, pendingBookingsCount, downloadCount, contentItemCount, domainInfo, storeSettings] = await withTenant(
      s.tenantId,
      async (tx) => {
        return Promise.all([
          listSiteLeads(s.tenantId, s.actor, { take: 8 }),
          tx.bookingRequest.count({ where: { tenantId: s.tenantId } }),
          tx.bookingRequest.count({ where: { tenantId: s.tenantId, status: "REQUESTED" } }),
          tx.siteDownload.count({ where: { tenantId: s.tenantId } }),
          tx.siteContentItem.count({ where: { tenantId: s.tenantId } }),
          tx.domain.findFirst({ where: { isPrimary: true }, select: { domain: true, verified: true } }),
          tx.storeSettings.findFirst({ select: { whatsappNumber: true, contactPhone: true, storeName: true } }),
        ]);
      }
    );

    portfolioData = {
      leads: leadsRes.items,
      totalLeads: leadsRes.total,
      unreadLeads: leadsRes.unreadCount,
      totalBookings: bookingCount,
      pendingBookings: pendingBookingsCount,
      totalDownloads: downloadCount,
      totalContentItems: contentItemCount,
      domainName: domainInfo?.domain || null,
      isDomainVerified: domainInfo?.verified || false,
      whatsappNumber: storeSettings?.whatsappNumber || storeSettings?.contactPhone || null,
      storeName: storeSettings?.storeName || s.user.name,
    };
  }

  // Pure Portfolio mode layout
  if (modeMeta.siteMode === "PORTFOLIO") {
    return (
      <>
        <div className="page-head">
          <div style={{ flex: 1 }}>
            <h1 style={{ flex: "none" }}>{greeting(now)}, {s.user.name.split(" ")[0]}</h1>
            <p className="muted" style={{ marginTop: 2 }}>
              {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" }).format(now)}
              {portfolioData.unreadLeads > 0 ? ` · ${portfolioData.unreadLeads} new inquiries waiting` : ""}
            </p>
          </div>
          <div className="actions">
            <Link href="/services" className="btn btn-secondary" prefetch={false}>
              <PlusIcon width={18} height={18} /> Add service
            </Link>
            <Link href="/leads" className="btn btn-primary" prefetch={false}>
              Inquiry inbox
            </Link>
          </div>
        </div>

        <PortfolioCommandCenter
          siteMode={modeMeta.siteMode}
          vertical={modeMeta.vertical}
          leads={portfolioData.leads}
          totalLeads={portfolioData.totalLeads}
          unreadLeads={portfolioData.unreadLeads}
          totalBookings={portfolioData.totalBookings}
          pendingBookings={portfolioData.pendingBookings}
          totalDownloads={portfolioData.totalDownloads}
          totalContentItems={portfolioData.totalContentItems}
          domainName={portfolioData.domainName}
          isDomainVerified={portfolioData.isDomainVerified}
          whatsappNumber={portfolioData.whatsappNumber}
          storeName={portfolioData.storeName}
          storeOrigin={storeOrigin}
          userName={s.user.name}
        />
      </>
    );
  }

  const showMoney = can(s.user.role, "reports");
  const salesChange = changePercent(d.today.sales, d.yesterday.sales);
  const chg = changePercent(d.series.total, d.series.previousTotal);
  const ser = d.series;
  const max = Math.max(1, ...ser.days.map((x) => Math.max(x.sales, x.previousSales)));
  const W = 700, H = 200, bw = W / ser.days.length;
  const y = (v: number) => H - Math.max(2, (v / max) * (H - 8));
  const prevLine = ser.days.map((x, i) => `${(i * bw + bw / 2).toFixed(1)},${(x.previousSales > 0 ? y(x.previousSales) : H).toFixed(1)}`).join(" ");
  const shortDate = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const tips: { text: string; href: string; cta: string }[] = [];
  if (d.setup.steps.some((st) => st.key === "courier" && !st.done)) tips.push({ text: "Connect a courier and book parcels from the orders list in one tap.", href: "/settings/apps?open=steadfast_courier", cta: "Connect" });
  if (d.lowStock.length + d.outOfStock.count > 0) tips.push({ text: "Products that run out lose sales. Restock the ones below their reorder level.", href: "/inventory?filter=low", cta: "Open inventory" });
  tips.push({ text: "Share your store link in your Facebook page and WhatsApp status. Most first orders come from there.", href: "/settings/store", cta: "See your link" });
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1 style={{ flex: "none" }}>{greeting(now)}, {s.user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ marginTop: 2 }}>
            {today}
            {d.toPack.count > 0 ? ` · ${d.toPack.count} ${d.toPack.count === 1 ? "order needs" : "orders need"} packing` : ""}
            {d.funnel.unverified.count > 0 ? ` · ${d.funnel.unverified.count} payment checks waiting` : ""}
          </p>
        </div>
        <div className="actions">
          {can(s.user.role, "products", "edit") && (
            <Link href="/products/new" className="btn btn-secondary" prefetch={false}>
              <PlusIcon width={18} height={18} /> Add product
            </Link>
          )}
          {can(s.user.role, "orders", "edit") && (
            <Link href="/orders/new" className="btn btn-primary" prefetch={false}>
              New order
            </Link>
          )}
        </div>
      </div>

      {modeMeta.siteMode === "HYBRID" && (
        <div className="segmented-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Link
            href="/?tab=store"
            className={`btn btn-sm ${hybridTab === "store" ? "btn-primary" : "btn-secondary"}`}
            prefetch={false}
          >
            🛍️ Store Operations & Courier Dispatch
          </Link>
          <Link
            href="/?tab=website"
            className={`btn btn-sm ${hybridTab === "website" ? "btn-primary" : "btn-secondary"}`}
            prefetch={false}
          >
            📊 Website Performance & Leads {portfolioData?.unreadLeads > 0 ? `(${portfolioData.unreadLeads})` : ""}
          </Link>
        </div>
      )}

      {modeMeta.siteMode === "HYBRID" && hybridTab === "website" ? (
        <PortfolioCommandCenter
          siteMode={modeMeta.siteMode}
          vertical={modeMeta.vertical}
          leads={portfolioData.leads}
          totalLeads={portfolioData.totalLeads}
          unreadLeads={portfolioData.unreadLeads}
          totalBookings={portfolioData.totalBookings}
          pendingBookings={portfolioData.pendingBookings}
          totalDownloads={portfolioData.totalDownloads}
          totalContentItems={portfolioData.totalContentItems}
          domainName={portfolioData.domainName}
          isDomainVerified={portfolioData.isDomainVerified}
          whatsappNumber={portfolioData.whatsappNumber}
          storeName={portfolioData.storeName}
          storeOrigin={storeOrigin}
          userName={s.user.name}
        />
      ) : (
        <>
          {one(sp.welcome) === "1" && (
            <div className="notice good" role="status" style={{ marginBottom: 16 }}>
              <b>Welcome to BizTrackBD!</b> Your store is open and ready. Complete the checklist below to connect your bKash/Nagad wallet and Steadfast/Pathao courier pickups.
            </div>
          )}

      {/* Top Quick Command Strip */}
      <div className="card" style={{ padding: "10px 14px", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--line)" }} data-testid="quick-command-strip">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--brand)" }} />
            <span>Power Tools</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Link
              href="/pos"
              className="btn btn-sm btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              prefetch={false}
              data-testid="dock-pos"
            >
              <BoltIcon width={15} height={15} style={{ color: "var(--brand)" }} />
              <span>POS Register</span>
              {activeModules["pos_barcode"] && (
                <span className="pill good" style={{ padding: "1px 6px", fontSize: 10 }}>ACTIVE</span>
              )}
            </Link>
            <Link
              href="/orders/ship"
              className="btn btn-sm btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              prefetch={false}
              data-testid="dock-courier"
            >
              <BoxIcon width={15} height={15} style={{ color: "var(--info)" }} />
              <span>Courier Dispatch</span>
              {d.toPack.count > 0 && (
                <span className="pill warn" style={{ padding: "1px 6px", fontSize: 10 }}>{d.toPack.count}</span>
              )}
            </Link>
            <Link
              href="/products/barcodes"
              className="btn btn-sm btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              prefetch={false}
              data-testid="dock-barcodes"
            >
              <SearchIcon width={15} height={15} />
              <span>Barcode Studio</span>
            </Link>
            <Link
              href="/fraud?tab=check"
              className="btn btn-sm btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              prefetch={false}
              data-testid="dock-fraud"
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "#0284C7" }} aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Fraud Check</span>
            </Link>
            <Link
              href="/marketing/ai"
              className="btn btn-sm btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              prefetch={false}
              data-testid="dock-ai"
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "#8B5CF6" }} aria-hidden="true">
                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
              </svg>
              <span>Content Studio</span>
            </Link>
            {can(s.user.role, "orders", "edit") && (
              <Link
                href="/orders/new"
                className="btn btn-sm btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                prefetch={false}
                data-testid="dock-quick-order"
              >
                <PlusIcon width={15} height={15} />
                <span>Quick Order</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Interactive Fulfillment Funnel Ribbon */}
      <section className="card" style={{ padding: 14, marginBottom: 16 }} aria-label="Fulfillment Pipeline Funnel" data-testid="fulfillment-funnel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Fulfillment Pipeline</h2>
            <span className="muted" style={{ fontSize: 12 }}>Order lifecycle progression</span>
          </div>
          <Link href="/orders" className="link" style={{ fontSize: 12.5 }} prefetch={false}>
            All orders ({d.funnel.unverified.count + d.funnel.toPack.count + d.funnel.inTransit.count + d.funnel.delivered.count}) →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Link
            href="/orders/check"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: d.funnel.unverified.count > 0 ? "var(--warning-bg)" : "var(--bg)",
              border: `1px solid ${d.funnel.unverified.count > 0 ? "var(--warning)" : "var(--line)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            prefetch={false}
            data-testid="funnel-unverified"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--warning)" }}>1. Unverified</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{d.funnel.unverified.count}</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>bKash / Nagad TrxID</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{taka(d.funnel.unverified.amount)}</div>
          </Link>

          <Link
            href="/orders/ship"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: d.funnel.toPack.count > 0 ? "var(--info-bg)" : "var(--bg)",
              border: `1px solid ${d.funnel.toPack.count > 0 ? "var(--info)" : "var(--line)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            prefetch={false}
            data-testid="funnel-topack"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--info)" }}>2. To Pack</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{d.funnel.toPack.count}</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Confirmed in Store</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{taka(d.funnel.toPack.amount)}</div>
          </Link>

          <Link
            href="/orders?status=SHIPPED"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: d.funnel.inTransit.count > 0 ? "var(--tint)" : "var(--bg)",
              border: `1px solid ${d.funnel.inTransit.count > 0 ? "var(--brand)" : "var(--line)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            prefetch={false}
            data-testid="funnel-intransit"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--brand)" }}>3. In Transit</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{d.funnel.inTransit.count}</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>With Courier Riders</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{taka(d.funnel.inTransit.amount)}</div>
          </Link>

          <Link
            href="/orders?status=DELIVERED"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: "var(--success-bg)",
              border: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            prefetch={false}
            data-testid="funnel-delivered"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--success)" }}>4. Delivered</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{d.funnel.delivered.count}</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Successfully Handed</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{taka(d.funnel.delivered.amount)}</div>
          </Link>

          <Link
            href="/returns"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: d.funnel.returns.count > 0 ? "var(--danger-bg)" : "var(--bg)",
              border: `1px solid ${d.funnel.returns.count > 0 ? "var(--danger)" : "var(--line)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            prefetch={false}
            data-testid="funnel-returns"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--danger)" }}>5. Returns</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{d.funnel.returns.count}</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Cancelled / Returned</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{taka(d.funnel.returns.amount)}</div>
          </Link>
        </div>
      </section>

      {/* Live Operations Cockpit: Real-time Telemetry, Fraud Radar & Bulk Dispatch Queue */}
      <DashboardOperationsClient
        telemetry={d.telemetry}
        activityFeed={d.activityFeed}
        fraudRadar={d.fraudRadar}
        dispatchQueue={d.dispatchQueue}
        connectedCouriers={connectedCouriers}
        canEdit={can(s.user.role, "orders", "edit")}
      />

      {/* 4-Tile Core KPI Grid */}
      <div className="grid grid-4" data-testid="dash-stats">
        <div className="stat">
          <div className="k">New orders (24h)</div>
          <div className="v num">{d.newOrders.count}</div>
          <div className={`d ${d.newOrders.count >= d.newOrders.previous ? "up" : "down"}`}>
            {d.newOrders.count - d.newOrders.previous >= 0 ? "+" : ""}{d.newOrders.count - d.newOrders.previous} vs previous 24h
          </div>
        </div>
        <div className="stat">
          <div className="k">To pack and ship</div>
          <div className="v num">{d.toPack.count}</div>
          <div className="d">{d.toPack.waitingOver24h > 0 ? `${d.toPack.waitingOver24h} waiting over 24h` : "Fulfillment on track"}</div>
        </div>
        {showMoney ? (
          <div className="stat">
            <div className="k">Sales today</div>
            <div className="v num">{taka(d.today.sales)}</div>
            <div className={`d ${salesChange == null ? "" : salesChange >= 0 ? "up" : "down"}`}>
              {salesChange == null ? `${d.today.orders} orders` : `${salesChange >= 0 ? "+" : ""}${salesChange}% vs yesterday`}
            </div>
          </div>
        ) : (
          <div className="stat">
            <div className="k">Orders today</div>
            <div className="v num">{d.today.orders}</div>
            <div className="d">{d.yesterday.orders} yesterday</div>
          </div>
        )}
        <div className="stat">
          <div className="k">COD in Courier Transit</div>
          <div className="v num">{taka(d.codLedger.inTransitAmount)}</div>
          <div className="d">{d.codLedger.inTransitOrders} parcels on the road</div>
        </div>
      </div>

      {/* Needs Attention Alert Stack */}
      {(d.awaitingCheck.count > 0 || d.toPack.count > 0 || d.outOfStock.count > 0) && (
        <section className="stack" style={{ marginTop: 16 }} aria-label="Needs your attention">
          <h2 style={{ fontSize: 16 }}>Needs your attention</h2>
          {d.awaitingCheck.count > 0 && (
            <Link href="/orders/check" className="attention" prefetch={false}>
              <span className="n" style={{ color: "var(--warning)" }}>{d.awaitingCheck.count}</span>
              <span className="t">
                <b>bKash and Nagad payments to verify</b>
                <span className="muted">{d.awaitingCheck.oldestHours != null ? `Oldest waiting ${d.awaitingCheck.oldestHours === 0 ? "less than an hour" : `${d.awaitingCheck.oldestHours} hours`}` : ""}</span>
              </span>
              <span className="link">Verify now</span>
            </Link>
          )}
          {d.toPack.count > 0 && (
            <Link href="/orders/ship" className="attention" prefetch={false}>
              <span className="n">{d.toPack.count}</span>
              <span className="t">
                <b>Orders to pack and ship</b>
                <span className="muted">{d.toPack.waitingOver24h > 0 ? `${d.toPack.waitingOver24h} are over 24 hours old` : "Ready for courier dispatch"}</span>
              </span>
              <span className="link">Dispatch</span>
            </Link>
          )}
          {d.outOfStock.count > 0 && (
            <Link href="/inventory?filter=out" className="attention" prefetch={false}>
              <span className="n" style={{ color: "var(--danger)" }}>{d.outOfStock.count}</span>
              <span className="t">
                <b>{d.outOfStock.count === 1 ? "Product" : "Products"} out of stock</b>
                <span className="muted">{d.outOfStock.examples.join(", ")}</span>
              </span>
              <span className="link">Restock</span>
            </Link>
          )}
        </section>
      )}

      {/* Main 2-Column Responsive Operations Layout */}
      <div className="split" style={{ marginTop: 16 }}>
        {/* Left Column (Wide) */}
        <div className="col stack">
          {/* 3-Way COD Cashflow Ledger */}
          <section className="card" data-testid="cod-cashflow-ledger">
            <div className="card-head">
              <div>
                <h2>3-Way COD Cashflow Ledger</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Cash in courier transit vs pending disbursement</p>
              </div>
              <Link href="/finance/cod" className="link" style={{ fontSize: 12.5 }} prefetch={false}>
                Reconciliation & payouts →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 4 }}>
              <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>In Transit (Riders)</div>
                <div className="num" style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: "var(--brand)" }}>{taka(d.codLedger.inTransitAmount)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{d.codLedger.inTransitOrders} parcels on delivery</div>
              </div>
              <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Awaiting Payout</div>
                <div className="num" style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: "var(--warning)" }}>{taka(d.codLedger.awaitingPayoutAmount)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{d.codLedger.awaitingPayoutOrders} delivered, courier holding</div>
              </div>
              <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Settled Payouts</div>
                <div className="num" style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: "var(--success)" }}>{taka(d.codLedger.settledAmount)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{d.codLedger.settledOrders} cleared to bank</div>
              </div>
              <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Direct MFS</div>
                <div className="num" style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: "var(--info)" }}>{taka(d.codLedger.directMfsAmount)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{d.codLedger.directMfsOrders} bKash/Nagad direct</div>
              </div>
            </div>
          </section>

          {/* Delivery Health Barometer */}
          <section className="card" data-testid="courier-health-barometer">
            <div className="card-head">
              <div>
                <h2>Delivery Health Barometer</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Courier delivery success rate and return protection</p>
              </div>
              <Link href="/reports/couriers" className="link" style={{ fontSize: 12.5 }} prefetch={false}>
                Courier analytics →
              </Link>
            </div>

            {d.courierHealth.isReturnRateElevated && (
              <div className="notice bad" style={{ marginBottom: 12, padding: "8px 12px", fontSize: 13 }} role="alert">
                <b>Elevated Return Rate ({d.courierHealth.returnRate}%):</b> Returns have exceeded the 12% safe threshold. Use phone confirmation calls before dispatch or enable Fraud Shield to screen high-risk COD buyers.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ padding: 12, background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>Success Rate</span>
                  <span className={`pill ${d.courierHealth.successRate >= 85 ? "good" : "warn"}`}>{d.courierHealth.successRate}%</span>
                </div>
                <div className="meter" style={{ marginTop: 8 }} aria-hidden="true">
                  <i style={{ width: `${Math.min(100, d.courierHealth.successRate)}%`, background: "var(--success)" }} />
                </div>
              </div>

              <div style={{ padding: 12, background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>Return Rate (RTO)</span>
                  <span className={`pill ${d.courierHealth.returnRate <= 10 ? "good" : "bad"}`}>{d.courierHealth.returnRate}%</span>
                </div>
                <div className="meter" style={{ marginTop: 8 }} aria-hidden="true">
                  <i style={{ width: `${Math.min(100, d.courierHealth.returnRate * 3)}%`, background: d.courierHealth.returnRate > 12 ? "var(--danger)" : "var(--warning)" }} />
                </div>
              </div>
            </div>

            {d.courierHealth.courierBreakdown.length > 0 && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>Courier Network Volume Share:</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {d.courierHealth.courierBreakdown.map((c) => (
                    <div key={c.courier} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{c.courier}</span>
                      <span className="chip" style={{ fontSize: 11, padding: "2px 6px" }}>{c.count} parcels ({c.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Sales Chart with Dhaka Comparisons */}
          {showMoney && (
            <section className="card" data-testid="sales-chart">
              <div className="card-head">
                <h2>Sales, last {ser.range} days</h2>
                <div className="view-toggle" role="group" aria-label="Date range">
                  {DASHBOARD_RANGES.map((r) => (
                    <Link
                      key={r}
                      href={r === 7 ? "/" : `/?range=${r}`}
                      className="chip"
                      aria-current={ser.range === r ? "true" : undefined}
                      prefetch={false}
                      data-testid={`range-${r}`}
                    >
                      {r} days
                    </Link>
                  ))}
                </div>
              </div>
              <div className="num" style={{ fontSize: 24, fontWeight: 800 }} data-testid="sales-total">{taka(ser.total)}</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                {ser.orders} {ser.orders === 1 ? "order" : "orders"} · {chg == null ? "No earlier period to compare" : `${chg >= 0 ? "+" : ""}${chg}% vs the previous ${ser.range} days (${taka(ser.previousTotal)})`}
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" role="img" aria-label={`Sales per day for the last ${ser.range} days, with the previous ${ser.range} days as a dashed line. Total ${taka(ser.total)}, before ${taka(ser.previousTotal)}.`}>
                <path d={`M0 ${H - 0.5}H${W}`} stroke="var(--line)" />
                {ser.days.map((x, i) => (
                  <rect
                    key={x.date}
                    x={i * bw + bw * 0.15}
                    width={bw * 0.7}
                    y={y(x.sales)}
                    height={H - y(x.sales)}
                    rx={2}
                    fill="var(--brand)"
                    opacity={i === ser.days.length - 1 ? 1 : 0.6}
                  >
                    <title>{`${shortDate(x.date)}: ${taka(x.sales)}`}</title>
                  </rect>
                ))}
                <polyline points={prevLine} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12.5, marginTop: 6 }} aria-hidden="true">
                <span className="muted">{shortDate(ser.days[0]!.date)}</span>
                <span className="muted">
                  <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--brand)", borderRadius: 2, marginRight: 4 }} />
                  This period
                  <span style={{ display: "inline-block", width: 16, borderTop: "2px dashed var(--ink-3)", margin: "0 4px 3px 10px" }} />
                  Before
                </span>
                <span className="muted">{shortDate(ser.days.at(-1)!.date)}</span>
              </div>
              <Link href="/reports" className="link" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: 40 }}>
                Full revenue report →
              </Link>
            </section>
          )}

          {/* Recent Orders Table */}
          <section>
            <div className="card-head">
              <h2 style={{ fontSize: 16 }}>Recent orders</h2>
              <Link href="/orders" className="link" prefetch={false}>View all orders</Link>
            </div>
            {d.recent.length === 0 ? (
              <div className="card empty">No orders yet. When a customer orders, it shows up here.</div>
            ) : (
              <>
                <div className="only-mobile">
                  {d.recent.map((o) => (
                    <Link key={o.id} href={`/orders/${o.id}`} className="list-card" prefetch={false}>
                      <div className="top"><b>{o.customerName}</b><span className="num">{taka(o.totalAmount)}</span></div>
                      <div className="muted" style={{ fontSize: 13 }}>{o.orderNumber} · {o.area}</div>
                      <div className="row" style={{ marginTop: 8 }}><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /><OrderPill status={o.status} /></div>
                    </Link>
                  ))}
                </div>
                <table className="table only-desktop">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Fulfilment</th>
                      <th className="r">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/orders/${o.id}`} className="link" prefetch={false}>{o.orderNumber}</Link></td>
                        <td>{o.customerName}<div className="muted" style={{ fontSize: 12.5 }}>{o.area}, {o.district}</div></td>
                        <td><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /></td>
                        <td><OrderPill status={o.status} /></td>
                        <td className="r num">{taka(o.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="col stack">
          {/* Active Apps & Shortcuts Widget */}
          <section className="card" data-testid="active-apps-card">
            <div className="card-head">
              <h2>Installed Apps & Extensions</h2>
              <Link href="/settings/apps" className="link" style={{ fontSize: 12.5 }} prefetch={false}>
                App store →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BoltIcon width={16} height={16} style={{ color: "var(--brand)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>POS & Barcode Register</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>Retail counter sales</div>
                  </div>
                </div>
                <Link href="/pos" className="btn btn-sm btn-secondary" prefetch={false}>Open</Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "#8B5CF6" }} aria-hidden="true">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Marketing Content Studio</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>Copywriter & Address Parsing</div>
                  </div>
                </div>
                <Link href="/marketing/ai" className="btn btn-sm btn-secondary" prefetch={false}>Launch</Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SearchIcon width={16} height={16} style={{ color: "var(--danger)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Courier Fraud Shield</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>5-network COD trust score</div>
                  </div>
                </div>
                <Link href="/fraud" className="btn btn-sm btn-secondary" prefetch={false}>Check</Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TagIcon width={16} height={16} style={{ color: "var(--success)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Campaigns & SMS</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>Broadcast & offers</div>
                  </div>
                </div>
                <Link href="/marketing/campaigns" className="btn btn-sm btn-secondary" prefetch={false}>Manage</Link>
              </div>
            </div>
          </section>

          {/* Setup Guide Meter */}
          {d.setup.done < d.setup.steps.length && (
            <section className="card" data-testid="setup-card">
              <div className="card-head">
                <h2>Finish setting up</h2>
                <span className="muted">{d.setup.done} of {d.setup.steps.length}</span>
              </div>
              <div className="meter" aria-hidden="true">
                <i style={{ width: `${(d.setup.done / d.setup.steps.length) * 100}%` }} />
              </div>
              <div style={{ marginTop: 8 }}>
                {d.setup.steps.map((st) => (
                  <div key={st.key} className={`setup-step${st.done ? " done" : ""}`}>
                    <span className="dot" aria-hidden="true">{st.done ? "✓" : ""}</span>
                    {st.done ? <span>{SETUP[st.key].label}</span> : <Link href={SETUP[st.key].href} className="link" prefetch={false}>{SETUP[st.key].label}</Link>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Low Stock Watchlist */}
          {d.lowStock.length > 0 && (
            <section className="card" data-testid="low-stock-card">
              <div className="card-head">
                <h2>Low stock alerts</h2>
                <Link href="/inventory?filter=low" className="link" prefetch={false}>See all</Link>
              </div>
              {d.lowStock.map((l) => (
                <div key={l.variantId} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 13.5 }}>
                    {l.productTitle}
                    {l.variantTitle.toLowerCase() !== "default" ? <span className="muted"> · {l.variantTitle}</span> : null}
                  </span>
                  <span className="pill warn">{l.stock} left</span>
                </div>
              ))}
            </section>
          )}

          {/* Growth Tips */}
          <section className="card" data-testid="tips-card">
            <div className="card-head"><h2>Growth Tips</h2></div>
            {tips.slice(0, 3).map((t) => (
              <div key={t.text} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13.5 }}>{t.text}</p>
                <Link href={t.href} className="link" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: 36, fontSize: 13 }}>
                  {t.cta} →
                </Link>
              </div>
            ))}
          </section>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: 12.5 }}>Updated {friendlyDate(now, now)} · Asia/Dhaka</p>
        </>
      )}
    </>
  );
}
