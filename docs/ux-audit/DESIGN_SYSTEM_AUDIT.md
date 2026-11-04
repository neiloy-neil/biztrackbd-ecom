# Design System Audit

Evidence labels: **[B]** browser-verified, **[S]** source-confirmed, **[H]** hypothesis. See `UX_AUDIT_REPORT.md` section 0 for what was inspected.

## 1. What exists

### Shared package `packages/ui` (1,197 lines)
| Piece | File | Notes |
|---|---|---|
| Colour, type, radius, spacing, shadow tokens, light and dark | `src/tokens.css` (100 lines) | Brand "Growth b": deep green `#0B4D3B`, fresh green `#11795A`, marigold `#F2A900`, cream `#FBF7EC`. Contrast ratios are documented in the file header (`--ink*` on `--bg/--surface/--tint` at least 4.5:1; marigold is never body text). Dark theme by `data-theme="dark"` or system preference. |
| Component CSS | `src/kit.css` (413 lines) | `PageHeader`, `Section`, `FieldGrid`, `KpiRow`, `SettingsLayout`, `Advanced`, drawer, savebar, segmented control, skeleton. |
| Components | `blocks.tsx`, `interactive.tsx`, `data-table.tsx`, `button.tsx`, `brand.tsx`, ... | `Card*`, `StatusBadge`, `MetricCard`, `FilterToolbar`, `EmptyState`, `Skeleton`, `Drawer` (native `<dialog>`), `ToastProvider`, `SaveBar`, `Segmented`, `DataTable`, `DoubleSubmitGuard`, `useBusyAction`. |
| Brand | `brand.tsx`, `brand.css` | Wordmark, symbol, lockup. |

Token scale: spacing `--space-1..8` (4 to 32 px), radii `6/10/14/9999`, three shadow levels plus card shadow, two font stacks (display Baloo Da 2, text Hind Siliguri, both cover Bangla). Status colours (`success/warning/danger/info`) are kept apart from the brand green. Strong foundation.

### Per-app CSS
| App | Files | Lines |
|---|---|---|
| admin | `admin.css`, `shell.css`, `builder.css`, `(admin)/menu/menu.css` | 326, 204, 1,295, 984 |
| platform | `platform.css` | 332 |
| marketing | `marketing.css`, `site.css` | 2,538, 785 |
| storefront | `kapor.css`, `themes.css`, `landing.css` | 688, 2,623, 287 |

## 2. Adoption (counts of use inside `apps/*/src`)
| Signal | admin | platform | marketing | storefront |
|---|---|---|---|---|
| Files importing `@biztrackbd/ui` | 101 | 7 | 5 | 3 |
| Loads shared `tokens.css` | yes | yes | no | no |
| Loads shared `kit.css` | yes | yes | no | no |
| `style={{` inline blocks | 3,208 | 1,602 | 2,438 | 1,068 |
| `className=` | 7,043 | 441 | 2,005 | 1,420 |
| Hard-coded hex in TSX | 972 | 400 | 1,270 | 615 |
| Raw `<table>` | 59 | 9 | 22 | 2 |
| `DataTable` from ui | 0 | 0 | 0 | 0 |
| `SaveBar` | 3 | 0 | 0 | 0 |
| `EmptyState` | 1 | 0 | 0 | 0 |
| `<dialog>` / `role="dialog"` | 2 / 26 | 0 / 0 | 0 / 1 | 0 / 6 |

Most-imported ui exports: `PageHeader` (74 imports), `useBusyAction` (6), `Drawer` (5), `Segmented` (4), `BrandLockup` (4). Several exports have a single consumer, and `DataTable`, the largest component in the package, has none.

## 3. Findings
| ID | Sev | Label | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| DS-01 | 3 | S | **The shared kit is built but barely used for data views.** `DataTable` has zero consumers; 92 raw tables exist across the four apps, each with its own header, spacing, empty, mobile and sort behaviour. | `packages/ui/src/data-table.tsx`; `<table` counts | Migrate the three highest-traffic tables (orders, products, customers) to `DataTable`, then retire the rest gradually. |
| DS-02 | 2 | S | Inline styles dominate: 8,316 blocks. They cannot be themed, cannot respond to breakpoints, and hide repeated values (margins like `marginBottom: 14`, `marginTop: 10`). | counts | Add utility classes in `kit.css` for the 10 most repeated inline values; lint against new `style={{ margin... }}` in admin. |
| DS-03 | 2 | S | Marketing duplicates and drifts from tokens: `--warning` is `#C2410C` there and `#B45309` in `tokens.css`; marketing repeats `--green-deep`, `--marigold`, `--cream`, `--mint`. | `marketing.css:3-14`; `tokens.css:35` | Import `tokens.css` into marketing and keep only marketing-specific tints locally. |
| DS-04 | 2 | S | Hard-coded colours in components bypass themes: `#dc2626` in checkout (`checkout-form.tsx:620`), `#11795A` in marketing TSX (`business/page.tsx:285`), legacy brown fallbacks in the admin error page (`error.tsx`: `#4A3E31`, `#6B5E50`). Fallbacks from an earlier palette suggest the rebrand was not fully swept. | | Replace with tokens; add a lint rule for `#[0-9a-f]{6}` in TSX outside theme files. |
| DS-05 | 2 | S | Two toast implementations: `ToastProvider/useToast` (ui) and `apps/admin/src/components/toast.tsx`. | | Keep one (the ui one), migrate admin callers, delete the other. |
| DS-06 | 2 | S | Button exists as a React component (`Button` in ui, inline styles) and as CSS classes (`.btn .btn-primary .btn-sm .btn-block .btn-round`) that most code uses. Two sources of truth; `Button` uses 44 px minimum, `.btn-sm` height not checked. | `button.tsx`; class use in admin and storefront | Pick the CSS classes; make `Button` render the classes. Check `.btn-sm` height against touch targets. |
| DS-07 | 2 | S | Type scale not systematised: font sizes are literal px values in 3 places; 209 marketing, 22 admin and 27 storefront declarations are 11 px or less. No `--text-*` tokens. | | Add `--text-xs..xl` tokens with a 12 px floor for body copy; allow smaller only for non-essential badges. |
| DS-08 | 1 | S | Focus ring colour differs per app: admin `color-mix(brand 50%, white)` 3 px; marketing 2.5 px solid brand; storefront accent mix; platform same as admin. A mix of a brand colour with white may fall below 3:1 on a white surface (H; not measured). | `admin.css:20`, `marketing.css:71`, `kapor.css:43`, `platform.css:16` | Define `--focus-ring` once and measure it on `--bg`, `--surface`, dark. |
| DS-09 | 1 | S | Breakpoints are literal and inconsistent: 640, 700, 720, 768, 800, 820, 840, 860, 899, 900. | CSS counts | Standardise on three (e.g. 640, 900, 1200) and expose as comments or custom media. |
| DS-10 | 2 | S | Modal patterns differ: `Drawer` (native `<dialog>`, focus trap free) in ui; 26 hand-rolled `role="dialog"` blocks in admin; 6 in storefront. Hand-rolled dialogs need their own focus trap, Esc handling and restore. | counts | Move hand-rolled dialogs to the `Drawer` or a new `Dialog` based on `<dialog>`; verify focus return. |
| DS-11 | 1 | S | Icons: no icon library. Admin and platform carry inline SVG paths (platform `layout.tsx` passes `iconPath` strings). Consistent, but each icon is bespoke. | | Fine at present; document an icon size/stroke rule. |

## 4. Cross-application UX consistency matrix
Legend: ● consistent with the shared system, ◐ partial, ○ own implementation, – not applicable. Based on source unless marked.

| Aspect | admin | platform | marketing | storefront |
|---|---|---|---|---|
| Colour tokens (shared `tokens.css`) | ● | ● | ○ drifted (DS-03) | ○ themeable by design |
| Dark mode | ● system + switch | ○ forced light (PL-02) | – | ◐ theme-dependent (not checked) |
| Typography | ● Baloo + Hind | ● | ● [B] | ◐ seven families (ST-08) |
| Buttons | ● `.btn` classes | ● | ○ own | ○ own `.btn` in `kapor.css` |
| Form fields | ● | ● | ○ `.input` | ○ `.input` |
| Error pattern (`role="alert"`, `aria-invalid`) | ◐ | ◐ | ◐ | ● standard fields, ◐ custom fields (ST-05) |
| Tables | ○ 59 bespoke | ○ 9 bespoke | ○ comparison tables | – |
| Empty states | ◐ 1 use of `EmptyState`, many ad hoc `.card.empty` | ○ none found | – | ◐ |
| Loading skeletons | ● `loading.tsx` | ● `loading.tsx` | ● `loading.tsx` | ● plus product-level |
| Error pages | ● | ● | ● | ● |
| Toasts | ◐ two systems | ○ none found | – | ○ ticker/toasts for social proof only |
| Modals | ◐ 26 custom + 2 native | – | ◐ | ◐ |
| Navigation pattern | sidebar + bottom bar + palette | sidebar | top nav + mobile menu | header + hamburger + sticky call bar |
| Skip link [B for marketing, storefront, admin login, platform login] | not on login | not on login | ● | not found |
| Language | EN/BN switch, shell only (AD-10) | EN | EN with Bangla taglines | EN/BN per visitor |
| Responsive breakpoint | 900 | 900 | 900 | 900 |

## 5. Recommended direction (without forcing one identity)
- **Admin and platform**: one product family, already close. Close the gaps (DataTable, EmptyState, SaveBar, single toast, dark mode for the platform).
- **Marketing**: share tokens and the button/field/focus primitives with admin so a visitor who signs up meets the same green and the same control shapes, but keep marketing's editorial layout.
- **Storefront**: intentionally distinct per merchant theme. Share only the accessibility primitives (focus ring variable, error pattern, skip link, minimum target size), not the look.
- Build a short `docs/` style guide page listing tokens, the 12 px text floor, the single focus ring, button variants, and when to use `Drawer` versus a page. The admin already has a `/ui-kit` route; check it is current (not reviewed here).

## 6. Not assessed
The theme builder UI, the six storefront themes beyond Kapor, and the dark-mode appearance of any page after sign-in.
