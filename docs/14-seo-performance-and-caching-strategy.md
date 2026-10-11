# SEO, Media Storage & Core Web Vitals Optimization Strategy

Status: COMPLETE SPECIFICATION  
Scope: `apps/storefront`, `packages/core`, Supabase Storage, Next.js Image Optimizer

> **Implementation status (Phase 2):** built in `apps/storefront`. The code samples below are the original sketch and use fields that do not exist (`product.handle`, `tenant.settings`, `images` as JSON). The real implementation: `generateMetadata` in `app/(store)/products/[slug]/page.tsx`, `app/sitemap.ts` and `app/robots.ts` (per store, from the request host), image settings in `next.config.ts` (`formats: avif, webp`, declared `qualities`, Supabase Storage remote pattern), and `sanitizeProductHtml` in `packages/core` for descriptions. Uploads to Supabase Storage (section 1) are Phase 3 with the admin media library.

---

## 1. Media Storage & Upload Architecture

All store assets (product photos, theme banners, logos, return proof photos) are stored in **Supabase Storage** with tenant-scoped folder isolation.

### Storage Hierarchy:
```
store-assets/ (Public Bucket with CDN Caching)
  ├── tenants/
  │   ├── {tenantId}/
  │   │   ├── logo/
  │   │   │   └── logo-primary.webp
  │   │   ├── products/
  │   │   │   ├── panjabi-offwhite-cover.webp
  │   │   │   └── panjabi-offwhite-detail.webp
  │   │   ├── banners/
  │   │   │   └── eid-collection-hero.webp
  │   │   └── returns/
  │   │       └── RT0412-damaged-photo.webp
```

### Security & Upload Protocol:
1. **Direct-to-Storage Presigned Uploads**:
   - Store admin requests a short-lived presigned upload URL from `apps/admin/api/media/presign`.
   - Admin browser uploads directly to Supabase Storage, eliminating server payload bottlenecks.
2. **Path Authorization Policy**:
   - Storage RLS policy verifies the uploading user's JWT belongs to `{tenantId}` before allowing write access.

---

## 2. Image Optimization for Bangladesh 3G/4G Mobile Networks

Mobile networks in Bangladesh have variable latency. Fast visual loading (< 2.0s) directly drives higher conversion.

### Optimization Rules:
1. **Next.js `<Image />` Component**:
   ```tsx
   import Image from "next/image";

   export function ProductCardImage({ src, alt }: { src: string; alt: string }) {
     return (
       <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#FAFAFC]">
         <Image
           src={src}
           alt={alt}
           fill
           sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
           className="object-cover transition-transform duration-300 group-hover:scale-105"
           loading="lazy"
           placeholder="blur"
           blurDataURL="data:image/svg+xml;base64,..."
         />
       </div>
     );
   }
   ```
2. **Automatic AVIF & WebP Content Negotiation**:
   - Configured in `next.config.js` (`formats: ['image/avif', 'image/webp']`).
   - Browser receives high-compression AVIF on modern Chrome/Safari, falling back to WebP.
3. **Cumulative Layout Shift (CLS) Prevention**:
   - All image containers enforce rigid aspect ratios (`aspect-square` or `aspect-[4/5]`) to prevent layout jump during image decode.

---

## 3. Dynamic Per-Tenant SEO & OpenGraph Link Previews

When a merchant or customer shares a product link on WhatsApp, Facebook Messenger, or Instagram DMs, the platform renders rich social cards with accurate BDT pricing.

### Implementation: `apps/storefront/app/(store)/products/[slug]/page.tsx`

```typescript
import { Metadata } from "next";
import { db } from "@biztrackbd/db";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  
  // Note: tenantId is automatically injected by Prisma extension from edge headers
  const product = await db.product.findFirst({
    where: { handle: slug, status: "ACTIVE" },
    include: { tenant: { include: { settings: true } } },
  });

  if (!product) {
    return { title: "Product Not Found" };
  }

  const title = `${product.titleEn} | ${product.tenant.settings?.storeName || product.tenant.name}`;
  const description = product.descriptionEn || `Buy ${product.titleEn} online at best price in Bangladesh.`;
  const primaryImage = Array.isArray(product.images) && product.images[0] ? String(product.images[0]) : "/default-og.jpg";
  const priceFormatted = `৳ ${Number(product.price).toLocaleString("en-BD")}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description: `${priceFormatted} — ${description}`,
      url: `https://${product.tenant.customDomain || `${product.tenant.subdomain}.biztrackbd.com`}/products/${slug}`,
      siteName: product.tenant.settings?.storeName || product.tenant.name,
      images: [
        {
          url: primaryImage,
          width: 1200,
          height: 630,
          alt: product.titleEn,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `${priceFormatted} — ${description}`,
      images: [primaryImage],
    },
    alternates: {
      canonical: `/products/${slug}`,
    },
  };
}
```

---

## 4. Dynamic Sitemaps & Search Engine Indexing

### A. Dynamic Per-Store Sitemap (`apps/storefront/app/sitemap.ts`)

```typescript
import { MetadataRoute } from "next";
import { db } from "@biztrackbd/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL || "https://biztrackbd.com";

  // Query all active products and collections for this tenant
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    select: { handle: true, updatedAt: true },
  });

  const collections = await db.collection.findMany({
    select: { handle: true, createdAt: true },
  });

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.handle}`,
    lastModified: p.updatedAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${baseUrl}/collections/${c.handle}`,
    lastModified: c.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    ...productEntries,
    ...collectionEntries,
  ];
}
```

### B. Robots.txt (`apps/storefront/app/robots.ts`)

```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/checkout", "/account", "/api/", "/order-placed/"],
    },
    sitemap: "/sitemap.xml",
  };
}
```

---

## 5. Core Web Vitals Performance Targets

| Metric | Target | Optimization Technique Applied |
|---|---|---|
| **LCP (Largest Contentful Paint)** | `< 2.2s` on 4G | Pre-loaded hero banners, Next.js priority image loading, Server Component HTML stream. |
| **INP (Interaction to Next Paint)** | `< 100ms` | Zero heavy client-side JavaScript on initial load; interactive components (drawers, variant pickers) loaded as lightweight client islands. |
| **CLS (Cumulative Layout Shift)** | `< 0.05` | Fixed aspect ratio image wrappers, Google font fallback font-display swap metrics. |
| **TTFB (Time to First Byte)** | `< 150ms` | Vercel Edge Middleware + global Edge Config cached routing. |
