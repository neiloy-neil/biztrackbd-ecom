export type BlogSection = { heading: string; body: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  published: string;
  intro: string;
  sections: BlogSection[];
  cta: { label: string; href: string };
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "stop-cod-return-fraud-bangladesh",
    title: "How to stop COD return fraud in Bangladesh",
    description:
      "Refused cash-on-delivery parcels cost you the courier fee and the return trip. Here is a practical way to screen COD orders before you ship.",
    published: "2026-10-30",
    intro:
      "Cash on delivery is how most Bangladeshi customers prefer to pay, and it is also how sellers lose money. A parcel that is refused at the door still costs you the delivery charge, the return charge and the days the stock was out of reach.",
    sections: [
      {
        heading: "Why COD orders get refused",
        body: [
          "Some refusals are honest: the customer changed their mind, was not home or could not gather the cash. Others are deliberate, such as prank orders, competitors placing fake orders, or repeat buyers who refuse every parcel.",
          "Either way the seller pays. Sellers who book couriers by hand rarely notice a pattern until the returns pile up.",
        ],
      },
      {
        heading: "Check the customer's delivery history before you ship",
        body: [
          "Couriers such as Steadfast, Pathao and RedX keep a record of how many parcels a phone number received, returned or refused. A number with many refusals and few deliveries is a risk, even if this is its first order with you.",
          "Checking that history before you book the pickup takes seconds and is the single most effective screen. You can try it with the free courier fraud checker, or have it run automatically on every order.",
        ],
      },
      {
        heading: "Ask for a small advance on risky orders",
        body: [
          "For orders that look risky, ask for a small bKash or Nagad payment up front. A customer who has paid part of the price is far less likely to refuse the parcel, and the advance covers your courier cost if they do.",
          "Keep the request polite and consistent so genuine customers do not feel singled out.",
        ],
      },
      {
        heading: "Confirm by phone, then keep a record",
        body: [
          "A short call or WhatsApp message to confirm the address and order removes most accidental refusals. Note the outcome against the order so repeat offenders are easy to spot later.",
        ],
      },
    ],
    cta: { label: "Try the free courier fraud checker", href: "/tools/courier-fraud-checker" },
  },
  {
    slug: "verify-bkash-nagad-trxid-orders",
    title: "Verify bKash and Nagad TrxID payments on orders",
    description:
      "Customers say they have paid and send a screenshot. Matching the TrxID against the order is faster and safer than scrolling through screenshots.",
    published: "2026-10-30",
    intro:
      "When customers pay a seller's personal or merchant bKash or Nagad number, the proof is a TrxID. Sellers who run their shop from Facebook messages end up comparing screenshots with their wallet by hand, which is slow and easy to get wrong.",
    sections: [
      {
        heading: "What a TrxID tells you",
        body: [
          "Every bKash and Nagad payment has a unique transaction ID. If the TrxID a customer gives you appears in your wallet history for the right amount, the payment is real. If it does not, do not confirm the order.",
        ],
      },
      {
        heading: "Common mistakes",
        body: [
          "Screenshots can be edited, so never confirm an order from an image alone. Also watch for a TrxID that was already used on another order, and for payments that are for a different amount than the order total.",
        ],
      },
      {
        heading: "Put the TrxID next to the order",
        body: [
          "The cleanest approach is to have the customer enter the TrxID at checkout so it is stored on the order. You then compare one field against your wallet statement and confirm the order, with a record of who confirmed it and when.",
          "Because the money goes straight to your own wallet, there is no payout delay and no platform commission on your sales.",
        ],
      },
    ],
    cta: { label: "See bKash and Nagad checkout", href: "/features/bkash-nagad-cod" },
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
