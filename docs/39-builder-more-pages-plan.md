# Editable product, collection and cart pages (builder phase 3b)

Decision (owner, 12 October 2026): the theme builder must edit more than the home page: product, collection and cart pages, and custom pages. Today the builder knows two page kinds, `home` and `landing`; the product page, category page and cart are fixed layouts in the storefront.

## Model
- **Page kinds**: `home`, `landing` (existing), plus `product`, `collection`, `cart`. One layout per store for each of the three new kinds (a product template, a collection template, a cart template), not one per product.
- **Same machinery**: drafts, publish, history, rollback, conflict detection and the plan gate all work by page key already. New keys `product`, `collection`, `cart` ride on them. The store theme still rides on the home page's rows.
- **Dynamic blocks**. Each new page has one block that cannot be removed or hidden, because the page does not work without it:
  - `product-main`: gallery, title, price, variant picker, add to cart, delivery assurances, description.
  - `collection-products`: the product grid with sort and paging.
  - `cart-main`: the cart lines, totals and the checkout button.
  Around them the merchant adds, moves, hides or removes the optional sections: `collection-header`, `product-reviews`, `product-related`, and the existing generic ones (`banner`, `rich-text`, `trust-strip`, `featured-products`, `category-grid`, `announcement-bar` where it fits).
- **Defaults equal today's pages**, so a store that never edits them looks exactly as before. `getLive` returning nothing means "use the default layout".
- **Plan gate**: the existing `sectionBuilder` plan feature. `home` tier edits the home page; `all` edits every page; `settings` edits colours only.

## Work
1. Core: page kinds, `required` sections, new section definitions, validation (required block present and enabled), default layouts, `versions.ts` keys.
2. Storefront: one shared renderer for the new blocks (client-safe, so the editor preview can redraw them live); product, collection and cart routes render their saved layout, falling back to the default.
3. Preview: `/preview?page=product|collection|cart` uses the first active product, the first category, or sample cart lines.
4. Admin builder: a page switcher in the top bar; the Template and style tab explains that colours are store-wide.
5. Tests (core validation and defaults; storefront pages unchanged by default; editor switching and publishing a product layout), docs.

## Out of scope for now
- Custom pages built from sections (About, Contact). They exist as content pages with rich text (Pages and blog); making them section-based needs a `custom:<id>` page kind and a list screen, and comes after these three.
- Per-product layouts.
