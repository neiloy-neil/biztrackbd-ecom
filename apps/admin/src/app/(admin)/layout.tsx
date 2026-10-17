import Link from "next/link";
import { cookies } from "next/headers";
import { ROLE_LABELS, can, getActiveAnnouncementsForTenant, getStoreSettings, getTenantActiveModules, getTenantCapabilities, shellCounts, type Area, type TenantCapabilities } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { ChartIcon, CustomersIcon, GearIcon, HomeIcon, MoreIcon, OrdersIcon, ProductsIcon, PuzzleIcon, StoreIcon, TagIcon } from "@/components/icons";
import { NavLink } from "@/components/nav";
import { PwaRegister } from "@/components/pwa";
import { ReadOnlyGuard } from "@/components/read-only";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { DemoBanner } from "@/components/demo-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { trialHref } from "@/lib/demo";
import { CommandPalette, ShellProvider, SideNav, TopActions, type NavGroup, type Page } from "@/components/shell";
import { AdminCopilotWidget } from "@/components/admin-copilot-widget";
import { ThemeSwitch } from "./theme-switch";
import { getSession } from "@/lib/session";
import { authMode } from "@/lib/auth";
import { LANG_COOKIE, asLang, tr } from "@/lib/i18n";
import { storefrontOrigin } from "@/lib/store-url";
import { logoutAction } from "../login/actions";
import { switchDevUser } from "./dev-actions";

// Every admin page depends on who is signed in, so nothing here may be prerendered at build time.
export const dynamic = "force-dynamic";

interface Item { href: string; label: string; area: Area; exact?: boolean; badge?: "check"; moduleKey?: string; capability?: keyof TenantCapabilities }
interface Group { id: string; label: string; icon: React.ReactNode; items: Item[]; activePrefixes?: string[]; capability?: keyof TenantCapabilities }
// Nine groups, as in the design canvas' sidebar. Every existing page is still one click away inside its group.
const GROUPS: Group[] = [
  { id: "home", label: "Home", icon: <HomeIcon />, items: [{ href: "/", label: "Home", area: "orders", exact: true }] },
  {
    id: "orders", label: "Orders", icon: <OrdersIcon />,
    capability: "commerce",
    items: [
      { href: "/orders", label: "Orders", area: "orders", badge: "check" },
      { href: "/pos", label: "POS Terminal", area: "orders", moduleKey: "pos_barcode" },
      { href: "/orders/new", label: "Quick order", area: "orders" },
      { href: "/returns", label: "Returns", area: "orders", moduleKey: "customer_returns" },
      { href: "/abandoned", label: "Abandoned checkouts", area: "customers" },
      { href: "/fraud", label: "Fraud check", area: "orders", moduleKey: "fraud_shield" },
    ],
    activePrefixes: ["/orders", "/pos", "/returns", "/fraud"],
  },
  {
    id: "products",
    label: "Products",
    icon: <ProductsIcon />,
    capability: "commerce",
    items: [
      { href: "/products", label: "Products", area: "products" },
      { href: "/inventory", label: "Inventory", area: "products" },
      { href: "/products/wholesale", label: "Wholesale & B2B", area: "products", moduleKey: "wholesale_b2b" },
      { href: "/products/barcodes", label: "Barcode Studio", area: "products", moduleKey: "pos_barcode" },
      { href: "/products/categories", label: "Categories", area: "products" },
    ],
    activePrefixes: ["/products", "/inventory"],
  },
  {
    id: "customers",
    label: "Customers",
    icon: <CustomersIcon />,
    items: [
      { href: "/leads", label: "Leads & Inquiries", area: "customers", capability: "leads" },
      { href: "/customers", label: "Customers", area: "customers", capability: "commerce" },
      { href: "/inbox", label: "Inbox", area: "customers" },
      { href: "/reviews", label: "Reviews", area: "marketing", moduleKey: "product_reviews", capability: "commerce" },
      { href: "/marketing/loyalty", label: "Loyalty and referrals", area: "marketing", moduleKey: "loyalty", capability: "commerce" },
    ],
    activePrefixes: ["/leads", "/customers", "/inbox"],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: <TagIcon />,
    items: [
      { href: "/marketing", label: "Overview", area: "marketing", exact: true },
      { href: "/marketing/drops", label: "Limited Drops & Pre-Orders", area: "marketing", moduleKey: "limited_drops", capability: "commerce" },
      { href: "/marketing/bundles", label: "Bundles & Upsells", area: "marketing", moduleKey: "product_bundles", capability: "commerce" },
      { href: "/marketing/whatsapp", label: "WhatsApp Automation", area: "marketing", moduleKey: "whatsapp_commerce" },
      { href: "/marketing/affiliates", label: "Affiliates & Influencers", area: "marketing", capability: "commerce" },
      { href: "/marketing/coupons", label: "Discounts", area: "marketing", capability: "commerce" },
      { href: "/marketing/campaigns", label: "Campaigns", area: "marketing", moduleKey: "marketing_campaigns" },
      { href: "/marketing/notifications", label: "Notifications", area: "marketing", moduleKey: "marketing_campaigns" },
      { href: "/marketing/banner", label: "Banner & Flash sale", area: "marketing", moduleKey: "marketing_campaigns" },
      { href: "/marketing/pixels", label: "Pixels & CAPI", area: "marketing" },
      { href: "/marketing/loyalty", label: "Loyalty & Referrals", area: "marketing", moduleKey: "loyalty", capability: "commerce" },
      { href: "/abandoned", label: "Abandoned checkouts", area: "customers", capability: "commerce" },
    ],
    activePrefixes: ["/marketing", "/abandoned"],
  },
  {
    id: "store",
    label: "Online store",
    icon: <StoreIcon />,
    items: [
      { href: "/design", label: "Store design", area: "design" },
      { href: "/menu", label: "Menu", area: "design", capability: "menu" },
      { href: "/services", label: "Services", area: "design", capability: "services" },
      { href: "/portfolio", label: "Portfolio", area: "design", capability: "portfolio_items" },
      { href: "/team", label: "Team", area: "design", capability: "team_profiles" },
      { href: "/credentials", label: "Credentials", area: "design", capability: "credentials" },
      { href: "/publications", label: "Publications", area: "design", capability: "credentials" },
      { href: "/events", label: "Events", area: "design", capability: "public_events" },
      { href: "/downloads", label: "Downloads", area: "design", capability: "downloads" },
      { href: "/landing", label: "Landing pages", area: "design", moduleKey: "landing_builder" },
      { href: "/pages", label: "Pages built from sections", area: "design" },
      { href: "/content", label: "Pages and blog", area: "design" },
    ],
    activePrefixes: ["/design", "/menu", "/services", "/portfolio", "/team", "/credentials", "/publications", "/events", "/downloads", "/content-items", "/landing", "/pages", "/content"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: <ChartIcon />,
    items: [
      { href: "/reports", label: "Overview & Sales", area: "reports", exact: true },
      { href: "/reports/products", label: "Products & Stock", area: "reports", capability: "commerce" },
      { href: "/reports/couriers", label: "Courier Performance", area: "reports", capability: "commerce" },
      { href: "/reports/customers", label: "Customer Analytics", area: "reports", capability: "commerce" },
      { href: "/finance/cod", label: "COD payouts", area: "reports", capability: "commerce" },
      { href: "/finance/profit", label: "Profit and loss", area: "reports", capability: "commerce" },
    ],
    activePrefixes: ["/reports", "/finance"],
  },
  { id: "apps", label: "Apps", icon: <PuzzleIcon />, items: [{ href: "/settings/apps", label: "Apps & Integrations", area: "billing" }] },
  {
    id: "settings", label: "Settings", icon: <GearIcon />,
    items: [
      { href: "/settings/store", label: "Settings", area: "design" },
      { href: "/settings/import", label: "Import content", area: "design" },
      { href: "/support", label: "Help and support", area: "design" },
    ],
    activePrefixes: ["/settings/store", "/settings/import", "/settings/domains", "/settings/payments", "/settings/shipping", "/settings/staff", "/settings/audit", "/billing", "/support"],
  },
];

const STRINGS = {
  en: { search: "Search", searchPlaceholder: "Search orders, products, customers", goTo: "Go to", noMatches: "No matches", typeToSearch: "Type at least 2 letters to search orders, products and customers.", notifications: "Notifications", allClear: "Nothing needs your attention", viewStore: "View store" },
  bn: { search: "খুঁজুন", searchPlaceholder: "অর্ডার, পণ্য, কাস্টমার খুঁজুন", goTo: "যান", noMatches: "কিছু পাওয়া যায়নি", typeToSearch: "অর্ডার, পণ্য ও কাস্টমার খুঁজতে অন্তত ২ অক্ষর লিখুন।", notifications: "নোটিফিকেশন", allClear: "আপনার মনোযোগ দরকার এমন কিছু নেই", viewStore: "স্টোর দেখুন" },
} as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const role = s.user.role;
  const lang = asLang((await cookies()).get(LANG_COOKIE)?.value);
  const [staff, settings, counts, announcements, activeModules, capabilities] = await Promise.all([
    withTenant(s.tenantId, (tx) => tx.tenantUser.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { email: true, name: true, role: true } })),
    can(role, "design") ? getStoreSettings(s.tenantId, s.actor) : Promise.resolve(null),
    shellCounts(s.tenantId, s.actor),
    getActiveAnnouncementsForTenant(s.tenantId),
    getTenantActiveModules(s.tenantId),
    getTenantCapabilities(s.tenantId),
  ]);
  const storeName = settings?.storeName ?? s.tenantSubdomain;
  const check = counts.check;
  const a = s.access;
  const banner =
    a.state === "TRIAL" && a.daysLeft !== null && a.daysLeft <= 3 ? { tone: "", text: `Your free trial ends ${a.daysLeft <= 1 ? "within a day" : `in ${a.daysLeft} days`}. Choose a plan to keep selling.` }
    : a.state === "ACTIVE" && a.daysLeft !== null && a.daysLeft <= 3 ? { tone: "", text: `Your plan renews ${a.daysLeft <= 1 ? "within a day" : `in ${a.daysLeft} days`}. Send your payment to stay on plan.` }
    : a.state === "GRACE" ? { tone: "bad", text: `Your plan has run out. Pay within ${4 - (a.overdueDays ?? 1)} ${4 - (a.overdueDays ?? 1) === 1 ? "day" : "days"}, or the store goes offline and your admin becomes read-only.` }
    : a.state === "READ_ONLY" ? { tone: "bad", text: "Your store is offline and your admin is read-only until the plan is paid. You can still look at everything and download your data." }
    : null;

  // What this person may open, translated, for the side menu and the search box.
  const groups: NavGroup[] = GROUPS.flatMap((g) => {
    if (g.capability && !capabilities[g.capability]) return [];
    const items = g.items
      .filter((it) => can(role, it.area) && (!it.moduleKey || Boolean(activeModules[it.moduleKey])) && (!it.capability || Boolean(capabilities[it.capability])))
      .map((it) => ({ href: it.href, label: tr(lang, it.label), exact: it.exact, badge: it.badge }));
    if (!items.length) return [];
    let groupLabel = tr(lang, g.label);
    if (g.id === "customers" && !capabilities.commerce) {
      groupLabel = tr(lang, "Leads & Inquiries");
    } else if (g.id === "store" && !capabilities.commerce) {
      groupLabel = tr(lang, "Website");
    }
    return [{ id: g.id, label: groupLabel, icon: g.icon, items, activePrefixes: g.activePrefixes }];
  });
  const pages: Page[] = groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label })));

  const bottom: { href: string; label: string; area: Area; exact?: boolean; icon: React.ReactNode; badge?: number }[] = [
    { href: "/", label: tr(lang, "Home"), area: "orders", exact: true, icon: <HomeIcon /> },
    ...(capabilities.commerce
      ? [
          { href: "/orders", label: tr(lang, "Orders"), area: "orders" as Area, icon: <OrdersIcon />, badge: check },
          { href: "/products", label: tr(lang, "Products"), area: "products" as Area, icon: <ProductsIcon /> },
          { href: "/customers", label: tr(lang, "Customers"), area: "customers" as Area, icon: <CustomersIcon /> },
        ]
      : [
          { href: "/leads", label: tr(lang, "Leads"), area: "customers" as Area, icon: <CustomersIcon /> },
          { href: "/pages", label: tr(lang, "Pages"), area: "design" as Area, icon: <StoreIcon /> },
          { href: "/design", label: tr(lang, "Design"), area: "design" as Area, icon: <GearIcon /> },
        ]),
    { href: "/more", label: tr(lang, "More"), area: "orders", icon: <MoreIcon /> },
  ];
  const storeHref = storefrontOrigin(s.tenantSubdomain);
  const trialPct = a.state === "TRIAL" && a.daysLeft !== null ? Math.max(4, Math.min(100, Math.round(((14 - a.daysLeft) / 14) * 100))) : null;

  const strings = {
    ...STRINGS[lang],
    searchPlaceholder: capabilities.commerce
      ? STRINGS[lang].searchPlaceholder
      : lang === "bn"
      ? "পেজ, লিড, ব্লগ খুঁজুন"
      : "Search pages, leads, blog",
  };

  return (
    <ShellProvider initial={counts} pages={pages} strings={strings}>
      {s.demo && <DemoBanner expiresAt={s.demo.expiresAt} keepHref={trialHref(s.demo.keep)} now={Date.now()} />}
      {s.impersonation && (
        <ImpersonationBanner
          tenantName={storeName}
          tenantId={s.tenantId}
          actorEmail={s.impersonation.actorEmail}
          expiresAt={s.impersonation.expiresAt}
        />
      )}
      <div className="shell">
        <PwaRegister />
        <header className="topbar">
          <span className="logo-mark" aria-hidden="true">B</span>
          <span className="store">{storeName}</span>
          <TopActions storeHref={storeHref} lang={lang} compact />
          <Link href="/orders/new" className="btn btn-primary btn-sm" prefetch={false}>{tr(lang, "New order")}</Link>
        </header>

        <aside className="side">
          <div className="brand"><span className="logo-mark" aria-hidden="true">B</span> BizTrackBD</div>
          <div className="store-chip"><b>{storeName}</b>{s.tenantSubdomain}</div>
          <SideNav groups={groups} />
          {trialPct !== null && can(role, "billing") && (
            <div className="plan-card" data-testid="plan-card">
              <div className="k">{tr(lang, "Free trial")}</div>
              <div className="v">{a.daysLeft} {a.daysLeft === 1 ? "day" : "days"} left</div>
              <div className="meter" aria-hidden><i style={{ width: `${trialPct}%` }} /></div>
              <Link href="/billing" prefetch={false}>{tr(lang, "Choose a plan")}</Link>
            </div>
          )}
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
                <form action={logoutAction}><button type="submit" className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }} data-testid="sign-out">{tr(lang, "Sign out")}</button></form>
              </div>
            )}
          </div>
        </aside>

        <div className="main-col">
          <div className="dtop"><TopActions storeHref={storeHref} lang={lang} /></div>
          <main className="content" id="main">
            <AnnouncementBanner announcements={announcements} lang={lang} />
            {banner && can(role, "billing") && (
              <div className={`notice ${banner.tone}`} role="status" style={{ marginBottom: 14 }} data-testid="billing-banner">{banner.text} <Link href="/billing" className="link" prefetch={false}>See plans and pay</Link></div>
            )}
            {banner && !can(role, "billing") && <div className={`notice ${banner.tone}`} role="status" style={{ marginBottom: 14 }} data-testid="billing-banner">{banner.text} Ask the store owner.</div>}
            <ReadOnlyGuard on={a.state === "READ_ONLY"}>{children}</ReadOnlyGuard>
          </main>
        </div>

        <nav className="bottom-nav" aria-label="Main">
          {bottom.filter((b) => can(role, b.area)).map((b) => (
            <NavLink key={b.href} href={b.href} exact={b.exact}>
              {b.icon}
              {b.label}
              {b.badge ? <span className="nav-badge" aria-label={`${b.badge} to check`}>{b.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <CommandPalette />
        <AdminCopilotWidget />
      </div>
    </ShellProvider>
  );
}
