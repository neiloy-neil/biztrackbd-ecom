import Link from "next/link";
import { canPlatform, getOverview, type PlatformArea } from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
import { NavLink } from "@/components/nav";
import { getSession } from "@/lib/session";
import { authMode } from "@/lib/auth";
import { logoutAction } from "../login/actions";
import { switchDevUser } from "./dev-actions";
import { SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const ITEMS: { href: string; label: string; area: PlatformArea; exact?: boolean; iconPath: string; isTickets?: boolean; isPayments?: boolean; isInquiries?: boolean }[] = [
  { href: "/", label: "Overview", area: "tenants", exact: true, iconPath: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" },
  { href: "/tenants", label: "Tenants", area: "tenants", iconPath: "M4 9l1.5-5h13L20 9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M5 12v8h14v-8" },
  { href: "/payments", label: "Payments and plans", area: "payments", iconPath: "M4.5 5h15A2.5 2.5 0 0122 7.5v9a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 16.5v-9A2.5 2.5 0 014.5 5zM2 10h20", isPayments: true },
  { href: "/domains", label: "Domains", area: "tenants", iconPath: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
  { href: "/themes", label: "Themes and modules", area: "tenants", iconPath: "M3 3h7.5v7.5H3zM13.5 3H21v7.5h-7.5zM3 13.5h7.5V21H3zM13.5 13.5H21V21h-7.5z" },
  { href: "/inquiries", label: "Inquiries", area: "tickets", iconPath: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", isInquiries: true },
  { href: "/tickets", label: "Support tickets", area: "tickets", iconPath: "M4 5h16v11H9l-5 4V5z", isTickets: true },
  { href: "/announcements", label: "Announcements", area: "announcements", iconPath: "M4 10v4h3l8 4V6L7 10H4zM18 9a4 4 0 010 6" },
  { href: "/blog", label: "Blog", area: "blog", iconPath: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" },
  { href: "/usage", label: "Usage and limits", area: "tenants", iconPath: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2" },
  { href: "/audit", label: "Team and audit log", area: "audit", iconPath: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" },
  { href: "/settings", label: "Platform settings", area: "settings", iconPath: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const ROLE: Record<string, string> = { OWNER: "Platform owner", FINANCE: "Finance", SUPPORT_LEAD: "Support lead", SUPPORT: "Support" };

export default async function SaLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const users = await getPlatformPrisma().platformUser.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { email: true, name: true, role: true } });
  const overview = await getOverview(s.actor);
  const pending = overview.pendingPayments.count;
  const openTickets = overview.openTickets;
  const newInquiries = await getPlatformPrisma().platformInquiry.count({ where: { status: "NEW" } }).catch(() => 0);
  const items = ITEMS.filter((i) => canPlatform(s.user.role, i.area));
  const initials = s.user.name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "SA";

  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo-mark" aria-hidden="true">B</span>
        <span className="store">BizTrackBD Platform</span>
      </header>
      <aside className="side">
        <div className="sa-brand-block">
          <div className="brand">
            <svg width="28" height="28" viewBox="0 0 44 44" role="img" aria-label="BizTrackBD">
              <rect width="44" height="44" rx="12" fill="#5B4FE8" />
              <path d="M13 32V22M22 32V14M31 32V19" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" />
            </svg>
            <div>BizTrack<span className="brand-accent">BD</span></div>
          </div>
          <div className="sa-tag">PLATFORM ADMIN</div>
        </div>
        <nav aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={i.iconPath} />
              </svg>
              <span>{i.label}</span>
              {i.isPayments && pending > 0 && <span className="count" aria-label={`${pending} payments to check`}>{pending}</span>}
              {i.isTickets && openTickets > 0 && <span className="count" aria-label={`${openTickets} open support tickets`}>{openTickets}</span>}
              {i.isInquiries && newInquiries > 0 && <span className="count" aria-label={`${newInquiries} new inquiries`}>{newInquiries}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          <div className="who-user">
            <div className="who-avatar">{initials}</div>
            <div className="who-details">
              <div className="who-name">{s.user.name}</div>
              <div className="who-role">{ROLE[s.user.role] ?? s.user.role}</div>
            </div>
          </div>
          {authMode() === "dev" ? (
            <form action={switchDevUser} style={{ marginTop: 10 }}>
              <label className="muted" htmlFor="dev_user" style={{ fontSize: 12, color: "#A8A8D8" }}>Dev: act as</label>
              <select id="dev_user" name="email" defaultValue={s.user.email} className="select input-sm" style={{ marginTop: 4, width: "100%", background: "#252568", color: "#fff", borderColor: "#34347F" }}>
                {users.map((u) => <option key={u.email} value={u.email}>{u.name} ({ROLE[u.role] ?? u.role})</option>)}
              </select>
              <SubmitButton className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6, width: "100%", background: "#34347F", color: "#fff", borderColor: "#4E4E9E" }} pending={false}>Switch</SubmitButton>
            </form>
          ) : (
            <form action={logoutAction} style={{ marginTop: 10 }}>
              <SubmitButton className="btn btn-secondary btn-sm btn-block" data-testid="sign-out" style={{ width: "100%", background: "#34347F", color: "#fff", borderColor: "#4E4E9E" }} pending={false}>Sign out</SubmitButton>
            </form>
          )}
        </div>
      </aside>
      <main className="content" id="main">
        <nav className="only-mobile" aria-label="Sections" style={{ marginBottom: 12 }}>
          <div className="chips">{items.map((i) => <Link key={i.href} href={i.href} className="chip" prefetch={false}>{i.label}</Link>)}</div>
        </nav>
        {children}
      </main>
    </div>
  );
}
