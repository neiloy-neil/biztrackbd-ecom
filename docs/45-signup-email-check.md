# Opening a store now starts with confirming the email (13 October 2026)

Before this, a store was created from an email address alone: nobody proved the address was theirs, and the "Go to my admin" button sent people to the sign-in page with nothing to sign in with. Now:

1. **You**: name, email, mobile. Pressing Next sends a 6-8 digit code to the email (BizTrackBD's own email, Supabase's as fallback).
2. **Confirm your email**: type the code and choose a password (10+ characters). A person who already has a BizTrackBD login leaves the passwords empty and the new store joins their account.
3. The remaining steps (store, address, template and plan, create) are unchanged. **Nothing is created until the email is confirmed.**
4. The done page links to the admin **sign-in** page. Sign in with the email and password just chosen. Nobody is signed in on anyone's behalf any more (the old `start-pass` ticket is no longer issued).

## How it is enforced
- The code check ends in a signed, one-hour note that this email was confirmed (`createEmailProof`). `signupAction` refuses a request without a valid note for exactly that email, so the server rejects a store from an unconfirmed address even if the screen is skipped.
- A code is limited per connection and per address; wrong tries are limited too.
- Stores made earlier from an email alone are kept. Their owner signs in with "set up your password" on the admin sign-in page, which needs a code sent to that email, so only the real owner gets in.
- Local development and the automated browser tests can switch the check off with `SIGNUP_VERIFY=off`. It is ignored in production.

## What must be set on the **marketing** Vercel project before this is deployed
Without these, no code can be made or sent and nobody can open a store:
- `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`
- a signing secret of 32+ characters: `SIGNUP_SECRET` (or `CUSTOMER_AUTH_SECRET`)

`node tools/make-vercel-env.mjs` then `node tools/vercel-load-env.mjs --yes --apps marketing` loads the Supabase and email values (see docs/43).
