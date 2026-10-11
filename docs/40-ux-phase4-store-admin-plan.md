# UX rebuild phase 4: store admin screens

Brief: docs/36. Gaps: `checkup/UX-GAPS.md`. Building blocks: `packages/ui` (PageHeader, Section, KpiRow, SettingsLayout, Drawer, SaveBar, Toast, Advanced) and the admin shell (docs/37 phase 2). Rule from the brief: tabs and cards, a sticky save bar, drawers for quick views, live filters, and nothing that is one long single page. One area at a time, with phone and desktop screenshots against the canvas artboard for review.

## Order of work
1. **Integrations** (`AdmIntegrations`). Worst offender: 8 providers open as raw forms with code-style labels (`apiKey`, `storePassword`), 2,852 px tall.
   - A list of cards in groups (Couriers, Payments, Marketing and tracking, Messaging). Each card: name, one-line purpose, status (Connected, Needs attention, Not connected), and Connect or Manage.
   - Connect and Manage open a drawer (bottom sheet on a phone): Test and Live as a segmented control, plain-language field labels, a "saved, type to replace" hint on secrets, Test connection and the status address with a copy button for couriers.
   - Keeps the write-only secret rule: stored values are never sent to the browser.
2. **Settings layout.** Every `/settings/*` page, plus Plan and usage, inside one `SettingsLayout` with a section list on the left (a row of pills on a phone). Store details, payments and shipping get the sticky save bar.
3. **Orders** (`AdmOrders`). Live search (no Search button), filter chips for payment, courier, district and date, a bulk-action bar that appears on selection (book courier, print labels, mark packed, send SMS), and a drawer for a quick look at one order without leaving the list.
4. **Products** (`AdmProducts`). Live search, status tabs with counts, category and collection filters, list and grid, select-all with bulk actions, Import CSV. The plan meter moves out of the way.
5. **Dashboard** (`AdmDashboard`). Sales chart with a comparison line, date range, the setup checklist, low stock, tips. The existing "Needs your attention" list stays (it is better than the canvas).
6. **Long pages**: COD payouts (tabs), Customers (filter bar, drawer), Inventory, Store details (grouped cards).

## Shared pieces added along the way
- `LiveSearch`: a search box that updates the page's URL a moment after typing stops, so lists filter as you type and links stay shareable.
- `FilterChips`: toggle chips that read and write URL parameters.
- `BulkBar`: a sticky bar that shows how many rows are selected and their actions.
- `CopyField`: a read-only value with a Copy button.

## Verification
Existing tests are updated where the interface changed (labels, buttons). Each area gets accessibility and 40 px tap-target checks at 390 and 1440 through the existing quality suite, plus a screenshot pair against the canvas.
