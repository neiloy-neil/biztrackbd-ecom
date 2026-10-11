# UX gap report: live app against the design canvas (11 October 2026)

Method: `node tools/ux-capture.mjs` opens every canvas artboard (`design/canvas/project/*.dc.html`) and the live page it should match, in the same browser at 1440 px (390 px for the `Mob*` boards), and writes a side-by-side image per pair to `checkup/ux/<Artboard>.png` with measurements in `checkup/ux/<Artboard>.json`. 73 pairs captured against the local seeded demo store.
Decisions that frame this report: docs/36. Plan: docs/37.
Caveats: the design boards show placeholder text (`{{o.id}}`) where data would go, so compare layout and features, not figures. The boards draw the sidebar and top bar as separate artboards (`Sidebar`, `Topbar`, `SaSidebar`), so they are absent from the pair images. The theme editor preview frame looked blank in the capture only because of headless full-page capture; the preview URL returns 200 and allows framing by the admin.

## 1. Screens in the design that do not exist in the app
| Artboard | What the design shows | State |
|---|---|---|
| `AdmNotifications` | SMS and email templates editor (Settings) | No route |
| `AdmInvoice` | Printable invoice layout and options | No matching screen (invoices print from orders) |
| `MobBkash`, `MobCourier` | Phone flows to verify a bKash payment and book a courier | No dedicated screens (checks sit inside the order list) |
| `SaAnnouncements` | Platform announcements to merchants | No route |
| `SaTickets` | Support tickets inbox | No route |
| `SaThemes` | Theme management | No route |
| `AdmCustomerDetail` | Customer profile | Route exists; the capture could not find a customer link, so not compared |
| `StrSuccess`, `StrOffline` | Order success and offline pages | Exist under other routes; compare separately |

The platform sidebar has 6 entries (Overview, Stores, Payments, Domains, Plans, Audit log); the design's has tickets, announcements and themes as well.

## 2. Pages that are one long form (page height, app against design)
| Screen | App | Design | What is wrong |
|---|---|---|---|
| Theme builder (`/design`) | 2,253 px | 900 px | Not a full-screen editor. Template cards, then tabs, then a section list with four buttons on every row, then a settings form below. Every text field appears twice (English and Bangla). Preview is a small panel beside it. No undo/redo, no page selector, no device icons, no top bar |
| Integrations | 2,852 px | 1,040 px | All 12 providers open as raw forms at once, with code-style labels (`apiKey`, `storePassword`, `pickupStoreId`). The design is a list of cards with a Connect button that opens a dialog (test or live, how-to link, copyable webhook URL) |
| COD payouts | 3,119 px (phone 5,533) | 1,040 px | A very long page; needs tabs or a master-detail view |
| Orders on phone | 4,776 px | 844 px | 25 full cards per page |
| Pixels on phone | 3,509 px | 844 px | Long stacked forms |
| Store details | 1,999 px | 1,359 px | One long form, no grouping |
| Platform audit log | 20,316 px | 1,040 px | No paging at all |
| Customers, Inventory, Loyalty | 1,700 to 2,000 px | 1,040 px | Long lists with no filter bar, no side panel |

## 3. Missing hierarchy and features, screen by screen
**Dashboard (`AdmDashboard`)**
- Design: date-range control, sales line chart with a comparison line, "Finish setting up" checklist, low stock, a tips card, KPI deltas.
- App: bar chart without a comparison, no date range, no setup checklist or tips, "Needs your attention" list instead (a good idea the design lacks; keep it).

**Orders (`AdmOrders`)**
- Design: filter chips (payment, courier, district, date range), live search, a dark bulk-action bar that appears on selection (book courier, print labels, mark packed, send SMS), 10 rows per page.
- App: search needs a Search button, two selects only, no courier or district filter, bulk actions sit below a 25-row table (out of sight), no send-SMS action, rows are tall.

**Products (`AdmProducts`)**
- Design: status tabs with counts, live search, category and collection filters, list/grid toggle, select-all checkbox, Import CSV.
- App: "Products on your plan" meter takes the top of the page, search needs a button, no collection filter, no grid view, no select-all, no import button, no bulk actions.

**Product editor, Inventory, Customers, Coupons, Reports, Settings pages**
- Compared in the captures; same pattern: sections stacked in one column, no sticky save bar, no side navigation between related settings (payments, shipping, domains, billing, staff are separate pages with no shared settings layout), billing is outside settings at `/billing`.

**Platform overview (`SaOverview`)**
- Design: search bar, MRR growth chart (12 months or 30 days), "Needs you" list with four linked, colour-coded items, newest signups, trial-to-paid funnel.
- App: four KPIs, a "Needs you" list of three zeros with no links, a 14-day signups bar chart, no search, no signups list, no funnel.

**Store detail (`SaTenant`)**
- Design: header with status and trial days, Open store, **Log in as owner**, Suspend; seven tabs (Overview, Subscription, Usage, Domains, Modules, Support, Audit log); KPI row; usage bars against plan limits; domains with status; modules; internal notes; recent activity.
- App: one page of four cards. No tabs, no KPI row, no limit bars, no domain or module view, no internal notes, no log-in-as-owner.

**Stores list, payments, plans, domains**: compared in captures; same pattern, with no filters, side panels or quick actions.

## 4. Cross-cutting gaps
1. **No shared page structure.** Pages assemble their own headers, cards and forms (docs/37 phase 1 addresses this; blocks now exist in `packages/ui`).
2. **Navigation.** App sidebar is light and long (Catalog, Fulfilment, Grow, Online store...); design groups it with a top bar (search, notifications, language). No global search, no notifications bell, no language switch in the admin.
3. **Filters and search** need button presses, not live updates, and lack the design's chips.
4. **Bulk actions and side panels** are missing; users leave the list to act on one row.
5. **Forms** have no sticky save bar, no unsaved-changes indicator, no inline validation summary, no "Advanced" fold.
6. **Labels.** Integration and some settings fields show internal names (`apiKey`, `storeId`).
7. **Dynamic content.** No live counts or notifications; several screens are static lists that need a reload.
8. **Phone.** Several screens render the desktop table stack as very long card lists (orders 4,776 px).
9. **Dark mode** is in the admin (works) but there is no toggle in the platform; platform has its own copy of the CSS.

## 5. What already matches or is better than the design
Orders status tabs with counts, "Needs your attention", bKash/Nagad payment-check flow, per-store integration vault, 5 themes with Bangla fields, mobile bottom tab bar, dark mode in the admin.

## 6. Suggested scope to approve
Follow docs/37 in order. Phase 2 (shell) fixes items 2, 3 and part of 4 and 7. Phase 3 (theme builder) is the largest single gap. Then, by value: Integrations dialog, Orders (filters, bulk bar, side panel), Products, Dashboard, Settings layout, Platform store detail (tabs, KPIs, limits, notes, log in as owner), Platform overview, then the missing screens (notifications templates, announcements, tickets, themes).
