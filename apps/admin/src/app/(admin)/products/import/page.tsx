import type { Metadata } from "next";
import Link from "next/link";
import { IMPORT_MAX_ROWS } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import products" };

export default async function ImportProducts() {
  await requireAccess("products");
  return (
    <>
      <PageHeader
        title="Import products"
        crumbs={[
          { label: "Products", href: "/products" },
          { label: "Import" },
        ]}
        actions={<Link href="/products" className="btn btn-secondary" prefetch={false}>Back to products</Link>}
      />
      <div className="card" style={{ maxWidth: 740 }}>
        <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.6 }}>
          Import your catalog in one click. We automatically detect <b>Shopify (products_export.csv)</b>, <b>WooCommerce</b>, and <b>BizTrackBD CSV</b> files, preserving multi-variant options (Size/Color) and external photo URLs.
        </p>
        <div style={{ background: "var(--bg-subtle, #f8f9fa)", border: "1px solid var(--border-color, #e9ecef)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <b style={{ display: "block", marginBottom: 6, fontSize: 13.5 }}>Supported formats:</b>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
            <li><b>Shopify:</b> Export from your Shopify Admin &rarr; Products &rarr; Export &rarr; CSV. Handles, multi-row variants, and CDN image URLs are fully preserved.</li>
            <li><b>WooCommerce:</b> Export products CSV directly from WooCommerce. Regular/Sale prices, categories, and image links are imported.</li>
            <li><b>BizTrackBD Standard:</b> Title & price required; stock, SKU, category, compare price, and image URLs optional. Up to {IMPORT_MAX_ROWS} products per batch.</li>
          </ul>
        </div>
        <p style={{ marginTop: 0 }}><a href="/products/import/template" className="btn btn-secondary" download data-testid="import-template">Download BizTrackBD template</a></p>
        <ImportForm />
      </div>
    </>
  );
}
