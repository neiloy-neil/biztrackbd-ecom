"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * While a store is read-only (unpaid past the grace days) every form on every screen is switched off, so nobody fills one in
 * only to be refused. The billing screen stays live because paying is the way out. The server refuses changes either way.
 */
export function ReadOnlyGuard({ on, children }: { on: boolean; children: ReactNode }) {
  const path = usePathname();
  if (!on || path.startsWith("/billing")) return <>{children}</>;
  return <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} data-testid="read-only-guard">{children}</fieldset>;
}
