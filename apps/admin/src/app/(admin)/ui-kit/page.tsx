import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Advanced, EmptyState, FieldGrid, KpiRow, PageHeader, Section, SettingsLayout, Skeleton } from "@biztrackbd/ui";
import { KitDemo } from "./demo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UI kit" };

/** Every shared page block on one screen, for checking at 390 and 1440 and in both themes. Not shown in production. */
export default function UiKit() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_UI_KIT !== "1") notFound();
  return (
    <>
      <PageHeader
        title="UI kit"
        sub="The blocks every admin page is built from."
        crumbs={[{ label: "Home", href: "/" }, { label: "UI kit" }]}
        linkAs={Link}
        actions={<><button className="btn btn-secondary" type="button">Secondary</button><button className="btn btn-primary" type="button">Primary</button></>}
      />
      <KpiRow items={[
        { label: "Today's sales", value: "৳ 18,450", delta: "+12% vs yesterday", trend: "up" },
        { label: "Orders", value: "42", delta: "7 to ship" },
        { label: "Returns", value: "3", delta: "+1 this week", trend: "down" },
        { label: "Customers", value: "1,208", delta: "+18 new" },
      ]} />
      <SettingsLayout
        linkAs={Link}
        items={[{ href: "/ui-kit", label: "Store details", current: true }, { href: "/settings/payments", label: "Payments" }, { href: "/settings/shipping", label: "Shipping" }, { href: "/settings/domains", label: "Domains" }]}
      >
        <KitDemo />
        <Section title="Contact" description="Shown on invoices and the store footer.">
          <FieldGrid>
            <label className="field"><span className="label">Phone</span><input className="input" defaultValue="01700 000000" /></label>
            <label className="field"><span className="label">Email</span><input className="input" defaultValue="shop@example.com" /></label>
            <label className="field full"><span className="label">Address</span><textarea className="textarea" defaultValue="House 12, Road 3, Dhanmondi, Dhaka" /></label>
          </FieldGrid>
          <Advanced><p className="muted">Options most shops never change sit here, closed by default.</p></Advanced>
        </Section>
        <Section title="Loading and empty states">
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}><Skeleton height={18} width="60%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /></div>
          <EmptyState title="No orders yet" text="When a customer orders, it shows up here." action={<button className="btn btn-primary" type="button">Create an order</button>} />
        </Section>
      </SettingsLayout>
    </>
  );
}
