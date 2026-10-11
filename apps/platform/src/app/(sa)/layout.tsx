import Link from "next/link";
import { canPlatform, getOverview, type PlatformArea } from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
import { NavLink } from "@/components/nav";
import { getSession } from "@/lib/session";
import { authMode } from "@/lib/auth";
import { logoutAction } from "../login/actions";
import { switchDevUser } from "./dev-actions";

export const dynamic = "force-dynamic";

const ITEMS: { href: string; label: string; area: PlatformArea; exact?: boolean }[] = [
  { href: "/", label: "Overview", area: "tenants", exact: true },
  { href: "/tenants", label: "Stores", area: "tenants" },
  { href: "/payments", label: "Payments", area: "payments" },
  { href: "/domains", label: "Domains", area: "tenants" },
  { href: "/plans", label: "Plans", area: "plans" },
  { href: "/audit", label: "Audit log", area: "audit" },
];

const ROLE: Record<string, string> = { OWNER: "Owner", FINANCE: "Finance", SUPPORT_LEAD: "Support lead", SUPPORT: "Support" };

export default async function SaLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const users = await getPlatformPrisma().platformUser.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { email: true, name: true, role: true } });
  const overview = await getOverview(s.actor);
  const pending = overview.pendingPayments.count;
  const items = ITEMS.filter((i) => canPlatform(s.user.role, i.area));

  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo-mark" aria-hidden="true">B</span>
        <span className="store">BizTrackBD Platform</span>
      </header>
      <aside className="side">
        <div className="brand"><span className="logo-mark" aria-hidden="true">B</span> Platform</div>
        <nav aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact}>
              <span style={{ width: 22 }} />
              {i.label}
              {i.href === "/payments" && pending > 0 && <span className="count" aria-label={`${pending} payments to check`}>{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          <div><b>{s.user.name}</b></div>
          <div className="muted">{ROLE[s.user.role] ?? s.user.role}</div>
          {authMode() === "dev" ? (
            <>
          {/* Development only: act as another platform user to try each role. Goes away with real sign-in. */}
          <form action={switchDevUser} style={{ marginTop: 10 }}>
            <label className="muted" htmlFor="dev_user" style={{ fontSize: 12 }}>Dev: act as</label>
            <select id="dev_user" name="email" defaultValue={s.user.email} className="select input-sm" style={{ marginTop: 4 }}>
              {users.map((u) => <option key={u.email} value={u.email}>{u.name} ({ROLE[u.role] ?? u.role})</option>)}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }}>Switch</button>
          </form>
            </>
          ) : (
            <form action={logoutAction} style={{ marginTop: 10 }}><button type="submit" className="btn btn-secondary btn-sm btn-block" data-testid="sign-out">Sign out</button></form>
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
