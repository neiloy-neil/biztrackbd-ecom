import { can, type Area } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { SettingsShell } from "./settings-shell";

// One navigation for every settings page. What a person sees in it follows what they may open.
const ITEMS: { href: string; label: string; area: Area }[] = [
  { href: "/settings/store", label: "Store details", area: "design" },
  { href: "/settings/payments", label: "Payments", area: "billing" },
  { href: "/settings/shipping", label: "Shipping", area: "orders" },
  { href: "/settings/domains", label: "Domains", area: "billing" },
  { href: "/settings/notifications", label: "Customer messages", area: "design" },
  { href: "/settings/invoices", label: "Invoices", area: "design" },
  { href: "/settings/apps", label: "Apps & Integrations", area: "billing" },
  { href: "/settings/staff", label: "Team", area: "team" },
  { href: "/settings/audit", label: "Audit log", area: "team" },
  { href: "/billing", label: "Plan and usage", area: "billing" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const items = ITEMS.filter((i) => can(s.user.role, i.area)).map(({ href, label }) => ({ href, label }));
  return <SettingsShell items={items} label="Settings sections">{children}</SettingsShell>;
}
