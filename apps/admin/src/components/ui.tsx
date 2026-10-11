"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { qs } from "@/lib/query";

/** A submit button that disables itself while its form is sending, so a double tap cannot send twice. */
export function SubmitButton({ children, pending, className = "btn btn-primary", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: ReactNode }) {
  const { pending: busy } = useFormStatus();
  return (
    <button {...rest} type="submit" className={className} disabled={busy || rest.disabled} aria-busy={busy}>
      {busy ? (pending ?? "Saving…") : children}
    </button>
  );
}

export interface TabDef {
  href: string;
  label: string;
  count?: number;
  alert?: boolean;
  current: boolean;
}

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="tabs" aria-label="Filter">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.current ? "page" : undefined} prefetch={false}>
          {t.label}
          {t.count !== undefined && <span className={`n${t.alert && t.count > 0 ? " alert" : ""}`}>{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({ page, pageSize, total, path, params }: { page: number; pageSize: number; total: number; path: string; params: Record<string, string | number | undefined | null> }) {
  const href = (p: number) => `${path}${qs({ ...params, page: p })}`;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? <Link className="btn btn-secondary btn-sm" href={href(page - 1)} prefetch={false}>Previous</Link> : <span />}
      <span className="muted" style={{ fontSize: 13 }}>{from} to {to} of {total}</span>
      {page < pages ? <Link className="btn btn-secondary btn-sm" href={href(page + 1)} prefetch={false}>Next</Link> : <span />}
    </nav>
  );
}
