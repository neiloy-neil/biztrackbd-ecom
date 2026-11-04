# Fixes applied after the audit

Date: 4 November 2026. Nothing is committed. Typecheck passes for `admin`, `platform`, `storefront`, `marketing` and `packages/ui`; ESLint reports 0 errors on the changed files (the warnings that remain were there before). No automated e2e suite was run (Playwright browsers were not set up here).

## Important correction to the browser addendum
`BROWSER_VERIFICATION_ADDENDUM.md` was measured on the **main checkout**, which is older than the audited branch. Re-measured on this branch's own code:
- **V-05 (platform nav uses 42% of a phone screen): does not apply.** The branch already has a single scrolling row (112 px tall at 390 px). No fix needed.
- **V-03 (Co-pilot covers controls): partly already handled.** The branch already shrinks the launcher to an icon on phones. It still sat on the bulk bar and the Save bar; fixed below.
- **Login without `<main>`: not an issue on the branch.** The login card uses `role="main"` (my production probe only counted `<main>` elements).
- **AD-14 (hidden search button): not an issue on the branch.** The orders list has live search. The tiny-text and 17 px auto-refresh findings were also largely fixed by an earlier commit on the branch (`2abc8ca`).

## What was changed
| Roadmap | Change | Files |
|---|---|---|
| R-01 | Bulk **Cancel selected** now needs a reason (placeholder "Cancel reason…" instead of a preset) and then asks "Cancel N orders?" with a danger button; default focus is "Keep them". Success banner reads "1 order cancelled." Verified in the browser end to end. e2e test updated. | `orders/bulk-cancel-button.tsx` (new), `orders/page.tsx`, `components/ui.tsx` (`ConfirmSubmitButton`), `e2e/order-handling.spec.ts` |
| R-03 | New `askConfirm()` (native `<dialog>`, Esc/backdrop = no, focus returned). **All 26 `window.confirm` calls** in admin and platform replaced, with a named action label ("Delete", "Revoke", "Disconnect"...) and danger tone. | `packages/ui/src/confirm.ts`, 18 admin and platform files |
| R-02 | `useUnsavedChanges(dirty)` hook; product editor warns before reload or tab close when edited. (Leaving through in-app links is not intercepted: Next.js has no supported hook for it.) | `packages/ui/src/unsaved.ts`, `products/editor.tsx` |
| R-25 | Co-pilot launcher lifts above the sticky save bar and the phone bulk bar. Measured: no overlap at 390 and 768 px. | `admin.css` |
| R-05 | `SkipLink` added to the admin, platform and storefront layouts (`<main>` gets `tabIndex={-1}`, id already present). Custom checkout field errors now have `id`, `role="alert"`, `aria-invalid`, `aria-describedby`; required asterisk uses `var(--danger)` and is `aria-hidden`. | `packages/ui/src/skip-link.tsx`, three layouts, `kapor.css`, `checkout-form.tsx` |
| R-06 | One `--focus-ring` token (3 px solid brand). Admin, platform and table-scroller rules use it. Marketing text inputs keep the global outline instead of removing it. | `tokens.css`, `admin.css`, `platform.css`, `shell.css`, `marketing.css` |
| R-08 | New `PasswordInput` (Show/Hide) on admin and platform sign-in; the admin "set up your password" path is now a visible secondary button. | `packages/ui/src/password-input.tsx`, both `login-form.tsx` |
| R-10 | Admin menu: "Loyalty and referrals" listed once (Marketing), "Abandoned checkouts" once (Orders), "Team" split into **Team profiles** and **Staff accounts**, first Settings item renamed **Store details**. | `(admin)/layout.tsx`, `settings/layout.tsx` |
| R-04 (part) | About 35 more menu labels translated to Bangla; trial card "N days left" translated. Page bodies are **not** translated. | `lib/i18n.ts`, `(admin)/layout.tsx` |
| R-28 | Row checkboxes 24 x 24 px (measured), order-card links 44 px tall on phones. | `admin.css` |
| R-11 | Marketing: hero CTA "See the merchant dashboard (no signup)", template CTAs "Try the apparel/gadgets/clinic dashboard", "See it in the live demo", wizard button "Next: How you sell →", shorter store-name placeholder. | `dual-hero.tsx`, `operational-scenarios.tsx`, `start/wizard.tsx` |
| R-19 | Empty-cart message says what to do next, in English and Bangla. | `i18n-core.ts` |

## Not done, and why
| Item | Reason |
|---|---|
| R-07 (single list DOM instead of cards + table) | Larger refactor of the orders list with e2e selectors tied to both variants; needs its own change and test run. |
| R-09 migrate 90+ tables to `DataTable`, `EmptyState` everywhere | Multi-week staged work; `DataTable`'s feature fit (selection, mobile cards) is unchecked. |
| R-12 unify marketing tokens, remove hex literals | Touches 1,270 literals; a mechanical sweep needs visual regression runs. |
| R-14 12 px text floor and text tokens | A previous commit already raised many; the rest needs design review of dense admin tables. |
| R-15 axe in storefront, marketing, platform e2e | Cannot be verified without Playwright browsers installed here. |
| R-26 platform phone nav | Not needed on this branch (see correction). |
| R-27 tablet breakpoint (900 to ~768 px) | Changes about 30 rules across four stylesheets; needs a device pass first. |
| R-13 stacked bars on the storefront | The repeated "free delivery" bar was seen only on the demo store; not reproduced on a real merchant theme. |
| R-04 page bodies in Bangla, R-24 builder keyboard review, R-16 to R-18, R-20 to R-23 | Content or design decisions, or not reproduced on this branch. |

## Verified in a browser vs not
- **Verified (local test DB, this branch):** bulk-cancel notice and confirm flow, order cancelled in the database after confirming, no Co-pilot overlap at 390 px (bulk bar) and 768 px (save bar), skip link present on platform and admin, platform nav height, 24 px checkboxes.
- **Not verified in a browser:** password Show/Hide, product-editor unsaved warning, `askConfirm` on the other 25 call sites, storefront skip link and checkout error changes, marketing copy. These compile and typecheck only.
- **Test data:** five synthetic orders and one platform user were added to the private test database and deleted; servers stopped; the `qa/logs` folder removed.
