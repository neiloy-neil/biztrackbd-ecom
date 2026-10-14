import { z } from "zod";

export const PAYMENT_METHODS = ["COD", "MANUAL_BKASH", "MANUAL_NAGAD", "MANUAL_ROCKET", "GATEWAY_UDDOKTAPAY"] as const;

export const CreateOrderInput = z.object({
  idempotencyKey: z.string().min(8).max(100),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().min(10).max(20),
    email: z.string().email().optional(),
  }),
  shipping: z.object({
    address: z.string().trim().min(5).max(300),
    city: z.string().trim().min(1).max(80),
    district: z.string().trim().min(1).max(80),
    division: z.string().trim().min(1).max(80),
    postalCode: z.string().max(10).optional(),
  }),
  // Client-sent prices are never read. Only ids and quantities.
  items: z.array(z.object({
    variantId: z.string().min(8),
    quantity: z.number().int().min(1).max(50),
    bundleId: z.string().optional(),
    bundleTitle: z.string().optional(),
    isBump: z.boolean().optional(),
  })).min(1).max(50),
  bundleId: z.string().optional(),
  bumpIds: z.array(z.string()).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default("COD"),
  mfs: z.object({ senderNumber: z.string(), trxId: z.string() }).optional(),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().max(500).optional(),
  channel: z.string().default("STOREFRONT"),
  createdByUserId: z.string().optional(),
  /** Shown on the order timeline for staff-keyed orders. */
  createdByName: z.string().max(120).optional(),
  /** Staff only (quick order desk): the money is already in. The order starts as paid, TrxID optional. */
  alreadyPaid: z.boolean().optional(),
  /** Taka off, worked out by a trusted server from a landing page's deal (placeLandingOrder). Never taken from a browser: the storefront builds the order itself. */
  offerDiscount: z.number().min(0).max(10_000_000).optional(),
  utmSource: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  /** Set by placeLandingOrder: the landing page this order came from. */
  landingPageId: z.string().max(64).optional(),
  /** Loyalty points to spend, in whole blocks. Only honoured with `verifiedCustomerId`. */
  redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
  /** A friend's code (REF-...). Needs no sign-in: the friend is new by definition. */
  referralCode: z.string().trim().max(40).optional(),
  /** Set ONLY by a server that has verified the customer's sign-in (the storefront from its session cookie). Unlocks the VIP discount and spending points. */
  verifiedCustomerId: z.string().max(64).optional(),
  /** A keyed hash of the buyer's address (see hashClient), set by the storefront. Never a raw address. Used only to refuse a referral from the referrer's own connection. */
  clientHash: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type CreateOrderInput = z.input<typeof CreateOrderInput>;
