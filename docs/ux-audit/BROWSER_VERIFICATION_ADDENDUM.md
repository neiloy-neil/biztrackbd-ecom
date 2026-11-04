# Browser Verification Addendum (signed-in admin and platform)

Date: 4 November 2026. This follows up the evidence gap in the first pass. It **supersedes** the earlier reports wherever they disagree.

> **Read `FIXES_APPLIED.md` first.** It records that these measurements came from an older checkout and that V-05 (platform nav) and parts of V-03 do not apply to the audited branch.

## Method and limits
- Ran `node tools/qa-stack.mjs admin,platform` from the **main checkout** (the audit worktree has no `node_modules`) against the private test database `biztrack_qa_test` on 127.0.0.1:54329, dev sign-in (`DEV_AUTH=1`), outbound keys blanked. The real Supabase project was not touched.
- The main checkout is slightly behind the audited branch (the branch has later theme commits). Findings below concern shared shell and form code, which those commits do not touch, but treat that as unverified.
- Test fixtures: tenant "Maison" (seeded demo, dark purple admin theme in this build), five synthetic orders `UX-9001..9005`, one synthetic platform owner. **All fixtures were deleted afterwards**; the order table was left at 0 rows, and the servers were stopped.
- Rendered viewports: **390, 768, 1366, 1920 px** (admin) and **390 px** (platform). **Not rendered:** 375 on signed-in pages, 1440, the storefront, the theme builder interior, POS. No keyboard-only or screen-reader run. DOM probes counted overflow, headings, landmarks, unlabeled controls, target sizes and text under 12 px.
- Pages probed: admin `/`, `/orders`, `/orders/[id]`, `/products`, `/products/new`, `/settings/store`, `/design`, `/orders/new`; platform `/`, `/tenants`, `/payments`, `/audit`.

## Corrections to the first pass
| Earlier claim | Correction |
|---|---|
| AD-15: "mobile merchants cannot select all" | **Wrong.** Mobile shows a "Select all 5" control above the cards. The duplicate DOM remains true: 10 order rows and 10 checkboxes exist for 5 visible of each. |
| AD-13: severity 3, "irreversible" | Downgraded to **2**. The order page has a **Reopen Order** action, so a cancel is recoverable. The missing confirmation is now browser-confirmed. |
| PL-03: platform has no empty states | **Too broad.** `/payments` shows "No payments waiting for approval. Queue is clear." and a "Target: approve within 4 working hours" line. Keep only that no shared `EmptyState` component is used. |

## Confirmed in the browser
| ID | Sev | Finding |
|---|---|---|
| V-01 | 2 | **Bulk cancel runs with no confirmation.** With one order selected, clicking "Cancel selected" cancelled it at once using the default reason "Customer requested cancellation". No native or custom dialog appeared (a `confirm()` hook recorded nothing, zero dialogs open). Feedback was a terse banner "1 cancelled." with no Undo; recovery is via Reopen Order on the order page. (Confirms AD-13.) |
| V-02 | 2 | **Mobile bulk bar hides its destructive action off-screen.** At 390 px the bar is fixed, and its action list is a 235 px scroller holding 1,065 px of controls: "Cancel selected" starts at about x=660. The visible part shows "Mark selected as packed" and a truncated "Con…". Discoverability is poor; the same hiding lowers mis-tap risk. |
| V-03 | 3 | **The floating "AI Co-pilot" button covers primary controls.** At 390 px it overlaps the bulk bar (button box 694-744 px against bar 716-772 px) and the Fulfilment "Delivered" card on the dashboard. At 768 px on Settings > Store it overlaps the sticky "Save store details" button (box 901-941 px against the button's top 874-924 px area). A floating control on top of the main action is a real obstruction. Severity 3 because it can block the save action on a form page. |
| V-04 | 2 | **A tablet gets the phone layout.** At 768 px the sidebar is `display:none` and the bottom tab bar (grid) is shown; a 1024 px tall iPad-size screen loses the persistent menu. The switch is at 900 px. |
| V-05 | 2 | **Platform navigation takes 42% of a phone screen.** At 390 px the 14 platform links wrap into pills that end at 352 px of an 844 px viewport, on every page, before any content. (Extends PL-01, which was about the flat list; here it is the mobile cost.) |
| V-06 | 1 | **No skip link on any signed-in page** (admin and platform probes). `<main>` exists on all probed pages. |
| V-07 | 2 | **Small targets.** Order checkboxes are 20 x 20 px; order-number links are 23 px high; "Auto-refresh: OFF" on the dashboard is 175 x 17 px; platform "Configure Gateways →" is 19 px high. Under WCAG 2.2 SC 2.5.8 (24 px) these need the spacing exemption or a larger target; they were not checked against that exemption, so treat as a risk, not a failure. |
| V-07b | 1 | The Next.js dev indicator ("N") sits over the bottom tab bar in dev builds; ignore for production. |
| V-08 | 1 | **Mixed language in one control**: the order page shows "Reopen Order" and "Reopen Order (অর্ডার পুনরায় চা…)" together, so the label repeats in two languages. Related to AD-10. |
| V-09 | 1 | Dashboard at 390 px has 38 text nodes under 12 px; other probed pages have 4 to 7. |
| V-10 | 0 | **Positive.** No horizontal page overflow at 390, 768 or 1366 px on any probed page. Every probed page has one `<h1>` (except `/design`, 0 `<h1>`, which is the builder shell). No unlabeled form fields on admin pages (the platform overview had 1). No images without `alt`. At 1920 px the admin content is capped at 1,180 px and centred with 246 px margins each side, which is a design choice rather than a defect. |
| V-11 | 0 | **Positive.** Store settings at 768 px has a sticky save bar reading "All changes saved" and a disabled save button until edits are made, so `SaveBar` is in use on that page. Orders: filters, quick view, status tabs with counts. |
| V-12 | 1 | Platform queue copy is plain and useful ("Queue is clear"); the platform overview greets a new operator with a wall of zero-count cards on an empty database (expected with test data; not a defect). |

## Effect on scores
Responsive can now be assessed for admin and platform, at limited depth:
| App | Responsive score | Reason |
|---|---|---|
| Admin | 68 | No overflow at four widths, good phone cards and select-all; minus the co-pilot overlap (V-03), hidden bulk actions (V-02) and tablet-as-phone (V-04). Based on 6 pages and 4 widths. |
| Platform | 62 | No overflow; nav costs 42% of the phone screen (V-05). Based on 4 pages at one width. |

Recomputed with all eight weights: Admin = 56.35 + 0.15 x 68 = **66.6, rounded 67**. Platform = 55.6 + 0.15 x 62 = **64.9, rounded 65**. The monorepo mean becomes (72 + 67 + 65 + 73) / 4 = **69**. Confidence for admin and platform rises from low to medium for navigation, forms and responsive; it stays low for accessibility, because no keyboard or screen-reader test was run.

## New or adjusted roadmap items
| ID | Priority | Action | Effort |
|---|---|---|---|
| R-25 | **P1** | Give the AI Co-pilot button a safe zone: position it clear of the bulk bar, save bar and bottom nav (or collapse it into the "More" menu on phones). Verify against `Save` on every form page at 390 and 768 px. Files: `apps/admin/src/components/admin-copilot-widget.tsx`, `shell.css`. | S |
| R-01 (revised) | **P1** | Keep. Now browser-confirmed; add a confirmation naming the count and requiring a reason, plus an Undo in the banner. Order is recoverable, so the risk is nuisance and customer messages, not data loss. | S |
| R-26 | P2 | Collapse the platform nav to a menu button on phones (or keep a single row that scrolls). Files: `apps/platform/src/app/(sa)/layout.tsx`, `platform.css`. | S |
| R-27 | P2 | Move the sidebar/bottom-bar switch from 900 px to about 768 px, or add a collapsed icon rail for tablets. Files: `shell.css`, `kit.css`. | M |
| R-28 | P2 | Raise tiny controls to 24 px minimum, 44 px on phone: row checkboxes (wrap in a larger label), order-number links, auto-refresh toggle. | S |
| R-07 (revised) | P2 | Drop the "mobile select-all" part (it exists); keep the visible Search button, and render one list variant instead of two DOM trees. | S |

## What is still not verified
Storefront at any width beyond 375 px, the theme and page builder, POS, the product editor interactions (dirty state, plan-limit messages), checkout completion, signup steps 2 to 4, quarantined-signup messaging, keyboard and screen-reader use, contrast measurements, and real-user task time. The unsaved-changes finding (AD-11) was not exercised in a browser; the store settings page does show a dirty-state bar, so check the product editor specifically.
