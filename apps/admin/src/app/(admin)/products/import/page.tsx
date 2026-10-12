import type { Metadata } from "next";
import Link from "next/link";
import { IMPORT_MAX_ROWS } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import products" };

export default async function ImportProducts() {
  await requireAccess("products");
  return (
    <>
      <div className="page-head">
        <h1>Import products</h1>
        <div className="actions"><Link href="/products" className="btn btn-secondary" prefetch={false}>Back to products</Link></div>
      </div>
      <div className="card" style={{ maxWidth: 680 }}>
        <ol style={{ margin: "0 0 14px", paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Download the template and fill one row for each product.</li>
          <li>Save it as a CSV file (in Excel: Save As, CSV).</li>
          <li>Choose the file below. Up to {IMPORT_MAX_ROWS} products at a time.</li>
        </ol>
        <p style={{ marginTop: 0 }}><a href="/products/import/template" className="btn btn-secondary" download data-testid="import-template">Download the template</a></p>
        <p className="muted" style={{ fontSize: 13.5 }}>Columns: <b>title</b> and <b>price</b> are needed. <b>stock</b>, <b>sku</b>, <b>status</b> (active or draft, draft if empty), <b>category</b> (made if it is new), <b>description</b> and <b>compare_at_price</b> are optional. Photos are added afterwards on each product. Each product gets one variant.</p>
        <ImportForm />
      </div>
    </>
  );
}
