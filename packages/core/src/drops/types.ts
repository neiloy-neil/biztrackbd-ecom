import { z } from "zod";

export const DropModeSchema = z.enum(["TEASER_WAITLIST", "LIVE_PREORDER"]);
export type DropMode = z.infer<typeof DropModeSchema>;

export const DropStatusSchema = z.enum(["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"]);
export type DropStatus = z.infer<typeof DropStatusSchema>;

export const DropDepositTypeSchema = z.enum(["NONE", "FIXED", "PERCENTAGE", "FULL"]);
export type DropDepositType = z.infer<typeof DropDepositTypeSchema>;

export const DropProductItemInput = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  allocatedQty: z.number().int().positive().nullable().optional(),
});
export type DropProductItemInput = z.infer<typeof DropProductItemInput>;

export const CreateDropInput = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  bannerImage: z.string().nullable().optional(),
  mode: DropModeSchema.default("LIVE_PREORDER"),
  status: DropStatusSchema.default("DRAFT"),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  estimatedShipDate: z.coerce.date().nullable().optional(),
  depositType: DropDepositTypeSchema.default("NONE"),
  depositValue: z.number().min(0).default(0),
  allocationCap: z.number().int().positive().nullable().optional(),
  productItems: z.array(DropProductItemInput).min(1, "A drop must include at least 1 product"),
});
export type CreateDropInput = z.infer<typeof CreateDropInput>;

export const UpdateDropInput = CreateDropInput.partial();
export type UpdateDropInput = z.infer<typeof UpdateDropInput>;

export const WaitlistSubscriptionInput = z.object({
  dropId: z.string().min(1),
  phone: z.string().min(10).max(15),
  name: z.string().trim().max(100).optional(),
});
export type WaitlistSubscriptionInput = z.infer<typeof WaitlistSubscriptionInput>;

export interface DropDepositCalculation {
  depositRequired: number;
  balanceDue: number;
  depositType: DropDepositType;
  depositValue: number;
  isPreOrder: boolean;
  estimatedShipDate?: Date | null;
}
