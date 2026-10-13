import { z } from "zod";
import { ValidationError } from "../errors";

/**
 * What a landing page sells (docs/46). A page has one or more OPTIONS the customer picks between, and optionally one ORDER BUMP, a small
 * extra offered above the button. An option is a product, how many of it, and a deal on that line:
 *   - one product:           a single option (the customer picks the variant and a quantity)
 *   - a choice of products:  several options with different products
 *   - quantity deals/bundles: several options of the same product, "1 piece", "2 pieces: save ৳200", each with a fixed quantity
 * Prices always come from the database; the deal is a percentage or a taka amount off that line, never a price typed into the page.
 */

export const DEAL_KINDS = ["none", "percent", "amount"] as const;
const text = z.string().trim().max(80);

export const OfferOption = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  label: text.min(1),
  labelBn: text.optional(),
  productId: z.string().min(8).max(64),
  /** Fixed pieces for a bundle or quantity deal. Absent means the customer chooses 1 to 5. */
  quantity: z.number().int().min(1).max(20).optional(),
  deal: z.object({ kind: z.enum(DEAL_KINDS), value: z.number().min(0).max(1_000_000) }).default({ kind: "none", value: 0 }),
});
export type OfferOption = z.infer<typeof OfferOption>;

export const OrderBump = z.object({
  productId: z.string().min(8).max(64),
  variantId: z.string().min(8).max(64),
  label: text.min(1),
  labelBn: text.optional(),
  /** Percent off the extra item, 0 to 90. */
  percentOff: z.number().min(0).max(90).default(0),
});
export type OrderBump = z.infer<typeof OrderBump>;

export const LandingOffers = z
  .object({ options: z.array(OfferOption).min(1).max(6), bump: OrderBump.nullable().optional() })
  .superRefine((o, ctx) => {
    const ids = new Set<string>();
    for (const [i, op] of o.options.entries()) {
      if (ids.has(op.id)) ctx.addIssue({ code: "custom", message: "Two options have the same id", path: ["options", i, "id"] });
      ids.add(op.id);
      if (op.deal.kind === "percent" && op.deal.value > 90) ctx.addIssue({ code: "custom", message: "A percentage deal can be at most 90", path: ["options", i, "deal"] });
    }
  });
export type LandingOffers = z.infer<typeof LandingOffers>;

export function parseOffers(raw: unknown): LandingOffers {
  const r = LandingOffers.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Check the offers", { field: "offers" });
  return r.data;
}

/** The offers of a page saved before offers existed: its one product, picked by the customer. */
export const legacyOffers = (productId: string): LandingOffers => ({ options: [{ id: "main", label: "Order", productId, deal: { kind: "none", value: 0 } }] });

/** Taka off a line of the given price, never more than the line itself. */
export function dealDiscount(deal: OfferOption["deal"], lineTotal: number): number {
  if (deal.kind === "percent") return Math.min(lineTotal, Math.round(lineTotal * deal.value) / 100);
  if (deal.kind === "amount") return Math.min(lineTotal, deal.value);
  return 0;
}

export const bumpDiscount = (bump: Pick<OrderBump, "percentOff">, price: number): number => Math.round(price * bump.percentOff) / 100;
