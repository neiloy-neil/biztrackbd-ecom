# UX rebuild: implementation plan

Brief and decisions: docs/36. Design reference: `design/canvas/project/*.dc.html` (docs/29). Order: design system, admin shell, theme builder, store admin screens, platform admin, storefront, dynamic and i18n sweep.

## Where we start (measured)
- Shared UI is tiny: `packages/ui` has one `button.tsx`, `tokens.css` and `format.ts`; `apps/admin/src/components/ui.tsx` is 52 lines; `admin.css` 266 lines and `platform.css` 219 lines. Every page therefore builds its own layout, which is why they read as one long page.
- 37 store admin pages and 12 platform pages. Theme editor is one 425-line client file (`design/editor.tsx`).
- Canvas artboards to match: `BldEditor`, `BldTheme`, `Adm*` (33), `Sa*` (SaSidebar, SaOverview, SaTenants, SaTenant, SaPayments, SaPlans, SaAnnouncements, SaTickets, SaDomains, SaThemes, SaAudit), `DarkDashboard`, `UiKit`.

## Phase 0: gap report (1 day, runs first and alongside phase 1)
For each screen, a screenshot of today (phone 390 and desktop 1440) next to its artboard, with a table of differences: layout, hierarchy, missing features, hardcoded content. Output: `checkup/UX-GAPS.md`. The owner approves scope before phase 3 onward.

## Phase 1: design system
- Tokens from the canvas Foundations artboard: colour, type, spacing, radius, shadow, with a dark set (docs/36: admin and platform have a toggle).
- Components in `packages/ui`, used by both apps: PageHeader (title, breadcrumbs, actions), Card and Section, Tabs, StickyActionBar (save, discard, unsaved indicator), DataTable (sort, filter bar, bulk actions, mobile as cards), FilterBar, KpiCard, Badge/Status pill, EmptyState, Skeleton, Drawer (desktop) and BottomSheet (phone), Dialog, Toast, Field and form layout, Stepper, Advanced disclosure.
- Rule: no page builds its own layout. Pages compose these.
- i18n: English and Bangla message files for admin and platform (storefront already has its own `t()`); language switch in the top bar.
- Done when: a Storybook-style `/ui-kit` page in each app shows every component at 390 and 1440, light and dark, and the canvas `UiKit` artboard matches.

## Phase 2: admin shell
- Dark grouped sidebar (Sell, Manage, Grow, Settings; "Advanced" collapsed), top bar with search, notifications bell, language and theme toggles, store switcher; bottom tab bar on phones.
- Ctrl+K command palette: jump to any page; search orders, products, customers (server endpoint, tenant-scoped).
- Notifications: a lightweight "counts and latest events" endpoint polled every 20 to 30 seconds with the tab visible (see Realtime note), shown in the bell and as sidebar badges.
- Done when: every existing page renders inside the new shell with no broken links; Playwright admin suite green at both widths.

## Phase 3: theme builder (the first real screen)
- Route `/design/editor`: full screen, three zones. Left: page selector (Home, Product, Collection, Cart, custom pages) and an ordered section list with drag handles, add (section library), duplicate, hide, delete. Centre: live preview of the real storefront in an iframe with a device switcher; clicking a section in the preview selects it. Right: settings for the selected section, grouped in tabs Content, Style, Advanced. Theme-wide settings (logo, colours, fonts) live in a Theme tab.
- Phone: preview on top, a bottom sheet with the section list and the settings; the same features.
- State: draft, then Publish; undo and redo; version history with restore; autosave of the draft only; unsaved indicator. Shareable private preview link (existing `PREVIEW_SECRET`).
- Section library: hero, slider, announcement bar; product grid, collection, best sellers; testimonials, FAQ, rich text, image with text; countdown and flash sale, newsletter, video, WhatsApp button. Each section declares a settings schema (the manifest in docs/06 and docs/20) so the settings panel is generated, not hand-built.
- Plan gating: custom CSS, extra pages, removing branding on paid plans (limits module exists).
- Done when: a merchant can build and publish a home page entirely on a phone; section add, reorder, edit, undo and publish covered by Playwright at 390 and 1440; preview matches the published store.

## Phase 4: store admin screens (one area per review)
Order: dashboard, orders list and detail, products list and editor, settings (payments, shipping, notifications, domains, billing as tabs), then customers, inventory, discounts, reports, returns, the rest.
Each screen: match its `Adm*` artboard, hierarchy of header, KPIs, filters, table or cards, a side drawer for quick view, sticky save bar on forms, empty and loading states, and mobile card layout.

## Phase 5: platform admin
Dark sidebar (`SaSidebar`), then overview with charts, stores list, store detail with tabs, KPIs and notes, payment desk, plans, announcements, support tickets, usage and limits, domains, audit, "log in as owner". Matches the B1.1 to B1.8 breakdown in docs/34.

## Phase 6: storefront
Compare home, product, collection, cart and checkout with the canvas storefront artboards at both widths; fix gaps; make sure every section is rendered from the builder's data, not hardcoded.

## Phase 7: dynamic and i18n sweep
Find hardcoded text, banners, menus and footers; move them into merchant-editable settings. Complete Bangla for all admin and platform strings. Verify live badges and notifications.

## How each phase is verified
1. Unit and database tests stay green (core 612, db 32, media 17).
2. Playwright admin (1440 and 390) and storefront suites updated for the new layouts.
3. Screenshots at 390 and 1440 beside the canvas artboard, posted for the owner's review before the next phase starts.
4. Production build and size budget (`pnpm check:size`).

## Risks and decisions needed
- **Realtime.** The apps talk to the database with restricted Postgres roles and row-level security, not through the Supabase client, so Supabase Realtime ("postgres changes") does not apply cleanly. Plan: polling of a counts endpoint first (free, simple, reliable); later, database triggers publishing to Supabase Realtime Broadcast channels per store if instant delivery is worth the extra moving parts.
- **Theme preview.** Needs the storefront to accept a draft token (`PREVIEW_SECRET`) and render unpublished sections; confirm the manifest and draft tables from docs/06 cover this before phase 3.
- **Size.** This is weeks of work, not days. Phases 1 and 2 unlock everything else; phase 3 is the largest single piece.
- **Hobby plan.** Preview iframes and extra requests add load; fine for a pilot.
