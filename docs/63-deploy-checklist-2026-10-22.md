# Deploy checklist (22 Oct 2026)

Everything below was verified locally on 22 Oct 2026. Nothing has been deployed yet.

## What was checked before this list was written

| Check | Result |
| --- | --- |
| Production build of marketing, storefront, admin, platform from the final code | see the last section |
| `packages/core` tests (about 1,350) against the private test database | see the last section |
| `packages/db` tests including the row-level-security sweep | 32 of 32 pass |
| Typecheck of all four apps and core | clean |
| Migrations against the real database | `059` applied; `060` ready, **not applied yet** |
| Vercel projects: node 22, framework Next.js, region bom1, last three production deploys READY | yes |

## Do these BEFORE pushing

1. **Apply migration 060** to the real database (`pnpm --filter @biztrackbd/db db:migrate`). It gives the marketing site two narrow openings
   and nothing else: it may read only the public rows of `PlatformConfig` (contact details, SEO text; every secret row stays hidden by a row policy),
   and it may add a row to `PlatformInquiry` (it cannot read, change or delete one). Without it the live contact form keeps failing with
   `permission denied for table PlatformInquiry` (it has stored zero inquiries so far) and details saved in Platform Admin never reach the site.
   To undo: `DROP POLICY platform_config_public_read ON "PlatformConfig"; DROP POLICY platform_inquiry_public_insert ON "PlatformInquiry"; REVOKE SELECT ON "PlatformConfig" FROM biztrack_app; REVOKE INSERT ON "PlatformInquiry" FROM biztrack_app;`
2. **Optional, for automatic plan activation: add two variables to the `biztrack-admin` project** (Production): `UDDOKTAPAY_API_KEY` and
   `UDDOKTAPAY_BASE_URL` (`https://biztrack.paymently.io`), the same values saved in Platform Admin. The admin app cannot read Platform Admin's
   saved key (its database role has no access to platform tables, on purpose), so it needs its own copy to start a payment. Without them the
   "pay online" button explains that online payment is not available and merchants pay by bKash or Nagad as before.
   Rotate the Paymently key first (it was pasted in a chat), then enter the new one in both places.

## Push once

One push builds all four projects once. Pushing also syncs the repository to Lovable.

## After the deploy: check in this order

1. `https://biztrack.bd`: footer shows the five contact cards on one row; no cookie banner; the share image loads at `/opengraph-image`.
2. `https://biztrack.bd/contact`: send one real message (it should say sent). It appears in Platform Admin -> Inquiries. Send it twice quickly: still one row.
3. Platform Admin -> Settings -> Contact & Social: change one value, save, reload `https://biztrack.bd`: the footer shows it.
4. Google Analytics -> Realtime: your visit appears within a minute. Meta Events Manager -> Test events: PageView and ViewContent appear twice (Browser and Server), merged into one.
5. Merchant admin: Marketing -> Pixels (GA4 secret field is blank with "saved" hint, never shows the value); Apps -> UddoktaPay (the card shows the store's two addresses); a support ticket sent twice quickly stays one.
6. Storefront: a store footer shows its contact and social icons; a store with no UddoktaPay keys of its own does not offer UddoktaPay at checkout.
7. One small real plan payment through UddoktaPay, closing the tab right after paying: the plan becomes active (the platform app's webhook does it).
8. Remove `PLATFORM_META_TEST_EVENT_CODE` from the `biztrack-marketing` project once step 4 is done, so live events stop being labelled as tests.

## If something goes wrong

* Vercel: open the project -> Deployments -> the previous Ready deployment -> Promote to Production (instant rollback, no rebuild, no extra build minutes).
* Database: migration 060 is additive; the undo statements above restore the old state. Nothing in 060 touches stored data.
* Two things to know are not code bugs: the first contact message after deploy is the first inquiry the table has ever stored, and Paymently's webhook needs the
  platform app deployed before a plan payment can activate on its own.

## Known and deliberately left

* 215 audit-log rows mention stores that were deleted from the real database on 22 Oct (they have no database link to a store).
* Admin, platform, shared UI tokens still use the old violet; marigold status badge (4.0:1) and the Nagad swatch (4.2:1) are below contrast targets.
* The share image fetches Baloo Da 2 from Google Fonts when it renders; if that fails it falls back to the system font.
