# UX Audit Report

Audit date: 4 November 2026. Branch `claude/comprehensive-ux-ui-audit-c4a8ea`. Audit only: no source was changed.

> **Update, 4 Nov 2026 (later):** signed-in admin and platform pages were then rendered locally on a private test database. See `BROWSER_VERIFICATION_ADDENDUM.md`. It **corrects** AD-13 (severity now 2; orders can be reopened), AD-15 (mobile does have "Select all"; only the duplicate DOM stands) and PL-03 (the platform does have an empty-state message on payments), and adds the finding that the floating AI Co-pilot button overlaps the bulk bar and the Save button (severity 3). Where the addendum and the text below disagree, the addendum wins.

## 0. How to read this report

### Evidence labels
Every finding carries one label. Do not treat them as equal.

| Label | Meaning |
|---|---|
| **[B]** Browser-verified | Observed or measured in a rendered page in the in-app browser (live `biztrack.bd` sites, 4 Nov 2026) |
| **[S]** Source-confirmed | Read directly in the repository; the behaviour follows from the code but was not rendered |
| **[H]** Hypothesis | Plausible from the code or a rendered clue; needs analytics, a usability test or a rendered check before it is acted on |

Severity uses the 0 to 4 scale from the brief (0 none, 1 cosmetic, 2 minor, 3 major, 4 critical blocker).

### What was and was not inspected (read this before trusting any score)
| Area | Browser | Source |
|---|---|---|
| Marketing: home, `/start` (step 1), `/templates`, `/demo/kapor` | **Yes, 375 px wide only** | Yes (sampled) |
| Admin: `/login` | **Yes, 375 px** | Yes (shell, orders, product editor, shared UI) |
| Admin: every authenticated page (dashboard, orders, products, settings, builder) | **No** (no credentials; none were entered) | Sampled |
| Platform: `/login` | **Yes, 375 px** | Navigation and layout only |
| Platform: every authenticated page | **No** | Navigation only |
| Storefront: Kapor demo home and an empty `/checkout` | **Yes, 375 px** | Checkout form read in full detail |
| Viewports 390, 768, 1366, 1440, 1920 | **Not tested** | CSS breakpoints read only |
| Keyboard walk, screen reader, zoom/reflow, forced colours | **Not tested** | |
| Real completion of signup, checkout or any order | **Not performed** (would create live records) | |

Consequences: responsive claims above 375 px are source-only. Admin and platform scores rest mostly on source. No claim of WCAG conformance is made anywhere in this audit.

A prior internal report, `checkup/UX-GAPS.md` (11 Oct 2026), lists many gaps. Several are visibly closed in current source (a pager on the orders and platform audit lists, a shared settings layout, a `SaveBar` component, a command palette). Items from that report are reused here only where re-confirmed.

---

## 1. Monorepo map

| Workspace | Role | Stack | Routes (`page.tsx`) |
|---|---|---|---|
| `apps/marketing` | Public site: product, pricing, templates, compare, migrate, signup wizard (`/start`), demo gallery | Next.js 16, React 19, own CSS (`marketing.css` 2,538 lines, `site.css` 785) | 42 |
| `apps/admin` | Merchant back office: orders, products, customers, marketing, reports, settings, theme/page builder, POS, inbox | Next.js 16, shared `@biztrackbd/ui` tokens and kit, `admin.css`, `shell.css`, `builder.css`, `menu.css` | 105 (`(admin)`, `(builder)`, `(print)`, login, demo, join) |
| `apps/platform` | BizTrackBD staff super-admin: tenants, payments, plans, domains, tickets, blog, audit | Next.js 16, shared tokens and kit, `platform.css` (332 lines) | 24 |
| `apps/storefront` | Merchant-facing shop for customers: home, products, cart, checkout, account, landing pages, themes | Next.js 16, own `kapor.css`, `themes.css` (2,623 lines), `landing.css`; merchant-themeable | 24 |
| `packages/ui` | Shared UI: tokens, `kit.css`, `PageHeader`, `Section`, `Card`, `DataTable`, `Drawer`, `SaveBar`, `ToastProvider`, `Segmented`, `EmptyState`, `Skeleton`, brand marks (1,197 lines in total) | React + CSS | n/a |
| `packages/core`, `db`, `media`, `tsconfig` | Business logic, Prisma/RLS, media, config | | not UX scope |

Styling: no Tailwind, no component library (no Radix, shadcn, Lucide, Framer). Custom CSS plus inline styles.

Roles and permissions: admin gates navigation by `can(role, area)`, plan modules (`moduleKey`) and tenant capabilities (`commerce`, `leads`, `menu`, `services`, `portfolio_items`...), so a clinic or restaurant tenant sees a different menu from a shop (`apps/admin/src/app/(admin)/layout.tsx:25-150, 186-200`).

Who shares what:

| | Tokens (`tokens.css`) | `kit.css` | `@biztrackbd/ui` components | Own CSS |
|---|---|---|---|---|
| admin | yes | yes | 101 files | yes |
| platform | yes | yes | 7 files | yes |
| marketing | **no**, re-declares brand tokens | no | 5 files | yes |
| storefront | **no**, own accent/theme variables | no | 3 files | yes (by design, themeable) |

Scale signals (counts across `apps/*/src`, `.tsx` only): 8,316 `style={{` inline-style blocks, 10,909 `className=`, 3,257 hard-coded hex colours in TSX.

---

## 2. Application-by-application analysis

### 2.1 Marketing site (`apps/marketing`)

**First impression and hierarchy [B, 375 px].** The home hero is clear: one `<h1>` ("Every order. Every courier. Every taka. Under control."), a supporting sentence, a primary CTA ("Start 14-day free trial") and a secondary CTA, with "14 days free · No card needed · Plans from ৳699/mo · 0% ..." under them. No horizontal overflow at 375 px; body text is 16 px. Within a few seconds a visitor can tell it is store software for Bangladesh. Positive.

**Issues**
| ID | Sev | Label | Finding | Evidence |
|---|---|---|---|---|
| M-01 | 1 | H | Two audiences share one page: a "Sell Products (Commerce)" / "Win Enquiries & Clients (Business)" switch sits above the single `<h1>`. A visitor may not realise the headline only speaks to one of them. | Home at 375 px |
| M-02 | 2 | B | Jargon in CTAs and labels: "Try store admin desk (no signup) ↗", "Inspect Apparel Demo Admin ↗", "Verify in Live Demo →", "Platform Architecture". "Admin desk" is not how a Bangladeshi shop owner names a back office. | Home, footer, `/templates` |
| M-03 | 2 | B / H | Repeated near-identical CTAs. Each template card carries three (View live demo / Try the admin / Use this template), and a later block carries two more each (Try demo desk / Use template). 15 of the 95 links and buttons on `/` are in these groups. Whether this causes choice overload needs analytics. | Counted in the rendered DOM at 375 px |
| M-04 | 2 | B | Signup wizard step 1 button reads "Continue to Selling Channel →". "Selling Channel" is internal vocabulary; the user has not yet been told what step 2 is. | `/start` |
| M-05 | 1 | B | Store-name placeholder is truncated at 375 px ("e.g. Aarohi Fashion, Gadget Pulse, Dhaka C…"). A shorter example would fit. | `/start` |
| M-06 | 1 | B | A sticky bottom CTA partly covers the third category card until the user scrolls. Not blocking, but it hides that more options exist. | `/start` |
| M-07 | 2 | S | `.input:focus { border-color: var(--brand); outline: none; }` removes the outline set globally by `:focus-visible` (`marketing.css:71`), leaving only a 1 px border colour change as the focus cue on text inputs. Needs a keyboard check against 3:1 contrast. | `apps/marketing/src/app/marketing.css:387` |
| M-08 | 2 | S | 209 `font-size` declarations of 9 to 11 px across CSS and TSX, e.g. `/business` stamps at 10 px and labels at 11.5 px. Small text on a conversion page hurts legibility on phones and for low-vision users. | `apps/marketing/src/app/business/page.tsx:233,285,432`; `business/pricing/page.tsx:234`; `compare/compare-view.tsx:196` |
| M-09 | 2 | S | Marketing does not load `@biztrackbd/ui/tokens.css`. It re-declares the brand tokens, and one has drifted: `--warning` is `#C2410C` in marketing but `#B45309` in the shared tokens. 1,270 hex literals in TSX. | `marketing.css:3-14` vs `packages/ui/src/tokens.css:35` |
| M-10 | 1 | B | Touch targets of 39 to 42 px high on mobile for links and buttons (all at least 24 CSS px, so they meet WCAG 2.2 AA 2.5.8; below the common 44 px guideline). Examples: "Monthly" 41 px, "View live demo" 39 px, social icons 40 x 40. | Measured on `/` at 375 px |

**Positives [B]:** skip link present, one `<main>`, four labelled `<nav>` regions, no images missing `alt`, error/not-found/loading files exist, visible contact details in the footer (trust), pricing is stated up front.

### 2.2 Merchant admin (`apps/admin`)

**Browser-verified scope: the sign-in page only.** Everything else is source.

**Sign-in [B, 375 px, dark because the browser prefers dark].**
| ID | Sev | Finding |
|---|---|---|
| AD-01 | 2 | No `<main>` landmark and no skip link on the sign-in page. |
| AD-02 | 2 | No show/hide password control. On a phone, typing a password blind raises error rates. |
| AD-03 | 1 | The card spans the full width with its border on the screen edge (no side gutter), and the label sits tight to its input. |
| AD-04 | 2 | The "biztrack" part of the wordmark is dark green on a dark card and looks low in contrast (not measured). |
| AD-05 | 0 | Positive: 44 px inputs, `autocomplete="username"`/`current-password`, labels present, clear secondary paths ("Set up your password", "Open a free store"). |

**Navigation and information architecture [S].**
| ID | Sev | Finding | Evidence |
|---|---|---|---|
| AD-06 | 2 | The same destinations are listed in more than one group: "Loyalty and referrals" under Customers (line 75) and "Loyalty & Referrals" under Marketing (line 94); "Abandoned checkouts" under Orders (47) and Marketing (95). The two loyalty labels differ in wording and case. | `apps/admin/src/app/(admin)/layout.tsx:47,75,94,95` |
| AD-07 | 2 | Two different things are called "Team": store team profiles (`/team`, layout.tsx:109) and staff accounts with roles (`/settings/staff`, labelled "Team", `settings/layout.tsx:18`). A merchant asking "where do I add my staff?" has two plausible answers. | files above |
| AD-08 | 1 | The Settings group shows three entries, and its first item is also called "Settings" (`layout.tsx:136-140`). The other settings pages (payments, shipping, domains, staff, notifications, integrations, webhooks) appear only after entering `/settings/store` (`settings-shell.tsx`). The command palette helps. | |
| AD-09 | 2 | Breadth: 105 routes, nine groups, and the Marketing group alone has 12 items. Good: items hide by role, plan and tenant capability. Risk: a new merchant meets a long menu. Needs task-based testing. | `layout.tsx:25-150` |

**Language [S].** The admin has an English/Bangla switch (cookie `bt_lang`).
| ID | Sev | Finding | Evidence |
|---|---|---|---|
| AD-10 | 3 | The translation dictionary is about 70 shell strings; `tr()` is imported in 2 files. The file states page text "follows in the dynamic-content sweep". Merchants who switch to Bangla get a translated menu around an English page body. Several menu labels are missing from the dictionary and stay English (for example "Limited Drops & Pre-Orders", "WhatsApp Automation", "Help and support", "Import content"). Banner text, "N days left", and the dev switcher are English-only. The product's stated audience reads Bangla. | `apps/admin/src/lib/i18n.ts:1-18`; `layout.tsx:85,140,274,306` |

**Interaction and forms [S].**
| ID | Sev | Finding | Evidence |
|---|---|---|---|
| AD-11 | 3 | **No protection against losing edits.** No `beforeunload` or dirty-state guard anywhere in the app. `SaveBar` (unsaved-changes indicator plus Discard) exists in `@biztrackbd/ui` but is used in 3 places. The product editor is a 1,320-line component with no dirty tracking. A merchant who edits a long product and taps back loses the work silently. | grep results; `products/editor.tsx` |
| AD-12 | 2 | Destructive confirmations use the browser's `window.confirm`: 24 call sites (e.g. `confirm-delete.tsx:30`, `content-items-manager.tsx:356`, `bundles-manager-client.tsx:277`). Messages are generic ("Are you sure you want to delete this bundle?"), not translated, not styled, and name no consequence. Native dialogs can also be suppressed in some embedded browsers (H). | |
| AD-13 | 3 | **S (partly H).** The bulk bar on the orders list puts "Cancel selected" in the same row as "Mark selected as packed", "Confirm selected" and "Book courier", next to a reason `<select>` whose first option, "Customer requested", is preselected. `bulkCancelAction` runs `bulkStatus(..., "CANCELLED")` straight from the form submit; no confirmation step was found in the action, `components/bulk.tsx` or `components/ui.tsx`. A mis-tap could cancel many orders with a default reason. Not exercised in a browser: a client script could still intercept the click, and `bulkChangeStatus` may skip orders that cannot be cancelled (it returns a done/skipped count). | `orders/page.tsx:104-120`; `orders/actions.ts:36-64` |
| AD-14 | 2 | The orders search form relies on a visually hidden submit button (`sr-only`); there is no visible Search button and no live filtering. Pressing Enter works; a sighted mouse or touch user may not know how to run the search. | `orders/page.tsx:97` |
| AD-15 | 2 | On mobile the orders list renders cards, with checkboxes per card, but the "select all" checkbox lives only in the desktop table header. Both a card list and a table are rendered in the DOM and switched by CSS (`only-mobile` / `only-desktop`), so `name="ids"` checkboxes and `data-testid` values appear twice in one form. Mobile merchants cannot select all. | `orders/page.tsx:121-160` |
| AD-16 | 1 | Two toast systems: `ToastProvider`/`useToast` in `@biztrackbd/ui` (used in 3 files) and a separate module toast in `apps/admin/src/components/toast.tsx`. Both announce politely; they differ in API and timing. | |
| AD-17 | 2 | Shared building blocks are under-used: `DataTable` has 0 uses against 59 raw `<table>` elements; `EmptyState` 1 use; `Skeleton` 6; inline `style={{}}` 3,208; hex literals 972. Behaviour of tables, empty states and spacing therefore varies page by page. | grep counts |

**Positives [S]:** a command palette, a mobile bottom tab bar with an "Orders to check" badge, a trial plan card with a progress meter, a billing banner that tells non-owners to "Ask the store owner", `DoubleSubmitGuard` and `useBusyAction` for duplicate submissions, `Drawer` built on native `<dialog>`, route-level `error.tsx` that says "Your orders and products are safe", `loading.tsx` skeleton, and automated axe checks in the admin end-to-end tests (`apps/admin/e2e/longpages.spec.ts` imports `@axe-core/playwright`).

### 2.3 Platform admin (`apps/platform`)

**Browser-verified scope: sign-in only [B, 375 px].** Clear copy ("BizTrackBD team only. Two-factor sign-in is required."), labelled 44 px inputs, correct `autocomplete`, no `<main>` landmark.

| ID | Sev | Label | Finding | Evidence |
|---|---|---|---|---|
| PL-01 | 2 | S | Fifteen flat top-level items, with combined labels ("Payments and plans", "Themes and modules", "Team and audit log", "Analytics & Ads"). The labels hide what sits inside them. | `apps/platform/src/app/(sa)/layout.tsx:15-28` |
| PL-02 | 1 | S | Theme is hard-coded `data-theme="light"`. The admin respects the system theme; the platform does not. | `apps/platform/src/app/layout.tsx:20` |
| PL-03 | 2 | S | No `EmptyState`, `Skeleton`, `SaveBar` or dialog use anywhere in platform source. Two `confirm()` calls. Internal-tool risk: an empty tenant list is just blank. | counts |
| PL-04 | 2 | S | Heavy tooling pages (audit log 20,000 px tall in the Oct report) now use a `Pager` (`audit/page.tsx:298`), which is an improvement. Tenant detail, per the Oct report, was one page of four cards; not re-checked. | `checkup/UX-GAPS.md` section 3 |

### 2.4 Storefront (`apps/storefront`)

**Browser scope: Kapor demo home and an empty checkout at 375 px.**
| ID | Sev | Label | Finding | Evidence |
|---|---|---|---|---|
| ST-01 | 2 | B | About 150 px of an 812 px phone screen is promotional chrome before the hero: a dark "Live demo" bar, a "Demo store: free delivery in Dhaka over ৳3,000" bar, the header, then the same free-delivery bar again. The repeated line may be demo-only. Check a non-demo store. | `kapor.biztrack.bd` at 375 px |
| ST-02 | 2 | B | A sticky "Call Now" bar and a floating chat bubble both sit at the bottom of the viewport on every page, including an empty checkout, covering the lower edge of content. | Screenshot, home and checkout |
| ST-03 | 2 | B | No skip link on the storefront (marketing has one). A `<main>` landmark exists. | DOM check |
| ST-04 | 1 | B | Empty checkout shows "Your cart is empty." with one link, "Continue shopping", and the page contains two `<h1>` elements both reading "Checkout". No suggestions, no recently viewed. | `/checkout` |
| ST-05 | 2 | S | Custom checkout fields render errors as a bare `<div className="error">` without `id`, `role="alert"` or `aria-invalid`, unlike every standard field, which uses a shared helper. Screen-reader users will not hear those errors. | `components/checkout-form.tsx:629` vs `495-496` |
| ST-06 | 1 | S | Required asterisk colour is a hard-coded `#dc2626`, outside the theme tokens, so a merchant theme cannot change it. | `checkout-form.tsx:620` |
| ST-07 | 2 | H | The checkout is one 906-line component that can show phone, name, email, address, AI address paste, custom fields, payment method with TrxID, coupon, referral code, loyalty points and order bumps. Strong validation (below), but the effect of this many optional blocks on completion is a hypothesis for A/B testing. | `checkout-form.tsx` |
| ST-08 | 2 | H | The root layout loads seven font families (`jakarta`, `hind`, `playfair`, `poppins`, `notoSerifBn`, `baloo`, `notoSansBn`). Whether every visitor downloads all of them was not measured; on 3G phones this could cost first paint. Measure real transfer. | `apps/storefront/src/app/layout.tsx:31` |

**Checkout strengths [S]:** inline validation with `aria-invalid`, `aria-describedby`, `role="alert"`; focus moves to the first invalid field (`checkout-form.tsx:307`); `inputMode="tel"`, `autoComplete="tel-national"`, `autoComplete="street-address"`; the submit button is disabled while busy; a TrxID format check (8 to 12 alphanumerics); server-side recalculation of prices (README); an AI "paste an address" helper; and Bangla/English per visitor. This is the best-crafted form in the repo.

---

## 3. Heuristic evaluation summary (Nielsen)

| Heuristic | Strongest evidence | Gaps |
|---|---|---|
| 1 Visibility of system status | Trial meter, billing banners, navigation progress bar, pending labels on bulk buttons ("Packing…"), skeleton `loading.tsx` | No visible search submit (AD-14); no unsaved-state indicator on most forms (AD-11) |
| 2 Match with real world | Taka, COD, bKash/TrxID, courier names, division/district/upazila | "Admin desk", "Selling Channel", "Platform Architecture" (M-02, M-04); two "Team" meanings (AD-07) |
| 3 User control and freedom | `Discard` in `SaveBar`; order cancel reasons | No leave-page guard (AD-11); no undo on deletes (AD-12) |
| 4 Consistency and standards | Shared tokens for admin and platform | Marketing token drift (M-09); duplicate nav entries (AD-06); two toast systems (AD-16); 59 hand-rolled tables (AD-17) |
| 5 Error prevention | `DoubleSubmitGuard`, TrxID pattern, phone validation, confirmation before delete | Bulk cancel adjacent to safe actions with a default reason and no confirmation found in source (AD-13); generic confirms (AD-12) |
| 6 Recognition over recall | Command palette, grouped nav, quick view drawer | Settings pages only discoverable after entering Settings (AD-08) |
| 7 Flexibility and efficiency | Bulk actions, quick order, POS, Ctrl-K, AI address paste | Mobile select-all missing (AD-15) |
| 8 Aesthetic and minimalism | Clean hero, restrained palette | Repeated CTAs (M-03), stacked bars on storefront (ST-01), very small text on `/business` (M-08) |
| 9 Help with errors | `role="alert"` errors; "Your orders and products are safe" error page; billing ownership hint | Custom checkout fields silent to screen readers (ST-05); generic confirm text |
| 10 Help and documentation | `/support`, contact details, FAQ on marketing | Not assessed in-app: no tooltips or onboarding checklist observed (source of dashboard not read) |

---

## 4. Responsive findings
Only 375 px was rendered. At 375 px: no horizontal overflow on marketing home, `/start`, `/templates`, admin login, platform login, Kapor home or checkout [B]. Breakpoints in CSS cluster around 900 px (admin 18 rules at `min-width: 900px`, 12 at `max-width: 899px`; platform 14 and 2; marketing 11; storefront 17) with extra steps at 640 to 860 px [S]. There is no breakpoint dedicated to 1366 to 1920 px, so very wide layouts (1920 px) rely on max-width containers; not observed.

Not assessed: 390, 768, 1366, 1440 and 1920 px rendering; table behaviour on tablets; the theme builder (`builder.css`, 1,295 lines) on any viewport; POS on a tablet.

Responsive-specific findings: AD-15 (mobile select-all), ST-01 and ST-02 (stacked bars and floating controls on a 375 px screen), M-06 (sticky CTA over content), M-10 (targets 39 to 42 px).

## 5. Accessibility
See `ACCESSIBILITY_REPORT.md`.

## 6. Interaction issues
See AD-11 to AD-16, ST-05, M-07. The strongest pattern problem is the mix of native `confirm()`, bespoke buttons and unguarded long forms.

## 7. UX writing recommendations
| Where | Today | Suggested |
|---|---|---|
| Home secondary CTA | "Try store admin desk (no signup) ↗" | "See the merchant dashboard (no signup)" |
| Template card | "Inspect Apparel Demo Admin ↗" | "Try the apparel dashboard" |
| Signup step 1 button | "Continue to Selling Channel →" | "Next: how you will sell →" |
| Admin delete confirm | "Are you sure you want to delete this bundle?" | "Delete the bundle 'Eid combo'? Orders already placed are not affected. This cannot be undone." |
| Admin nav | "Loyalty and referrals" / "Loyalty & Referrals" | One label, one location |
| Admin nav | "Team" (profiles) and "Team" (staff) | "Team profiles (shown on your site)" and "Staff accounts" |
| Platform nav | "Payments and plans", "Team and audit log" | Split, or add sub-labels |
| Storefront empty cart | "Your cart is empty." | Add what to do next, e.g. "Add something you like, delivery is free in Dhaka over ৳3,000." |

Note on hedging: copy suggestions are drafts for the content owner, not validated wording.

## 8. Technical UX inspection
| Area | Finding | Label |
|---|---|---|
| Error boundaries | `error.tsx` and `global-error.tsx` in all four apps; `(admin)`, `(sa)` and `(store)` have group-level boundaries | S |
| Loading | `loading.tsx` in all four apps; one product-level loading file in the storefront; skeleton CSS honours `prefers-reduced-motion` | S |
| Layout shift | Not measured. The repo has `audit:vitals` (`apps/storefront/e2e/vitals.mjs`); no results were run in this audit | not assessed |
| Images | `next/image` in storefront (9 uses) and marketing (4); admin has 19 raw `<img>` against 1 `next/image` | S |
| Duplicate DOM | Orders list renders both card and table variants (AD-15) | S |
| Inline styles | 8,316 inline `style={{` blocks bloat HTML and defeat theming, and block CSS-level responsive overrides | S |
| Fonts | Seven families in storefront layout (ST-08) | S / H |
| Native dialogs | 24 `confirm()` in admin, 2 in platform | S |

## 9. Cross-application analysis
See `DESIGN_SYSTEM_AUDIT.md` (consistency matrix) and `UX_SCORECARD.md`.
