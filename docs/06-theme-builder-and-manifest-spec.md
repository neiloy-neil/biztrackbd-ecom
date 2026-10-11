# Theme Architecture & Section Builder Specification

Status: COMPLETE SPECIFICATION  
Scope: `packages/themes`, `packages/builder`, `apps/storefront`, `apps/admin`

---

## 1. Overview & Core Philosophy

BizTrackBD themes allow Bangladeshi ecommerce merchants to achieve high-converting, fully customized storefronts while maintaining zero-code simplicity.

### Key Architecture Principles:
1. **Separation of Content & Presentation**: Switching themes never deletes products, collections, pages, reviews, or orders. Only presentation tokens and page layout assignments change.
2. **Standardized Section & Block JSON Schema**: Every page is rendered from an immutable JSON tree of sections and blocks validated with Zod.
3. **Draft vs. Published State Machine**: Changes in the theme editor are instantly previewable via a low-latency `postMessage` bridge, saved as draft versions with version history and 1-click rollback, and published only when confirmed.
4. **Server Component First**: Section data fetching happens on the server (RSC) to maximize SEO and Core Web Vitals, while client components (islands) handle cart drawers, variant pickers, filters, and image galleries.
5. **Unified Design Tokens**: Global theme settings map to standard CSS custom properties (`--primary`, `--radius`, `--font-heading`, etc.) injected at the HTML root.

---

## 2. Directory & Package Structure

```
packages/
  themes/
    src/
      tokens.ts              # Global token definitions & standard CSS variable mappings
      types.ts               # ThemeManifest, SectionDefinition, BlockDefinition types
      registry.ts            # Global lookup of installed themes
      kapor/                 # Flagship Fashion Theme (Berber port)
        manifest.ts          # Theme metadata, default settings, supported sections
        sections/            # React RSC/Client section components
          hero-slider.tsx
          featured-products.tsx
          announcement-bar.tsx
          category-grid.tsx
          video-banner.tsx
        tokens.css           # Default fallback variables
        preview.png
      mini-bunny/            # Baby & Kids Theme
      bindu/                 # Women Ethnic & Drops Theme
      axionwear/             # Streetwear & Fast Fashion Theme
      gadgetstudio/          # Electronics & Multi-vendor look
  builder/
    src/
      schema.ts              # Zod validation schemas for Page JSON and Section Settings
      renderer.tsx           # <SectionRenderer pageJson={...} /> Next.js RSC engine
      bridge.ts              # PostMessage event protocol between Admin Editor & Preview Iframe
      controls/              # Admin UI form control inputs (ColorPicker, ImageUploader, etc.)
```

---

## 3. Unified Design Tokens Schema

All themes declare their default token values in `manifest.ts`. When rendering `apps/storefront/app/layout.tsx`, these tokens are merged with the tenant's custom overrides from `ThemeInstall.settings` and injected into the `<head>` as CSS variables:

```typescript
export interface ThemeDesignTokens {
  colors: {
    primary: string;           // Brand CTA, active states (e.g. #5B4FE8)
    primaryHover: string;      // Button hover state
    primaryForeground: string; // Contrast text on primary (#FFFFFF)
    background: string;        // Page background (#FFFFFF or #0B0B0F)
    surface: string;           // Card and drawer background (#F8FAFC)
    surfaceBorder: string;     // Border around cards (#E2E8F0)
    inkPrimary: string;        // Primary text (#0F172A)
    inkSecondary: string;      // Subtitles & metadata (#475569)
    inkMuted: string;          // Form placeholders & disabled (#94A3B8)
    accent: string;            // Sale badges, highlights (#EF4444)
    success: string;           // Stock available, order placed (#16A34A)
  };
  typography: {
    fontHeading: string;       // e.g. "Plus Jakarta Sans", "Hind Siliguri"
    fontBody: string;          // e.g. "Inter", "Hind Siliguri"
    baseFontSize: "14px" | "15px" | "16px";
    headingWeight: "600" | "700" | "800";
    headingTransform: "none" | "uppercase" | "capitalize";
  };
  layout: {
    containerWidth: "1200px" | "1280px" | "1440px" | "100%";
    radiusSm: "2px" | "4px" | "6px";
    radiusMd: "6px" | "8px" | "12px";
    radiusLg: "12px" | "16px" | "24px";
    radiusPill: "9999px";
    headerStyle: "sticky" | "fixed" | "transparent-on-hero" | "standard";
    productCardStyle: "border" | "shadow" | "flat-gray" | "floating-badge";
  };
}
```

---

## 4. Section & Block Definition Specification

Every section exposed by a theme is defined via a typed manifest. Settings define the schema for form inputs in the theme editor.

```typescript
import { z } from "zod";

export const HeroSectionSettingsSchema = z.object({
  title: z.string().default("Exclusive Eid Collection 2026"),
  subtitle: z.string().default("Handcrafted premium fabrics tailored for elegance."),
  ctaText: z.string().default("Shop Collection"),
  ctaLink: z.string().default("/collections/eid-2026"),
  backgroundImage: z.string().url().optional(),
  textAlignment: z.enum(["left", "center", "right"]).default("center"),
  overlayOpacity: z.number().min(0).max(100).default(30),
  showBadge: z.boolean().default(true),
  badgeText: z.string().default("New Arrival"),
});

export type HeroSectionSettings = z.infer<typeof HeroSectionSettingsSchema>;

export interface SectionDefinition<T = any> {
  id: string;                      // e.g. "hero-banner"
  name: string;                    // "Hero Banner with CTA"
  category: "hero" | "products" | "marketing" | "content" | "social" | "footer";
  description: string;
  thumbnail: string;
  settingsSchema: z.ZodType<T>;
  maxInstancesPerPage?: number;     // e.g. 1 for Announcement Bar
  supportsBlocks?: boolean;
  allowedBlockTypes?: string[];    // e.g. ["slide-item"]
  defaultContent: {
    settings: T;
    blocks?: Array<{
      id: string;
      type: string;
      settings: Record<string, any>;
    }>;
  };
}
```

---

## 5. Page JSON Data Contract & Versioning

Pages (Home, Landing Pages, Custom Pages) are saved in the `ThemeInstall` or `Page` database model as structured JSON:

```json
{
  "version": 1,
  "themeId": "kapor",
  "pageType": "home",
  "meta": {
    "title": "Kapor - Premium Bangladeshi Fashion",
    "description": "Buy original premium ethnic & western fashion online."
  },
  "sections": [
    {
      "id": "sec_announcement_01",
      "type": "announcement-bar",
      "disabled": false,
      "settings": {
        "text": "🎉 Free Delivery all across Bangladesh on orders over ৳2,000!",
        "bgColor": "#5B4FE8",
        "textColor": "#FFFFFF"
      }
    },
    {
      "id": "sec_hero_01",
      "type": "hero-slider",
      "disabled": false,
      "settings": {
        "autoplaySpeed": 5000,
        "fullWidth": true
      },
      "blocks": [
        {
          "id": "blk_slide_01",
          "type": "slide",
          "settings": {
            "title": "Summer Panjabi Drop",
            "subtitle": "Breathable 100% Egyptian Cotton",
            "image": "https://storage.biztrackbd.com/tenants/kapor/panjabi-hero.webp",
            "ctaLabel": "Order Now",
            "ctaUrl": "/collections/panjabi"
          }
        }
      ]
    },
    {
      "id": "sec_featured_01",
      "type": "featured-collection",
      "disabled": false,
      "settings": {
        "title": "Trending This Week",
        "collectionHandle": "trending",
        "limit": 8,
        "columns": 4,
        "showQuickView": true,
        "showDirectCODButton": true
      }
    }
  ]
}
```

---

## 6. Live Theme Editor PostMessage Iframe Bridge Protocol

The Theme Editor runs in `apps/admin/app/(admin)/settings/theme-editor/page.tsx` and hosts a live storefront preview inside an `<iframe>`:

```
+-------------------------------------------------------------+
| Admin Theme Editor (Parent Window)                         |
|  - Sidebar: Section tree, settings form, add section       |
|  - Topbar: Viewport switch (Desktop/Tablet/Mobile), Publish |
+-------------------------------------------------------------+
                           |
            PostMessage Event Bridge (Typed)
                           v
+-------------------------------------------------------------+
| Storefront Preview (Child Iframe: *.domain/preview?token=x) |
|  - Highlight active section on hover                        |
|  - Immediate visual DOM update without full page reload     |
|  - Click section in iframe -> activates sidebar panel       |
+-------------------------------------------------------------+
```

### Event Payload Definitions:

```typescript
export type EditorToPreviewMessage =
  | { type: "BIZTRACK_UPDATE_TOKENS"; tokens: Partial<ThemeDesignTokens> }
  | { type: "BIZTRACK_UPDATE_PAGE_JSON"; pageJson: PageJson }
  | { type: "BIZTRACK_SELECT_SECTION"; sectionId: string }
  | { type: "BIZTRACK_HOVER_SECTION"; sectionId: string | null }
  | { type: "BIZTRACK_SET_DEVICE_VIEWPORT"; mode: "desktop" | "tablet" | "mobile" };

export type PreviewToEditorMessage =
  | { type: "BIZTRACK_PREVIEW_READY"; currentPath: string; availableSections: string[] }
  | { type: "BIZTRACK_SECTION_CLICKED"; sectionId: string }
  | { type: "BIZTRACK_NAVIGATED"; url: string };
```

---

## 7. Next.js Storefront Server Component Rendering Engine

Inside `apps/storefront/components/section-renderer.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getThemeRegistry } from "@biztrackbd/themes";

interface SectionRendererProps {
  tenantId: string;
  themeId: string;
  sections: PageJson["sections"];
}

export async function SectionRenderer({ tenantId, themeId, sections }: SectionRendererProps) {
  const theme = getThemeRegistry(themeId);
  if (!theme) return notFound();

  return (
    <main className="min-h-screen flex flex-col">
      {sections.map((section) => {
        if (section.disabled) return null;
        const SectionComponent = theme.sections[section.type];
        if (!SectionComponent) return null;

        return (
          <div 
            key={section.id} 
            id={`section-${section.id}`} 
            data-biztrack-section-id={section.id}
          >
            <SectionComponent
              tenantId={tenantId}
              settings={section.settings}
              blocks={section.blocks || []}
            />
          </div>
        );
      })}
    </main>
  );
}
```

---

## 8. Flagship Starter Themes Porting Matrix

| Theme Identifier | Visual Niche | Primary Features / Modules | Target Bangladesh Market |
|---|---|---|---|
| `kapor` | High-End Fashion & Panjabi | Video Hero, Size Chart, Bespoke Measurement integration, Quick COD | Clothing, Panjabi, Sarees, Luxury Boutiques |
| `mini-bunny` | Baby, Kids & Toys | Age filter, Baby Profile integration, bundle packs, pastel palette | Baby wear, Diapers, Kids footwear, Toys |
| `bindu` | Women's Ethnic & Drops | Drop countdown timer, Episode drops, WhatsApp order button | Modest wear, Abayas, Hijabs, Designer collections |
| `axionwear` | Gen-Z & Streetwear | Dark mode hero, Lookbook grid, Instagram reel feed, Sticky COD bar | T-shirts, Hoodies, Sneakers, Gym wear |
| `gadgetstudio` | Tech, Electronics & Accessories | Spec comparison table, Warranty selector, Flash sale ticker | Phones, Earbuds, Smartwatches, Computer accessories |

**Authoritative theme list (10 Oct 2026).** These five identifiers are the only themes. Marketing and the canvas gallery show these display names: `kapor` = Kapor, `gadgetstudio` = Gadget Studio, `mini-bunny` = Mini Bunny, `axionwear` = Axionwear, `bindu` = Bindu. Earlier names (gadget, grocer, glow, craft, Nirmal, Chhoto, Uddam, Darzi) are retired.

**Current release status (11 Oct 2026):** all five visual templates ship on the shared storefront renderer and can be selected at signup or switched in Store design. Each template keeps separate drafts and version history. Specialized behavior remains modular: bespoke tailoring, baby profiles, drops/episodes, and electronics-specific structured product features are not implied by choosing a visual template.

---

## 9. 1-Product Landing Page Builder Integration

The Landing Page Builder uses the identical section engine, but scopes the page to a single high-conversion template:

- **Route**: `apps/storefront/src/app/l/[slug]/page.tsx` (the built route is `/l/[slug]`, not `/lp/`)
- **Embedded Fast COD Form**: Eliminates cart & multi-step navigation. Collects:
  - Customer Name
  - Mobile Number (with automatic 01X validation)
  - Full Address & District selector
  - Selected Variant / Quantity offer (e.g. "Buy 2 Get Free Delivery")
  - Courier fee auto-calculation (Inside Dhaka ৳70 / Outside Dhaka ৳130)
- **Instant Facebook Pixel & CAPI Trigger**: Server-side CAPI event `InitiateCheckout` on form focus, `Purchase` on form submit.

---

## 10. Unified Media Asset Drawer & Bengali Stock Graphic Library

To ensure merchants can build stunning, professional storefronts without needing professional graphic design tools, the Theme Customizer includes an integrated **Media Asset Drawer**:

### 10.1 Asset Picker Architecture
Whenever an image control is opened in the Theme Inspector (for Store Logo, Favicon, Hero Banner, or Category Tiles):
1. **Drawer Trigger**: Opens a slide-over modal with 3 tabs:
   - **Upload**: Drag-and-drop new images from computer/phone.
   - **Store Library**: Browse previously uploaded store assets with search and tags.
   - **Bengali Template Library**: Ready-to-use seasonal and promotional graphics tailored for Bangladesh.

### 10.2 In-Browser Aspect Ratio Cropper
- Enforces recommended aspect ratios automatically:
  - **Desktop Hero Banner**: `16:5` (e.g. `1920x600px`)
  - **Mobile Hero Banner**: `5:4` (e.g. `750x600px`)
  - **Store Logo**: `4:1` (e.g. `240x60px`)
  - **Category Tile**: `1:1` (e.g. `600x600px`)
- Performs instant client-side WebP conversion and lossless compression before uploading directly to Cloudflare R2 / Supabase Storage.

### 10.3 Built-in Bengali Stock Graphic Templates
Merchants can 1-click select high-resolution, culturally styled graphics with editable Bengali text overlays:
- **Eid-ul-Fitr & Eid-ul-Adha Collections** (Traditional Islamic patterns, lanterns, "ঈদ স্পেশাল কালেকশন")
- **Pahela Baishakh / Boishakhi Mela** (Red & white festive motifs, "বৈশাখী ধামাকা অফার")
- **Puja Specials** (Autumn festive gold & vermillion themes)
- **Flash Sale & Clearance** (Vibrant urgency badges: "ফ্ল্যাশ সেল - ৬০% পর্যন্ত ছাড়", "স্টক সীমিত", "ফ্রি ডেলিভারি")
- **Winter Fashion** (Hoodies, jackets, shawls, "উইন্টার কালেকশন ২০26")

---

## Phase 7 status (what was built from this spec)

Built: the section registry with generated forms and validation (14 sections for the home page and landing pages), the page JSON contract (`{ version: 1, sections: [{ id, type, disabled?, settings }] }`), design tokens (main colour, background, text colour, corner size, font) with a contrast guard, draft and published versions with go-back, the `postMessage` preview bridge with a signed preview link, the shared server and browser section renderer, the one-product landing page with embedded cash on delivery checkout, and picture crop and WebP upload. Code: `packages/core/src/builder/`, `packages/core/src/landing/`, `apps/storefront/src/components/{sections,preview-bridge,landing-order-form}.tsx`, `apps/admin/src/app/(admin)/{design,landing}/`.

Differences from this spec: the page JSON is flat (sections have settings and at most one list, not block trees); sections move with buttons, not drag and drop; the five templates share the same section/component renderer with distinct tokens and composition rules rather than separate component packages; home and landing pages only are editable; pictures are cropped in the browser and uploaded, with no media library or Bengali stock graphics; bespoke, drops and baby-profile modules and the saved-section library are not built. See docs/16 Phase 7 for what is and is not verified.

