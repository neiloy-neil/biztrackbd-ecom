"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsLayout } from "@biztrackbd/ui";

export interface SettingsItem { href: string; label: string }

/** One settings navigation for every settings page: a list on the left on a computer, a scrolling row of pills on a phone. */
export function SettingsShell({ items, label, children }: { items: SettingsItem[]; label: string; children: ReactNode }) {
  const path = usePathname();
  return (
    <SettingsLayout
      linkAs={Link}
      label={label}
      items={items.map((i) => ({ ...i, current: path === i.href || path.startsWith(`${i.href}/`) }))}
    >
      {children}
    </SettingsLayout>
  );
}
