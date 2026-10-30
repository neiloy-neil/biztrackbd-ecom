import Link from "next/link";

export interface ReportTabsProps {
  currentTab: "realtime" | "sales" | "products" | "couriers" | "customers" | "cod" | "profit";
  queryString?: string;
}

const TABS: { id: ReportTabsProps["currentTab"]; href: string; label: string }[] = [
  { id: "realtime", href: "/reports/realtime", label: "Real-Time Studio" },
  { id: "sales", href: "/reports", label: "Overview & Sales" },
  { id: "products", href: "/reports/products", label: "Products & Stock" },
  { id: "couriers", href: "/reports/couriers", label: "Couriers & Delivery" },
  { id: "customers", href: "/reports/customers", label: "Customers & Cohorts" },
  { id: "cod", href: "/finance/cod", label: "COD Payouts" },
  { id: "profit", href: "/finance/profit", label: "Profit & Loss" },
];

export function ReportTabs({ currentTab, queryString = "" }: ReportTabsProps) {
  const qs = queryString ? (queryString.startsWith("?") ? queryString : `?${queryString}`) : "";

  return (
    <nav className="tabs mb-lg" aria-label="Report Category">
      {TABS.map((tab) => {
        const isActive = tab.id === currentTab;
        const targetHref = `${tab.href}${qs}`;
        return (
          <Link
            key={tab.id}
            href={targetHref}
            aria-current={isActive ? "page" : undefined}
            prefetch={false}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
