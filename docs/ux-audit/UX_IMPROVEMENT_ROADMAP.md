# UX Improvement Roadmap

Effort scale: **S** under 2 days, **M** 2 to 5 days, **L** more than 5 days (one developer, including tests). Estimates are rough and exclude design review.
Labels: **[B]** browser-verified, **[S]** source-confirmed, **[H]** hypothesis. Finding IDs refer to `UX_AUDIT_REPORT.md` and `DESIGN_SYSTEM_AUDIT.md`.

> **Update:** after browser verification, add **R-25 (P1, AI Co-pilot safe zone)**, **R-26 to R-28 (P2)** and note the revisions to R-01 and R-07, all in `BROWSER_VERIFICATION_ADDENDUM.md`.

## P0: critical usability blockers
**None confirmed.** No finding reached severity 4 on the evidence available. Authenticated admin and platform pages were not rendered, so the absence of a P0 reflects limited coverage, not a clean bill.

---

## P1: high-impact improvements

### R-01 Bulk cancel safeguards on the orders list (severity 3, listed first)
- **Problem:** "Cancel selected" sits in the same bar as "Mark packed", "Confirm" and "Book courier", beside a reason select whose default is "Customer requested". In source, `bulkCancelAction` cancels straight from the form submit with no confirmation step found. [S; not exercised in a browser]
- **User impact:** one mis-tap could cancel many orders with a misleading reason recorded, and may release stock and trigger customer messages (the side effects were not checked).
- **Evidence:** `apps/admin/src/app/(admin)/orders/page.tsx:104-120`; `orders/actions.ts:36-64` (AD-13).
- **Proposed solution:** first try it in a browser to confirm. Then add a confirmation stating the count ("Cancel 12 orders?"), require choosing a reason (no default), and move Cancel to an overflow or separate row. Check whether a cancelled order can be restored.
- **Apps:** admin. **Files:** `orders/page.tsx`, `orders/actions.ts`, `components/bulk.tsx`.
- **Effort:** S. **Expected outcome:** removes the highest-consequence mis-tap. **Dependencies:** shares a dialog with R-03.

### R-02 Protect against lost edits
- **Problem:** no leave-page guard or dirty state on long admin forms; `SaveBar` exists but is used in 3 places; the product editor is 1,320 lines. [S]
- **User impact:** silent data loss for merchants on phones with poor connectivity, where back-swipes are common.
- **Evidence:** zero `beforeunload` matches in `apps/*/src`; `packages/ui/src/interactive.tsx` `SaveBar`; `products/editor.tsx`. (AD-11)
- **Proposed solution:** a `useUnsavedChanges(dirty)` hook in `@biztrackbd/ui` (beforeunload plus Next navigation interception), then wire `SaveBar` into the product editor, store settings, shipping, payments and staff first.
- **Apps:** admin (platform later). **Files:** `packages/ui/src/interactive.tsx`, `products/editor.tsx`, `settings/*`.
- **Effort:** M. **Expected outcome:** fewer abandoned edits; measurable as a drop in "discarded product form" events once instrumented. **Dependencies:** none.

### R-03 Replace native `confirm()` with an accessible, specific confirm dialog
- **Problem:** 24 admin and 2 platform `window.confirm` calls with generic text; not translated; no consequence stated. [S]
- **User impact:** weaker error prevention; less trust; possible suppression in embedded browsers [H].
- **Evidence:** `components/confirm-delete.tsx:30`, `content-items-manager.tsx:356`, `bundles-manager-client.tsx:277` and 21 more. (AD-12)
- **Proposed solution:** one `ConfirmDialog` built on `<dialog>` in `@biztrackbd/ui` with title, consequence line, destructive button label that names the action, and focus return. Migrate `ConfirmDelete` first (8 consumers) then the rest.
- **Apps:** admin, platform. **Effort:** M. **Outcome:** consistent, accessible, translatable confirms. **Dependencies:** none.

### R-04 Finish the Bangla admin
- **Problem:** the language switch translates the menu (about 70 strings) but not page bodies, banners or several menu labels. [S]
- **User impact:** Bangla-reading merchants face a half-translated product, the core audience in the product's own positioning.
- **Evidence:** `apps/admin/src/lib/i18n.ts:1-18` (a comment says page text is pending), `layout.tsx:85,140,274,306`. (AD-10)
- **Proposed solution:** decide scope first. Option A: complete menu and banners now (S). Option B: a message catalogue per page, tackled in order of traffic (orders, dashboard, products, billing). Do not ship the language switch as a promise until pages exist. Ask merchants which pages they need translated first.
- **Apps:** admin. **Effort:** M for menu/banners; L for pages. **Outcome:** fewer language mismatches; measure language-switch retention. **Dependencies:** translation resources.

### R-05 Add skip links and `<main>` where missing; fix custom checkout field errors
- **Problem:** skip link only on marketing; no `<main>` on the two login pages; storefront custom field errors are silent to assistive tech. [B, S]
- **User impact:** keyboard and screen-reader users cannot bypass headers; some checkout errors are not announced.
- **Evidence:** DOM checks on five pages; `checkout-form.tsx:629`. (AD-01, ST-03, ST-05)
- **Proposed solution:** a shared `SkipLink` in `@biztrackbd/ui`; wrap login forms in `<main id="main">`; give custom field errors the same `id`/`role`/`aria-invalid` helper as the standard fields.
- **Apps:** admin, platform, storefront. **Effort:** S. **Outcome:** closes WCAG 2.4.1 gaps seen. **Dependencies:** none.

### R-06 One focus ring, measured
- **Problem:** four different focus rings; the lightened brand mix may be below 3:1 on white; marketing inputs rely on a 1 px border change. [S, H]
- **Evidence:** `admin.css:20`, `marketing.css:71,387`, `kapor.css:43`, `platform.css:16`. (DS-08, M-07)
- **Proposed solution:** define `--focus-ring` in `tokens.css`; measure at least 3:1 against `--bg`, `--surface` and dark equivalents; use it in all apps, storefront via theme-aware variable.
- **Apps:** all. **Effort:** S. **Outcome:** consistent, visible focus. **Dependencies:** none.

### R-07 Orders list: visible search and mobile select-all
- **Problem:** hidden-only Search button; no select-all on phones; duplicate card/table DOM. [S]
- **Evidence:** `orders/page.tsx:97,121-160`. (AD-14, AD-15)
- **Proposed solution:** show a Search button or debounce live search; add a "Select all on this page" control to the mobile list; render one list variant via CSS grid rather than two DOM trees where feasible.
- **Apps:** admin. **Effort:** M. **Outcome:** faster daily order handling on phones; test with 3 merchants. **Dependencies:** R-01 for bulk bar changes.

### R-08 Make the first sign-in obvious
- **Problem:** first-time owners and forgotten passwords share one small link under the button; no password reveal. [B, hypothesis on impact]
- **Evidence:** admin `/login`. (AD-02, J2)
- **Proposed solution:** when arriving from signup, show "Set up your password" as the primary action; add a show/hide password control; add a `<main>`.
- **Apps:** admin, platform (reveal only). **Effort:** S. **Outcome:** fewer first-session stalls; track "login view to first dashboard view". **Dependencies:** product decision on the auth flow.

---

## P2: medium-priority improvements

### R-09 Adopt the shared kit for data views
- **Problem:** `DataTable` has 0 uses against 92 raw tables; `EmptyState` 1 use. [S]
- **Evidence:** `DESIGN_SYSTEM_AUDIT.md` section 2. (DS-01, AD-17)
- **Proposed solution:** migrate orders, products, customers tables, then add `EmptyState` to every list that can be empty (including all platform lists).
- **Apps:** admin, platform. **Effort:** L (staged). **Outcome:** one table behaviour, better mobile handling. **Dependencies:** DataTable feature check (sorting, selection, mobile cards).

### R-10 Tidy admin navigation
- **Problem:** duplicate entries, two "Team" labels, a Settings group with three items, 12 items under Marketing. [S]
- **Evidence:** `layout.tsx:47,75,94,95,109,136-140`; `settings/layout.tsx:18`. (AD-06 to AD-09)
- **Proposed solution:** list each destination once; rename "Team" (profiles) to "Team profiles" and settings "Team" to "Staff"; group Marketing items into "Promote" and "Automate"; test with a card sort before restructuring. Keep the command palette.
- **Apps:** admin. **Effort:** S for labels, M for regrouping. **Outcome:** less confusion; validate with a first-click test. **Dependencies:** R-04 for translations.

### R-11 Marketing CTA and microcopy cleanup
- **Problem:** repeated template CTAs, jargon ("admin desk", "Selling Channel"), truncated placeholder, a two-audience hero. [B]
- **Evidence:** home, `/templates`, `/start`. (M-01 to M-06)
- **Proposed solution:** one primary and one secondary action per card; plain labels (see section 7 of the audit report); shorter placeholders; A/B test the hero with and without the audience switch above the headline.
- **Apps:** marketing. **Effort:** S. **Outcome:** clearer funnel; needs analytics before and after. **Dependencies:** analytics events on CTA clicks.

### R-12 Unify tokens across marketing and admin/platform
- **Problem:** marketing re-declares tokens with drift; 3,257 hex literals in TSX; legacy colours in error pages. [S]
- **Evidence:** `marketing.css:3-14`, `tokens.css:35`, `checkout-form.tsx:620`, `error.tsx`. (DS-03, DS-04)
- **Proposed solution:** import `tokens.css` in marketing; replace literals with tokens; add a lint rule to flag new hex literals in TSX.
- **Apps:** marketing, admin, storefront. **Effort:** M. **Outcome:** consistent colour; easier dark mode. **Dependencies:** none.

### R-13 Storefront mobile chrome
- **Problem:** stacked bars (demo, free-delivery twice, header) and permanent Call Now bar plus chat bubble on every page including checkout. [B]
- **Evidence:** Kapor demo at 375 px. (ST-01, ST-02)
- **Proposed solution:** confirm which bars exist on a real merchant store (not demo); merge duplicates; hide the chat bubble on `/checkout`; add `scroll-padding-bottom`. Test taps and focus under bars.
- **Apps:** storefront. **Effort:** S to M. **Outcome:** more usable screen on small phones. **Dependencies:** none.

### R-14 Small text floor and text tokens
- **Problem:** 209 marketing, 22 admin and 27 storefront declarations at 11 px or less. [S]
- **Proposed solution:** add `--text-*` tokens with a 12 px floor; raise informational text; keep tiny sizes only for decorative badges. Re-test dense admin tables.
- **Apps:** all. **Effort:** M. **Outcome:** better legibility on phones. **Dependencies:** design review for dense layouts.

### R-15 Extend automated accessibility checks
- **Problem:** axe only in admin e2e. [S]
- **Proposed solution:** add axe checks to storefront, marketing and platform main pages, at 375 px, light and dark; store the baseline in CI.
- **Apps:** all. **Effort:** M. **Outcome:** regressions caught. **Dependencies:** existing Playwright setup.

---

## P3: polish and refinement
| ID | Item | Apps | Effort |
|---|---|---|---|
| R-16 | Platform: follow the system theme or add a switch; label nav items with sub-labels (PL-01, PL-02) | platform | S |
| R-17 | Login card gutter and label spacing at 375 px; check the dark wordmark contrast (AD-03, AD-04) | admin, platform | S |
| R-18 | One toast system (AD-16, DS-05) | admin | S |
| R-19 | Unique single `<h1>` on checkout empty state; add suggestions to empty cart (ST-04) | storefront | S |
| R-20 | Wrap Bangla spans in `lang="bn"` on marketing | marketing | S |
| R-21 | Standardise three breakpoints (DS-09) | all | M |
| R-22 | Audit the fonts shipped by the storefront; measure transfer on 3G (ST-08, H) | storefront | S |
| R-23 | Legacy palette fallbacks in admin error page (DS-04) | admin | S |
| R-24 | Review the theme builder for keyboard and non-drag alternatives (not inspected) | admin | L |

## Suggested sequencing
1. **Week 1:** R-01; R-05; R-06; R-08; R-11 text edits (all S).
2. **Weeks 2 to 3:** R-02; R-03 (shared `ConfirmDialog` then migrate); R-07.
3. **Weeks 4 to 6:** R-04 decision and menu/banner translations; R-10; R-13; R-12.
4. **Ongoing:** R-09 staged migration; R-14; R-15.
5. **Before redesigning anything:** run the verification work in `UX_SCORECARD.md` section "Evidence gaps", especially authenticated pages at 390, 768 and 1440 px, and a 5-user task test of order handling and first sign-in.

## Things that are working and should be kept
Checkout validation; the admin command palette and bottom bar; role-, plan- and capability-aware menus; `DoubleSubmitGuard`; the calm error page copy; escalating billing banners; marketing skip link and landmarks; documented token contrast; native `<dialog>` `Drawer`; axe in e2e.
