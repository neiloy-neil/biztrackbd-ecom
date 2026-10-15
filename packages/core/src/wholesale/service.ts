import { withTenant, Prisma } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import {
  WholesaleRegistrationSchema,
  WholesaleTierSchema,
  WholesalePriceOverrideSchema,
  WholesaleSettingsSchema,
  type WholesaleRegistrationInput,
  type WholesaleTierInput,
  type WholesalePriceOverrideInput,
  type WholesaleSettingsInput,
  type WholesalePriceResolutionResult,
} from "./types";

// ==========================================
// 1. RESELLER APPLICATION MANAGEMENT
// ==========================================

export async function applyWholesaleCustomer(tenantId: string, input: WholesaleRegistrationInput) {
  const parsed = WholesaleRegistrationSchema.parse(input);
  const cleanPhone = parsed.phone.replace(/[^0-9]/g, "");

  return withTenant(tenantId, async (tx) => {
    // 1. Find or create the base Customer record
    let customer = await tx.customer.findUnique({
      where: {
        tenantId_phone: { tenantId, phone: cleanPhone },
      },
      include: { wholesaleProfile: true },
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          tenantId,
          name: parsed.applicantName,
          phone: cleanPhone,
          tags: ["b2b_applicant"],
        },
        include: { wholesaleProfile: true },
      });
    }

    // 2. Check if wholesale profile already exists
    if (customer.wholesaleProfile) {
      if (customer.wholesaleProfile.status === "APPROVED") {
        return {
          ok: true,
          status: "APPROVED" as const,
          message: "You already have an active Wholesale Partner account.",
          profileId: customer.wholesaleProfile.id,
        };
      }
      if (customer.wholesaleProfile.status === "PENDING") {
        return {
          ok: true,
          status: "PENDING" as const,
          message: "Your application is currently under review by our wholesale team.",
          profileId: customer.wholesaleProfile.id,
        };
      }

      // If previously rejected, update details and reopen application to PENDING
      const updated = await tx.wholesaleCustomer.update({
        where: { id: customer.wholesaleProfile.id },
        data: {
          companyName: parsed.companyName,
          tradeLicense: parsed.tradeLicense,
          businessType: parsed.businessType,
          taxId: parsed.taxId,
          whatsappNumber: parsed.whatsappNumber,
          address: parsed.address,
          district: parsed.district,
          status: "PENDING",
          rejectionReason: null,
          updatedAt: new Date(),
        },
      });

      return {
        ok: true,
        status: "PENDING" as const,
        message: "Your application has been resubmitted for review.",
        profileId: updated.id,
      };
    }

    // 3. Create fresh wholesale customer profile
    const created = await tx.wholesaleCustomer.create({
      data: {
        tenantId,
        customerId: customer.id,
        companyName: parsed.companyName,
        tradeLicense: parsed.tradeLicense,
        businessType: parsed.businessType,
        taxId: parsed.taxId,
        whatsappNumber: parsed.whatsappNumber,
        address: parsed.address,
        district: parsed.district,
        status: "PENDING",
      },
    });

    return {
      ok: true,
      status: "PENDING" as const,
      message: "Application submitted successfully! Our wholesale team will review your business details.",
      profileId: created.id,
    };
  });
}

export async function listWholesaleApplications(
  tenantId: string,
  filter?: { status?: "PENDING" | "APPROVED" | "REJECTED" }
) {
  return withTenant(tenantId, async (tx) => {
    return tx.wholesaleCustomer.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            totalOrders: true,
            totalSpent: true,
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
          },
        },
      },
    });
  });
}

export async function approveWholesaleCustomer(
  tenantId: string,
  wholesaleCustomerId: string,
  params: { tierId: string; creditLimit?: number }
) {
  return withTenant(tenantId, async (tx) => {
    const profile = await tx.wholesaleCustomer.findUnique({
      where: { id: wholesaleCustomerId },
    });
    if (!profile) throw new NotFoundError("Wholesale application not found");

    const tier = await tx.wholesaleTier.findUnique({
      where: { id: params.tierId },
    });
    if (!tier) throw new NotFoundError("Wholesale tier not found");

    const updated = await tx.wholesaleCustomer.update({
      where: { id: wholesaleCustomerId },
      data: {
        status: "APPROVED",
        tierId: params.tierId,
        approvedAt: new Date(),
        rejectionReason: null,
        creditLimit: params.creditLimit !== undefined ? params.creditLimit : profile.creditLimit,
      },
      include: { customer: true, tier: true },
    });

    // Tag the customer profile
    await tx.customer.update({
      where: { id: updated.customerId },
      data: {
        tags: {
          push: `wholesale_${tier.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        },
      },
    });

    return updated;
  });
}

export async function rejectWholesaleCustomer(
  tenantId: string,
  wholesaleCustomerId: string,
  reason?: string
) {
  return withTenant(tenantId, async (tx) => {
    const profile = await tx.wholesaleCustomer.findUnique({
      where: { id: wholesaleCustomerId },
    });
    if (!profile) throw new NotFoundError("Wholesale application not found");

    return tx.wholesaleCustomer.update({
      where: { id: wholesaleCustomerId },
      data: {
        status: "REJECTED",
        rejectionReason: reason ?? "Business verification could not be completed.",
      },
    });
  });
}

export async function getWholesaleCustomerProfile(
  tenantId: string,
  customerPhoneOrId: string
) {
  return withTenant(tenantId, async (tx) => {
    const cleanPhone = customerPhoneOrId.replace(/[^0-9]/g, "");

    const customer = await tx.customer.findFirst({
      where: {
        OR: [
          { id: customerPhoneOrId },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
      include: {
        wholesaleProfile: {
          include: {
            tier: true,
          },
        },
      },
    });

    return customer?.wholesaleProfile ?? null;
  });
}

// ==========================================
// 2. WHOLESALE TIER MANAGEMENT
// ==========================================

export async function listWholesaleTiers(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const tiers = await tx.wholesaleTier.findMany({
      orderBy: { discountPercent: "asc" },
      include: {
        _count: {
          select: { customers: true, productPrices: true },
        },
      },
    });

    return tiers.map((t) => ({
      id: t.id,
      name: t.name,
      discountPercent: Number(t.discountPercent),
      minOrderAmount: Number(t.minOrderAmount),
      allowCod: t.allowCod,
      partialDepositPercent: t.partialDepositPercent ? Number(t.partialDepositPercent) : null,
      customerCount: t._count.customers,
      customPricesCount: t._count.productPrices,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  });
}

export async function upsertWholesaleTier(tenantId: string, input: WholesaleTierInput) {
  const parsed = WholesaleTierSchema.parse(input);

  return withTenant(tenantId, async (tx) => {
    if (parsed.id) {
      return tx.wholesaleTier.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          discountPercent: parsed.discountPercent,
          minOrderAmount: parsed.minOrderAmount,
          allowCod: parsed.allowCod,
          partialDepositPercent: parsed.partialDepositPercent ?? null,
        },
      });
    }

    return tx.wholesaleTier.create({
      data: {
        tenantId,
        name: parsed.name,
        discountPercent: parsed.discountPercent,
        minOrderAmount: parsed.minOrderAmount,
        allowCod: parsed.allowCod,
        partialDepositPercent: parsed.partialDepositPercent ?? null,
      },
    });
  });
}

export async function deleteWholesaleTier(tenantId: string, tierId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.wholesaleTier.delete({
      where: { id: tierId },
    });
  });
}

// ==========================================
// 3. VARIANT WHOLESALE PRICING & VOLUME BREAKS
// ==========================================

export async function listWholesalePrices(tenantId: string, variantId?: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.wholesalePrice.findMany({
      where: variantId ? { variantId } : undefined,
      orderBy: [{ minQuantity: "asc" }, { price: "asc" }],
      include: {
        tier: { select: { id: true, name: true, discountPercent: true } },
        variant: {
          select: {
            id: true,
            title: true,
            price: true,
            sku: true,
            product: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });
  });
}

export async function setVariantWholesalePrice(
  tenantId: string,
  input: WholesalePriceOverrideInput
) {
  const parsed = WholesalePriceOverrideSchema.parse(input);

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.wholesalePrice.findFirst({
      where: {
        tenantId,
        variantId: parsed.variantId,
        tierId: parsed.tierId ?? null,
        minQuantity: parsed.minQuantity,
      },
    });

    if (existing) {
      return tx.wholesalePrice.update({
        where: { id: existing.id },
        data: { price: parsed.price },
      });
    }

    return tx.wholesalePrice.create({
      data: {
        tenantId,
        variantId: parsed.variantId,
        tierId: parsed.tierId ?? null,
        minQuantity: parsed.minQuantity,
        price: parsed.price,
      },
    });
  });
}

export async function deleteVariantWholesalePrice(tenantId: string, priceId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.wholesalePrice.delete({
      where: { id: priceId },
    });
  });
}

// ==========================================
// 4. BEST PRICE GUARANTEE ENGINE
// ==========================================

export async function resolveWholesaleUnitPrice(params: {
  tenantId: string;
  variantId: string;
  retailPrice: number;
  quantity: number;
  customerPhoneOrId?: string | null;
  forceRetail?: boolean;
}): Promise<WholesalePriceResolutionResult> {
  const { tenantId, variantId, retailPrice, quantity, customerPhoneOrId, forceRetail } = params;

  // If force retail is toggled by customer, return normal retail price
  if (forceRetail) {
    return {
      unitPrice: retailPrice,
      regularPrice: retailPrice,
      savingsPerUnit: 0,
      savingsTotal: 0,
      appliedSource: "RETAIL",
      isWholesaleApplied: false,
    };
  }

  return withTenant(tenantId, async (tx) => {
    // 1. Resolve wholesale customer & tier if available
    let tier: { id: string; name: string; discountPercent: number } | null = null;

    if (customerPhoneOrId) {
      const cleanPhone = customerPhoneOrId.replace(/[^0-9]/g, "");
      const customer = await tx.customer.findFirst({
        where: {
          OR: [
            { id: customerPhoneOrId },
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ],
        },
        include: {
          wholesaleProfile: {
            include: { tier: true },
          },
        },
      });

      if (
        customer?.wholesaleProfile?.status === "APPROVED" &&
        customer.wholesaleProfile.tier
      ) {
        tier = {
          id: customer.wholesaleProfile.tier.id,
          name: customer.wholesaleProfile.tier.name,
          discountPercent: Number(customer.wholesaleProfile.tier.discountPercent),
        };
      }
    }

    // 2. Fetch all matching wholesale overrides & volume breaks for this variant
    const priceRules = await tx.wholesalePrice.findMany({
      where: {
        tenantId,
        variantId,
        minQuantity: { lte: quantity },
      },
      orderBy: { minQuantity: "desc" },
    });

    let bestPrice = retailPrice;
    let appliedSource: WholesalePriceResolutionResult["appliedSource"] = "RETAIL";

    // Candidate A: Public volume break (tierId is null)
    const publicVolumeRule = priceRules.find((r) => r.tierId === null);
    if (publicVolumeRule) {
      const p = Number(publicVolumeRule.price);
      if (p < bestPrice) {
        bestPrice = p;
        appliedSource = "VOLUME_BREAK";
      }
    }

    // Candidate B: Reseller Tier Specific Override
    if (tier) {
      const tierRule = priceRules.find((r) => r.tierId === tier.id);
      if (tierRule) {
        const p = Number(tierRule.price);
        if (p < bestPrice) {
          bestPrice = p;
          appliedSource = "TIER_OVERRIDE";
        }
      }

      // Candidate C: Reseller Tier Flat Percentage Discount
      const flatPrice = Math.round(retailPrice * (1 - tier.discountPercent / 100));
      if (flatPrice < bestPrice) {
        bestPrice = flatPrice;
        appliedSource = "TIER_FLAT";
      }
    }

    const savingsPerUnit = Math.max(0, retailPrice - bestPrice);
    const savingsTotal = savingsPerUnit * quantity;

    return {
      unitPrice: bestPrice,
      regularPrice: retailPrice,
      savingsPerUnit,
      savingsTotal,
      appliedSource,
      isWholesaleApplied: bestPrice < retailPrice,
      tierName: tier?.name,
    };
  });
}

// ==========================================
// 5. WHOLESALE STORE SETTINGS
// ==========================================

export async function getWholesaleSettings(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const settings = await tx.storeSettings.findUnique({
      where: { tenantId },
      select: {
        wholesaleEnabled: true,
        wholesaleMinOrderAmount: true,
        wholesaleDefaultMoq: true,
        wholesaleAllowRegistration: true,
        wholesaleBankDetails: true,
      },
    });

    return {
      wholesaleEnabled: settings?.wholesaleEnabled ?? false,
      wholesaleMinOrderAmount: Number(settings?.wholesaleMinOrderAmount ?? 5000),
      wholesaleDefaultMoq: settings?.wholesaleDefaultMoq ?? 6,
      wholesaleAllowRegistration: settings?.wholesaleAllowRegistration ?? true,
      wholesaleBankDetails: (settings?.wholesaleBankDetails as any) ?? null,
    };
  });
}

export async function updateWholesaleSettings(
  tenantId: string,
  input: WholesaleSettingsInput
) {
  const parsed = WholesaleSettingsSchema.parse(input);

  return withTenant(tenantId, async (tx) => {
    return tx.storeSettings.update({
      where: { tenantId },
      data: {
        wholesaleEnabled: parsed.wholesaleEnabled,
        wholesaleMinOrderAmount: parsed.wholesaleMinOrderAmount,
        wholesaleDefaultMoq: parsed.wholesaleDefaultMoq,
        wholesaleAllowRegistration: parsed.wholesaleAllowRegistration,
        wholesaleBankDetails: parsed.wholesaleBankDetails ?? Prisma.DbNull,
      },
    });
  });
}

// ==========================================
// 6. WHOLESALE OVERVIEW STATS
// ==========================================

export async function getWholesaleOverview(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [totalApproved, totalPending, totalTiers, wholesaleOrders] = await Promise.all([
      tx.wholesaleCustomer.count({ where: { status: "APPROVED" } }),
      tx.wholesaleCustomer.count({ where: { status: "PENDING" } }),
      tx.wholesaleTier.count(),
      tx.order.findMany({
        where: {
          isWholesale: true,
          status: { notIn: ["CANCELLED"] },
        },
        select: {
          totalAmount: true,
          advancePaidAmount: true,
          balanceDue: true,
          createdAt: true,
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalWholesaleGross = wholesaleOrders.reduce(
      (acc, o) => acc + Number(o.totalAmount),
      0
    );
    const totalAdvanceCollected = wholesaleOrders.reduce(
      (acc, o) => acc + Number(o.advancePaidAmount),
      0
    );
    const totalPendingBalance = wholesaleOrders.reduce(
      (acc, o) => acc + Number(o.balanceDue),
      0
    );

    return {
      totalApproved,
      totalPending,
      totalTiers,
      totalOrders: wholesaleOrders.length,
      totalWholesaleGross,
      totalAdvanceCollected,
      totalPendingBalance,
    };
  });
}
