# UX Audit: Executive Summary

Date: 4 November 2026. Scope: the whole BizTrackBD monorepo (4 apps, 1 shared UI package). Audit only; no source was changed.

## Read this first: how much was actually checked
| Checked in a real browser (live sites, 375 px wide) | Marketing home, signup step 1, templates; admin and platform sign-in; the Kapor demo store home and an empty checkout |
|---|---|
| Checked only in source code | All signed-in admin and platform pages; the checkout form logic; the shared UI package; navigation, forms, dialogs, CSS |
| Not checked at all | Viewports other than 375 px; keyboard and screen-reader use; real signup, checkout or order handling; analytics (none available) |

So the scores below are best read as a structured first pass. The admin and platform scores are low confidence, and the Responsive category is **Not Assessed** for both. Every finding in the full report is labelled as browser-verified, source-confirmed or hypothesis.

> **Update (later on 4 Nov 2026):** the signed-in admin and platform were then rendered locally (390, 768, 1366, 1920 px) on a private test database. Result in `BROWSER_VERIFICATION_ADDENDUM.md`. Headline changes: no page overflowed; the **floating AI Co-pilot button covers the Save button and the bulk-action bar** (new severity 3); bulk cancel was confirmed to run without confirmation but is recoverable via "Reopen Order" (severity 2, down from 3); platform navigation uses 42% of a phone screen; a tablet gets the phone layout. Three first-pass claims were wrong or too broad and are corrected there. Scores: admin 67, platform 65, monorepo 69.

## Overall assessment
BizTrackBD's UX is **sound and unusually considered in the places that matter commercially**, but the product is being built faster than its shared design system is being adopted.

| Application | Score | Confidence |
|---|---|---|
| Marketing site | 72 | Medium |
| Merchant admin | 66 | Low to medium |
| Platform admin | 65 | Low |
| Storefront | 73 | Medium |
| **Monorepo mean** | **69** | Low to medium |

Details and reasoning: `UX_SCORECARD.md`.

## What is working
- **The customer checkout is the strongest flow.** Inline validation with focus on the first error, correct phone and address input hints, a lock against double submission, server-side price recalculation, Bangla and English, an AI "paste an address" shortcut (`checkout-form.tsx`).
- **The admin is built for operators.** A command palette, mobile bottom bar with a payments-to-check badge, bulk order actions, quick-view drawer, menus that adapt to role, plan and business type (shop, clinic, restaurant), and escalating trial and billing banners.
- **Foundations are good.** Documented token contrast, light and dark themes, native `<dialog>` drawer, skeleton and error pages in every app, reduced-motion support, and automated axe checks in the admin end-to-end tests.
- **Marketing is clear at a glance.** One headline, one primary action, reassurance copy, a skip link and landmarks; no horizontal overflow at 375 px on every page checked.

## Most serious usability problems found
None reached severity 4 (critical blocker) on the evidence available. The highest-consequence items are severity 3:

1. **Bulk cancel on the orders list has no confirmation step in source**, sits next to safe actions, and carries a preselected reason (AD-13). Try it in a browser first, because a client script could intercept it.
2. **No protection against losing edits in long admin forms** (AD-11). The shared `SaveBar` exists but is used in 3 places; the 1,320-line product editor has no unsaved-changes guard.
3. **The Bangla admin is only a translated menu** (AD-10). Page bodies, banners and several menu labels stay in English, for an audience that reads Bangla.

Severity 2 items worth knowing: two "Team" entries and duplicate menu items (AD-06, AD-07); 24 native `confirm()` dialogs (AD-12); no skip link on four of five surfaces and no `<main>` on the two sign-in pages (AD-01, ST-03); silent custom-field errors at checkout (ST-05); crowded mobile storefront with stacked bars plus a permanent call bar and chat bubble (ST-01, ST-02); jargon in marketing CTAs ("admin desk", "Selling Channel").

## The structural finding
The shared UI package is good but **barely used where it would help most**: `DataTable` has zero consumers against 92 hand-built tables; admin has 3,208 inline-style blocks; marketing re-declares the brand tokens and one has already drifted (`--warning`); there are 3,257 hard-coded hex colours in TSX; there are two toast systems and four different focus rings. This is the cause behind many smaller inconsistencies, and the cheapest place to prevent more.

## Recommendations
1. Fix the three severity 3 items first (R-01, R-02, R-04 decision).
2. Make a small accessibility pass (skip links, `<main>`, custom-field errors, one measured focus ring): all small tasks.
3. Replace `window.confirm` with one accessible, specific confirm dialog.
4. Tidy admin navigation labels before restructuring it; test with a card sort.
5. Adopt `DataTable`, `EmptyState` and `SaveBar` in the top five admin screens; stop adding new inline styles and hex colours.
6. Close the evidence gaps (below) before any redesign. Do not redesign pages from this report alone.

## Priority roadmap (summary)
Full detail with files, effort and dependencies: `UX_IMPROVEMENT_ROADMAP.md`.

| Priority | Items |
|---|---|
| **P0** | None confirmed. |
| **P1** | R-01 bulk cancel safeguards; R-02 unsaved-changes guard; R-03 accessible confirm dialog; R-04 Bangla admin scope; R-05 skip links and checkout field errors; R-06 one focus ring; R-07 orders search and mobile select-all; R-08 first sign-in clarity |
| **P2** | R-09 adopt DataTable and EmptyState; R-10 admin navigation labels; R-11 marketing CTA and microcopy; R-12 token unification; R-13 storefront mobile chrome; R-14 small-text floor; R-15 axe in all apps |
| **P3** | Platform theme, login polish, one toast system, empty-cart suggestions, Bangla `lang` spans, breakpoint standard, font audit, legacy colours, builder keyboard review |

## Evidence gaps to close next
Render authenticated admin and platform pages at six viewports on a seeded test tenant (`tools/qa-stack.mjs`); run keyboard and screen-reader walkthroughs; measure contrast and storefront vitals; walk signup steps 2 to 4 and the demo-to-trial path; run a 5-person task test; add funnel analytics. No conversion or drop-off figures exist in this audit: every drop-off statement is a hypothesis.

## The seven deliverables
| File | Contents |
|---|---|
| `EXECUTIVE_SUMMARY.md` | This page |
| `UX_AUDIT_REPORT.md` | Monorepo map, per-app findings with evidence and file paths, heuristic table, responsive notes, writing suggestions |
| `USER_JOURNEY_ANALYSIS.md` | Nine journeys with friction, failure cases and drop-off hypotheses |
| `DESIGN_SYSTEM_AUDIT.md` | Tokens, components, adoption counts, consistency matrix |
| `ACCESSIBILITY_REPORT.md` | WCAG 2.2 AA indicative table, remediation, test plan |
| `UX_IMPROVEMENT_ROADMAP.md` | P0 to P3 with problem, impact, evidence, solution, files, effort, outcome, dependencies |
| `UX_SCORECARD.md` | Scores per app and per category with evidence |
