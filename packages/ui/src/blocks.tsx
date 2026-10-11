import type { ElementType, ReactNode } from "react";

/** A link-like element. Apps pass next/link; the default is a plain anchor so the package has no framework dependency. */
export type LinkAs = ElementType;

export interface Crumb { label: string; href?: string }

/** Title, optional breadcrumbs, subtitle and action buttons. Every page starts with one. */
export function PageHeader({ title, sub, crumbs, actions, linkAs: L = "a" }: { title: ReactNode; sub?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; linkAs?: LinkAs }) {
  return (
    <header className="ph">
      {crumbs && crumbs.length > 0 && (
        <nav className="ph-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? <L href={c.href}>{c.label}</L> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="ph-row">
        <div className="ph-title"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
        {actions && <div className="ph-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** A titled card. Put related fields in `<FieldGrid>` inside it. */
export function Section({ title, description, action, children, id }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="sec" id={id}>
      {(title || action) && (
        <div className="sec-head">
          <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Two columns on desktop, one on phones. Give a child className="full" to span both. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="fields">{children}</div>;
}

export interface KpiData { label: string; value: ReactNode; delta?: ReactNode; trend?: "up" | "down" }
export function KpiRow({ items, three }: { items: KpiData[]; three?: boolean }) {
  return (
    <div className={`kpis${three ? " three" : ""}`}>
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="kpi-k">{k.label}</div>
          <div className="kpi-v">{k.value}</div>
          {k.delta && <div className={`kpi-d${k.trend ? ` ${k.trend}` : ""}`}>{k.delta}</div>}
        </div>
      ))}
    </div>
  );
}

export interface NavItem { href: string; label: string; current?: boolean }
/** Settings-style pages: section list on the left (a scrolling row of pills on phones), the page body on the right. */
export function SettingsLayout({ items, children, linkAs: L = "a", label = "Sections" }: { items: NavItem[]; children: ReactNode; linkAs?: LinkAs; label?: string }) {
  return (
    <div className="sl">
      <nav className="sl-nav" aria-label={label}>
        {items.map((i) => <L key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>{i.label}</L>)}
      </nav>
      <div className="sl-body">{children}</div>
    </div>
  );
}

/** Rarely used options, closed by default, so beginners see a short page. */
export function Advanced({ title = "Advanced", children }: { title?: ReactNode; children: ReactNode }) {
  return <details className="adv"><summary>{title}</summary><div className="adv-body">{children}</div></details>;
}

export function EmptyState({ title, text, action }: { title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

export function Skeleton({ width = "100%", height = 16 }: { width?: number | string; height?: number | string }) {
  return <span className="skel" style={{ width, height }} aria-hidden />;
}
