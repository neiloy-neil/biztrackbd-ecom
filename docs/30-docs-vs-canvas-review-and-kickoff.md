# Docs vs Canvas Review and Implementation Kickoff

Reviewed 10 Oct 2026: docs 01 to 29 against the 88-artboard canvas (`docs/29-design-canvas-screen-index.md`). Docs 06 to 28 were written separately; this review reads them against the canvas and the decisions in `docs/05-decisions-log.md`. Nothing in the other docs was changed.

## 0. Resolution status (10 Oct 2026)

All ten conflicts in section 2 were resolved:

| # | Resolved by |
|---|---|
| 1 | Doc 16 rewritten as the single plan; doc 01 section 12 now only summarises it |
| 2 | Doc 08 merged: 61 models, 21 enums, validated with `prisma validate`. Docs 18 and 28 now point to it |
| 3 | Doc 07 section 7 and doc 16 follow the single-warehouse decision; canvas `AdmInventory` shows a shelf code instead of locations |
| 4 | Real theme IDs everywhere; canvas gallery renamed (Kapor, Gadget Studio, Mini Bunny, Axionwear, Bindu); doc 06 is the authority and sets launch order |
| 5 | Canvas `AdmLoyalty` now uses the doc 26 tiers, thresholds and perks |
| 6 | Doc 17 has Brevo, `PLATFORM_DATABASE_URL` and the vault key id |
| 7 | `Plan` and `UsageCounter` models added to doc 08; limits stated in doc 07 section 21 |
| 8 | Counts updated to 88; hover colour and mobile tabs corrected in doc 09; `canvas:preview` is scheduled in doc 16 Phase 0 |
| 9 | Same as 8 |
| 10 | Doc 20 marked post-v1 |

### Extra schema problems found while merging (also fixed)
- `ProductImage`, `ProductVariant` and `WebhookDeliveryLog` had no `tenantId`, so RLS could not protect them. Added.
- `Order.idempotencyKey` and `IdempotencyRecord.idempotencyKey` were globally unique, so one tenant could block another. Now unique per tenant.
- The RLS table list omitted 9 tenant tables that already had `tenantId`. Added, plus all new tables.
- `DailyStoreMetrics` was defined twice with different fields (docs 08 and 18). Doc 18 version kept.
- `TenantIntegration` did not match doc 04 (no mode, status or webhook token). Replaced.
- No platform-side database role existed for cross-tenant super admin reads. Added `biztrack_platform` (doc 08 section 3.4).

---

## 1. What is solid

- **Coverage:** 68 of 88 artboards are named in at least one doc. Every desktop admin, builder, storefront and super admin screen from the first 78 has a route and component mapping in doc 09. No doc refers to an artboard that does not exist.
- **Consistent with the canvas:** delivery fees (Inside Dhaka ৳80, outside ৳130), COD and bKash/Nagad TrxID flow, address cascade, 14-day trial, manual payment approval queue, 15-minute impersonation, plan-limit interceptor and read-only state.
- **Strong specs:** order state machine and atomic stock decrement (27), RLS with a restricted DB role (08), encrypted secrets vault (17), edge routing (13), backups (19), COD reconciliation (28).

## 2. Conflicts to resolve before coding

| # | Severity | Conflict | Where | Suggested resolution |
|---|---|---|---|---|
| 1 | High | **Two roadmaps disagree.** Doc 01 section 12 puts the verification desk, quick order, COD reconciliation and P&L in Phases 3 and 4 and launches one theme. Doc 16 has none of those and ports four more themes in Phase 6. | 01, 16 | Make doc 16 the single execution plan and rebuild it from doc 01 section 12 plus section 4 below. Delete the roadmap from doc 01 or link to doc 16. |
| 2 | High | **Schema is missing models the canvas needs.** Doc 08 has 38 models. Not present: plan and entitlements, usage counters, tenant modules, announcements, support tickets and messages, expenses (P&L), blocklist entries, collections, theme drafts and versions, SMS and email templates, customer and product tags, staff invites, review replies, bespoke measurements. Doc 28 defines `CourierSettlementInvoice` and `CourierSettledOrder` and doc 18 defines `PlatformDailyMetrics`, but doc 08 does not include them. | 08, 18, 26, 28 | Merge all model definitions into doc 08, one schema. Add the missing models listed here. |
| 3 | High | **Inventory scope contradicts the decision.** Doc 05 says single central warehouse. Doc 07 section 7 and doc 16 Phase 4 specify multi-location stock across physical outlets, which also drifts toward POS (excluded). | 05, 07, 16 | Follow doc 05. Remove multi-location from 07 and 16. The canvas inventory screen shows a location column, so change that to one location. |
| 4 | High | **Theme names do not match.** Docs 06 and 16 use `kapor`, `mini-bunny`, `bindu`, `axionwear`, `gadgetstudio` (the existing projects). Doc 01 lists `gadget`, `grocer`, `glow`, `craft`. The canvas gallery shows Kapor, Nirmal, Chhoto, Uddam, Darzi. | 01, 06, 16, canvas | Pick one set. Recommended: keep `kapor` for v1 and name the rest after the real projects. Update the canvas gallery and pricing copy to match. |
| 5 | Medium | **Loyalty tiers differ.** Doc 26: Gold ৳15,000 to ৳34,999, Platinum from ৳35,000, perks include permanent 5% and 10% discounts and free delivery. Canvas: Platinum from ৳40,000, perks are lighter. | 26, canvas | Doc 26 wins. Change the canvas table. Note that permanent discounts eat margin; confirm that is intended. |
| 6 | Medium | **Email provider missing from env.** Decision: platform-managed Brevo plus SMS credits. Doc 17 has Greenweb SMS but no Brevo key or sender settings. | 04, 05, 17 | Add `BREVO_API_KEY`, sender domain and per-tenant usage notes to doc 17. |
| 7 | Medium | **Plan limits are not in the schema or the env.** Starter 300 products and 500 orders, Pro 2,000 and 3,000, Business unlimited appear on the canvas and in docs 01 and 05 but not in doc 08 or doc 07 (which mentions only the 10% order grace). | 07, 08 | Add a `Plan` table (limits as JSON, price, interval) and a `UsageCounter` model. |
| 8 | Medium | **Stale numbers.** Docs 07 and 09 say 78 artboards, and 09 refers to `pnpm run canvas:preview`, which does not exist in `package.json`. The canvas has 88. | 07, 09, package.json | Update counts. Add the preview script (see section 4). |
| 9 | Low | **Token drift.** Doc 09 has brand hover `#4A3ED4`; canvas uses `#4A3FD1`. Doc 09 lists a `bkash` tab in the mobile bar; canvas tabs are Home, Orders, Products, Customers, More. | 09 | Use canvas values. |
| 10 | Low | **Doc 20 (third-party marketplace) is a full spec for something deferred.** | 05, 20 | Keep it, add "post-v1" at the top so nobody builds it early. |

## 3. Screens in the canvas that no doc maps to a route

Marketing home, templates, pricing and mobile home; storefront mobile home; wizard preview and shared header and footer; landing pages list; and the later additions: quick order (desktop and mobile), COD settlement (desktop and mobile), loyalty and VIP, profit and loss, mobile fraud, abandoned, pixels and landing pages, and the dark dashboard. Doc 09 section 4 needs rows for these. The specs for quick order, COD settlement, loyalty and P&L already exist in docs 26 and 28; only the route mapping is missing.

## 4. How to start implementing

**Principle:** build one thin working path through the whole stack first (a walking skeleton), then widen. The existing five projects already contain working Prisma models, order logic and admin screens; port from them instead of rewriting.

### Step 0: fix the docs (1 to 2 days)
1. Resolve conflicts 1 to 4 above. Nothing else blocks coding.
2. Merge the schema (conflict 2) into doc 08 and let it be the only source.

### Step 1: repository (day 1 to 2)
- `git init` in `D:\AI\biztrackbd ecom`. Add `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`, `.env.example` from doc 17.
- Packages: `packages/tsconfig`, `packages/db`, `packages/ui`, `packages/core`.
- Apps: `apps/admin`, `apps/storefront` only. Marketing and platform wait.
- Move the render harness used to check the canvas into `tools/canvas-render` and add `pnpm canvas:preview` and `pnpm canvas:measure`. It gives pixel baselines for visual tests.

### Step 2: walking skeleton (week 1 to 2)
The goal is one real COD order, end to end, for one tenant:
1. **db:** Tenant, TenantUser, Product, ProductVariant, Customer, Order, OrderItem, OrderStateLog, Domain, Plan. RLS with the `biztrack_app` role. `createTenantPrismaClient`. Seed Rongdhonu Fashion.
2. **Cross-tenant test first:** a Vitest suite proving tenant A cannot read tenant B. Run it in CI from the first commit.
3. **core:** `OrderService.createOrder()` from doc 27 (price recalculation, atomic stock, idempotency).
4. **storefront:** host-based tenant resolution (use a local `*.localhost` rewrite first, Edge Config later), Kapor home, product, one-page checkout, order placed.
5. **admin:** login, orders list, order detail with "Mark as paid", using the canvas shell (sidebar, topbar).
6. **Inngest:** `order/created` triggers a stubbed SMS.

Done when: a customer places a COD order on `demo.localhost`, the owner sees it in the admin, and the isolation test passes.

### Step 3: widen in this order (weeks 3 to 10)
1. `packages/ui` from `UiKit` and shells, then admin dashboard, products, product editor, inventory.
2. Courier booking (Steadfast first), bKash/Nagad TrxID verification, fraud check and quick order desk.
3. COD settlement and P&L (doc 28).
4. Signup wizard and subscription with manual payment approval, plus the super admin screens needed to approve it. This is the first point at which someone can actually become a customer.
5. Theme editor, custom domains, abandoned orders, pixels and CAPI, landing pages, loyalty.
6. Hardening: RLS suite, Playwright checkout on mobile, backup restore drill, Core Web Vitals.

### Step 4: pilot
Five to ten real Bangladeshi merchants on the free trial before building anything in the "second wave" list. Their first-month complaints should set priorities, not this document.

## 5. Risks to watch

- **Scope.** The canvas has 88 screens and the docs describe a lot more. The skeleton plus Step 3 items 1 to 4 is a sellable product; the rest is not required to charge the first customer.
- **Pricing and limits** are hypotheses (doc 05). Keep them in the `Plan` table, not in code.
- **SSLCommerz per store** needs each merchant's own account; verify with SSLCommerz before promising it.
- **Deliverability and BTRC rules** for SMS sender IDs and email domains need lead time; start registration early.
- **One theme at launch.** Do not start the other themes until Step 3 is done.
