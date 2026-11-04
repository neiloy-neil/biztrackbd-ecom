# User Journey Analysis

Labels: **[B]** browser-verified, **[S]** source-confirmed, **[H]** hypothesis. No analytics were available, so every "drop-off" below is a **hypothesis for validation**, never a measured rate. No journey was completed end to end in a live system (that would create real records), so completion feedback is read from source unless stated.

Finding IDs refer to `UX_AUDIT_REPORT.md`.

---

## J1. Visitor to registered merchant (marketing to signup)
- **Goal:** open a free store without risk.
- **Entry:** `biztrack.bd` home, a template card, or a pricing page.
- **Observed path [B]:** Home hero (one h1, primary CTA "Start 14-day free trial", reassurance "No card needed") → `/start` wizard "Step 1 of 4: Business & category" (store name, then a category list with Bangla sub-labels) → "Continue to Selling Channel →". Hidden fields carry plan, theme, UTM, `fbp`/`fbc`, so attribution survives. The wizard is a real form; step 1 was seen but not submitted.
- **Source path [S]:** steps continue to selling channel, owner details and plan/theme; owner sets a password at first sign-in, per the Oct report (not re-verified).

| Friction | Label | Ref |
|---|---|---|
| Step 1 button names the next step "Selling Channel", which is internal vocabulary | B | M-04 |
| Two audience modes (commerce vs business) share one hero | H | M-01 |
| Many near-identical template CTAs (View live demo / Try the admin / Use this template) | B / H | M-03 |
| Sticky CTA hides the third category until scroll | B | M-06 |
| Placeholder truncated | B | M-05 |

- **Failure scenarios:** duplicate store name or subdomain, flagged brand word (per Oct report a store can be quarantined and wait for review). The user-facing message and expected wait for a quarantined signup were not inspected. **Check this: a merchant who is silently held may leave.**
- **Completion feedback:** `/start/done` exists [S]; content not read.
- **Drop-off hypotheses [H]:** (1) after the template CTA choice on `/templates`; (2) at the category step if the user's business is not in the list; (3) between "done" and first sign-in, because the owner must go to a different host (`admin.biztrack.bd`) and set a password (see J2).
- **Recommended improvement:** rename the step button; reduce each template card to one primary CTA plus one text link; add an "Other" category; verify quarantined-signup messaging; instrument step-by-step funnel events before changing the order of steps.

## J2. First sign-in (email code, then password) to dashboard
- **Goal:** get into the new store.
- **Entry:** link after signup or `admin.biztrack.bd/login`.
- **Observed [B]:** login has email and password, a helper line "First time here, or forgot your password? Set up your password", and "New here? Open a free store". The first-time and forgot-password paths are merged into one link.
- **Friction:** no show-password toggle (AD-02); no `<main>` or skip link (AD-01); a first-time user who has no password yet must notice the small link under the button. **[H]** this is the likeliest first-visit stall, since the form invites a password the user has never created.
- **Failure scenarios:** wrong password message and lock-out wording were not tested.
- **Recommended improvement:** make "Set up your password" a visible secondary button for new owners (for example when arriving from signup with `?first=1`), add the password reveal control.

## J3. Dashboard to a completed task: process an order
- **Goal:** confirm, pack and ship today's orders, verify bKash/Nagad payments.
- **Entry:** Home or bottom bar "Orders" (badge for payments to check) [S].
- **Path [S]:** Orders list with tabs (check payment, risk, etc.) and filters → select rows or open one → bulk actions: pack, book courier, confirm, cancel with reason, print slips/invoices/KOT. A quick-view drawer avoids leaving the list. Payment checks surface as a pill and a "Verify payment" button on mobile cards.
- **Friction:**
  - Search needs Enter; no visible button (AD-14).
  - Bulk bar has eight controls in one cluster, with destructive "Cancel selected" and a preset reason beside safe actions; no confirmation step found in source (AD-13).
  - On phones there is no select-all (AD-15).
  - Native `confirm()` for deletes (AD-12).
- **Failure scenarios:** courier booking failure, duplicate submission. Duplicate submissions are guarded (`DoubleSubmitGuard`, "Booking…" pending labels). Error text for a failed courier booking was not inspected.
- **Completion feedback:** pending labels and a toast system [S]; success wording not reviewed.
- **Recommended improvement:** show a visible Search button; separate "Cancel" into an overflow menu with a confirm dialog that lists the count and requires a reason; add select-all to the mobile bulk bar.

## J4. Add a product
- **Goal:** publish a product with photos and price.
- **Path [S]:** Products → New → `products/editor.tsx` (1,320 lines): title, price (decimal keypad), photos with upload errors via `role="alert"`, URL name, category creation inline, AI copywriter helper, variants.
- **Friction:** no dirty-state or leave-page protection (AD-11), long single form (no sticky save bar in this editor), plan limit shows an error "See your plan" only after a failed save (`editor.tsx:188-190`), so a merchant at the limit learns after filling the form. Check whether the page warns earlier (the Oct report mentioned a "Products on your plan" meter on the list).
- **Recommended improvement:** sticky `SaveBar` with dirty state; warn about the plan limit before the form opens.

## J5. Customer: browse to cash-on-delivery order (storefront)
- **Goal:** buy a product and pay on delivery.
- **Entry:** shop home, category, product, or ad landing page (`/l/[slug]`).
- **Observed [B]:** the Kapor demo home at 375 px: three stacked promo or demo bars, a header with hamburger and cart, a hero with one CTA, a sticky "Call Now" bar plus a chat bubble. Empty `/checkout` offers one link back.
- **Source path [S]:** Cart → Checkout → one form: phone (first, with local format), name, optional email, division/district/upazila, address, optional AI paste, payment (COD, bKash, Nagad with sender number and TrxID), coupon, referral, loyalty points, order bumps → place order → `/order/[orderId]` tracking.
- **Strengths:** inline validation with focus to first error; correct `inputMode`/`autocomplete`; busy lock; server-side price recalculation; Bangla and English.
- **Friction:** the form combines many optional blocks (ST-07, H); custom-field errors are not announced (ST-05); stacked bars and a floating chat and call bar consume the small screen (ST-01, ST-02); two `h1` on checkout (ST-04).
- **Failure scenarios:** invalid phone, missing upazila, wrong TrxID format; each has a message in the form's `errorsText` map. A customer who has paid by bKash but typed a wrong TrxID is not blocked at submit if it matches the 8 to 12 pattern; the merchant verifies later. Do customers see "payment pending verification" clearly? Not inspected (`payment-recovery-card.tsx` exists).
- **Drop-off hypotheses [H]:** (1) at the payment step when the customer has not yet sent money and must leave the page to open bKash; (2) at coupon/referral/loyalty fields prompting detours; (3) on 3G if fonts and theme CSS delay the first render (ST-08). Validate with checkout step events and real-device throttling.
- **Recommended improvement:** collapse coupon, referral and loyalty under one "Have a code?" control; announce custom-field errors; test removing the floating chat bubble on the checkout route.

## J6. Merchant subscription and payment
- **Goal:** keep the store online after trial.
- **Path [S]:** trial card in the sidebar ("N days left", progress bar, "Choose a plan") → `/billing` → bKash proof for the plan → platform staff approve → store ACTIVE. Banners escalate: trial ends in 3 days, renewal in 3 days, grace (read-only warning), read-only (`layout.tsx:200-210`). Non-owners are told "Ask the store owner".
- **Strengths:** early, escalating, plain-language warnings; read-only mode still lets the merchant view and download data.
- **Friction:** the "N days left" and banners are English-only (AD-10); payment approval is manual, so the time between "I paid" and "store active" depends on staff response. **[H]** the merchant is anxious during that wait; check whether the UI shows an expected time.
- **Recommended improvement:** show "Payment received, we are checking it (usually within X)" with a real SLA from operations; translate banners.

## J7. Platform staff: approve a payment or release a flagged store
- **Goal:** clear pending items fast.
- **Source [S]:** platform nav of 15 flat items; "Payments and plans", "Tenants", "Inquiries", "Support tickets". Approval of a flagged store needs a note; without it the page shows the reason in an alert (per Oct report).
- **Friction:** combined nav labels (PL-01); no empty states or skeletons (PL-03); light-only theme (PL-02).
- **Not assessed:** the rendered tenant detail, payment queue and triage speed. Needs staff walkthrough.

## J8. Demo to "Keep this store"
- **Goal:** try the admin without signup, then convert.
- **Source [S] (`docs/41-demo-admin-plan.md`):** one click creates a private temporary store (3 hours, 50 at once), a banner shows the countdown and "Keep this store" carries the catalogue into a real trial.
- **Friction hypotheses [H]:** a "demo is busy, try again" message at the 50-store cap loses the visitor; the countdown may create pressure or confusion; converting requires the normal signup (the product copies products, not orders).
- **Not assessed:** the demo itself (starting one would create a live record). Walk it with a test user before changing it.

## J9. Error recovery
- **Page errors [S]:** each app has route and global error boundaries. Admin: "Something went wrong on our side. Your orders and products are safe." with Try again, Dashboard and Orders links and a support code. Good.
- **Form errors:** standard storefront fields good; custom fields weak (ST-05); admin editor shows an error banner `role="alert"` with a plan link.
- **Offline:** `/offline` route exists in the storefront and the admin registers a service worker (`PwaRegister`); behaviour not tested.
- **Not-found:** `not-found.tsx` in all four apps; text not reviewed.

---

## Summary of highest-risk journey points
| Rank | Point | Why | Label |
|---|---|---|---|
| 1 | Losing edits in long admin forms (J4) | Silent data loss, no guard | S |
| 2 | Bulk cancel next to safe actions (J3) | Mass action with no confirmation found; reversibility unchecked | S; try in browser |
| 3 | First-time owner meets a password form (J2) | Possible stall at activation | H |
| 4 | Bangla-speaking merchant gets English pages (J6, J3) | Core audience mismatch | S |
| 5 | Checkout optional blocks and floating bars (J5) | Possible mobile completion loss | H |
