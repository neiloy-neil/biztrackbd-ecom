import type { Metadata } from "next";
import { CUSTOMER_IMPORT_MAX_ROWS } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import customers" };

export default async function ImportCustomers() {
  await requireAccess("customers", "edit");
  return (
    <>
      <PageHeader
        title="Import customers"
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: "Import" },
        ]}
      />
      <div className="card stack" style={{ maxWidth: 740 }}>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Bring in the customers you already have from a spreadsheet or a Shopify customer export. Each one is matched by mobile number, so nobody is added twice, and a customer who is already in your store is left as they are.
          Up to {CUSTOMER_IMPORT_MAX_ROWS.toLocaleString("en-US")} at a time.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>Columns: <b>Name</b> and <b>Phone</b> are needed. <b>Email</b>, <b>Tags</b> (separate with ;) and <b>Notes</b> are optional. A Shopify export with First Name and Last Name works as it is.</li>
          <li>Numbers may start with 01, +880 or 880, and Bangla digits are fine.</li>
          <li>Importing does <b>not</b> give you permission to send them SMS or email. Only message people who agreed to hear from you.</li>
        </ul>
        <p style={{ margin: 0 }}><a href="/customers/import/template" className="btn btn-secondary" download data-testid="cimport-template">Download the template</a></p>
        <ImportForm />
      </div>
    </>
  );
}
