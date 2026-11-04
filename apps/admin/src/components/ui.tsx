"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, askConfirm, type ButtonProps, type ConfirmOptions } from "@biztrackbd/ui";
import { qs } from "@/lib/query";

/** A submit button that disables itself while its form is sending, so a double tap cannot send twice. */
export function SubmitButton({ children, pending, className = "btn btn-primary", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: ReactNode | false }) {
  const { pending: busy } = useFormStatus();
  return (
    <button {...rest} type="submit" className={className} disabled={busy || rest.disabled} aria-busy={busy}>
      {busy && pending !== false ? (pending ?? "Saving…") : children}
    </button>
  );
}

/**
 * A submit button that asks first. `confirm` receives the form (so it can count the selected rows) and returns the question to ask,
 * or `{ notice }` to explain what is missing instead of submitting. Esc, Cancel and a click outside all mean no.
 */
export function ConfirmSubmitButton({ confirm, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: ReactNode | false; confirm: (form: HTMLFormElement) => ConfirmOptions | { notice: string } }) {
  return (
    <SubmitButton
      {...rest}
      onClick={async (e) => {
        const btn = e.currentTarget;
        const form = btn.form;
        if (!form) return;
        e.preventDefault();
        const q = confirm(form);
        if ("notice" in q) { await askConfirm({ title: "One more thing", message: q.notice, confirmLabel: "OK", cancelLabel: null }); return; }
        if (await askConfirm(q)) form.requestSubmit(btn);
      }}
    />
  );
}

/** The kit Button that disables itself while its form is sending, so a second tap cannot send twice. */
export function PendingButton({ children, pendingLabel, ...rest }: ButtonProps & { pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button {...rest} type="submit" disabled={pending || rest.disabled} aria-busy={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
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
