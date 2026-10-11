# Template demo stores: plan (11 October 2026)

## Problem found
- `/templates` on the marketing site shows a "See demo store" button on the **Kapor** card only. The other four templates (Gadget Studio, Mini Bunny, Axion Wear, Bindu) have no demo.
- Kapor's button points at `NEXT_PUBLIC_DEMO_STORE_URL` = `https://demo.biztrack.bd`. No store has that name, so the link returns the storefront's 404.
- Signup's "include demo data" adds the same three fashion products (panjabi, shirt, socks) for every template (`packages/core/src/platform/signup.ts`, `seedDemoCatalog`).

## Decisions (owner, 11 October 2026)
1. **Five real demo stores**, one per template, running the real storefront.
2. **Behaviour**: browse and fill a cart; checkout shows a clear "demo store" message and never creates an order or sends an SMS.
3. **Content**: industry-specific products, English and Bangla, about 8 to 12 per template (Kapor: panjabi, kurti; Gadget Studio: earbuds, chargers; Mini Bunny: toys; Axion Wear: sportswear; Bindu: skincare).
4. **Pictures**: generated, brand-neutral product illustrations (no licensing).
5. **Addresses**: `kapor`, `gadgetstudio`, `minibunny`, `axionwear`, `bindu` `.biztrack.bd`. Reserve these names so nobody can sign up with them (the template ids are `kapor`, `gadgetstudio`, `mini-bunny`, `axionwear`, `bindu`; the host label for mini-bunny is `minibunny`).
6. **Platform numbers**: demo stores carry a demo flag and are excluded from MRR, trial counts, billing and suspension.
7. **Signup sample data** follows the chosen template (copy that template's demo products).
8. **Upkeep**: a reset tool (one command) and a nightly refresh job from Supabase, so edits never last.
9. **Marketing cards**: real preview image (desktop and phone) plus "View live demo" and "Use this template" on all five.
10. **Language**: opens in English; the Bangla switch works because content exists in both.
11. **Location**: the production Supabase project, flagged as demo.
12. **Order of work**: demos first, then the admin UX rebuild (docs/37).

## Work breakdown
1. **Data model**: a demo flag on `Tenant` (migration; excluded in platform queries for MRR, trials, store counts, billing sweeps, suspension). Row-level security unchanged.
2. **Template content module** in `packages/core`: per template, categories, products with variants, English and Bangla titles and descriptions, prices, stock, and the picture reference. Used by both signup and demos so they cannot drift.
3. **Pictures**: generate an illustration per product (consistent style per template), process through the media pipeline (WebP), store in the `store-media` bucket under each demo tenant.
4. **Demo seeding tool** `tools/demo-stores.mjs`: creates or resets the five stores (tenant, owner, plan, active theme and its sections, products, sample banners, announcement text saying "Demo store"). Idempotent. Run against production with the owner connection after the migration.
5. **Demo guard** in the storefront: for demo tenants, the order and checkout actions return a friendly "This is a demo store" result and never write an order, send SMS, or call a courier or payment provider; a visible demo ribbon on every page.
6. **Nightly refresh**: a protected cron route on the admin app (`/api/cron/demo-reset`) scheduled from Supabase (`tools/supabase-schedule.mjs` gains a job).
7. **Marketing**: `/templates` cards show a preview image and both buttons for every live template; the demo URL is derived from the template id and root domain, not a single environment variable. Home page link updated.
8. **Reserved names**: add the five labels to the reserved-subdomain list used by signup.
9. **Previews**: capture desktop and phone screenshots of each demo for the cards (tool in `tools/`).
10. **Tests**: signup seeds template-specific products; demo checkout never creates an order; demo stores are absent from platform metrics; marketing cards render five demo links; the reset tool is idempotent.
11. **Docs**: docs/35 (setup, new env and cron job), docs/23 (onboarding), `checkup` notes.

## Risks
- Pictures are the biggest effort: about 50 generated images. They are produced as vector or simple illustration files, so size is small.
- The free Supabase database is small; 5 demos of about 10 products each are tiny.
- Public demo stores are an abuse target (spam in forms). The guard blocks writes; the nightly reset clears the rest.
