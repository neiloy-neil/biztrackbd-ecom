# Merchant theme builder: plan for review (13 October 2026)

Status: **plan only, nothing built.** Written from the owner's answers on 13 October 2026. Please review section 7 (decisions to confirm) before any code.

## 1. What was decided
- **Add**: visual on-page editing of the store pages, more style controls, a header and footer builder, and custom pages built from sections.
- **Freedom**: guided. Pages stay a single column of sections; style comes from tested choices, not free positioning. This keeps every store fast, readable and usable on a phone.
- **Plans**: keep today's tiers (Starter colours and style only, Pro home page sections, Business every page). New controls follow the same gate: a lower plan keeps what it has.
- **Switching templates**: yes, with a preview and drafts. A merchant picks another template, sees it on their own products, applies it as drafts and publishes when ready. Their products and content stay.
- **Order of work**: write this plan, review it with the owner, then build.

## 2. What exists today (so the work extends it)
- **Editor** (`apps/admin/.../design/builder.tsx`): home, product, collection and cart pages; drafts, publish, history, rollback, conflict detection; live preview in an iframe with phone/tablet/desktop sizes; undo and redo; Bangla and English text; plan gate (`sectionBuilder`).
- **On-page editing exists for landing pages only** (docs/46 stage 4): typing on the page, a section toolbar with a drag grip, plus signs between sections, picture cards in the gallery, and a phone bottom sheet. It is built into the storefront preview (`edit-overlay.tsx`, `sections.tsx`) and the editor (`builder.tsx`).
- **Style** is a `ThemeSettings` record: three colours, corners (3 choices), font (2 choices). `themeCss` turns validated values into CSS variables. Contrast is checked.
- **Header and footer** are fixed storefront components (`header.tsx`, `footer.tsx`) fed by store settings, the category list and footer pages.
- **Content pages** are a `Page` row with a rich-text HTML body, a slug and a publish switch; they appear in the footer.
- **Templates** (docs/46 stage 5): a template is theme settings plus a layout per store page, published by staff; stores are offered updates as drafts.

## 3. Part A: on-page editing for store pages
Reuse the landing editor's machinery for home, product, collection and cart.
- Mark editable text and pictures (`data-edit`, `data-edit-image`) in the home sections (hero, banner, rich text, announcement bar, category and product grid headings, trust strip text) and in the product, collection and cart blocks that have text of their own (page headings, reviews heading).
- Turn on the overlay (toolbar, drag grip, plus signs, hide/duplicate/delete) for these pages. Required blocks (product details, product grid, cart) cannot be hidden or deleted, as today.
- Dynamic blocks (the real product grid, the real cart) show real data in the preview and are moved as one block; their inner layout is not editable here.
- The plan gate applies: a locked plan gets the plain preview with no overlay.
- Phone: the same bottom sheet.
- Effort: small to medium, because the machinery exists. Most of the work is annotating the section renderers and testing each page kind.

## 4. Part B: more style controls
All values come from short tested lists. Nothing the merchant types ever reaches the page as code.
| Control | Choices | Notes |
|---|---|---|
| Font pair | 6 to 8 pairs of heading and body, each with a Bangla-capable fallback | Fonts are system or self-hosted web fonts, never loaded from a third-party host, so the store stays fast and private. |
| Buttons | filled, outline or soft; small, medium or large; corner follows "Corners" | |
| Product cards | image ratio (square, 4:5, 3:4), hover (none, lift, second picture), price and badge position, cards per row (2 or 3 on phones, 3 or 4 on a computer) | |
| Spacing | tight, normal, airy | A single multiplier on section padding. |
| Page width | narrow, normal, wide | |
Implementation: extend `ThemeSettings` (validated) and `themeCss` (variables only), add the matching variables to the shared storefront CSS, extend the editor's Style panel with a live preview, and keep today's values as the defaults so untouched stores look exactly the same. A template carries these settings too, so staff can publish them in a template.

## 5. Part C: header and footer builder
Both become editable, store-wide layouts (not per page), with their own draft and publish like a page.
- **Header**: logo position (left, centred, above the menu), sticky or not, search (icon, bar or none), cart style (icon with count, or text), and the announcement bar moved here so it is store-wide and always on top (today it is a home section).
- **Menu**: an ordered list of items, each a store page, a category, a custom page or an https link. Drag to reorder, up to 8 items, optional sub-items for categories.
- **Footer**: 1 to 4 columns; each column is text, a link list, contact details (from store settings), social links, payment icons or a newsletter box. A line for the copyright text.
- **Data**: a new page key `chrome` in the existing version tables (draft, published, history, rollback, conflict check all reused), holding `{ header, menu, footer }`, validated like sections. The storefront layout reads the published `chrome` and falls back to today's header and footer when none exists, so nothing changes until a merchant edits it.
- **Editor**: a "Header and footer" entry in the page switcher with its own preview, using the same on-page overlay.
- **Plan gate**: header and footer editing for Pro and above (it is layout, not only colour); Starter keeps the logo, menu order and social links through store settings as today.
- Effort: medium to large. The editor and version machinery are reused; the work is the new validated model, the storefront components reading it, and tests.

## 6. Part D: custom pages from sections, and switching templates
**Custom pages**
- A new page kind `custom:<id>` built from the same sections used elsewhere (text, picture and text, gallery, FAQ, video, contact block, rich text) with a slug, a title, an SEO title and description, and its own draft and publish.
- A "Pages" list screen in the admin with a template choice for new pages (About us, Contact, Size guide, Delivery and returns) built from original text. Existing rich-text pages keep working and can be converted one at a time.
- Custom pages can be added to the menu and footer (Part C).
- Plan: counted against a per-plan page limit (proposed Starter 3, Pro 10, Business 50), like landing pages.
- New sections needed: `contact` (phone, WhatsApp, address, hours from store settings; no form that sends mail yet) and a few text variants.

**Switching templates**
- A "Change template" screen lists the published templates (docs/46 stage 5). Choosing one opens a preview of the merchant's own products in that template.
- "Apply as drafts" writes the template's colours, style, header, footer and page layouts to the drafts. Products, categories and content pages are untouched. Pages the merchant has customised are listed with a choice per page: take the template's layout, or keep theirs.
- Nothing is live until the merchant publishes each page, and history can roll back.
- The store remembers its new template and version (so future updates are offered).
- Looks: changing to a template on another original look changes the CSS skin for the whole store. The preview shows this before anything is applied.

## 7. Decisions to confirm
1. **Order**: suggested A (on-page editing, quick and visible), then B (style controls), then C (header and footer), then D (custom pages and switching). Header and footer could come first if you would rather see a visible change on every page sooner.
2. **Font pairs**: self-hosted fonts add a little weight to each store. Proposed 6 pairs, 2 of them Bangla-first. Agree?
3. **Header and footer gate**: Pro and above. Is that right, or should Starter edit them too?
4. **Page limits** for custom pages: Starter 3, Pro 10, Business 50?
5. **Contact block**: show details only (no message form) for now?
6. **Switching template**: allow it for every plan, with Starter taking the colours and style only, like template updates today?

## 8. Out of scope here
Free positioning and resizing, custom CSS or code boxes, animations, multi-user live editing, per-product layouts, and a separate template editor in the platform admin.

## 9. Testing and safety
- Unit tests for every new validated value (style settings, header, menu, footer, custom page sections), including refusal of anything outside the lists.
- Tests that an untouched store renders exactly as before (CSS output, header, footer).
- Tests for the plan gate on each new control, and for the switching and update flows writing drafts only.
- Browser checks of the editor on desktop and a phone-sized screen (the browser test ports are blocked on the owner's machine, so these run through the dev servers by hand until that is fixed).
