# Go-live checklist (12 October 2026)

State of production when this was written, checked against what is set in Vercel (names only, never values), GitHub and Supabase. "You" means the owner: these need your logins.

## Must fix before the first real merchant
| # | What | Why it matters | How |
|---|---|---|---|
| 1 | **Marketing project is missing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_DRIVER`, `MEDIA_BUCKET`.** | Without them signup cannot draw the sample products' pictures, and **Keep this store silently falls back to sample products** (it cannot copy pictures). | `node tools/make-vercel-env.mjs`, then `node tools/vercel-load-env.mjs --yes --apps marketing`. Redeploy marketing. |
| 2 | **`IMPERSONATION_SECRET` is not set in admin or platform**, so the super-admin impersonation cookie is signed with a secret written in the source code. | Anyone who reads the repository could forge an impersonation session. | Review and merge branch `claude/jolly-ishizaka-e1882c` (commit `ccf5c05`). It makes the secret mandatory in production. **Set the same 64-character value in both projects first** (`make-vercel-env` generates it), or impersonation will fail with a clear error. |
| 3 | **`DATABASE_URL` is on Supabase's session pooler (15 connections).** | Already caused two outages. | In Vercel, switch `DATABASE_URL` in all four projects to the transaction pooler (port 6543, same login), keep `DB_POOL_MAX=1`, redeploy. Run `node tools/smoke.mjs` afterwards. |
| 4 | **Admin is missing `PLATFORM_VERCEL_TOKEN`, `EDGE_CONFIG_ID`** (and the storefront `EDGE_CONFIG`). | Merchants cannot connect a custom domain. | Create a Vercel token and an Edge Config (see `make-vercel-env` TODO lines), load them. |
| 5 | **Privacy, terms and contact pages** were missing. Drafts are added (marketing site, linked from the footer). | Needed for SMS sender approval, Meta, and trust. | Have a lawyer read `privacy` and `terms`. Set `NEXT_PUBLIC_SUPPORT_EMAIL` and/or `NEXT_PUBLIC_SUPPORT_WHATSAPP` on the marketing project so the contact page shows how to reach you. |

## Check these work for real (once, with a real phone and email)
- **SMS**: `node tools/sms-test.mjs` to your own number with the production key; confirm the sender ID is approved by sms.net.bd. Then turn on "Order received" in a test store's Customer messages and place an order.
- **Email**: confirm Brevo's sending domain is verified (SPF and DKIM) so sign-in and invoice emails do not land in spam. Test the sign-in email from a new address.
- **Supabase email templates**: the manual step in docs (confirm email, reset password) is done.
- **bKash and Nagad numbers** on the plan payment screen are your real ones (`PLATFORM_BKASH_NUMBER`, `PLATFORM_NAGAD_NUMBER`).
- **A real signup, start to finish**, on the live site: sign up, confirm email, sign in with two-factor, add a product with a photo, place an order from the storefront, check a payment, book a courier (test mode).

## Turn on
- **`DEPLOY_ENABLED=true`** (GitHub repository variable) so database migrations apply automatically after CI passes. Until then run `node tools/checkup-migrate.mjs` before every push that adds a migration.
- **Backups**: the `backup.yml` workflow needs its secrets (present: `BACKUP_ENCRYPTION_KEY_HEX`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`). Run it once by hand and restore the file into a scratch database to prove it works.
- **Alerts**: `smoke.yml` runs after every deploy and hourly; a failure emails the repository owner. Turn on GitHub notifications for failed workflow runs.
- **Supabase scheduler jobs** (`node tools/supabase-schedule.mjs --admin https://admin.biztrack.bd --platform https://platform.biztrack.bd`): abandoned carts, billing, courier sync, domains, loyalty, demo resets and the demo sweep are installed.

## Known limits on the free plans
- Supabase Free: 500 MB database, 1 GB storage, 15 pooler connections (see #3), pauses after a week without activity.
- Vercel Hobby: 60-second function limit (demo start takes about 4 seconds; a demo's starter orders are the long part), 4 projects deployed from one repository.
- Vercel keeps about an hour of runtime logs; to investigate an incident later, add a log drain or an error tracker (for example Sentry's free plan).
