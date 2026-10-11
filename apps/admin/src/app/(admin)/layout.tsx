import Link from "next/link";
import { ROLE_LABELS, can, getStoreSettings, orderTabCounts, type Area } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { BoltIcon, ChartIcon, CustomersIcon, GearIcon, HomeIcon, MoreIcon, OrdersIcon, ProductsIcon, TagIcon, BoxIcon } from "@/components/icons";
import { NavLink } from "@/components/nav";
import { PwaRegister } from "@/components/pwa";
import { ReadOnlyGuard } from "@/components/read-only";
import { ThemeSwitch } from "./theme-switch";
import { getSession } from "@/lib/session";
import { authMode } from "@/lib/auth";
import { logoutAction } from "../login/actions";
import { switchDevUser } from "./dev-actions";

// Every admin page depends on who is signed in, so nothing here may be prerendered at build time.
export const dynamic = "force-dynamic";

interface Item { href: string; label: string; area: Area; exact?: boolean; icon?: React.ReactNode; badge?: "check" }
const GROUPS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/", label: "Home", area: "orders", exact: true, icon: <HomeIcon /> },
      { href: "/orders", label: "Orders", area: "orders", icon: <OrdersIcon />, badge: "check" },
      { href: "/orders/new", label: "Quick order", area: "orders", icon: <BoltIcon /> },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/products", label: "Products", area: "products", icon: <ProductsIcon /> },
      { href: "/inventory", label: "Inventory", area: "products", icon: <BoxIcon /> },
      { href: "/customers", label: "Customers", area: "customers", icon: <CustomersIcon /> },
    ],
  },
  {
    title: "Fulfilment",
    items: [
      { href: "/returns", label: "Returns", area: "orders" },
      { href: "/fraud", label: "Fraud check", area: "orders" },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/marketing/coupons", label: "Discounts", area: "marketing", icon: <TagIcon /> },
      { href: "/abandoned", label: "Abandoned checkouts", area: "customers" },
      { href: "/reviews", label: "Reviews", area: "marketing" },
      { href: "/marketing/loyalty", label: "Loyalty and referrals", area: "marketing" },
      { href: "/marketing/pixels", label: "Pixels", area: "marketing" },
      { href: "/reports", label: "Reports", area: "reports", icon: <ChartIcon /> },
      { href: "/finance/cod", label: "COD payouts", area: "reports" },
      { href: "/finance/profit", label: "Profit and loss", area: "reports" },
    ],
  },
  {
    title: "Online store",
    items: [
      { href: "/design", label: "Store design", area: "design" },
      { href: "/landing", label: "Landing pages", area: "design" },
      { href: "/content", label: "Pages and blog", area: "design" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings/store", label: "Store details", area: "design", icon: <GearIcon /> },
      { href: "/settings/domains", label: "Domains", area: "billing" },
      { href: "/settings/payments", label: "Payments", area: "billing" },
      { href: "/settings/shipping", label: "Shipping", area: "orders" },
      { href: "/settings/integrations", label: "Integrations", area: "billing" },
      { href: "/settings/apps", label: "Apps", area: "billing" },
      { href: "/settings/staff", label: "Team", area: "team" },
      { href: "/settings/audit", label: "Audit log", area: "team" },
      { href: "/billing", label: "Plan and usage", area: "billing" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const role = s.user.role;
  const [staff, settings, counts] = await Promise.all([
    withTenant(s.tenantId, (tx) => tx.tenantUser.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { email: true, name: true, role: true } })),
    can(role, "design") ? getStoreSettings(s.tenantId, s.actor) : Promise.resolve(null),
    can(role, "orders") ? orderTabCounts(s.tenantId, s.actor) : Promise.resolve(null),
  ]);
  const storeName = settings?.storeName ?? s.tenantSubdomain;
  const check = counts?.check ?? 0;
  const a = s.access;
  const banner =
    a.state === "TRIAL" && a.daysLeft !== null && a.daysLeft <= 3 ? { tone: "", text: `Your free trial ends ${a.daysLeft <= 1 ? "within a day" : `in ${a.daysLeft} days`}. Choose a plan to keep selling.` }
    : a.state === "ACTIVE" && a.daysLeft !== null && a.daysLeft <= 3 ? { tone: "", text: `Your plan renews ${a.daysLeft <= 1 ? "within a day" : `in ${a.daysLeft} days`}. Send your payment to stay on plan.` }
    : a.state === "GRACE" ? { tone: "bad", text: `Your plan has run out. Pay within ${4 - (a.overdueDays ?? 1)} ${4 - (a.overdueDays ?? 1) === 1 ? "day" : "days"}, or the store goes offline and your admin becomes read-only.` }
    : a.state === "READ_ONLY" ? { tone: "bad", text: "Your store is offline and your admin is read-only until the plan is paid. You can still look at everything and download your data." }
    : null;

  const bottom: { href: string; label: string; area: Area; exact?: boolean; icon: React.ReactNode; badge?: number }[] = [
    { href: "/", label: "Home", area: "orders", exact: true, icon: <HomeIcon /> },
    { href: "/orders", label: "Orders", area: "orders", icon: <OrdersIcon />, badge: check },
    { href: "/products", label: "Products", area: "products", icon: <ProductsIcon /> },
    { href: "/customers", label: "Customers", area: "customers", icon: <CustomersIcon /> },
    { href: "/more", label: "More", area: "orders", icon: <MoreIcon /> },
  ];

  return (
    <div className="shell">
      <PwaRegister />
      <header className="topbar">
        <span className="logo-mark" aria-hidden="true">B</span>
        <span className="store">{storeName}</span>
        <Link href="/orders/new" className="btn btn-primary btn-sm" prefetch={false}>New order</Link>
      </header>

      <aside className="side">
        <div className="brand"><span className="logo-mark" aria-hidden="true">B</span> BizTrackBD</div>
        <div className="store-chip"><b>{storeName}</b>{s.tenantSubdomain}</div>
        <nav aria-label="Main">
          {GROUPS.map((g, i) => {
            const items = g.items.filter((it) => can(role, it.area));
            if (items.length === 0) return null;
            return (
              <div key={i}>
                {g.title && <div className="group">{g.title}</div>}
                {items.map((it) => (
                  <NavLink key={it.href} href={it.href} exact={it.exact}>
                    {it.icon ?? <span style={{ width: 22 }} />}
                    {it.label}
                    {it.badge === "check" && check > 0 && <span className="count" aria-label={`${check} payments to check`}>{check}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="who">
          <div><b>{s.user.name}</b></div>
          <div className="muted">{ROLE_LABELS[role]}</div>
          <div style={{ marginTop: 10 }}><ThemeSwitch /></div>
          {authMode() === "dev" ? (
            <>
          {/* Development only: act as another team member to try each role. Goes away with real sign-in. */}
          <form action={switchDevUser} style={{ marginTop: 10 }}>
            <label className="muted" htmlFor="dev_user" style={{ fontSize: 12 }}>Dev: act as</label>
            <select id="dev_user" name="email" defaultValue={s.user.email} className="select input-sm" style={{ marginTop: 4 }}>
              {staff.map((u) => <option key={u.email} value={u.email}>{u.name} ({ROLE_LABELS[u.role]})</option>)}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }}>Switch</button>
          </form>
            </>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }} data-testid="who-email">{s.user.email}</div>
              <NavLink href="/security">Sign-in and security</NavLink>
              <form action={logoutAction}><button type="submit" className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }} data-testid="sign-out">Sign out</button></form>
            </div>
          )}
        </div>
      </aside>

      <main className="content" id="main">
        {banner && can(role, "billing") && (
          <div className={`notice ${banner.tone}`} role="status" style={{ marginBottom: 14 }} data-testid="billing-banner">{banner.text} <Link href="/billing" className="link" prefetch={false}>See plans and pay</Link></div>
        )}
        {banner && !can(role, "billing") && <div className={`notice ${banner.tone}`} role="status" style={{ marginBottom: 14 }} data-testid="billing-banner">{banner.text} Ask the store owner.</div>}
        <ReadOnlyGuard on={a.state === "READ_ONLY"}>{children}</ReadOnlyGuard>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {bottom.filter((b) => can(role, b.area)).map((b) => (
          <NavLink key={b.href} href={b.href} exact={b.exact}>
            {b.icon}
            {b.label}
            {b.badge ? <span className="nav-badge" aria-label={`${b.badge} to check`}>{b.badge}</span> : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
