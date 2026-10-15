import { z } from "zod";
import type { WholesaleApplicationStatus } from "@biztrackbd/db";

export type { WholesaleApplicationStatus };

export const WholesaleRegistrationSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  tradeLicense: z.string().trim().max(60).optional().nullable(),
  businessType: z.string().trim().max(60).optional().nullable(),
  taxId: z.string().trim().max(60).optional().nullable(),
  applicantName: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(11, "Valid phone number is required").max(15),
  whatsappNumber: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  district: z.string().trim().max(60).optional().nullable(),
});
export type WholesaleRegistrationInput = z.infer<typeof WholesaleRegistrationSchema>;

export const WholesaleTierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Tier name is required").max(60),
  discountPercent: z.number().min(0).max(95).default(15),
  minOrderAmount: z.number().min(0).default(5000),
  allowCod: z.boolean().default(false),
  partialDepositPercent: z.number().min(0).max(100).nullable().optional(),
});
export type WholesaleTierInput = z.infer<typeof WholesaleTierSchema>;

export const WholesalePriceOverrideSchema = z.object({
  variantId: z.string().min(1),
  tierId: z.string().nullable().optional(),
  minQuantity: z.number().int().min(1).default(1),
  price: z.number().positive("Price must be greater than 0"),
});
export type WholesalePriceOverrideInput = z.infer<typeof WholesalePriceOverrideSchema>;

export const WholesaleBankDetailsSchema = z.object({
  bankName: z.string().trim().min(2, "Bank name is required"),
  branchName: z.string().trim().min(2, "Branch name is required"),
  accountName: z.string().trim().min(2, "Account holder name is required"),
  accountNumber: z.string().trim().min(5, "Account number is required"),
  routingNumber: z.string().trim().optional().nullable(),
  instructions: z.string().trim().max(500).optional().nullable(),
});
export type WholesaleBankDetails = z.infer<typeof WholesaleBankDetailsSchema>;

export const WholesaleSettingsSchema = z.object({
  wholesaleEnabled: z.boolean().default(false),
  wholesaleMinOrderAmount: z.number().min(0).default(5000),
  wholesaleDefaultMoq: z.number().int().min(1).default(6),
  wholesaleAllowRegistration: z.boolean().default(true),
  wholesaleBankDetails: WholesaleBankDetailsSchema.nullable().optional(),
});
export type WholesaleSettingsInput = z.infer<typeof WholesaleSettingsSchema>;

export interface WholesalePriceResolutionCandidate {
  source: "TIER_OVERRIDE" | "TIER_FLAT" | "VOLUME_BREAK" | "RETAIL";
  price: number;
  minQuantity: number;
}

export interface WholesalePriceResolutionResult {
  unitPrice: number;
  regularPrice: number;
  savingsPerUnit: number;
  savingsTotal: number;
  appliedSource: "TIER_OVERRIDE" | "TIER_FLAT" | "VOLUME_BREAK" | "RETAIL";
  isWholesaleApplied: boolean;
  tierName?: string;
}
