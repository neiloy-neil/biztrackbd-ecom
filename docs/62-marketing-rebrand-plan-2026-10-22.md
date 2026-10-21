# Marketing website rebrand plan (22 Oct 2026)

Applies the confirmed brand set ("Growth b", logo set + colours and type sheet) to `apps/marketing`. Scope is the marketing site only; Section 7 lists what would follow in other apps.

## 1. The brand, in one table

| Item | Brand guideline | Marketing site today |
| --- | --- | --- |
| Primary colour | Deep green `#0B4D3B`, Fresh green `#11795A` | Violet `#5B4FE8` / `#4A3FD0`, navy ink `#1A1A4E` |
| Accent | Marigold `#F2A900` (arrow, badges, accents on dark), Dark gold `#946300` (".bd" on light) | None |
| Surfaces | Cream `#FBF7EC`, Mint `#E3F1EA` | White, `#F4F3FF` lilac tint |
| Text | Deep green, Muted ink `#3D5A52` | Navy `#1A1A4E`, `#4B4B73` |
| Alert | Warning `#C2410C`, for losses, returns, alerts only | Danger `#B91C1C`, warning `#B45309` |
| Headlines + wordmark | Baloo Da 2, 800 | Plus Jakarta Sans |
| Body | Hind Siliguri 400 and 600 | Hind Siliguri as fallback only |
| Logo | Growth b: white "b" with marigold arrow on a deep green rounded square. Wordmark is lowercase `biztrack.bd`, ".bd" in marigold (dark) or dark gold (light). Six lockups: primary, stacked, symbol, on dark, one colour/reversed, Bangla (`বিজট্র্যাক বিডি`) | Purple square with three bars, "BizTrack**BD**" in text |
| Rules | Clear space = arrow height; min 16 px symbol, 20 px wordmark; never recolour arrow green, stretch, outline, or put on a photo without the square | n/a |

Files that carry the old brand: [layout.tsx](apps/marketing/src/app/layout.tsx) (header logo, footer logo, fonts, `themeColor`, JSON-LD `logo`), [marketing.css](apps/marketing/src/app/marketing.css) (token block on lines 3-35, 2,400 lines), [site.css](apps/marketing/src/app/site.css), [opengraph-image.tsx](apps/marketing/src/app/opengraph-image.tsx) (indigo `#4338CA` and a "B" tile), [icon.svg](apps/marketing/src/app/icon.svg) (purple "B"), `public/favicon.ico`, and 22 component/page files with hard-coded hex values (about 28 uses each of `#5B4FE8` and `#4F46E5`, plus `#7C3AED`, `#3B5BFD`, `#2563EB`, `#1D4ED8` blues and violets). 55 files use inline `style={{}}`.

## 2. Decisions needed before Phase 1

1. **Logo source files.** The three images exist only in this chat. Phase 1 needs vector files (SVG) for: symbol (on square), symbol open (no square), primary, stacked, on-dark, one-colour/reversed, Bangla. Either drop them into `design/brand/` or approve me redrawing them. The "b" and arrow are simple geometry (stem + ring + triangle), so a redraw is feasible, but the wordmark letterforms are Baloo Da 2 800 and need outlining so they do not depend on a font load.
2. **Name styling.** Logo is lowercase `biztrack.bd`; prose, titles and schema use `BizTrackBD`. Proposed rule: wordmark only in the logo, `BizTrackBD` in running text and `<title>`. Confirm.
3. **Business mode colour.** The site uses teal `#0F766E` to tell "Business" pages from "Storefront" pages. It sits too close to Fresh green and loses meaning under the new palette. Proposed: drop teal, tell the two modes apart with labels and Mint vs Cream surfaces, not hue.
4. **Status colours.** Success stays a green (Fresh green `#11795A`), and Warning `#C2410C` becomes the single red/orange alert colour. The old `#B91C1C` red and `#B45309` amber merge into it. The guideline says warning is "losses, returns, alerts only", so decorative uses of orange go.

## 3. Phases

### Phase 0: Brand assets and tokens (foundation, do first, about half a day)

- Add `design/brand/` with the SVGs above plus a short `BRAND.md` that copies the guideline rules.
- Make marketing logo components: `<BrandSymbol>`, `<BrandWordmark variant="primary|stacked|on-dark|mono|bn">`, so no page inlines an SVG again.
- Rewrite the token block in `marketing.css` with new names (`--green-deep`, `--green-fresh`, `--marigold`, `--gold-dark`, `--cream`, `--mint`, `--ink-muted`, `--warning`) and keep the old names (`--brand`, `--ink`, `--tint`, `--success`, `--danger`...) as aliases pointing to the new values. That recolours most of the site at once and keeps the diff reviewable.
- Swap fonts in `layout.tsx`: Baloo Da 2 (800, `latin` + `bengali`) as `--font-display`, Hind Siliguri (400, 600) as `--font-body`. Drop Plus Jakarta Sans. Headings (`h1-h3`, `.brand`, nav logo, price figures) use display; everything else body.
- Check contrast: Marigold `#F2A900` on white fails text contrast, so it is only for fills, arrows, badges and text on deep green; ".bd" and accent text on light use Dark gold `#946300`. Muted ink on Cream and Mint to be measured (target 4.5:1).
- Exit: site renders in the new palette and fonts with no layout breakage; `pnpm --filter marketing typecheck` and build pass.

### Phase 1: Identity surfaces (about half a day)

- Header and footer logo (layout.tsx), including a Bangla lockup in the footer for the `/bn` toggle if present.
- Favicon set from the symbol: `icon.svg`, `favicon.ico`, `apple-touch-icon` (180 px, with square), PWA/maskable 192/512 if any, `themeColor` `#0B4D3B`.
- `opengraph-image.tsx`: cream background, primary lockup, headline in Baloo Da 2 (load the font file into `ImageResponse`), green frame instead of indigo. Check per-route OG images too (backlog SEO-002 made them route-specific).
- JSON-LD `Organization.logo` should point to a real PNG/SVG logo URL (currently points to the OG image), 512 px min.
- Email templates in `packages/core/src/mail/layout.ts` are shared, so only note them here (Section 7).

### Phase 2: Replace hard-coded colours (about 1 day)

Work through the 22 files by group, replacing hex with tokens, and removing inline `style={{}}` colour uses where a class fits:

| Group | Files |
| --- | --- |
| Home and shared components | `page.tsx`, `hero-mock.tsx`, `dual-hero.tsx`, `plan-cards.tsx`, `template-gallery.tsx`, `template-card.tsx`, `authentic-ui-proof.tsx`, `mode-architecture-matrix.tsx`, `site-navigation.tsx` |
| Pricing and product | `pricing/*`, `product/*`, `business/*` (7 pages, `vertical-landing-layout.tsx`) |
| Compare and migrate | `compare/*` (5 pages + view), `migrate/*` |
| Features and tools | `features/*`, `couriers/`, `data-ownership/`, `tools/courier-fraud-checker/*`, simulators (`cod-calculator`, `courier-dispatch`, `meta-capi`, `payment-wallet-matcher`, `waterfall-profit-ledger`, `tco-calculator`) |
| Forms and legal | `contact/*`, `start/*` (wizard), `privacy`, `terms`, `security` |

Rules for this pass: green for primary buttons, links and active states; Marigold only as a highlight (one per view, never a large fill on a light page); Mint for cards and tints; Cream for alternating sections. Charts and the ledger/waterfall simulators keep meaning: green = gain, Warning = loss or return, blue courier colour removed (use Muted ink + label). Never encode status by colour alone (existing rule from doc 53).

### Phase 3: Page redesign pass against the brand (about 1.5 days)

Colour swap alone will look like a recoloured violet site, so this phase re-sets the layouts that carry the brand:

- **Home hero:** new headline set in Baloo Da 2, Cream background, deep-green CTA, Bangla headline from the sheet ("অর্ডার থেকে টাকা হাতে") and the English line ("Your store, your money") as the paired tagline. Decide with the owner whether this pair replaces the current hero copy; copy claims must still pass the COPY-001/002 rules.
- **Dark section:** one deep-green band per page (logo "on dark" lockup, marigold accents) for rhythm, e.g. pricing CTA and footer.
- **Section order and repetition:** reduce repeated card grids; use Mint cards and the arrow motif (up arrow as the "growth" bullet/divider) sparingly.
- **Bangla typography:** headline weights in Baloo Da 2 render Bangla, so check line-height and clipping of matras on every h1/h2 (Bangla needs about 1.35-1.5 line-height).
- **Pricing, Compare, Business, Templates, Start wizard:** same component set, new look, verified at 320-414 px (WEB-002 standard: zero horizontal overflow).
- **Template previews:** `public/templates/*.webp` are merchant-store screenshots, so they stay as they are.

### Phase 4: Verify (about half a day)

- `pnpm turbo typecheck lint build --filter marketing` (all 45+ routes still prerender).
- Grep gate: no `#5B4FE8`, `#4F46E5`, `#7C3AED`, `#4338CA`, `#3B5BFD`, `#0F766E`, Jakarta references left in `apps/marketing/src`.
- Contrast check on every text/background pair in the new token table (script, not by eye).
- Screenshots of every route at 375 and 1280 px, plus Bangla toggle, using the existing QA stack (`tools/qa-stack.mjs`, `biztrack-qa-*` skills). Compare against the logo set rules: clear space, min sizes, no recoloured arrow, no logo on photo without the square.
- Social check: view OG image in a card debugger, favicon in tab at 16 px (symbol must stay legible).
- Update `docs/56` backlog with `BRAND-002 ... BRAND-00x` rows and `docs/INDEX.md`.

## 4. Suggested order and size

| Phase | Effort | Can run in parallel |
| --- | --- | --- |
| 0 Assets + tokens + fonts | 0.5 day | no, everything depends on it |
| 1 Identity surfaces | 0.5 day | after 0, with 2 |
| 2 Hex to tokens (5 groups) | 1 day | yes, by group |
| 3 Redesign pass | 1.5 days | after 2 |
| 4 Verify + docs | 0.5 day | last |

About 4 days for one person. Phases 0-2 give an on-brand site that is shippable; Phase 3 is the polish that makes it feel designed rather than recoloured.

## 5. Risks

- **Marigold contrast.** The most common mistake will be Marigold text on white. Enforce with the contrast script.
- **Font weight cost.** Baloo Da 2 with Bengali subset is heavy. Load only weight 800 for display and use `display: swap`; check LCP on home and pricing.
- **Existing claims.** Do not let a copy refresh reintroduce claims that were removed in COPY-001/002 (0.6 s load, response-time guarantees).
- **Chrome/browser cache.** Favicon and OG image are cached hard by Google/Facebook; schedule a re-scrape after deploy.

## 6. Out of scope for the first PR

Storefront template styling (merchant stores have their own themes), merchant admin, platform admin.

## 7. Follow-ups outside `apps/marketing`

The old violet is also in `packages/ui/src/tokens.css`, `apps/admin` (`admin.css`, `builder.css`, `icon.svg`, `manifest.ts`, layout), `apps/platform`, `packages/core/src/mail/layout.ts` (every transactional email), and the README banner (`docs/assets/banner.svg`). A site that is green while the signup emails, admin login and checkout redirects are violet will feel broken to a new merchant, so a second pass on the admin tokens and email layout should follow immediately after marketing ships.
