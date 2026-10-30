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
  {
    slug: "shopify-vs-local-platform-bangladesh",
    title: "Shopify or a local platform for Bangladesh?",
    description:
      "Selling inside Bangladesh with COD, bKash and local couriers? Here are the four things to compare before you pick Shopify or a local store platform.",
    ctaLabel: "See the full Shopify comparison",
    ctaHref: "/compare/shopify",
    body: `Shopify is one of the best-known store builders in the world, so it is natural to start there. But a platform built for global selling does not always fit a shop that sells inside Bangladesh, collects cash on delivery and ships with Steadfast or Pathao. The right choice depends on who your customers are and how they pay.

This guide gives you four things to compare, in the order they usually matter, so you can decide with numbers from your own shop instead of guesses.

## First, decide who you sell to

If most of your customers are outside Bangladesh, pay with international cards and expect delivery by global carriers, Shopify's strengths line up with your needs. Global checkout, foreign currencies and overseas dropshipping apps are what it was built for.

If most of your customers are inside Bangladesh, the picture changes. They pay with cash on delivery, bKash or Nagad, they give a division, district and area rather than a postal code, and your parcels travel with a local courier. Everything below is written for this second kind of seller.

## Four things to compare

![Four things to compare before choosing a store platform for Bangladesh: total monthly cost in taka, local payments, courier booking, and COD fraud protection](/blog/platform-compare-four.svg)

### 1. The real monthly cost in taka

Do not compare the headline plan price alone. Add up everything you will pay each month: the plan, any apps you need for Bangladesh, and any fee taken from each sale. Then convert it to taka.

Shopify bills in US dollars, so you need an international card that can pay in dollars, and your card's limits and your bank's charges apply. Local platforms usually bill in taka and accept bKash or Nagad for the subscription. Also check whether the platform takes a percentage of every sale. A platform that charges 0% commission keeps more of each order, which matters more as you grow. BizTrackBD takes 0% of your sales and bills a flat monthly plan, shown on the [pricing page](/pricing). Check Shopify's own pricing page for its current plans, transaction fees and the payment options it supports in Bangladesh, because these change.

### 2. How customers pay

Ask a simple question: can a customer pay the way they actually pay today, without a workaround? For most Bangladeshi shops that means cash on delivery, bKash and Nagad. Look at whether the platform lets customers pay straight to your own wallet and enter a TrxID that you can confirm, or whether it expects a card gateway you would have to set up separately. Paying your own wallet means the money arrives immediately, with no payout delay. The [bKash and Nagad checkout](/features/bkash-nagad-cod) works this way, and [our TrxID guide](/blog/verify-bkash-nagad-trxid-orders) shows how to check each payment.

### 3. How you book couriers

Count how many steps it takes to get an order into a courier's system. Without an integration you copy the name, phone number, address and amount into the courier's website for every order, and typing mistakes there cause failed deliveries. Look for a platform that books pickups directly from the order with your own courier account, so you keep your own rates. See how that works in [booking Steadfast, Pathao and RedX from your orders](/blog/connect-steadfast-pathao-redx-courier-api).

If you stay on a global platform, you may need extra apps for COD confirmation, courier booking and SMS. Each has its own subscription, usually priced in dollars, so add them to the cost in step one.

### 4. Protection against refused COD parcels

Cash on delivery is where Bangladeshi sellers lose money. Ask whether the platform shows you a customer's delivery history before you ship, and whether it can ask for an advance on risky orders. This feature is rare on global platforms and usually needs an add-on. Our guide to [stopping COD return fraud](/blog/stop-cod-return-fraud-bangladesh) explains the routine, and [COD fraud protection](/features/cod-fraud-protection) automates it.

## Check the checkout your customers will see

Open the platform's demo checkout on your phone, and fill it in as a customer from outside Dhaka would. Does it ask for a postal code your customer may not know? Can they pick their division, district and area from a list? Is the page quick on a mobile data connection? A checkout that confuses people loses orders you never see.

## Moving is easier than it sounds

Many sellers stay on a platform because switching feels risky. In practice, the main data is your product catalogue and photos. You can export your products as a CSV file from Shopify and import them into a local platform. The [Shopify migration guide](/migrate/shopify) shows each step, including how to keep your domain.

## A simple way to decide

Write down your last month's orders and answer three questions. How many were cash on delivery? How many came back? How much did you pay in fees and apps? If most orders are domestic and a good share are COD, a local platform with built-in payments, courier booking and fraud checks will likely save you both money and time. If you mainly export, stay with a global platform.

Whichever you choose, test before you commit. You can try the [live demo](/demo), or [start a free 14-day trial](/start) with no card, and compare it against your current shop on real orders.`,
  },
  {
    slug: "connect-steadfast-pathao-redx-courier-api",
    title: "Connect Steadfast, Pathao and RedX to your store",
    description:
      "Stop copying orders into courier websites. Here is how to connect your courier accounts once and book pickups, labels and tracking from each order.",
    ctaLabel: "See courier automation",
    ctaHref: "/couriers",
    body: `Every order you copy into a courier website by hand is a chance for a typo: a wrong phone digit, a misspelled area or the wrong amount to collect. Each mistake can become a failed delivery, and failed deliveries cost money. Connecting your courier accounts to your store once removes that copying step for good.

This guide explains what a courier connection does, how to set one up for Steadfast, Pathao and RedX, and what to check before you book your first parcel.

## What a courier connection does

A courier connection lets your store talk to your own courier merchant account. When you confirm an order, you book the pickup from the order screen. The store sends the customer's name, phone number, address and cash to collect to the courier, and gets back a consignment number it saves on the order.

![Four steps to automate courier booking: connect your keys once, check the order's risk, book the pickup from the order, then print the label and send the tracking SMS](/blog/courier-booking-flow.svg)

Because you connect your own merchant account, you keep your own rates and your own relationship with the courier. The store only acts on your behalf.

## Before you start

You need a merchant account with each courier you want to use, and you need to be able to sign in to its merchant portal. You will also need your pickup location saved in that portal, because the courier needs to know where the rider collects the parcel.

Treat your keys like passwords. Anyone who has them can book parcels on your account. Do not post them in chats, and never paste them into a website you do not trust. In BizTrackBD, keys are encrypted and are used only to request pickups for you.

## Connect Steadfast

Sign in to the Steadfast merchant portal and open its API or developer settings, where it shows an API key and a secret key. Copy both. In your store admin, open the courier settings, choose Steadfast and paste them in. Save, then book a test parcel to confirm the connection works. Steadfast is popular for deliveries outside Dhaka and for regular remittances of the cash it collects.

## Connect Pathao

Sign in to the Pathao merchant panel and generate your API credentials there. Paste them into the Pathao section of your store's courier settings, then choose your default store pickup location, such as the hub or address you ship from. Pathao is often preferred for fast deliveries inside Dhaka.

## Connect RedX

Sign in to your RedX merchant account and open Settings, then the developer section, and generate a production token. Paste it into the RedX section of your courier settings. RedX suits high-volume stores that ship nationwide.

The exact menu names change as couriers update their portals, so if a name differs, look for the section that shows API keys or developer tokens. If you get stuck, our team can [help over WhatsApp](/contact) with screenshots.

## Test with one parcel first

Before you rely on a new connection, book one real parcel to a friend or to your own address. Check that the name, phone number, address and amount to collect appear correctly in the courier's portal, that the consignment number is saved on the order, and that the label prints at a readable size. A five-minute test saves you from discovering a wrong setting in the middle of a busy day, when a whole batch of parcels could go out with the wrong pickup location.

## Check the order before you book

Booking is fast, which is exactly why you should check first. Look at the customer's delivery history before you book a cash-on-delivery parcel. A number that has refused many parcels is a risk. For those orders, ask for a small advance by bKash or Nagad, or confirm by phone, before you ship. Our guide to [stopping COD return fraud](/blog/stop-cod-return-fraud-bangladesh) has the full routine, and [COD fraud protection](/features/cod-fraud-protection) shows the risk on the order itself.

## Book, print and tell the customer

Once the order is confirmed, book the pickup from the order screen. The store creates the consignment, and you can print a standard 4 by 6 inch label to stick on the parcel. Then send the customer a message with a tracking link so they know the parcel is on its way. Customers who know a parcel is coming are far more likely to be home and to have the cash ready, which raises your delivery rate.

## Keep addresses clean

Many failed deliveries come from vague addresses. A checkout that makes customers choose their division, district and area from a list sends the courier clean data and avoids most routing mistakes. Combine that with a quick phone confirmation for orders from outside the main cities.

## Review your couriers every month

Do not assume one courier is best forever. Once a month, compare how many parcels each courier delivered and returned, how quickly cash reached you, and how much each cost you. Many sellers use one courier for Dhaka and another for other districts. Because you hold your own accounts, you can change the default for different areas, and the [profit tools](/blog/calculate-profit-per-cod-order-bangladesh) show whether a courier's return rate is hurting your margin.

## Ready to try it

Connecting takes a few minutes per courier. [Start a free 14-day trial](/start) with no card, connect one courier, and book a test parcel so you know the flow before your next busy day.`,
  },
  {
    slug: "calculate-profit-per-cod-order-bangladesh",
    title: "How to calculate your real profit per COD order",
    description:
      "Sales are not profit. Learn to subtract product cost, courier fees, packaging, ads and returns to find what each COD order really earns you.",
    ctaLabel: "See profit and COD reconciliation",
    ctaHref: "/features/profit-cod-reconciliation",
    body: `A busy week of orders feels like success, but busy is not the same as profitable. Many online sellers in Bangladesh only find out their real margin at the end of the month, when the cash in their hands is smaller than the sales they recorded. The gap is made of costs that never show up on the order list.

This guide shows how to work out what each cash-on-delivery order really earns you, with a simple worked example, and how to use the result to decide what to sell, advertise and ship.

## The formula

True profit per order is what the customer pays minus everything it cost you to earn that sale.

![The profit formula: sale price, minus product and packing cost, minus courier and ad cost, minus a share of return losses, equals true profit](/blog/profit-formula.svg)

Written out, you start with the sale price and subtract your product cost, packaging, the courier fee, the advertising cost to get the order, and a share of what you lose on returned parcels. What is left is your true profit. The rest of this guide explains each part.

## Step 1: Know your product cost

Use what you actually paid per unit, including anything you paid to bring the stock to your shop such as transport. If you buy in bulk at different prices, use an average. Many sellers guess this number, and a guess that is off by a few percent can hide a loss. Put the cost of every product in one list, or import it as a spreadsheet, so it applies to every order automatically.

## Step 2: Add packaging

A box, polybag, tape, a seal and a printed label cost little per parcel, but they repeat on every order. Estimate the average per parcel and include it. If you use branded packaging, include that too.

## Step 3: Add the courier fee

Add the outbound delivery charge you pay the courier. For cash on delivery, remember that the courier may also charge a fee on the cash it collects, so check your agreement. Costs differ between couriers and between Dhaka and other districts, so use the figure for the usual route of that order.

## Step 4: Add your ad cost per order

If an order came from a paid ad, divide what you spent on the ad by the orders it produced to get the cost per order. This is the number that decides whether an ad is working. An ad with many clicks and a cost per order higher than your profit is losing money, however busy it looks.

## Step 5: Share the cost of returns

Returns are the hidden part. Every refused parcel costs you the courier fees both ways, plus the ad money you spent to win it. Spread that loss across your orders. If one in ten parcels returns, one tenth of your orders carry that loss, so a profit that looks fine on a delivered order can disappear once you include it. Our guide to [stopping COD return fraud](/blog/stop-cod-return-fraud-bangladesh) shows how to bring that rate down.

## A worked example

This is an illustration, not a benchmark. Suppose you sell a product for Tk 1,600. The product costs you Tk 800 and packaging adds Tk 30. The courier fee is Tk 130, and the ad cost per order is Tk 200. On paper that leaves Tk 440, which sounds healthy.

Now include returns. Suppose one parcel in ten returns, and each return costs you about Tk 260 in courier fees both ways, which is Tk 26 per order when spread across all orders. Your true profit falls to about Tk 414. If your return rate is one in five, the share doubles to Tk 52, and true profit is about Tk 388. The same product can look very different depending on how many parcels come back.

## Use the result to make decisions

When you know the true profit of each product, three things get easier. You can see which products make real money and which only create packing work. You can set a maximum you are willing to pay for an order from ads, because you know your profit before advertising. And you can see which delivery areas or couriers return more parcels, and change how you ship to them.

## Check that couriers paid you in full

Profit on paper only becomes profit when the cash arrives. Couriers collect cash on your behalf and send it to you in batches. Match each settlement statement against your delivered parcels, and look for parcels that were delivered but not paid. This is tedious by hand, which is why [profit and COD reconciliation](/features/profit-cod-reconciliation) does the matching for you and flags anything missing.

## Make it a routine

Once a month, recalculate for your best-selling products, because costs and ad prices change. Keep your records clean and in one place. When your accountant or a partner asks for numbers, you can export them instead of rebuilding them. To try this on your own orders, [start a free 14-day trial](/start). No card is needed.`,
  },
];
