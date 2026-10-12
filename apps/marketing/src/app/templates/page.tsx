import type { Metadata } from "next";
import { TemplateGallery } from "@/components/template-gallery";
import { demoAdminUrl } from "@/lib/demo-admin";

export const metadata: Metadata = {
  title: "eCommerce Store Templates: Ready-to-Use Bangladeshi Storefronts",
  description:
    "Explore responsive storefront templates for Bangladeshi businesses. Complete with bKash checkout, size guides, spec tables, and mobile-optimized carts.",
};

export default function TemplatesPage() {
  return (
    <section className="block">
      <div className="wrap">
        <div>
          <span className="eyebrow">Storefronts &amp; Designs</span>
          <h1
            style={{
              fontSize: "clamp(34px, 5.5vw, 50px)",
              letterSpacing: "-1.2px",
              lineHeight: 1.1,
              fontWeight: 800,
            }}
          >
            Templates
          </h1>
          <p
            className="lead"
            style={{
              marginTop: 14,
              fontSize: 18,
              color: "var(--ink-2)",
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            Every template is a complete, functioning store: home page, product pages, shopping cart, and local bKash/Nagad checkout. Open a live demo, test the flow, and start your trial with the design that fits your brand.
          </p>
          <p className="fine" style={{ marginTop: 10, fontSize: 14.5 }}>
            Want to see how you would manage orders?{" "}
            <a
              href={demoAdminUrl()}
              className="link"
              data-testid="templates-demo-admin"
              style={{ fontWeight: 600 }}
            >
              Try the admin desk on any template with sample products (no signup)
            </a>
            .
          </p>
        </div>

        <TemplateGallery />
      </div>
    </section>
  );
}
