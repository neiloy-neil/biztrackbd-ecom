import type { ElementType, ReactNode } from "react";

/** A link-like element. Apps pass next/link; the default is a plain anchor so the package has no framework dependency. */
export type LinkAs = ElementType;

export interface Crumb { label: string; href?: string }

export interface PageHeaderProps {
  title: ReactNode;
  sub?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  linkAs?: LinkAs;
}

/** Title, optional breadcrumbs, subtitle and action buttons. Every page starts with one. */
export function PageHeader({ title, sub, description, badge, crumbs, actions, linkAs: L = "a" }: PageHeaderProps) {
  const subtitle = sub ?? description;
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
        <div className="ph-title">
          {badge ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1>{title}</h1>
              {badge}
            </div>
          ) : (
            <h1>{title}</h1>
          )}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions ? <div className="ph-actions">{actions}</div> : null}
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

/* ---- Modern High-Craft UI Primitives ---- */

export interface CardProps {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className = "", id, style }: CardProps) {
  return (
    <div className={`card-base ${className}`.trim()} id={id} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, children, className = "" }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`card-header-clean ${className}`.trim()}>
      {(title || description) ? (
        <div>
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      ) : (
        children
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card-body-clean ${className}`.trim()} style={style}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-footer-clean ${className}`.trim()}>{children}</div>;
}

export type StatusTone = "good" | "warn" | "bad" | "info" | "neutral";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ children, tone = "neutral", dot = true, className = "" }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${tone} ${className}`.trim()}>
      {dot && <span className="status-badge-dot" aria-hidden />}
      <span>{children}</span>
    </span>
  );
}

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, delta, trend, icon, className = "" }: MetricCardProps) {
  return (
    <div className={`metric-card-clean ${className}`.trim()}>
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      <div className="metric-card-value">{value}</div>
      {delta && (
        <div className={`metric-card-delta ${trend ?? "neutral"}`}>
          {trend === "up" && <span>↑</span>}
          {trend === "down" && <span>↓</span>}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ children, columns = 4, className = "" }: { children: ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  const colClass = columns === 3 ? "three-col" : "";
  return <div className={`metric-grid-clean ${colClass} ${className}`.trim()}>{children}</div>;
}

export function FilterToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`filter-toolbar-clean ${className}`.trim()}>{children}</div>;
}
