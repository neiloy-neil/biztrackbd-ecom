# Landing pages and fully dynamic templates: plan (13 October 2026)

Status: **plan for review, nothing built yet.** Written from the owner's answers on 13 October 2026 and from the 68 sample pages in `Landing Page/` (CartFlows funnel exports from the Bdigital Zone bundle).

## 1. What was asked
- **Landing page** means the merchant's ad page: one product or a few, one long scrolling Bangla sales page, an order form on the same page, no cart and no account. It is not the biztrack.bd marketing page.
- **Templates** (store designs) must be fully dynamic too: merchants edit everything, and BizTrackBD can publish new templates without a deploy.
- Decisions: a library of ready-made landing templates to start from (converted to our own, not copied); linked to real products; short Cash on Delivery form on the page; address on the store domain and an optional own short link; drag-and-drop editing with draft, preview and publish; count limit per plan; thank-you page with order number; track views, orders, source, pixels and abandoned leads.

## 2. What the 68 samples contain
- 68 funnels, each a `checkout` step (the long page with the order form) and usually a `thankyou` step. Three also have a plain `landing` step.
- Built in Elementor. Sections that repeat across nearly all of them: headline and short pitch, YouTube video, big "অর্ডার করতে চাই" button that jumps to the form, benefits as icon lists, "why buy" image-and-text blocks, image carousels, customer review screenshots and star ratings, countdown timers, FAQ accordion, delivery and trust icons, then the order form (`checkout-form` widget) and a thank-you with order details.
- The order form offers the products as options (`force-all` product options, `inline` variations, quantity), with billing fields cut down for COD, a custom place-order button ("অর্ডার করুন") and a coupon field.
- Widget mix across all pages: headings, buttons, images, icon lists, text, animated headlines, carousels, video, image boxes, countdowns, testimonials, accordions. About 12 distinct section types cover them.
- The pages contain other people's pictures and copy. The plan copies none of it: templates are rebuilt with our own placeholder pictures and original Bangla and English text, using the sample pages only to learn which sections and order sell.

## 3. What already exists (so we upgrade, not restart)
- `LandingPage` model (one `targetProductId`, `sectionsJson`, `slug`, `pixelId`), plan limit `landingPages`, storefront route `l/[slug]`, admin screen `(admin)/landing`.
- Seven landing sections in the builder registry: `lp-hero`, `lp-benefits`, `lp-gallery`, `lp-reviews`, `lp-faq`, `lp-order-form`, `lp-sticky-cta`, with English and Bangla fields, drafts, publish, history and rollback (`packages/core/src/builder`).
- Store builder with home, product, collection and cart pages (docs/39), plan gate `sectionBuilder`.

## 4. Landing pages: design

### 4.1 Sections (new ones marked +)
| Section | Notes |
|---|---|
| Top of page (`lp-hero`) | headline, subhead, picture, button; + optional YouTube video |
| + Video | YouTube or uploaded, lazy loaded |
| Why buy (`lp-benefits`) | icon list |
| + Image and text | alternating picture and paragraph, for "how to use" and details |
| Pictures (`lp-gallery`) | grid or carousel |
| Customer words (`lp-reviews`) | text reviews; + review screenshots |
| + Countdown | to a date, or a rolling 24 hours per visitor |
| + Stock left | shows the real stock, hidden above a threshold the merchant sets |
| Questions (`lp-faq`) | accordion |
| + Trust strip | delivery, return, secure COD icons |
| + Offer bar | price, old price, savings, repeated button |
| Order form (`lp-order-form`) | see 4.3 |
| Sticky button (`lp-sticky-cta`) | phones |
| + Custom text and button | free section |

### 4.2 Products and offers
- A page is linked to real products; price, stock, variants and the created order all come from the store, so editing a product updates the page.
- The form supports: one product with variants and quantity; a **choice between products**; **bundles and quantity deals** ("buy 2 get ৳100 off", family pack) with the price updating live; an **order bump** (a small extra product ticked above the button).
- Replace `targetProductId` with an `offers` list: `{ productId, variantId?, label, deal? }`, kind `single | choice | bundle`, plus an optional `bump`.

### 4.3 Order form
Name, mobile, full address, delivery area (drives the delivery charge), product or variant and quantity, order note (optional), coupon (optional), live total, button. Cash on Delivery only. No account, no cart. Reuses the storefront's order creation (stock reservation, fraud and duplicate-order checks, courier flow) so a landing order is an ordinary order with `source = landing` and the page id.

### 4.4 Thank-you page
`/o/<order number>` style page: order number, items, total, expected delivery from the delivery zone, the merchant's phone and WhatsApp. It also fires the Purchase pixel event once.

### 4.5 Addresses
Two ways to reach the same page: `store-address/offer/<slug>` on the store domain (and the merchant's custom domain), and an optional own short link `store-address/go/<code>` for ads. The page may carry its own tracking ids; otherwise it uses the store's.

### 4.6 Tracking
- **Views and orders per page**, conversion rate, in the admin landing list (daily counters, no personal data).
- **Meta and TikTok pixel events** from the page: ViewContent, InitiateCheckout (form focused), Purchase, using the store's ids (strictly pattern-checked, as in the tracker today) and server events where configured.
- **Traffic source**: `utm_*` and `fbclid` saved on the order and shown on it.
- **Abandoned form leads**: when a visitor types a valid mobile number and leaves, save name, phone and product as a lead the merchant can call (a "Leads" tab; existing abandoned-cart tools reused). Consent line shown under the form; leads are deleted after 30 days.

### 4.7 Template library
- About 10 templates at first, one per sample family (clothing, food and honey, electronics and gadgets, beauty and care, home and kitchen, books and kids, watches, combos, health, a minimal one), each as data: ordered sections with Bangla and English default text and neutral placeholder pictures.
- "Start from a template" in the admin: pick, choose products, fill the pictures, publish.
- Templates are stored as data (section 6), so new ones are added from the platform admin without a deploy.
- A merchant who has a CartFlows JSON is **not** a goal for now.

### 4.8 Limits
Count limit per plan using the existing `limits.landingPages`: proposed Starter 1, Pro 5, Business unlimited (to confirm in the plan matrix). Unpublished drafts count.

## 5. Visual drag-and-drop editor (shared by landing pages and the store builder)
- Live page in the middle (phone and desktop preview), section list on the left with drag handles, selected section's fields on the right; click a headline or picture on the page to edit it in place.
- Add section from a gallery, duplicate, hide, delete (required blocks such as the order form cannot be removed), undo and redo.
- **Draft, preview, publish**: edits go to a draft; a preview link works on a phone; Publish makes it live; history keeps versions and rolls back; two people editing is detected (already built).
- Autosave drafts; leaving with unsaved changes warns.
- Built on the existing registry and versions engine. The change is mostly the editor UI: drag, inline text, a bigger section gallery, and global styles.

## 6. Fully dynamic store templates
Today templates are mostly code (`STORE_THEMES`) with merchant edits stored per store. Target:
1. **Merchant side:** all pages (home, product, collection, cart, landing, custom pages) are editable section lists; global style (colours, fonts, button shape, spacing) as variables; header and footer as editable sections.
2. **Platform side:** a `Template` record per design in the database: name, preview image, category, pages (each an ordered section list with default content), global style, `isPublished`, version. The super admin can create one by **saving any store (for example a demo store) as a template**, edit it, preview it and publish it. The marketing gallery and the signup wizard read from these records.
3. Existing code templates (Kapor, Gadget Studio, Mini Bunny, Axion Wear, Bindu, Berber) are migrated to records, so there is one path.
4. Updating a template never changes stores that already use it; merchants can choose "apply the new version" (shows a preview first).
5. Plan gate stays: `settings` colours only, `home` home page only, `all` everything.

## 7. Data model changes (new migration)
- `LandingPage`: add `offersJson`, `templateId`, `shortCode` (unique), `status` (DRAFT | PUBLISHED), `seoTitle`, `seoImage`, `views`; keep `sectionsJson` for the published layout, drafts in the existing version tables.
- `LandingLead` (tenantId, landingPageId, name, phone, productId, utm, createdAt) with RLS.
- `Order.source` and `Order.landingPageId`, `Order.utmJson`.
- `LandingDaily` (page, date, views, orders) for the counters.
- `Template` (platform-level, no tenant RLS; read-only for stores) plus `TemplateVersion`.
- Migration numbering continues after `…0022`; apply to Supabase before the code, as before.

## 8. Build order (once approved)
1. Landing core: `offers`, order from the page (reusing order creation), `source` on orders, thank-you page, short link, tests.
2. New sections (video, image and text, countdown, stock left, trust strip, offer bar, custom) and the 10 templates.
3. Tracking: counters, pixel events, utm on orders, leads tab.
4. Visual editor: drag and drop, in-place text, undo, preview link; used for landing first.
5. Fully dynamic store templates: `Template` records, "save as template", migrate existing themes, platform editor, marketing gallery and signup reading from records.
6. Plan limits, docs, end-to-end tests on phone and desktop.

## 9. Open points to confirm
- Plan numbers for `landingPages` (Starter 1, Pro 5, Business unlimited?).
- Whether the order form may also offer bKash and Nagad later (decided: COD only for now).
- Whether the rolling countdown ("this offer ends in 23:59:59") is acceptable. It is common in these pages but can mislead customers if the offer does not really end. Proposed: only a real end date set by the merchant.
- Rights: the sample bundle's pictures and copy are not reused. If you own the bundle and want its pictures, say so and we can import them for your own demo store only.
