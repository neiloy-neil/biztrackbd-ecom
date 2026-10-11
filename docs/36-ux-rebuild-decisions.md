# UX rebuild: decisions (11 October 2026)

The owner finds the theme builder, the store admin and the platform admin too long and flat: one big page, no hierarchy, little design. These answers set the brief. The design canvas (docs/29) stays the base; where it falls short, propose a better layout and get approval.

## Who and what
- Typical merchant: a **non-technical shop owner on a phone**. Every screen must work at 390 px first.
- Brand: the canvas look (purple/indigo, type and spacing from the Foundations artboard). No new brand.
- Languages: **English and Bangla**, switchable. Merchant sets the store language; customers can switch on the storefront.
- Dark mode: **admin and platform, with a toggle** (canvas has a dark dashboard).
- Simplify: advanced features go behind an "Advanced" section. Nothing is removed.

## Theme builder
- Problems named: no live preview, too many fields on one page, hard to add or reorder sections, looks unfinished.
- **Full-screen editor**: sections list on the left, live preview of the real store in the centre, settings for the selected section on the right. On phones: preview on top and a bottom sheet for sections and settings (the full editor, not a reduced one).
- Control level: **section-level**. Add, remove, reorder and edit each section's content and style.
- Save model: **draft, then Publish**, with undo/redo and version history.
- Preview: device switcher (phone, tablet, desktop) and a **shareable private preview link** for a draft.
- Pages editable: home, product, collection, cart and custom pages (About, Contact).
- Themes: keep the existing five, each fully editable.
- Sections to offer: hero banner, slider, announcement bar; product grids, collections, best sellers; testimonials, FAQ, rich text, image with text; countdown and flash sale, newsletter, video, WhatsApp button.
- Plan gating: basic editing on all plans; extras on paid plans (custom CSS, more pages, removing branding).

## Store admin
- Worst screens: dashboard, orders and order detail, products and product editor, settings pages.
- Navigation: grouped **dark sidebar** (Sell, Manage, Grow, Settings), a top bar with search and notifications, a bottom tab bar on phones.
- Page structure: tabs for long pages, cards to group fields, a **sticky save bar**. Master-detail where a list and its detail belong together.
- **Global search and command bar (Ctrl+K)** is a must: search orders, products, customers, jump to any page.

## Platform admin (operator)
- All screens need a rebuild: overview, stores list and store detail, payments and plans.
- Priorities: approve stores and payments fast; platform health and revenue (MRR, signups, churn); support merchants (tickets, notes, log in as owner); control plans, limits and announcements.

## "Dynamic, not static"
- Live data everywhere, no reload to see changes.
- Nothing hardcoded: text, banners, menus and sections editable by the merchant.
- Real-time notifications for new orders, tickets and low stock (**Supabase Realtime for key events, refresh on action for the rest**).
- Interactive UI: filters, search, inline editing, drag and drop.

## Storefront
- Compare home, product, cart and checkout to the canvas and fix the gaps.

## Method
1. **Design system first** (tokens, shared components, page shell), then the admin shell and navigation, then screens in priority order, starting with the theme builder.
2. One area at a time. After each: screenshots at phone (390) and desktop (1440) next to the canvas artboard, for the owner to review before the next area.
3. Existing Playwright and unit suites stay green.
