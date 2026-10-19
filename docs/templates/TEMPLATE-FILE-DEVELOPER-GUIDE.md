# Template file: developer guide

A template is one `.json` file. Platform staff upload it at **Platform admin → Themes and modules → Upload a template file**. When it is live it appears in:

- the marketing gallery (`/templates`, `/business/templates`) and the signup wizard (`/start`),
- every merchant's template picker in the design editor, where they apply it into their **drafts**, edit it with the normal visual editor, and publish when happy.

Merchants keep their own copy. Re-uploading the same `id` creates a new version; stores using it are *offered* the update as drafts and never lose edits.

Working examples (both pass the real validator):
- [`examples/example-store.template.json`](examples/example-store.template.json), an online store
- [`examples/example-business-restaurant.template.json`](examples/example-business-restaurant.template.json), a business website with custom pages

The code is `packages/core/src/platform/template-bundle.ts`. When this guide and the code disagree, the code wins.

---

## 1. How to build one (recommended workflow)

1. Start from an example file, or download any existing template from the platform admin (the **Download** button on its row).
2. Edit the JSON. To get valid section settings, copy sections from the example or from a downloaded template rather than writing them by hand.
3. Upload it with **Save as a draft** ticked. A validation error names the exact part that is wrong (for example `pages.home: Section 2 is not one this page can use`).
4. Apply the draft to a test store, check it in the editor, then press **Publish** on the template row.

Nothing in the file is trusted. Every part passes through the same validators as the visual editor, so a file cannot add script, raw HTML or a bad link.

---

## 2. File shape

```jsonc
{
  "format": "biztrack-template",          // required, exactly this
  "formatVersion": 1,                     // required, exactly 1
  "id": "eid-kapor",                      // required, see rules below
  "name": "Eid Kapor",                    // required, 2-60 chars
  "blurb": "One line for the gallery",    // optional, max 200
  "audience": "Panjabi and saree shops",  // optional, max 80
  "category": "fashion",                  // fashion|electronics|kids|streetwear|beauty|other (default other)
  "tags": ["Eid", "Panjabi"],             // optional, max 4 tags, 30 chars each
  "moduleLabel": null,                    // optional badge text on the card, max 40, or null
  "baseLook": "kapor",                    // required, one of the six original looks
  "siteMode": "ECOMMERCE",                // ECOMMERCE (default) | PORTFOLIO | HYBRID
  "vertical": "RESTAURANT",               // required for PORTFOLIO/HYBRID, forbidden for ECOMMERCE
  "previews": { "desktop": "https://…", "mobile": "https://…" },
  "settings": { },                        // colours and style, section 3
  "pages": { "home": { }, "product": { }, "collection": { }, "cart": { } },  // section 4
  "chrome": { },                          // optional header and footer, section 5
  "customPages": [ ]                      // business sites only, section 6
}
```

### Field rules

| Field | Rule |
|---|---|
| `id` | 3-40 chars, small letters, digits and single dashes (`eid-kapor`). It is the permanent key. Using the id of one of the six originals replaces it (starting at version 2). |
| `baseLook` | `kapor`, `gadgetstudio`, `mini-bunny`, `axionwear`, `bindu`, `berber`. This is the CSS "look" the template is drawn with; the layout and colours sit on top of it. |
| `siteMode` / `vertical` | `ECOMMERCE` has no vertical. `PORTFOLIO` and `HYBRID` need one of `RESTAURANT`, `DOCTOR_CLINIC`, `PUBLIC_FIGURE`, `BUSINESS_COMPANY`, `SERVICE_PROVIDER`, `PERSONAL_PORTFOLIO`. The vertical decides which business tab the template shows on. |
| `previews` | `https://` links only (they are shown with a plain `<img>`, so any https host works). Use about 1440x900 for desktop and 390x844 for mobile, WebP. Optional: without them the gallery draws a colour card. |
| file size | 1 MB maximum. |

**There is no live demo store for an uploaded template.** The gallery preview shows your `previews` pictures, so supply them.

---

## 3. `settings` (colours and style)

```json
{
  "accent": "#8A2855",
  "background": "#FFF9F7",
  "text": "#321E28",
  "radius": "round",
  "font": "serif",
  "button": "filled",
  "buttonShape": "pill",
  "cardsDesktop": "4"
}
```

| Key | Values |
|---|---|
| `accent`, `background`, `text` | `#RRGGBB` hex (six digits). |
| `radius` | `none`, `sharp`, `subtle`, `soft`, `rounded`, `round`, `pill` |
| `font` | `sans`, `serif`, `editorial`, `friendly`, `bangla`, `bangla-serif`, `bangla-modern`, `bold-display` |
| `button` | `look`, `filled`, `outline`, `soft`, `elevated` |
| `buttonShape` | `look`, `square`, `rounded`, `pill` |
| `buttonSize` | `look`, `small`, `medium`, `large` |
| `cardRatio` | `look`, `square`, `portrait`, `tall` |
| `cardHover` | `look`, `none`, `lift` |
| `cardBorder` | `look`, `none`, `hairline`, `elevated` |
| `cardsDesktop` | `look`, `3`, `4` |
| `cardsMobile` | `look`, `2`, `3` |
| `spacing` | `look`, `tight`, `airy` |
| `width` | see `STYLE_CHOICES.width` in `packages/core/src/builder/theme.ts` |
| `paletteId` | optional string |

`look` means "use the base look's own value". Unknown choice values quietly fall back to the default; bad colours are an error.

**Two contrast rules reject the file**:
- text on background must be at least **4.5:1**,
- accent on background must be at least **3:1** (the accent is used as link and price text).

---

## 4. `pages`

Four page keys are allowed: `home`, `product`, `collection`, `cart`. **`home` is required.** A page you leave out starts from the built-in layout for that page.

```json
{
  "version": 1,
  "sections": [
    { "id": "hero-1", "type": "hero", "settings": { "title": "Eid Collection", "ctaLink": "/search?sale=1" } },
    { "id": "featured-1", "type": "featured-products", "settings": {} }
  ],
  "seo": { "title": "…", "description": "…" }
}
```

### Section rules

- `id`: 3-40 chars, `a-z 0-9 _ -`, **unique within the page**.
- `type`: must exist and be allowed on that page (table below).
- A page holds at most **30** sections. Each type has its own per-page maximum (`max`).
- `settings`: validated per type. Unknown keys are dropped; wrong values are errors or fall back to defaults. Easiest way to learn the keys: copy a section from a downloaded template.
- Optional `label` (max 60 chars, shown in the layers panel), `disabled: true` (hide it), `style` (below).
- **Required sections** cannot be missing or disabled: `product` needs `product-main`, `collection` needs `collection-products`, `cart` needs `cart-main`.
- Text fields come in pairs: `title` and `titleBn` (Bangla). Fill both for a bilingual store.
- Links must start with `/` or `https://`. Images must be `https://` or one of the store's own `/media/` paths. Colours are `#RRGGBB`. No HTML anywhere.

### Section types

| Page | Section types (max per page) |
|---|---|
| **home** | `announcement-bar` (1), `hero` (3), `featured-products` (8), `category-grid` (2), `banner` (6), `rich-text` (6), `trust-strip` (1), `drop-spotlight` (2), `countdown-timer` (2), `accordion-faq` (3), `marquee-ticker` (2), `video-reels` (3), `floating-contact` (1), `visitor-counter` (4), `stock-scarcity` (4) |
| **product** | `product-main` (1, **required**), `product-reviews` (1), `product-related` (1), plus the shared ones: `featured-products`, `category-grid`, `banner`, `rich-text`, `trust-strip`, `drop-spotlight`, `countdown-timer`, `accordion-faq`, `marquee-ticker`, `video-reels`, `floating-contact`, `visitor-counter`, `stock-scarcity`, `testimonials-slider` |
| **collection** | `collection-header` (1), `collection-products` (1, **required**), plus the shared ones above (not `testimonials-slider`) |
| **cart** | `cart-main` (1, **required**), plus `featured-products`, `category-grid`, `banner`, `rich-text`, `trust-strip`, `countdown-timer`, `accordion-faq`, `marquee-ticker`, `video-reels`, `floating-contact`, `visitor-counter`, `stock-scarcity` |
| **Business sections** (home and custom pages) | `restaurant-menu`, `restaurant-hours-location`, `reservation-cta`, `doctor-hero`, `clinic-chambers`, `service-cards`, `team-grid`, `portfolio-grid`, `download-card`, `contact-form`, `bento-grid`, `content-tabs`, `video-lightbox`, `testimonials-slider`, `pricing-matrix`, `promo-popup`, `image-comparison`, `logo-marquee`, `process-timeline`, `flip-box`, `image-hotspots`, `filterable-grid` |

Some business sections need a capability on the merchant's site (`menu`, `booking_requests`, `services`, `downloads`, `leads`); they show in the picker only where that capability is on. The authoritative list, with every setting key, is `SECTIONS` in `packages/core/src/builder/registry.ts`. To print it:

```bash
pnpm --filter @biztrackbd/core exec tsx -e "import {SECTIONS} from './src'; for (const s of SECTIONS) console.log(s.type, s.page, s.fields.map(f=>f.key).join(','))"
```

### Per-section `style` (optional)

Background (`bgType`, `bgColor`, `bgGradient`, `bgImage`, `bgOverlay`, `bgPattern`), spacing (`paddingY`, `paddingTop`, `paddingBottom`), `textColor`, `textAlign`, `cardMode`, `hideOn` (hide on mobile or desktop), animation (`animation`, `animDuration`, `animDelay`), `anchorId`, and a `mobile` override block. Copy the shape from a downloaded template; invalid values are normalised.

---

## 5. `chrome` (header and footer, optional)

```json
{
  "version": 1,
  "header": {
    "logo": "left", "sticky": true, "search": "bar", "showLanguage": true, "showAccount": true,
    "announcement": { "mode": "settings", "text": "", "textBn": "", "link": "", "bgColor": "#2B2118", "textColor": "#FFFFFF" }
  },
  "menu": { "auto": false, "items": [
    { "id": "menu-home", "type": "link", "label": "Home", "labelBn": "হোম", "ref": "", "url": "/" }
  ] },
  "footer": { "columns": [ { "id": "about", "type": "about", "title": "", "titleBn": "", "body": "", "bodyBn": "", "links": [] } ], "copyright": "", "copyrightBn": "" }
}
```

- `logo`: `left`, `center`, `stacked`. `search`: `bar`, `icon`, `none`.
- Menu: up to 8 items. Item `type`: `new`, `sale`, `all`, `blog`, `category`, `page`, `link`. **Item ids are 3-40 chars** (`menu-1`, not `m1`) and unique. `link` items use `url` (`/…` or `https://`); `category` and `page` items use `ref` (a slug).
- Footer: 1 to 4 columns, column `type`: `about`, `shop`, `help`, `links`, `text`, `contact`, `social`, `payments`. Column ids follow the same 3-40 rule and must be unique.
- **Templates are made store-neutral on purpose.** On the way in, only `about`, `shop`, `help`, `contact`, `social` and `payments` columns are kept, and their titles, body text and links are cleared. The announcement text is cleared too. A store's own words are never overwritten by a template.
- Omit `chrome` and the store keeps its current header and footer.

---

## 6. `customPages` (business sites only)

Extra pages created on the merchant's site, such as `/menu` or `/reservations`:

```json
{
  "slug": "reservations",
  "title": "Reservations", "titleBn": "বুকিং",
  "description": "Book a table", "descriptionBn": "টেবিল বুক করুন",
  "layout": { "version": 1, "sections": [ { "id": "res-1", "type": "reservation-cta", "settings": {} } ] }
}
```

- Up to **12** pages; `slug` is dashes-and-lowercase and unique; `title` is required (max 80).
- `layout` follows the section rules in section 4, using the `custom` page's allowed sections (business sections plus the shared ones, `contact-block`, `lp-*` blocks that list `custom`).
- Link menu items to a custom page with `{ "type": "page", "ref": "<slug>" }` or `{ "type": "link", "url": "/<slug>" }`.

---

## 7. Common validation errors

| Message | Cause |
|---|---|
| `That file is not valid JSON` | Trailing comma, comments (the `//` comments in this guide are not allowed in the file) or a bad quote. |
| `Template file: id …` | Id not lowercase-dashes, or outside 3-40 chars. |
| `baseLook: choose one of the original looks` | Typo, or a look that does not exist. |
| `vertical: a business template needs one` | `siteMode` is `PORTFOLIO`/`HYBRID` without a `vertical`. |
| `pages.home: a template needs a home page` | `pages.home` missing. |
| `pages.X: only home, product, collection, cart can be set` | A page key outside those four. Put business pages in `customPages`. |
| `pages.home: Section N is not one this page can use` | Section type unknown or not allowed on that page. |
| `pages.home: Section N has a bad id` / `Two sections share the id …` | Id outside 3-40 `a-z0-9_-`, or duplicated. |
| `This page needs the "Product" section` | A required section is missing or disabled. |
| `settings: Your text colour is hard to read…` | Contrast rule in section 3. |
| `chrome: Menu, link N has a bad id` | Item id shorter than 3 characters. |
| `Preview pictures must be https:// links` | `previews` use `http://` or a relative path. |

---

## 8. Checklist before you upload

- [ ] `id` is unique and final (changing it later makes a different template).
- [ ] Valid JSON with no comments.
- [ ] Bangla fields (`…Bn`) filled for visible text.
- [ ] Colours pass the contrast rules; check on a phone-width preview.
- [ ] `previews.desktop` and `previews.mobile` are https and load publicly.
- [ ] Uploaded as a draft first, applied to a test store, checked in the editor, then published.
- [ ] No store-specific content (phone numbers, real product names, addresses) in the sections.
