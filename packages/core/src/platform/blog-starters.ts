/**
 * The two guides that ship with the site. They are seeded into PlatformBlogPost (packages/db/scripts/seed-blog-starters.ts) so staff
 * edit them in Platform Admin like any other post, and the marketing site shows them as a fallback if the database cannot be read.
 * No dependencies on purpose: the seed script imports this file directly.
 *
 * Body format: a blank line ends a paragraph, a line starting "## " is a heading, [text](/path) is a link, and a line that is only
 * ![alt text](/blog/picture.svg) is a picture. Product facts here come from the feature pages on the site; money figures are examples.
 */
export interface StarterBlogPost {
  slug: string;
  title: string;
  description: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export const STARTER_BLOG_POSTS: StarterBlogPost[] = [
  {
    slug: "stop-cod-return-fraud-bangladesh",
    title: "How to stop COD return fraud in Bangladesh",
    description:
      "Refused cash-on-delivery parcels cost you the courier fee and the return trip. Here is a practical way to screen COD orders before you ship.",
    ctaLabel: "Try the free courier fraud checker",
    ctaHref: "/tools/courier-fraud-checker",
    body: `Cash on delivery is how most Bangladeshi customers prefer to pay, and it is also how online sellers lose money. A parcel that is refused at the door still costs you the delivery charge, the return charge and the days the stock was out of reach. For a small shop, a few refused parcels a week can erase the profit on everything else you sold.

The good news is that most refusals can be predicted. This guide explains what a refused parcel really costs, why COD orders get refused, and a four-step routine that stops most of them before you pack the box.

## What one refused parcel really costs

It is easy to think of a refusal as a lost sale. It is worse than that, because you pay for the parcel to go out and again to come back.

![The four costs of one refused COD parcel: outbound delivery, return shipping, stock stuck in transit, and the ad money spent to win the order](/blog/cod-refusal-costs.svg)

Couriers charge the full outbound delivery fee, and they usually charge part of the fee again when the parcel returns. Your product then sits in a courier van or return hub for days, so you cannot sell it to a genuine buyer. If the order came from a Facebook or Instagram ad, the money you paid for that click is gone too. And boxes, polybags and seals get scuffed in transit, so you may have to repack at your own expense.

Here is a simple example, not a benchmark. Suppose the round trip costs about Tk 140 in courier fees. If you ship 300 COD orders a month and 15 in every 100 come back, that is 45 parcels and Tk 6,300 in courier fees alone, before you count the stock that was stuck or the ad spend. Your own numbers will differ, but the shape is the same: a modest return rate takes a large bite out of a small margin.

## Why COD orders get refused

Some refusals are honest. The customer changed their mind, was not home, or could not gather the cash in time. Others are deliberate: prank orders, competitors placing fake orders to waste your courier fees, and repeat buyers who refuse every parcel they order.

Either way, the seller pays. Sellers who book couriers by hand rarely notice a pattern until the returns pile up, because each courier shows you only your own parcels. A customer who refused five parcels from other shops looks exactly like a new customer on your order list.

## The four-step routine

The idea is to spend a few seconds of checking on every order and a few minutes of effort only on the orders that look risky.

![Four steps to screen a COD order: check delivery history, ask for an advance if risky, confirm by phone, then book the courier from the order](/blog/cod-screening-flow.svg)

### Step 1: Check the customer's delivery history

Couriers such as Steadfast, Pathao and RedX keep a record of how many parcels a phone number has received, returned or refused. A number with many refusals and few deliveries is a risk, even if this is its first order with you. A number that accepted nearly every parcel is a customer you can ship to with confidence.

You can check a single number with the [free courier fraud checker](/tools/courier-fraud-checker). If you take more than a handful of orders a day, [COD fraud protection](/features/cod-fraud-protection) runs the check automatically when the order arrives and shows a plain badge: Safe, Review or High Return Risk. It never cancels an order for you. The decision stays with you, which is how it should be.

### Step 2: Ask for a small advance on risky orders

For an order that looks risky, ask for a small bKash or Nagad payment up front, usually just the courier fee. A customer who has paid part of the price is far less likely to refuse the parcel, and the advance covers your cost if they do. It also tells you the buyer is real, because a prank order rarely survives a request for money.

Keep the request polite and consistent so genuine customers do not feel singled out. Something like "To confirm your order we take the delivery charge in advance through bKash" works, and you can send the same message to everyone flagged. When the advance arrives, [match the TrxID against the order](/blog/verify-bkash-nagad-trxid-orders) before you confirm it.

### Step 3: Confirm by phone or WhatsApp

A short call or message to confirm the address, the product and the total removes most accidental refusals. Ask the customer to repeat the delivery area and the amount they will pay on delivery.

Write the outcome on the order, such as "confirmed", "no answer" or "asked to cancel". Over a few weeks the same phone numbers and addresses start to repeat, and your notes tell you who to stop shipping to.

### Step 4: Book the courier from the order

Wrong addresses and mistyped phone numbers cause a share of failed deliveries, and the usual source is copying details from your order list into the courier website by hand. Booking [Steadfast, Pathao and RedX pickups](/couriers) directly from the order removes that copy-and-paste step, and the customer's division, district and area stay consistent from checkout to the rider's phone.

## What not to do

Do not post customers' names and numbers in public groups or call them thieves. Naming people publicly can expose you to legal trouble, and a delivery record is evidence of a pattern, not proof of intent. Treat the history as a reason to ask for an advance, not as a verdict.

Do not cancel every flagged order automatically either. A first-time buyer with no history is not a fraudster. Reserve the strictest rules for numbers with a clear pattern.

## A weekly habit that keeps returns down

Once a week, open your returned parcels and look for what they have in common. Look at the phone numbers, the delivery areas, the products and the ad campaigns they came from. If most returns come from one campaign, the ad is attracting the wrong audience. If they come from one product, the photos or the price may be misleading. If they come from one courier or area, try another courier for those orders.

To see whether it pays off, track your real profit per order after courier fees and returns, which the [profit and COD reconciliation tools](/features/profit-cod-reconciliation) do for you.

## Will an advance scare away real customers?

Some will hesitate, and that is acceptable. Most genuine customers understand that sellers lose money on refused parcels, especially when you explain it in one friendly sentence. Applying the advance only to orders flagged as risky keeps the friction away from your good customers.

## Put it together

A simple routine works for most shops: check the number's history, ask for an advance on risky orders, confirm by phone, then book the courier from the order. Each step is cheap, and together they cut the parcels that come back. You can try the first step right now with the free checker, and when you are ready to run all four on every order, [start a free 14-day trial](/start). No card is needed.`,
  },
  {
    slug: "verify-bkash-nagad-trxid-orders",
    title: "Verify bKash and Nagad TrxID payments on orders",
    description:
      "Customers say they have paid and send a screenshot. Matching the TrxID against the order is faster and safer than scrolling through screenshots.",
    ctaLabel: "See bKash and Nagad checkout",
    ctaHref: "/features/bkash-nagad-cod",
    body: `When customers pay a seller's personal or merchant bKash or Nagad number, the proof of payment is a TrxID. Sellers who run their shop from Facebook messages often end up comparing screenshots with their wallet by hand, which is slow, tiring and easy to get wrong. One missed mismatch and you have shipped a parcel that was never paid for.

This guide explains what a TrxID proves, the mistakes that cost sellers money, and a routine that confirms payments in seconds instead of minutes.

## What a TrxID is, and what it proves

Every bKash and Nagad payment has a unique transaction ID, called the TrxID. It is created when the money moves and it appears in both the sender's and the receiver's transaction history. That makes it the one piece of evidence that does not depend on a picture.

If the TrxID a customer gives you appears in your own wallet history, for the right amount and from the right sender, the payment is real. If it does not appear, the payment has not reached you, whatever the screenshot looks like. That single rule, check the TrxID against your wallet and not against the image, is the foundation of everything below.

## Why screenshots are not enough

Screenshots are the default proof in chat orders, and they are unreliable for three reasons. They can be edited with a free app in a minute. They tell you nothing about whether the money reached your number. And they pile up in message threads, so the screenshot for order 41 is hard to find when you finally pack order 41.

![Screenshot proof compared with TrxID matching: a screenshot can be edited and is hard to search, while a TrxID is a unique code you can match against your wallet](/blog/trxid-vs-screenshot.svg)

## The mistakes that cost sellers money

**A reused TrxID.** A dishonest customer sends the TrxID of a real payment they made to someone else, or the same TrxID for two orders. If you do not check whether you have seen it before, both orders look paid.

**The wrong amount.** The customer pays Tk 1,000 for a Tk 1,450 order, or pays before you added delivery. The TrxID is real, but the order is not fully paid.

**The wrong number.** The customer sends the money to a number that is one digit off. The TrxID is genuine, but the money never reached you. Always check the receiving number as well as the code.

**A pending or failed payment.** Occasionally a payment appears in the customer's app before it settles, or never settles. Confirm on your side, not theirs.

**Delay.** The longer you wait to verify, the more orders pile up and the more likely you are to pack first and check later.

## A routine that takes seconds

The cleanest approach is to make the TrxID part of the order rather than part of the chat. When the customer pays, they enter the TrxID in the checkout form, so it is stored with the order.

![Four steps to verify a payment: the customer pays your wallet, enters the TrxID at checkout, you match it against your wallet history, then confirm the order](/blog/trxid-verification-flow.svg)

With [bKash and Nagad checkout](/features/bkash-nagad-cod), the customer sends money to the wallet number shown at checkout and types the TrxID into the form. The order then appears in your admin with the TrxID highlighted, and you confirm it in one tap after matching it. Because the code is stored on the order, you also keep a record of what was paid and when, which settles disputes quickly.

When you match a payment, check four things every time: the TrxID exists in your wallet history, the amount equals the order total, the sender number is plausible for that customer, and the code has not been used on another order. If all four pass, confirm. If any fails, do not pack the box. Message the customer and ask them to check their payment.

## What to say when a payment does not match

Keep it short and friendly. For example: "We could not find this TrxID in our wallet. Could you check the code and the number you sent to?" Most mismatches are typing mistakes, and an honest customer will fix them straight away. A customer who disappears or sends a second suspicious screenshot has told you what you need to know.

Never ask for a customer's PIN or one-time code, and never share your own. Verifying a payment needs only the TrxID, the amount and your own statement.

## Personal wallet or merchant wallet?

Many growing sellers start with a personal bKash or Nagad number and move to a merchant account later. Either works with this routine. The wallet you use matters less than keeping the checking habit, so choose whichever fits your volume and move up when you are ready.

## Keep the money in your own wallet

When customers pay your wallet directly, the money arrives immediately and you can spend it the same day. There is no payout delay and no platform taking a percentage of each sale. Platforms and gateways that collect payments for you usually charge a percentage and pay out later, so compare their rates with a flat monthly plan, as in our [Shopify comparison](/compare/shopify). BizTrackBD charges a flat monthly plan, shown on the [pricing page](/pricing), and takes 0% of your sales.

## Reconcile once a day

Even with good checks, set aside five minutes at the end of each day. Open your wallet statement and your list of orders marked paid, and tick each payment off against an order. Anything in the wallet without an order is either a customer who forgot to enter the TrxID or a payment for an order you have not seen yet. Anything marked paid without a wallet entry needs urgent follow-up before it ships.

A daily check keeps small errors from growing into a month-end mystery. It also makes your accounts easier to prepare, since the [profit and reconciliation tools](/features/profit-cod-reconciliation) can build on records that are already clean.

## Combine it with a fraud check for COD

A fully paid order is safe to ship, but cash on delivery is where returns happen. For COD orders, pair TrxID matching with a check of the customer's delivery history and, for risky orders, a small advance paid by bKash or Nagad, as described in our guide to [stopping COD return fraud](/blog/stop-cod-return-fraud-bangladesh). The advance is verified with the same TrxID routine, so you only need to learn one habit.

## Put it together

Treat the screenshot as a courtesy and the TrxID as the proof. Have customers enter it at checkout, match it against your own wallet for the amount, the number and uniqueness, confirm in one tap, and reconcile once a day. You can see how it looks in the [live demo](/demo), or [start a free 14-day trial](/start) and take your first order this week. No card is needed.`,
  },
];
