# Emails (13 October 2026)

Decisions: store owner only; email plus one text message for the urgent reminders; English and Bangla by the store's language; sent from `no-reply@biztrack.bd` as "BizTrackBD".

## What is sent
| Email | When | Text message too |
|---|---|---|
| Welcome | A store is opened (`signupStore`) | no |
| Staff invite | An owner invites a team member (the link is still shown once so it can be sent by WhatsApp) | no |
| Trial ending | 3 days and 1 day before the trial ends | on the last day |
| Renewal due | 3 days and 1 day before a paid plan ends | on the last day |
| Payment confirmed | Finance approves a plan payment | no |
| Payment not confirmed | Finance rejects it (the reason is in the email) | no |
| Payment overdue | Day 1 after the plan ends | yes |
| Store offline | Day 4 (read-only starts) | yes |
| Admin locked | Day 15 | yes |
| Support reply | Support replies to a ticket (not for internal notes) | no |

Demo stores are never emailed or texted.

## How it works
- Code: `packages/core/src/mail/` (`layout.ts` the shared look, `templates.ts` the words, `send.ts` the sending). Hooks: `runBillingLifecycle`, `approveSubscriptionPayment`, `rejectSubscriptionPayment`, `replyPlatformTicket`, `signupStore`, and the staff invite action.
- Each send is recorded in `PlatformMessage` (migration 22) with a key for the moment it is about, so running the daily sweep twice, or retrying, never sends the same message twice. A send that fails is not recorded, so a retry goes out.
- Nothing here can stop a payment being approved or an invite being made: sending never throws.
- The provider is Brevo (`BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`). With no key the message is skipped and a line is logged. Text messages use the platform's SMS account.
- See every email: `pnpm --filter @biztrackbd/core exec tsx scripts/email-preview.ts`, then open `checkup/emails/index.html`.

## Sign-in codes are sent by us too
First sign-in and "forgot password" codes now go out in BizTrackBD's own email (`sendSignInCode`), through Brevo: our server asks Supabase for the one-time code without Supabase emailing it (`issueEmailCode`), then sends it with our template. Supabase still creates the account and checks the code when it is typed. The email follows the page language (the `bt_lang` cookie in the admin; English on the platform) and is bilingual when the language is unknown.
- A code is only made for an address that is on a store's team or the platform team, and the screen answers the same either way. Asking is limited per visitor and per address.
- If we cannot send it ourselves (no Brevo key, Brevo is down, or no code could be made), Supabase's own sender is asked to, so signing in never depends on only one of the two. That fallback is why the Supabase templates and SMTP in step 2 and 3 below are still worth setting, but they are no longer required.
- The code is never logged.

## What you must do
1. **Verify the sending domain in Brevo** (Senders, domains, add `biztrack.bd`): it gives SPF and DKIM records to add in Vercel DNS. Until then mail from `no-reply@biztrack.bd` will be rejected or land in spam.
2. **Optional (the fallback): paste the sign-in templates into Supabase** (Authentication, Emails, Templates). Files: `docs/email-templates/supabase-<name>.html` and the subject in `supabase-<name>.subject.txt`:
   - Confirm signup: `supabase-confirm-signup`
   - Magic Link: `supabase-sign-in-code` (the sign-in code; the admin uses codes, not links)
   - Reset Password: `supabase-reset-password`
   - Change Email Address: `supabase-change-email`
   - Reauthentication: `supabase-reauthentication`
   These are bilingual because Supabase cannot tell which language the person uses.
3. **Optional (the fallback): Supabase SMTP** (Authentication, SMTP settings): Brevo's SMTP details, sender `no-reply@biztrack.bd`.
4. **Marketing project env**: the welcome email is sent from the signup, which runs in the marketing project. Add `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMS_PROVIDER` and the SMS key there too (the same values as the admin project), or new owners get no welcome email.
5. **Platform project env** sends the billing reminders (its cron): it already has the Brevo and SMS settings.
6. Apply migration `20261020000022_platform_messages` to Supabase before the code that uses it is deployed.
