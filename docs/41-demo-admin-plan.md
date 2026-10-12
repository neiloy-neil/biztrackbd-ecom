# Demo admin for merchants: plan

Decisions (owner, 12 October 2026): one click, no signup. Each visitor gets a **private temporary copy** of the demo store they pick (Kapor, Gadget Studio, Mini Bunny, Axion Wear, Bindu or Berber). It lives on **demo.biztrack.bd**, lasts **3 hours**, and at most **50** exist at once. New orders appear while they look around. A **"Keep this store"** button carries the store into a real free trial. Switched off in the demo: real SMS and email, courier booking and payments (simulated), account settings (plan and billing, domains, team, integration keys, pause store), uploads and exports.

## How it works
1. **Entry.** "Try the admin" on each template card, the templates page and the home page opens `https://demo.biztrack.bd/start?template=kapor`. That address is served by the admin app (a host check in `proxy.ts`), and only that host can start a demo; real merchant logins never work there and demo sessions never work on `admin.biztrack.bd`.
2. **Starting a demo** (`/start`). Checks: per-visitor limit (hashed IP, 3 starts an hour), the 50-at-once cap ("The demo is busy, try again in a few minutes"). Then it creates a tenant through the same `signup_create_tenant` function the signup uses, fills it from the template with the existing demo seed (`packages/core/src/demo/seed.ts`), reusing the template's pictures by address (no new uploads, so no storage cost), makes one demo owner, signs the session and redirects to the dashboard.
3. **Data.** Migration 20 adds to `Tenant`: `demoKind` (`TEMPLATE` for the shared storefronts, `SESSION` for visitor copies), `demoTemplate`, `demoExpiresAt`, `demoLastOrderAt`. Existing `isDemo` stays the one flag that says "this is not a real store".
4. **Storefront of the copy.** `d-<random>.biztrack.bd` (the wildcard already resolves it), so "View your store" works. The "Demo" ribbon the storefront already has applies.
5. **Guards** (extend `packages/core/src/demo/guard.ts`, which today protects the shared storefronts).
   - SMS and email: the sender wrapper checks the tenant; for a demo it records "sent" in the order timeline and sends nothing.
   - Couriers: a built-in fake provider answers booking and tracking.
   - Locked areas show a clear "Not available in the demo" note instead of the form: billing, domains, team, integrations, store pause, delete.
   - Uploads, imports and CSV exports return "Not available in the demo".
   - Everything else works for real inside the copy: products, orders, packing, customers, reports, builder.
6. **Clean up.** A Supabase `pg_cron` job every 15 minutes calls `/api/cron/demo-sweep`: deletes session tenants past `demoExpiresAt` (cascade removes their rows) and any cap overflow. The 3-hour clock shows in a banner ("This demo is deleted in 2 h 40 min").
7. **Live feel.** No per-minute job (free tier). When a demo admin page loads and the last simulated order is older than 3 minutes (and there are fewer than 12 unpacked), one sample order is placed (random items, mix of COD, bKash with a TrxID to check, and a Dhaka or outside-Dhaka address). Capped at about 25 simulated orders per demo.
8. **Keep this store.** A banner button goes to `biztrack.bd/start?from=<signed demo token>`. After the normal signup, the products, categories, theme and store details are copied from the demo copy into the new real store (orders, customers and anything locked are not), then the demo is deleted. The token is signed and single-use; the copy runs under the new store's own session.
9. **Limits on the free database.** Each copy is about 8 to 14 products and about 25 orders. At 50 copies that is a few thousand rows, well inside the free plan. The cap and the 3 hour life keep it that way.

## Build order
1. Migration 20, session creation, cap and rate limit, sweep job, guards, `demo.biztrack.bd` host handling. Tests: isolation between two visitors, expiry deletes, cap, each guard.
2. Entry buttons on marketing (template cards, templates page, home, pricing), demo banner with countdown.
3. Live orders.
4. Keep this store.

## Needs from the owner
- Add the domain `demo.biztrack.bd` to the **biztrack-admin** Vercel project (free, one click; the wildcard DNS already points at Vercel).
- Nothing else: no new accounts or keys.

## Notes
- Another session already added a demo ribbon and `/demo/[template]` fallback paths on the storefront and marketing app (commit f5408d7). This plan reuses the ribbon and replaces those fallback paths once the real addresses are used everywhere.
- Real merchants are unaffected: demo tenants are excluded from platform revenue, tenant counts and the super admin lists by `isDemo` (the super admin tenants list already shows a Demo marker).
