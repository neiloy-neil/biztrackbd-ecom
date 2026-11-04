# UX Scorecard

Scores are 0 to 100 per category and use the weights in the brief. **They are judgements from partial evidence, not measurements, and they carry a confidence rating.** Where a category could not be assessed it is marked **NA** and the weighted total is computed over the assessed weights only (total divided by the sum of assessed weights). No category was scored from an assumption that "the UI exists, so it works".

Evidence: **[B]** browser-verified at 375 px only, **[S]** source, **[H]** hypothesis. See `UX_AUDIT_REPORT.md` section 0 for coverage.

| Category | Weight |
|---|---|
| Usability and navigation | 20% |
| Visual hierarchy and design | 15% |
| User journeys and task completion | 15% |
| Responsive experience | 15% |
| Accessibility | 15% |
| Interaction and feedback | 10% |
| UX writing and clarity | 5% |
| Design consistency | 5% |

## Overall

| Application | Weighted score | Confidence | Basis |
|---|---|---|---|
| Marketing site | **72** | Medium | Browser (3 pages, 375 px) plus source |
| Merchant admin | **66** | Low to medium | Sign-in page in browser; everything else source |
| Platform admin | **65** | Low | Sign-in in browser; layout and navigation in source |
| Storefront | **73** | Medium | Demo home and empty checkout in browser; checkout form in source |
| **Monorepo (unweighted mean of the four)** | **69** | Low to medium | |

> **Update after browser verification (see `BROWSER_VERIFICATION_ADDENDUM.md`):** Responsive is now assessed for admin (68) and platform (62), giving admin **67** and platform **65** over all eight weights; monorepo mean stays **69**. Confidence for those two rises to medium except for accessibility. The tables below show the first-pass figures.

Shared `packages/ui` is not scored as an application. It is a sound foundation with low adoption (see `DESIGN_SYSTEM_AUDIT.md`).

---

## Marketing site: 72 / 100 (medium confidence)
| Category | Score | Wt | Evidence |
|---|---|---|---|
| Usability and navigation | 75 | 20 | [B] clear hero, a main nav and three footer navs, skip link, a four-step wizard. Minus: CTA repetition (M-03), audience switch (M-01). |
| Visual hierarchy and design | 78 | 15 | [B] one h1, readable 16 px text, calm palette. Minus: very small text on `/business` (M-08). |
| User journeys | 70 | 15 | [B] signup step 1 clear; jargon in step label (M-04); later steps and the demo not walked. |
| Responsive | 72 | 15 | [B] no overflow at 375 px; targets 39 to 42 px. Only one viewport tested. |
| Accessibility | 74 | 15 | [B] skip link, landmarks, alt text; [S] focus cue on inputs weak (M-07). No keyboard or screen-reader test. |
| Interaction and feedback | 68 | 10 | [B] sticky CTA overlap (M-06); form validation not exercised. |
| UX writing | 70 | 5 | [B] clear value statements, bilingual taglines; jargon labels (M-02). |
| Design consistency | 55 | 5 | [S] own token copy with drift (M-09), 1,270 hex literals. |
| **Weighted** | **72.2** | | |

## Merchant admin: 66 / 100 (low to medium confidence)
| Category | Score | Wt | Evidence |
|---|---|---|---|
| Usability and navigation | 66 | 20 | [S] command palette, role/plan-aware menu, bottom bar; duplicates and two "Team" meanings (AD-06, AD-07); 105 routes. |
| Visual hierarchy and design | 70 | 15 | [S] shared tokens and `PageHeader` (74 uses); not rendered beyond login. |
| User journeys | 65 | 15 | [S] bulk order handling, quick view, billing warnings are good; unsaved edits (AD-11), bulk cancel (AD-13), half-translated Bangla (AD-10). |
| Responsive | **NA** | 15 | Source shows mobile patterns (bottom nav, card list, settings pills) but nothing was rendered after login; the mobile select-all gap (AD-15) is source only. |
| Accessibility | 68 | 15 | [S] focus ring, native dialog, `aria` use, axe in e2e; [B] login lacks main and skip link; 24 native confirms; small text. |
| Interaction and feedback | 66 | 10 | [S] busy locks, toasts; no leave-page guard; generic confirms; hidden search submit. |
| UX writing | 62 | 5 | [S] helpful error copy; mixed language (AD-10); generic confirmations. |
| Design consistency | 60 | 5 | [S] shared kit but 3,208 inline styles, 0 `DataTable`, two toast systems (AD-17, AD-16). |
| **Weighted over 85%** | **66.3** | | (56.4 / 0.85) |

## Platform admin: 65 / 100 (low confidence)
| Category | Score | Wt | Evidence |
|---|---|---|---|
| Usability and navigation | 70 | 20 | [S] flat 15-item nav is easy to scan; combined labels (PL-01). |
| Visual hierarchy and design | 68 | 15 | [B] login clear; [S] shares tokens and kit; authenticated pages not seen. |
| User journeys | 60 | 15 | [S] approval flows exist; not walked; Oct report suggested thin tenant pages. |
| Responsive | **NA** | 15 | Authenticated pages not rendered. |
| Accessibility | 64 | 15 | [B] login lacks main and skip link; [S] no dialogs, few ARIA hooks (74 `aria-`). |
| Interaction and feedback | 60 | 10 | [S] no `EmptyState`, `Skeleton` or `SaveBar` use; two native confirms. |
| UX writing | 70 | 5 | [B] clear sign-in copy. |
| Design consistency | 66 | 5 | [S] shares tokens and kit with admin; forced light theme (PL-02). |
| **Weighted over 85%** | **65.4** | | (55.6 / 0.85) |

## Storefront: 73 / 100 (medium confidence)
| Category | Score | Wt | Evidence |
|---|---|---|---|
| Usability and navigation | 74 | 20 | [B] header with hamburger and cart; stacked bars (ST-01). |
| Visual hierarchy and design | 76 | 15 | [B] strong hero hierarchy on the demo theme; one theme seen. |
| User journeys | 72 | 15 | [S] thorough COD, bKash and Nagad checkout; no complete run; optional blocks may add load (ST-07, H). |
| Responsive | 72 | 15 | [B] no overflow at 375 px; sticky call bar and chat bubble crowd the screen (ST-02); other viewports untested. |
| Accessibility | 70 | 15 | [S] best form accessibility in the repo; [B] no skip link; custom errors not announced (ST-05). |
| Interaction and feedback | 76 | 10 | [S] first-error focus, busy lock, inline quote. |
| UX writing | 74 | 5 | [B/S] bilingual, plain; empty cart minimal (ST-04). |
| Design consistency | 68 | 5 | [S] themes intentionally vary; hard-coded hex, 2,623-line themes file. |
| **Weighted** | **73.0** | | |

---

## How to reproduce the weighted figures
Weighted = sum of (score x weight). Marketing: 15.0 + 11.7 + 10.5 + 10.8 + 11.1 + 6.8 + 3.5 + 2.75 = 72.2. Admin and platform exclude Responsive (weight 15), so the sum is divided by 0.85. Storefront: 14.8 + 11.4 + 10.8 + 10.8 + 10.5 + 7.6 + 3.7 + 3.4 = 73.0.

## Evidence gaps (do these before trusting the low-confidence scores)
1. Render admin and platform authenticated pages (dashboard, orders, product editor, settings, tenant detail, builder) at 375, 390, 768, 1366, 1440 and 1920 px with a seeded test tenant. Start from `tools/qa-stack.mjs`, which the repo already provides, so no live data is touched.
2. Keyboard-only and screen-reader runs on sign-in, orders, product editor and checkout.
3. Measure contrast on the focus ring, small text and the dark wordmark.
4. Run `audit:vitals` for the storefront and a throttled 3G trace.
5. Walk signup steps 2 to 4, the demo-to-trial path and a quarantined signup with a test account.
6. A 5-person task test: first sign-in, ship an order, add a product, in Bangla and English.
7. Add funnel analytics (signup steps, checkout steps, admin form abandon) before treating any drop-off hypothesis as fact.

## Re-scoring rule
Re-score a category only when new evidence changes it. When a category moves from NA to assessed, recompute the weighted total with all eight weights.
