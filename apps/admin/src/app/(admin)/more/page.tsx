import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABELS, can, type Area } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { InstallApp } from "@/components/pwa";
import { requireAccess } from "@/lib/session";
import { ThemeSwitch } from "../theme-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "More" };

const ITEMS: { href: string; label: string; area: Area }[] = [
  { href: "/orders/new", label: "Quick order", area: "orders" },
  { href: "/inventory", label: "Inventory", area: "products" },
  { href: "/marketing/bundles", label: "Bundles and upsells", area: "marketing" },
  { href: "/marketing/whatsapp", label: "WhatsApp Automation", area: "marketing" },
  { href: "/marketing/coupons", label: "Discounts and coupons", area: "marketing" },
  { href: "/abandoned", label: "Abandoned checkouts", area: "customers" },
  { href: "/reviews", label: "Reviews", area: "marketing" },
  { href: "/marketing/loyalty", label: "Loyalty and referrals", area: "marketing" },
  { href: "/marketing/pixels", label: "Pixels and tracking", area: "marketing" },
  { href: "/returns", label: "Returns and exchanges", area: "orders" },
  { href: "/fraud", label: "Fraud check", area: "orders" },
  { href: "/reports", label: "Reports", area: "reports" },
  { href: "/finance/cod", label: "COD payouts", area: "reports" },
  { href: "/finance/profit", label: "Profit and loss", area: "reports" },
  { href: "/design", label: "Store design", area: "design" },
  { href: "/landing", label: "Landing pages", area: "design" },
  { href: "/content", label: "Pages and blog", area: "design" },
  { href: "/settings/store", label: "Store details", area: "design" },
  { href: "/settings/domains", label: "Domains", area: "billing" },
  { href: "/settings/payments", label: "Payments", area: "billing" },
  { href: "/settings/shipping", label: "Delivery charges", area: "orders" },
  { href: "/settings/apps", label: "Apps and Integrations", area: "billing" },
  { href: "/settings/staff", label: "Team", area: "team" },
  { href: "/settings/audit", label: "Audit log", area: "team" },
  { href: "/security", label: "Sign-in and security", area: "orders" },
  { href: "/billing", label: "Plan and usage", area: "billing" },
];

/** The phone's menu for everything that does not fit in the bottom tabs. On a desktop the sidebar has all of this. */
export default async function More() {
  const s = await requireAccess("orders");
  return (
    <>
      <PageHeader
        title="More"
        sub={`${s.user.name} · ${ROLE_LABELS[s.user.role]} (${s.tenantSubdomain})`}
      />
      <nav className="card menu-list" aria-label="More" style={{ padding: "0 12px" }} data-testid="more-menu">
        {ITEMS.filter((i) => can(s.user.role, i.area)).map((i) => <Link key={i.href} href={i.href} prefetch={false}>{i.label}</Link>)}
      </nav>
      <section className="card" style={{ marginTop: 14 }}><ThemeSwitch /></section>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Use it like an app</h2>
        <InstallApp />
      </section>
    </>
  );
}
