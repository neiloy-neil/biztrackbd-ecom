# Platform UI/UX Plan

Status: UPDATED 10 Oct 2026. Companion to `docs/01-architecture-and-roadmap.md`. The design now exists as a canvas of 88 artboards (see `docs/29-design-canvas-screen-index.md`). Nothing is implemented in code yet.

## 0. Decisions locked in

| Area | Decision |
|---|---|
| Parent brand | The Digital Dude (digitaldude.co.uk). Platform inherits its identity. |
| References | Shopify admin (structure), Linear/Vercel (precision, keyboard), Stripe (data/tables/trust), Notion/Webflow (editor feel) |
| Tone | Neutral and professional. Tenant themes are the visual stars; the platform stays quiet. |
| Avoid | Purple/blue gradients + glows, emoji/icon-in-circle feature cards, glassmorphism + heavy shadows, vague copy |
| Primary user | Non-technical owner on a phone, Bangla or English |
| Mobile | Responsive, app-like admin, installable PWA, push for new orders |
| Type | One sans + Bangla pair |
| Density | Comfortable default, compact toggle |
| Builder | Left sections panel, centre live preview, right settings |
| Surfaces | Marketing + gallery + pricing; signup + onboarding; owner admin; builder; super admin; storefront design system; BD checkout + customer account; domain + billing |
| Deliverable | Design canvas (88 artboards, light mode plus one dark dashboard) in `design/canvas/project/`; this plan explains it |
| Pills vs rectangles | Pill buttons on marketing and signup only; 8px rounded rectangles in admin (decided in the canvas) |
| Accessible text colors | Ink 3 `#6B6B8D` (5.1:1), success `#15803D`, info `#0369A1`, warning `#B45309`; first-draft values failed 4.5:1 and were replaced |

## 1. Design principles

1. **Say what it does.** Every headline names a concrete outcome ("Your store, live at yourname.shop in 10 minutes"). No "supercharge", "unlock", "seamless".
2. **Quiet chrome, loud content.** Platform UI is white, navy text, one accent. The merchant's products and theme previews carry the color.
3. **Tasks, not features.** Navigation and dashboards are organised around "what do I do today" (fulfil orders, add product, get paid), not modules.
4. **Phone first for owners.** Design the admin at 390px first; desktop adds density, not new concepts.
5. **Real data in every mock.** Real BDT amounts, real Bangla names, real districts. Never lorem ipsum, never "John Doe".
6. **One accent, used for action.** Indigo means "you can do something here". Status colors only for status.
7. **Progressive disclosure.** Basic fields visible, advanced behind "More options". Plan-locked features are visible but explained, never silently hidden.
8. **Honest states.** Every screen has designed empty, loading, error, offline and permission-denied states, with a next step.
9. **Bangla is a first-class locale,** not a translation afterthought: layout tested with Bangla strings, Bangla numerals optional, correct line-height.

## 2. Brand foundation (from digitaldude.co.uk)

Observed on the live site: Plus Jakarta Sans, 700 headings (48px hero), 600 buttons at 14px, pill-shaped buttons (radius 9999px), navy body text, white surface, pale lavender section tint.

### Color tokens

| Token | Value | Use |
|---|---|---|
| `--brand` | `#5B4FE8` | Primary action, links, focus, selected |
| `--brand-hover` | `#4A3FD1` | Hover/pressed (derive; verify contrast) |
| `--brand-tint` | `#F4F3FF` | Selected rows, soft sections, hover surface |
| `--brand-tint-2` | `#5B4FE8` @ 10% | Badges, subtle fills |
| `--ink` | `#1A1A4E` | Headings, primary text |
| `--ink-2` | `#4B4B73` (derive) | Secondary text |
| `--ink-3` | `#7C7C9A` (derive) | Tertiary/placeholder (check 4.5:1 on white for text use) |
| `--surface` | `#FFFFFF` | Cards, pages |
| `--canvas` | `#FAFAFC` (derive) | App background behind cards |
| `--line` | `#E7E7F0` (derive) | Borders/dividers |
| `--sky` | `#0EA5E9` | Informational / secondary accent (appears on site as 10% tint) |
| `--success` `--warning` `--danger` | green `#16A34A`, amber `#D97706`, red `#DC2626` | Status only |

Rules: **flat fills only**. No gradients, no glow/box-shadow color, no blurred backdrops. Elevation = 1px border + at most one subtle neutral shadow on popovers/modals. The indigo is the brand's own color, so keep it, but use it sparingly (primary buttons, selected state, links, the "live" dot) and let white and navy do the work. Dark mode: ink-based surfaces (`#0F0F2A` canvas, `#171738` surface); brand lightened to meet 4.5:1.

Marketing hero may use the navy `#1A1A4E` as a solid dark band for the product screenshot, as the parent site does. Still flat.

### Typography

- **UI/Latin:** Plus Jakarta Sans (matches parent brand).
- **Bangla:** Hind Siliguri for UI, Noto Sans Bengali as fallback; confirm weights 400/500/600/700 and tested line-height (Bangla needs ~1.6 vs 1.4).
- **Numerals:** tabular figures for all money, quantities, tables. Option for Bangla digits per store/user.
- Scale (px, desktop / mobile): Display 48/34, H1 32/26, H2 24/20, H3 18/17, Body 15/16 (admin 14 compact), Small 13, Micro 12. Weights 400/500/600/700 only.
- Never all-caps body; small eyebrow labels only, with letter-spacing.

### Shape, space, motion

- 4px base grid. Spacing scale 4/8/12/16/24/32/48/64.
- Radii: inputs/cards 10px, buttons **pill** on marketing, **8-10px rounded rect in the dense admin** (pills for primary CTAs on signup/marketing only; keeps tables and forms tidy). Decide in prototype review.
- Icons: one set, 1.5px stroke, 20px (Lucide). Icons accompany labels; no decorative icon medallions.
- Motion: 120-180ms ease-out for state changes, 240ms for panels/sheets; respect `prefers-reduced-motion`. No parallax, no floating blobs.
- Imagery: real product screenshots and real merchant stores. No stock illustrations of people at laptops, no 3D blobs, no gradient meshes.

## 3. Information architecture and navigation

### 3.1 Marketing site (`yourplatform.com`)
- Home, Templates (gallery), Template detail (live demo), Pricing, How it works, Customers/Stories (later), Help center, Blog, Login, Start free trial.
- Header: logo, Templates, Pricing, Help, Log in, **Start free trial** (primary).

### 3.2 Store owner admin
Desktop: left sidebar. Mobile: bottom tab bar (5 slots) + "More" sheet.

| Slot | Contents |
|---|---|
| **Home** | Today dashboard, setup checklist, alerts |
| **Orders** | Orders, quick order desk, fraud and risk check, abandoned orders and call list, returns and exchanges, COD settlement, print documents (invoice, packing slip, label) |
| **Products** | Products, categories, inventory, collections, reviews (approve, reply, hide) |
| **Customers** | Customers, customer detail, tags, messages |
| **More** | Marketing (coupons, landing pages, pixels and tracking, loyalty and VIP, campaigns), Online store (themes, builder, pages, blog, menus), Reports (sales, profit and loss), Apps/Modules, Settings (store details, payments, shipping and couriers, integrations and keys, notifications and SMS, domains, staff, plan and billing, language), Help |

Global: store switcher (multi-store owners), search/command palette (`Ctrl/Cmd+K`), notifications, language toggle (EN/বাংলা), "View store" link, account menu. Module-gated items (Bespoke, Drops, Baby profiles) appear only when enabled.

### 3.3 Super admin
Overview, Tenants (list, detail), Payments and plans (manual payment approvals, plans and entitlements matrix), Domain health, Themes and modules (staged releases, module flags), Support tickets, Announcements, Usage and limits, Team and audit log.

### 3.4 Storefront (per theme)
Header (announcement, logo, nav, search, account, cart), Home sections, Collection, Product, Cart drawer, Checkout, Account (orders, addresses, wishlist), Pages, Blog, Footer.

## 4. Key flows

### 4.1 Discovery to live store (the money flow)
1. Landing -> Templates gallery (filter by industry: fashion, electronics, kids, bespoke; search).
2. Template detail: **full live demo in an iframe with desktop/mobile toggle**, "Start free trial with this template".
3. Signup: email + phone (OTP optional) + password, or Google. No card.
4. Wizard (5 steps, resumable, progress shown, each skippable except 1-2):
   1. Store name + category
   2. Choose subdomain (live availability check, suggestions from name) 
   3. Confirm template (can change later)
   4. Brand basics: logo, primary color, contact phone, currency BDT
   5. Choose starter content: **demo products** (editable) or start empty
5. Land in admin Home with a setup checklist: Add products, Set payment methods, Set shipping, Customize theme, Publish store, Connect domain.
6. Trial banner shows days left; upgrade from banner, billing, or when hitting a limit.

### 4.2 Add a product (mobile-optimised)
Single scrolling form with sticky Save: photos (camera/gallery, reorder), title, price, compare-at price, stock, category, variants (guided: "Does this come in sizes/colors?"), description, visibility. Draft autosave. Bangla/English fields side by side tabs.

### 4.3 Fulfil an order
Order list with status tabs (New, To pack, Shipped, Delivered, Returns). Order detail: timeline, customer, items, payment (COD/bKash/Nagad with TrxID verify action), **one-tap "Book courier"** (Pathao/Steadfast/RedX) with auto-filled address, print label, SMS to customer. Bulk actions on desktop.

### 4.4 Customize the store
Builder (see 6). Simple mode for owners: Brand (logo, colors, fonts), Home sections, Header/Footer, Pages. Publish with preview link; revert to previous version.

### 4.5 Connect a custom domain
Domain screen: enter domain -> choose **"I bought it from [registrar]"** guidance -> exact DNS records with copy buttons -> "Check now" -> live status (Waiting for DNS, Verifying, Issuing SSL, Connected) with plain-language errors ("The A record points to 1.2.3.4; it should point to ..."). Plan-locked state if on a lower tier.

### 4.6 Subscribe and pay
Billing page: current plan, usage meters (products, staff, storage, SMS), plan comparison, pay via Stripe card, SSLCommerz (bKash/Nagad/cards), or **manual transfer** (instructions, TrxID, screenshot upload, "pending approval" state with SLA text). Invoices list. Dunning banners: friendly, specific, with the action to fix.

### 4.7 Customer checkout (BD-specific)
One page, mobile first: contact (phone first, email optional), address (Division -> District -> Upazila/Thana cascading selects, free-text area), delivery method with cost, payment: **COD**, **bKash/Nagad** (shows merchant number, amount, field for TrxID + sender number, clear "we'll confirm after verifying"), order summary sticky. Guest checkout default; account creation after. Order success page with tracking link and SMS confirmation.

### 4.8 Super admin daily
Overview of MRR, trials ending, failed/manual payments awaiting approval, new tickets. Tenant detail with "Login as", suspend, change plan, extend trial. All destructive/impersonation actions require confirmation and write to audit log.

## 5. Screen inventory and design notes

### 5.1 Marketing
- **Home:** Hero with outcome headline, subline, two CTAs (Start free trial / View templates), real product screenshot in navy frame. Then: how it works (3 numbered steps, plain), template previews (real storefront screenshots, large), what's included (a concise comparison table, not icon cards), Bangladesh-specific capabilities (bKash/Nagad, Pathao/Steadfast, Bangla), pricing summary, FAQ, footer CTA.
- **Templates gallery:** large cards = real screenshot, name, industry, "Live demo", "Use this template". Sticky filter bar.
- **Template detail:** full-width live preview with device switcher, features list, included modules, similar templates.
- **Pricing:** 3 plans + trial note; table of limits; monthly/yearly toggle; FAQ on payments in BDT; manual payment mention.
- Copy rule: each section answers one question a shop owner has; sentences concrete; Bangla version of the whole site.

### 5.2 Onboarding wizard
Full-screen focused layout, left progress, right live mini-preview of the store updating as they type. Large touch targets, one decision per screen on mobile.

### 5.3 Owner admin
- **Home:** Today strip (new orders, to pack, revenue today vs yesterday), sales chart (7/30 days), top products, low stock, setup checklist card (collapses once done), announcements from platform.
- **Orders list:** tabs, search, filters, saved views; row = order #, customer, items, total, payment badge, fulfilment badge, time. Mobile rows become cards with primary action.
- **Order detail, Product list/editor, Customers, Inventory, Coupons, Reports, Settings** following one consistent page template: title bar + primary action, content cards, sticky save bar when dirty.
- **Settings:** grouped list (Store details, Payments, Shipping, Taxes, Notifications and SMS templates, Staff and permissions, Domains, Language, Billing). Each opens a single focused page.
- **Fraud and risk:** orders needing a decision with a transparent score, reasons and courier history for the phone number; actions Call, Ask for advance payment, Approve, Cancel and block; rules panel and blocklist. Mobile version has one-tap Call, Approve, Block.
- **Abandoned orders:** tabs To call, Called, Recovered; call list with cart, stage reached and a suggested script; result buttons; Create order for this customer. Mobile version is a call queue.
- **Quick order desk:** paste the customer message, fill phone, name, address and products; returning-customer lookup; automatic district and delivery charge; Create and book courier. 15-second timer. Mobile version is one scrolling form with a pinned action bar.
- **COD settlement:** couriers owe you, received, does not match; table of expected vs paid per consignment; detail panel with fee breakdown and Raise dispute. Mobile version shows short-paid cards.
- **Returns, reviews, pages and blog, invoice and packing slip, customer detail, store details:** standard list plus side-panel or form pages in the same template.
- **Marketing:** landing pages list (visits, orders, conversion), pixels and conversion tracking (Pixel ID, CAPI token write-only, event match table, cookie notice), loyalty and VIP (tiers, earning rules, referral reward).
- **Integrations and keys:** cards per courier, gateway and messaging provider; a connect dialog with write-only secrets, test or live mode and the webhook URL to paste. Owner only.
- **Profit and loss:** waterfall from delivered sales through product cost, couriers, COD and gateway fees, returns, discounts and ads to net profit.
- **Lifecycle states:** read-only mode after the plan ends (export your data, reactivate), plan limit reached dialog, store paused storefront.
- **Components:** data table (sort, filter, column picker, bulk bar, density toggle), form field set, status badge, empty state, toast, confirm dialog, side sheet, command palette, skeleton, usage meter, upgrade prompt.

### 5.4 Builder
Layout: **left** sections list (drag to reorder, eye to hide, + Add section) and page switcher; **centre** live preview in an iframe with device toggle (mobile/tablet/desktop); **right** settings for selected section/block (content, layout, colors); top bar with Undo/Redo, page picker, Preview, **Publish**, unsaved indicator, version history. Theme settings (colors, fonts, buttons, spacing) in a separate left tab. A one-product **landing page builder** reuses the same shell with blocks (countdown, hero, order form, benefits, gallery, size chart, reviews, sticky button) and a mobile preview. Mobile: builder available in simplified form (section list + settings sheet); full canvas on desktop/tablet. Phase 7 adds click-on-canvas and free-form drag.

### 5.5 Super admin
Dense desktop-first layout (compact default). Overview KPIs, MRR/churn charts (Stripe-style), tenants table with health indicators, tenant detail tabs (Overview, Subscription, Usage, Domains, Modules, Orders/GMV, Audit, Notes), payments queue (screenshot, TrxID checks, approve or reject), plans and entitlements matrix, domain health, themes and modules registry, tickets inbox (list + thread), announcement composer with preview, team and audit log.

### 5.6 Storefront design system
Shared tokens (color, type scale, radius, spacing) overridable by tenant brand settings; shared primitives (Button, Input, Badge, Price, Rating, QuantityStepper, ProductCard, Drawer, Accordion). Each theme composes these with its own personality (bespoke tailoring, kids, streetwear, electronics), so quality floor is shared and identity is not. Rules: accessible contrast guard (builder warns if tenant colors fail 4.5:1), image aspect ratios enforced, fast LCP, tested with Bangla product names.

### 5.7 Customer account
Phone/OTP or email login, orders with tracking timeline, saved addresses (BD structure), wishlist, loyalty/store credit if enabled.

## 6. Mobile and PWA
- Bottom tab bar, large tap targets (44px min), thumb-reachable primary actions, sticky bottom action bars, bottom sheets instead of modals.
- Installable PWA (manifest, icons, splash), offline shell + queued actions where safe, web push for new orders/low stock/payment proof, haptics-free.
- Camera-first image upload, share sheet to send store link on WhatsApp/Facebook.
- Performance budget: admin TTI < 3s on mid-range Android over 4G; lists virtualized.

## 7. Accessibility and i18n
- WCAG 2.2 AA: contrast, focus rings (2px brand, 2px offset), keyboard paths everywhere, labelled inputs, error text not color-only, reduced motion.
- Locale switch persists per user; admin strings via `next-intl` keys; no concatenated sentences; plural/number/date/currency formatting via Intl (BDT, `bn-BD`).
- Test matrix: EN/BN x mobile/desktop x light/dark on key screens.

## 8. Content and voice
Plain, specific, respectful of a shop owner's time. Short sentences. Bangladesh-aware examples (Dhaka, bKash, Eid sale). Buttons are verbs ("Add product", "Publish store"). Errors say what happened and what to do. Sample voice:
- Hero: "Launch your online store in a day. Sell with bKash, Nagad and cash on delivery."
- Empty orders: "No orders yet. Share your store link to get your first one."
- Domain error: "We can't see your DNS record yet. It can take up to a few hours. We'll keep checking."

## 9. Deliverables and process

**Step A: this plan.** Done.
**Step B: design canvas.** Done: 88 artboards instead of separate prototypes. Original order for reference:
1. Design tokens + component sheet (buttons, inputs, table, badges, nav) in light and dark
2. Marketing home + templates gallery + pricing
3. Signup wizard (5 steps with live preview)
4. Owner admin: Home, Orders list, Order detail, Product editor (mobile + desktop)
5. Builder
6. Domain setup + Billing (manual payment)
7. BD checkout (mobile)
8. Super admin: Overview, Tenant detail
**Step C: review round(s)** per group, adjust tokens, then freeze the design system. In progress.
**Step D: implement** in `packages/ui` and the apps per the architecture roadmap, with Storybook for the component library and visual regression tests.

## 10. Quality bar (definition of "not AI-looking")
- No gradient or glow anywhere; one accent; borders over shadows.
- No three-up icon-in-circle feature grids; use real screenshots, tables, numbered steps.
- Copy contains no filler adjectives; every claim is checkable.
- All demo data realistic and local.
- Every screen reviewed at 390px, 768px, 1440px, in EN and BN.
- Consistent page template, spacing, and component usage; no one-off styles.

## 11. Open questions
1. Primary CTA shape: pill everywhere (matches parent) or pill on marketing only and rounded-rectangle in admin?
2. Platform name/logo: is it a Digital Dude sub-brand ("X by The Digital Dude") or a standalone name? Logo files available?
3. Light mode only at launch, or light + dark?
4. Should the marketing site feature the parent studio's 7 delivered products as social proof?
5. Preferred Bangla UI font if the team has one; any Bangla copywriter/reviewer available?
6. Any must-copy details from Shopify/Stripe/Linear you particularly like (e.g. command palette, keyboard shortcuts)?

## 12. Canvas status (10 Oct 2026)

- 88 artboards across 9 pages. Index: `docs/29-design-canvas-screen-index.md`.
- **Done:** foundations and component kit, marketing, onboarding, owner admin (desktop and mobile) including all v1 features, theme builder and landing page builder, storefront and checkout, super admin, lifecycle states, one dark-mode screen.
- **Dark mode:** drawn for the admin dashboard only. Tokens: canvas `#0F0F2A`, surface `#171738`, line `#2A2A5A`, text `#ECECFA`, brand `#8B83F5`.
- **Not yet drawn:** dark versions of other screens, mobile loyalty and profit and loss, the risk rules and blocklist pages, empty and error states for every list, a keyboard shortcut sheet.
- Page heights were measured in headless Chrome with fallback fonts; adjust frames if real fonts change a layout.
