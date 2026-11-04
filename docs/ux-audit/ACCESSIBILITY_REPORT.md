# Accessibility Report (WCAG 2.2 AA, indicative)

**This is not a conformance statement.** Conformance requires keyboard, screen-reader, zoom/reflow and forced-colours testing across every page. What follows is what a limited inspection found.

Labels: **[B]** browser-verified (live DOM at 375 px), **[S]** source-confirmed, **[H]** hypothesis needing a check. Pages rendered: marketing home, `/start` step 1, `/templates`, admin `/login`, platform `/login`, Kapor demo home and empty checkout. Not tested: any authenticated page, keyboard walkthrough, screen reader, 200% / 400% zoom, forced colours, colour contrast by measurement (except as noted).

## 1. Existing strengths
- `lang` set on `<html>` in all four apps; admin and storefront follow the chosen language (`apps/admin/src/app/layout.tsx:28`, `apps/storefront/src/app/layout.tsx:31`). Marketing is fixed `en` even though it carries Bangla text [S].
- Global `:focus-visible` outlines in all four apps (3 px in admin, platform and storefront; 2.5 px marketing) [S].
- Marketing: skip link, one `<main>`, four labelled `<nav>` regions, every image has `alt` [B].
- Storefront checkout: `aria-invalid`, `aria-describedby`, `role="alert"`, first-error focus (`checkout-form.tsx:307, 495-496`) [S].
- `Drawer` uses native `<dialog>` with `showModal()`, so focus trap and Esc are free (`packages/ui/src/interactive.tsx`) [S].
- Toasts expose `role="status"` and `aria-live="polite"` (`interactive.tsx`; admin `components/toast.tsx:105,122`) [S].
- `prefers-reduced-motion` handled for skeletons, drawers, storefront themes and landing animation (11 rules across four apps) [S].
- Login inputs have labels and correct `autocomplete`, 44 px tall [B].
- Tokens document 4.5:1 contrast for text pairs (`tokens.css` header) [S, claim not independently measured].
- The admin e2e suite runs `@axe-core/playwright` on several pages (`apps/admin/e2e/longpages.spec.ts` and four others) [S]. No axe run appears in the storefront, marketing or platform e2e folders searched.

## 2. Findings by WCAG 2.2 success criterion

| SC | Level | Status | Finding | Sev | Label | Evidence |
|---|---|---|---|---|---|---|
| 1.1.1 Non-text content | A | Likely OK | Marketing images all have `alt`. Admin has 19 raw `<img>` and 22 `alt=` attributes; 10 are `alt=""`, which is correct only if decorative. Verify product images. | 1 | S | counts |
| 1.3.1 Info and relationships | A | Risk | Orders list renders two parallel structures (cards and table) and swaps them with CSS; hidden variant remains in the DOM only if `display:none`, which removes it from the accessibility tree, so fine. 59 admin `<table>` elements: header scope and captions not sampled. | 1 | H | |
| 1.3.1 | A | Fail (likely) | Storefront checkout custom-field errors have no `id`, `role` or `aria-invalid`, so they are not associated with the field. | 2 | S | `checkout-form.tsx:629` |
| 1.3.5 Identify input purpose | AA | Pass (checkout) | `autocomplete` values on phone, name, email, address. Admin login also. Marketing wizard fields were not inspected for `autocomplete`. | 0 | B/S | |
| 1.4.3 Contrast (minimum) | AA | Not measured | Token pairs claim 4.5:1. The admin login wordmark (dark green on dark card) looks low in contrast. Marigold `#F2A900` is stated as non-text-only. 209 marketing declarations at 11 px or less make contrast failures more likely to matter. | 2 | H | `tokens.css` header; screenshot |
| 1.4.4 Resize text | AA | Not tested | | | | |
| 1.4.10 Reflow | AA | Partly | No horizontal overflow at 375 px on seven pages [B]. Tables in admin use `.table-scroll` with a focusable scroller (`shell.css:108`) [S]. Not tested at 320 px or 400% zoom. | 0 | B | |
| 1.4.11 Non-text contrast | AA | Risk | The focus ring is `color-mix(brand 50%, white)`: lighter than the brand. Against white it may fall under 3:1. The marketing text-input focus cue is a 1 px border colour change only. | 2 | H | `admin.css:20`, `marketing.css:387` |
| 1.4.12 Text spacing | AA | Not tested | Heavy inline styles with fixed `fontSize` can resist user spacing overrides. | | H | |
| 1.4.13 Content on hover or focus | AA | Not tested | Tooltips/popovers (`edit-overlay`, social-proof toasts) not inspected. | | | |
| 2.1.1 Keyboard | A | Not tested | `<div onClick>` or `<span onClick>`: 6 in admin, 5 in storefront. Each needs `role`, `tabIndex` and key handlers or must become a `<button>`. | 2 | S | grep |
| 2.1.2 No keyboard trap | A | Not tested | Custom dialogs (26 in admin, 6 in storefront) need individual checks. | | H | |
| 2.4.1 Bypass blocks | A | **Fail** (4 of 5 surfaces) | Skip link only on marketing. None on admin login, platform login, storefront. Admin and platform login pages have no `<main>`. The admin shell has `<main id="main">` but no skip link was found. | 2 | B | DOM checks |
| 2.4.2 Page titled | A | Pass | All pages inspected have specific titles. | 0 | B | |
| 2.4.3 Focus order | A | Not tested | Sticky bars and floating chat on the storefront should be checked. | | H | |
| 2.4.6 Headings and labels | AA | Mixed | Marketing home has a clear hierarchy [B]. Checkout page has two `<h1>` with the same text (empty-cart state). | 1 | B | |
| 2.4.7 Focus visible | AA | Likely pass | Global rule; exceptions with `outline:none` at `menu.css:637`, `builder.css:233`, `marketing.css:387,1361`, storefront search pills `kapor.css:76,122`, `edit-overlay.tsx` (editor-only). Check each has a replacement cue. | 2 | S | |
| 2.4.11 Focus not obscured (min) | AA | Risk | Sticky bottom bars (`Call Now`, wizard CTA, chat bubble, mobile bottom nav) can cover a focused control. Needs `scroll-padding-bottom` and a keyboard test. | 2 | H | screenshots |
| 2.5.3 Label in name | A | Not tested | | | | |
| 2.5.7 Dragging movements | AA | Not tested | The theme/page builder likely uses drag; confirm an alternative exists. | | H | `(builder)` |
| 2.5.8 Target size (minimum 24 px) | AA | **Pass** on pages measured | All 34 marketing targets under 44 px high were 39 to 42 px; admin inputs 44 px; buttons 40 px at login. Not measured on dense admin tables or the builder. | 0 | B | |
| 3.2.2 On input | A | Not tested | | | | |
| 3.2.6 Consistent help | A | Not tested | Contact details repeat in the footer (marketing, storefront). | | | |
| 3.3.1 Error identification | A | Mostly pass | Standard checkout fields yes; admin product editor uses `aria-invalid` on title and `role="alert"` for save errors. | 1 | S | |
| 3.3.2 Labels or instructions | A | Pass (inspected) | 618 `<label>` elements in admin against 626 `<input>` (hidden inputs and checkboxes included). Placeholders are used as examples, not labels, on the pages seen. | 0 | S | |
| 3.3.3 Error suggestion | AA | Partial | Messages in the form map are plain; text not fully read. | | | |
| 3.3.4 Error prevention (legal, financial, data) | AA | Risk | Deletes use native `confirm()`; no undo; no leave-page guard (AD-11, AD-12). Order placement on the storefront is a financial commitment; summary is visible before submit (quote), which helps. | 2 | S | |
| 3.3.7 Redundant entry | A | Not tested | Whether the checkout restores values after a failed submit is a client state matter: values live in React state; a full page reload loses them. | | H | |
| 3.3.8 Accessible authentication (min) | AA | Likely pass | Login uses email and password with `autocomplete` and no cognitive test. Password reveal is absent (usability, not a failure). The platform uses authenticator codes (TOTP): fine if paste is permitted. | 1 | B | |
| 4.1.2 Name, role, value | A | Not tested | `Segmented` uses `aria-pressed` buttons [S]. Custom selects, combobox (command palette) and the business switcher need a screen-reader pass. | | H | |
| 4.1.3 Status messages | AA | Likely pass | `role="status"`/`alert` used 181 times in admin, 31 in platform, 30 in storefront. | 0 | S | |

## 3. Cross-cutting accessibility risks
1. **Inline styles at scale** (8,316 blocks) make it hard to fix focus, contrast or spacing centrally.
2. **Tiny text**: 22 admin, 27 storefront and 209 marketing declarations at 11 px or less.
3. **Custom dialogs** (26 + 6) with hand-rolled focus management versus one native `Drawer`.
4. **Automated testing gap**: axe runs only in the admin e2e. It should also run on the three other apps' main pages, in light and dark and at 375 px.
5. **Bangla and English** content: `lang` switching is dynamic in two apps; marketing mixes Bangla inside an `en` document without `lang="bn"` on those spans (not verified element by element; **H**). Screen readers mispronounce unmarked Bangla.

## 4. Remediation plan
| Priority | Action | Effort |
|---|---|---|
| High | Add a skip link and `<main>` to the admin login, platform login and storefront layouts | S |
| High | Associate custom checkout field errors (`id`, `role="alert"`, `aria-invalid`) | S |
| High | Measure and fix focus-ring contrast; define one `--focus-ring` in tokens and use it everywhere; add a visible focus style for marketing inputs | S |
| Medium | Replace `div/span onClick` with buttons (11 places) | S |
| Medium | Replace `window.confirm` with an accessible confirm dialog using `<dialog>` | M |
| Medium | Raise minimum text to 12 px for informational text; measure contrast on small text | M |
| Medium | Wrap Bangla text in marketing with `lang="bn"` | S |
| Medium | Add `scroll-padding-bottom` and test focus visibility under sticky bars | S |
| Medium | Extend axe e2e to marketing, storefront and platform | M |
| Low | Review the builder for a keyboard alternative to dragging | L |

## 5. Test plan before claiming any conformance level
1. Keyboard-only walk of each primary journey (sign-up, sign-in, order processing, product create, checkout).
2. NVDA with Firefox and VoiceOver with Safari on checkout, the admin orders list and the product editor.
3. 200% and 400% zoom, 320 px width.
4. Contrast sampling with a tool on light and dark, including the focus ring and placeholder text.
5. Forced-colours and `prefers-reduced-motion` runs.
6. Re-run axe on all four apps with the result stored in CI.
