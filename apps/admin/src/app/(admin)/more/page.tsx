import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABELS, can, type Area } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { InstallApp } from "@/components/pwa";
import { requireAccess } from "@/lib/session";
import { ThemeSwitch } from "../theme-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "More" };

interface MoreSection {
  title: string;
  items: { href: string; label: string; area: Area; note?: string }[];
}

const SECTIONS: MoreSection[] = [
  {
    title: "Operations & Fulfillment",
    items: [
      { href: "/orders/new", label: "Quick Order Desk", area: "orders", note: "Phone order entry" },
      { href: "/inventory", label: "Inventory & Stock", area: "products", note: "Stock adjustments & alerts" },
      { href: "/returns", label: "Returns & Exchanges", area: "orders", note: "Customer return slips" },
      { href: "/fraud", label: "Fraud Check Radar", area: "orders", note: "Courier trust ratio" },
    ],
  },
  {
    title: "Marketing & Growth",
    items: [
      { href: "/marketing/coupons", label: "Discounts & Coupons", area: "marketing", note: "Promo codes" },
      { href: "/marketing/bundles", label: "Bundles & Upsells", area: "marketing", note: "Order bumps" },
      { href: "/marketing/whatsapp", label: "WhatsApp Automation", area: "marketing", note: "Order confirmation bots" },
      { href: "/marketing/loyalty", label: "Loyalty & Referrals", area: "marketing", note: "VIP points" },
      { href: "/marketing/pixels", label: "Pixels & Tracking", area: "marketing", note: "Meta CAPI & GA4" },
      { href: "/reviews", label: "Customer Reviews", area: "marketing", note: "Social proof" },
      { href: "/abandoned", label: "Abandoned Checkouts", area: "customers", note: "Recover lost carts" },
    ],
  },
  {
    title: "Analytics & Finance",
    items: [
      { href: "/reports", label: "Business Reports", area: "reports", note: "Sales, products & couriers" },
      { href: "/finance/cod", label: "COD Payouts & Claims", area: "reports", note: "Courier reconciliation" },
      { href: "/finance/profit", label: "Profit & Loss", area: "reports", note: "Net margins & COGS" },
    ],
  },
  {
    title: "Online Store & Content",
    items: [
      { href: "/design", label: "Store Design & Theme", area: "design", note: "Custom branding" },
      { href: "/landing", label: "Landing Pages", area: "design", note: "Single-product funnels" },
      { href: "/content", label: "Pages & Blog Articles", area: "design", note: "SEO content" },
    ],
  },
  {
    title: "Settings & System",
    items: [
      { href: "/settings/store", label: "Store Details & Policies", area: "design", note: "Name, phone & logo" },
      { href: "/settings/shipping", label: "Delivery Charges & Zones", area: "orders", note: "Inside / Outside Dhaka" },
      { href: "/settings/payments", label: "Payment Gateways & MFS", area: "billing", note: "bKash, Nagad, COD" },
      { href: "/settings/apps", label: "Apps & Integrations", area: "billing", note: "Steadfast, Pathao, RedX" },
      { href: "/settings/domains", label: "Custom Domains", area: "billing", note: "DNS & SSL setup" },
      { href: "/settings/staff", label: "Team & Permissions", area: "team", note: "Staff access roles" },
      { href: "/settings/audit", label: "Audit Log", area: "team", note: "Security activity log" },
      { href: "/security", label: "Sign-in & Security", area: "orders", note: "Passwords & 2FA" },
      { href: "/billing", label: "Plan & Usage", area: "billing", note: "Subscription tier" },
    ],
  },
];

/** The phone menu for everything that does not fit in the bottom tabs. */
export default async function More() {
  const s = await requireAccess("orders");

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="More"
        sub={`${s.user.name} · ${ROLE_LABELS[s.user.role]} (${s.tenantSubdomain})`}
      />

      {SECTIONS.map((sec, idx) => {
        const visibleItems = sec.items.filter((i) => can(s.user.role, i.area));
        if (visibleItems.length === 0) return null;

        return (
          <section key={idx} className="card" style={{ padding: "14px 16px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
              {sec.title}
            </h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {visibleItems.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < visibleItems.length - 1 ? "1px solid var(--line)" : "none",
                    color: "var(--ink)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                  {item.note && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{item.note}</span>}
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card" style={{ padding: "14px 16px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
          Appearance
        </h3>
        <ThemeSwitch />
      </section>

      <section className="card" style={{ padding: "14px 16px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
          Mobile Experience
        </h3>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>Install BizTrackBD on your home screen for rapid 1-tap merchant access.</p>
        <InstallApp />
      </section>
    </div>
  );
}
