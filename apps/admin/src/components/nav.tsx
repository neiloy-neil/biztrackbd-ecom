"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A link that marks itself current. `exact` for "/" so Home is not lit on every page. */
export function NavLink({ href, exact, children, className }: { href: string; exact?: boolean; children: ReactNode; className?: string }) {
  const path = usePathname();
  const current = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return <Link href={href} aria-current={current ? "page" : undefined} className={className} prefetch={false}>{children}</Link>;
}
