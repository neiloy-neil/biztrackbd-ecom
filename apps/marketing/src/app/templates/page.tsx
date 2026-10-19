import type { Metadata } from "next";
import { listPublishedTemplates } from "@biztrackbd/core";
import { splitPublishedTemplates } from "@/lib/published-gallery";
import { TemplateGallery } from "@/components/template-gallery";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "eCommerce Store & Business Website Templates",
  description:
    "Explore responsive templates for Bangladeshi businesses. Complete with bKash checkout, size guides, spec tables, and mobile-optimized carts.",
  alternates: {
    canonical: `${siteUrl}/templates`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/templates`,
    siteName: "BizTrackBD",
    title: "Store & Business Website Templates for Bangladesh",
    description: "Browse high-converting mobile templates for fashion, gadgets, clinics, dining, and professional services.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Templates" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Store & Business Website Templates for Bangladesh",
    description: "Ready-to-use Bangladeshi storefront and business templates.",
    images: [`${siteUrl}/opengraph-image`],
  },
};


export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const initialMode = sp.tab === "business" ? "business" : "ecommerce";

  // Templates published by staff appear here with no deploy; an original they take down disappears. If the list cannot be read, the originals show.
  const published = await listPublishedTemplates().catch(() => []);
  const { extra, businessExtra, hidden } = splitPublishedTemplates(published);
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
            Templates &amp; Designs
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
            Explore handcrafted designs for online retail shops, restaurants with contactless table QR menus, doctor clinics, corporate firms, and creative portfolios. Open any live demo to experience the flow.
          </p>
          <p className="fine" style={{ marginTop: 10, fontSize: 14.5 }}>
            Want to see how you would manage orders or bookings?{" "}
            <a
              href={demoAdminUrl()}
              className="link"
              data-testid="templates-demo-admin"
              style={{ fontWeight: 600 }}
            >
              Try the admin desk on any template with sample data (no signup)
            </a>
            .
          </p>
        </div>

        <TemplateGallery extra={extra} businessExtra={businessExtra} hidden={hidden} initialMode={initialMode} />
      </div>
    </section>
  );
}
