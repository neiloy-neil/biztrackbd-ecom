import { withTenant, Prisma } from "@biztrackbd/db";
import { ValidationError, NotFoundError } from "../errors";
import { normalizeBdPhone } from "../phone";

export interface AffiliatePartnerDto {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string;
  code: string;
  couponCode: string | null;
  commissionType: "PERCENTAGE" | "FLAT";
  commissionValue: number;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  payoutMethod: "BKASH" | "NAGAD" | "ROCKET" | "BANK";
  payoutAccount: string | null;
  totalEarned: number;
  totalPaid: number;
  payableBalance: number;
  portalToken: string;
  notes: string | null;
  referralsCount?: number;
  deliveredCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateReferralDto {
  id: string;
  tenantId: string;
  affiliateId: string;
  orderId: string;
  customerPhone: string;
  orderSubtotal: number;
  commissionAmount: number;
  commissionType: "PERCENTAGE" | "FLAT";
  commissionValue: number;
  status: "PENDING" | "APPROVED" | "PAID" | "VOID";
  attributedVia: "LINK" | "COUPON";
  createdAt: Date;
  settledAt: Date | null;
  affiliateName?: string;
  affiliateCode?: string;
}

export interface AffiliatePayoutDto {
  id: string;
  tenantId: string;
  affiliateId: string;
  amount: number;
  method: "BKASH" | "NAGAD" | "ROCKET" | "BANK";
  accountNumber: string;
  bankDetails: string | null;
  status: "REQUESTED" | "PAID" | "REJECTED";
  trxId: string | null;
  notes: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  affiliateName?: string;
}

export interface CreateAffiliateInput {
  name: string;
  phone: string;
  email?: string;
  code: string;
  couponCode?: string;
  commissionType?: "PERCENTAGE" | "FLAT";
  commissionValue?: number;
  payoutMethod?: "BKASH" | "NAGAD" | "ROCKET" | "BANK";
  payoutAccount?: string;
  notes?: string;
}

export interface UpdateAffiliateInput {
  name?: string;
  phone?: string;
  email?: string;
  couponCode?: string;
  commissionType?: "PERCENTAGE" | "FLAT";
  commissionValue?: number;
  status?: "ACTIVE" | "PAUSED" | "ARCHIVED";
  payoutMethod?: "BKASH" | "NAGAD" | "ROCKET" | "BANK";
  payoutAccount?: string;
  notes?: string;
}

function cleanCode(code: string): string {
  const cleaned = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (cleaned.length < 2 || cleaned.length > 32) {
    throw new ValidationError("Referral code must be 2 to 32 alphanumeric characters", { field: "code" });
  }
  return cleaned;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 5)}***${phone.slice(-3)}`;
}

export async function listAffiliatePartners(tenantId: string): Promise<AffiliatePartnerDto[]> {
  return withTenant(tenantId, async (tx) => {
    const partners = await tx.affiliatePartner.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            referrals: true,
          },
        },
        referrals: {
          where: { status: "APPROVED" },
          select: { id: true },
        },
      },
    });

    return partners.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      couponCode: p.couponCode,
      commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(p.commissionValue),
      status: p.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      payoutMethod: p.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      payoutAccount: p.payoutAccount,
      totalEarned: Number(p.totalEarned),
      totalPaid: Number(p.totalPaid),
      payableBalance: Number(p.payableBalance),
      portalToken: p.portalToken,
      notes: p.notes,
      referralsCount: p._count.referrals,
      deliveredCount: p.referrals.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  });
}

export async function getAffiliatePartner(tenantId: string, id: string): Promise<AffiliatePartnerDto> {
  return withTenant(tenantId, async (tx) => {
    const p = await tx.affiliatePartner.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { referrals: true } },
        referrals: { where: { status: "APPROVED" }, select: { id: true } },
      },
    });
    if (!p) throw new NotFoundError("Affiliate partner not found");

    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      couponCode: p.couponCode,
      commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(p.commissionValue),
      status: p.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      payoutMethod: p.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      payoutAccount: p.payoutAccount,
      totalEarned: Number(p.totalEarned),
      totalPaid: Number(p.totalPaid),
      payableBalance: Number(p.payableBalance),
      portalToken: p.portalToken,
      notes: p.notes,
      referralsCount: p._count.referrals,
      deliveredCount: p.referrals.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

export async function getAffiliatePartnerByCode(tenantId: string, code: string): Promise<AffiliatePartnerDto | null> {
  const cleaned = code.trim().toLowerCase();
  return withTenant(tenantId, async (tx) => {
    const p = await tx.affiliatePartner.findFirst({
      where: { code: cleaned, tenantId, status: "ACTIVE" },
    });
    if (!p) return null;
    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      couponCode: p.couponCode,
      commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(p.commissionValue),
      status: p.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      payoutMethod: p.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      payoutAccount: p.payoutAccount,
      totalEarned: Number(p.totalEarned),
      totalPaid: Number(p.totalPaid),
      payableBalance: Number(p.payableBalance),
      portalToken: p.portalToken,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

export async function createAffiliatePartner(tenantId: string, input: CreateAffiliateInput): Promise<AffiliatePartnerDto> {
  const code = cleanCode(input.code);
  let phone: string;
  try {
    phone = normalizeBdPhone(input.phone);
  } catch {
    throw new ValidationError("Enter a valid mobile number (e.g. 01712345678)", { field: "phone" });
  }

  const commissionType = input.commissionType === "FLAT" ? "FLAT" : "PERCENTAGE";
  const commissionVal = Number(input.commissionValue ?? (commissionType === "FLAT" ? 100 : 10));

  if (commissionVal <= 0 || (commissionType === "PERCENTAGE" && commissionVal > 70)) {
    throw new ValidationError("Commission percentage must be between 1% and 70%", { field: "commissionValue" });
  }

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.affiliatePartner.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new ValidationError(`Referral code "${code}" is already in use by another affiliate.`, { field: "code" });
    }

    const p = await tx.affiliatePartner.create({
      data: {
        tenantId,
        name: input.name.trim(),
        phone,
        email: input.email?.trim() || null,
        code,
        couponCode: input.couponCode?.trim().toUpperCase() || null,
        commissionType,
        commissionValue: new Prisma.Decimal(commissionVal),
        payoutMethod: input.payoutMethod || "BKASH",
        payoutAccount: input.payoutAccount?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      couponCode: p.couponCode,
      commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(p.commissionValue),
      status: p.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      payoutMethod: p.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      payoutAccount: p.payoutAccount,
      totalEarned: Number(p.totalEarned),
      totalPaid: Number(p.totalPaid),
      payableBalance: Number(p.payableBalance),
      portalToken: p.portalToken,
      notes: p.notes,
      referralsCount: 0,
      deliveredCount: 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

export async function updateAffiliatePartner(tenantId: string, id: string, input: UpdateAffiliateInput): Promise<AffiliatePartnerDto> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.affiliatePartner.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError("Affiliate partner not found");

    let phone = existing.phone;
    if (input.phone) {
      try {
        phone = normalizeBdPhone(input.phone);
      } catch {
        throw new ValidationError("Enter a valid mobile number", { field: "phone" });
      }
    }

    const data: Prisma.AffiliatePartnerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.phone !== undefined) data.phone = phone;
    if (input.email !== undefined) data.email = input.email?.trim() || null;
    if (input.couponCode !== undefined) data.couponCode = input.couponCode?.trim().toUpperCase() || null;
    if (input.commissionType !== undefined) data.commissionType = input.commissionType;
    if (input.commissionValue !== undefined) data.commissionValue = new Prisma.Decimal(input.commissionValue);
    if (input.status !== undefined) data.status = input.status;
    if (input.payoutMethod !== undefined) data.payoutMethod = input.payoutMethod;
    if (input.payoutAccount !== undefined) data.payoutAccount = input.payoutAccount?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const p = await tx.affiliatePartner.update({
      where: { id },
      data,
    });

    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      couponCode: p.couponCode,
      commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(p.commissionValue),
      status: p.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      payoutMethod: p.payoutMethod as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      payoutAccount: p.payoutAccount,
      totalEarned: Number(p.totalEarned),
      totalPaid: Number(p.totalPaid),
      payableBalance: Number(p.payableBalance),
      portalToken: p.portalToken,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

/** Get public partner dashboard info via tokenized magic link */
export async function getAffiliateByToken(tenantId: string, portalToken: string) {
  return withTenant(tenantId, async (tx) => {
    const p = await tx.affiliatePartner.findFirst({
      where: { portalToken, tenantId },
      include: {
        referrals: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            orderId: true,
            customerPhone: true,
            orderSubtotal: true,
            commissionAmount: true,
            status: true,
            attributedVia: true,
            createdAt: true,
            settledAt: true,
          },
        },
        payouts: {
          orderBy: { requestedAt: "desc" },
          take: 30,
        },
      },
    });

    if (!p) throw new NotFoundError("Affiliate partner portal link is invalid or expired.");

    return {
      partner: {
        id: p.id,
        name: p.name,
        code: p.code,
        couponCode: p.couponCode,
        commissionType: p.commissionType as "PERCENTAGE" | "FLAT",
        commissionValue: Number(p.commissionValue),
        status: p.status,
        payoutMethod: p.payoutMethod,
        payoutAccount: p.payoutAccount,
        totalEarned: Number(p.totalEarned),
        totalPaid: Number(p.totalPaid),
        payableBalance: Number(p.payableBalance),
      },
      referrals: p.referrals.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        customerPhone: maskPhone(r.customerPhone),
        orderSubtotal: Number(r.orderSubtotal),
        commissionAmount: Number(r.commissionAmount),
        status: r.status,
        attributedVia: r.attributedVia,
        createdAt: r.createdAt,
        settledAt: r.settledAt,
      })),
      payouts: p.payouts.map((py) => ({
        id: py.id,
        amount: Number(py.amount),
        method: py.method,
        accountNumber: py.accountNumber,
        status: py.status,
        trxId: py.trxId,
        requestedAt: py.requestedAt,
        processedAt: py.processedAt,
        notes: py.notes,
      })),
    };
  });
}

/** Attribution engine: binds an order to an active affiliate via coupon code or 30-day referral cookie */
export async function attributeOrderToAffiliate(
  tenantId: string,
  input: {
    orderId: string;
    subtotal: number;
    customerPhone: string;
    couponCode?: string | null;
    refCode?: string | null;
  }
): Promise<AffiliateReferralDto | null> {
  const { orderId, subtotal, customerPhone, couponCode, refCode } = input;
  if (!couponCode && !refCode) return null;

  return withTenant(tenantId, async (tx) => {
    let partner = null;
    let via: "COUPON" | "LINK" = "LINK";

    // 1. Coupon code check first (explicit intent overrides link)
    if (couponCode) {
      partner = await tx.affiliatePartner.findFirst({
        where: {
          tenantId,
          couponCode: { equals: couponCode.trim(), mode: "insensitive" },
          status: "ACTIVE",
        },
      });
      if (partner) via = "COUPON";
    }

    // 2. Link cookie fallback
    if (!partner && refCode) {
      partner = await tx.affiliatePartner.findFirst({
        where: {
          tenantId,
          code: { equals: refCode.trim().toLowerCase() },
          status: "ACTIVE",
        },
      });
      if (partner) via = "LINK";
    }

    if (!partner) return null;

    // Prevent duplicate attribution for the same order
    const existing = await tx.affiliateReferral.findFirst({
      where: { tenantId, orderId },
    });
    if (existing) return null;

    // Calculate commission
    let commAmount = 0;
    const commVal = Number(partner.commissionValue);
    if (partner.commissionType === "PERCENTAGE") {
      commAmount = Math.round(subtotal * (commVal / 100) * 100) / 100;
    } else {
      commAmount = commVal;
    }

    if (commAmount <= 0) return null;

    const ref = await tx.affiliateReferral.create({
      data: {
        tenantId,
        affiliateId: partner.id,
        orderId,
        customerPhone,
        orderSubtotal: new Prisma.Decimal(subtotal),
        commissionAmount: new Prisma.Decimal(commAmount),
        commissionType: partner.commissionType,
        commissionValue: partner.commissionValue,
        status: "PENDING",
        attributedVia: via,
      },
    });

    return {
      id: ref.id,
      tenantId: ref.tenantId,
      affiliateId: ref.affiliateId,
      orderId: ref.orderId,
      customerPhone: ref.customerPhone,
      orderSubtotal: Number(ref.orderSubtotal),
      commissionAmount: Number(ref.commissionAmount),
      commissionType: ref.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(ref.commissionValue),
      status: ref.status as "PENDING" | "APPROVED" | "PAID" | "VOID",
      attributedVia: ref.attributedVia as "LINK" | "COUPON",
      createdAt: ref.createdAt,
      settledAt: ref.settledAt,
    };
  });
}

/** Delivery state machine: converts PENDING commissions to APPROVED on DELIVERED, cancels on CANCELLED/RETURNED */
export async function settleAffiliateOrderCommissions(
  tenantId: string,
  orderId: string,
  orderStatus: string
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const referral = await tx.affiliateReferral.findFirst({
      where: { tenantId, orderId },
      include: { affiliate: true },
    });

    if (!referral) return;

    const comm = Number(referral.commissionAmount);

    if (orderStatus === "DELIVERED") {
      if (referral.status === "PENDING") {
        await tx.affiliateReferral.update({
          where: { id: referral.id },
          data: { status: "APPROVED", settledAt: new Date() },
        });

        await tx.affiliatePartner.update({
          where: { id: referral.affiliateId },
          data: {
            totalEarned: { increment: comm },
            payableBalance: { increment: comm },
          },
        });
      }
    } else if (orderStatus === "CANCELLED" || orderStatus === "RETURNED") {
      if (referral.status === "PENDING") {
        await tx.affiliateReferral.update({
          where: { id: referral.id },
          data: { status: "VOID", settledAt: new Date() },
        });
      } else if (referral.status === "APPROVED") {
        // If it was already approved/credited and later returned, reverse the payable balance
        await tx.affiliateReferral.update({
          where: { id: referral.id },
          data: { status: "VOID", settledAt: new Date() },
        });

        await tx.affiliatePartner.update({
          where: { id: referral.affiliateId },
          data: {
            totalEarned: { decrement: comm },
            payableBalance: { decrement: comm },
          },
        });
      }
    }
  });
}

/** Submit payout request from partner portal */
export async function requestAffiliatePayout(
  tenantId: string,
  portalToken: string,
  input: {
    amount: number;
    method: "BKASH" | "NAGAD" | "ROCKET" | "BANK";
    accountNumber: string;
    bankDetails?: string;
  }
): Promise<AffiliatePayoutDto> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (amount < 100) {
    throw new ValidationError("Minimum payout request amount is ৳100");
  }

  return withTenant(tenantId, async (tx) => {
    const partner = await tx.affiliatePartner.findFirst({
      where: { portalToken, tenantId },
    });
    if (!partner) throw new NotFoundError("Affiliate partner not found");

    const currentPayable = Number(partner.payableBalance);
    if (amount > currentPayable) {
      throw new ValidationError(`Requested amount (৳${amount}) exceeds available payable balance (৳${currentPayable})`);
    }

    // Decrement payable balance upfront into pending payout
    await tx.affiliatePartner.update({
      where: { id: partner.id },
      data: {
        payableBalance: { decrement: amount },
        payoutMethod: input.method,
        payoutAccount: input.accountNumber.trim(),
      },
    });

    const payout = await tx.affiliatePayout.create({
      data: {
        tenantId: partner.tenantId,
        affiliateId: partner.id,
        amount: new Prisma.Decimal(amount),
        method: input.method,
        accountNumber: input.accountNumber.trim(),
        bankDetails: input.bankDetails?.trim() || null,
        status: "REQUESTED",
      },
    });

    return {
      id: payout.id,
      tenantId: payout.tenantId,
      affiliateId: payout.affiliateId,
      amount: Number(payout.amount),
      method: payout.method as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      accountNumber: payout.accountNumber,
      bankDetails: payout.bankDetails,
      status: payout.status as "REQUESTED" | "PAID" | "REJECTED",
      trxId: payout.trxId,
      notes: payout.notes,
      requestedAt: payout.requestedAt,
      processedAt: payout.processedAt,
    };
  });
}

/** Merchant marks payout as PAID (with TrxID) or REJECTED */
export async function processAffiliatePayout(
  tenantId: string,
  payoutId: string,
  input: {
    status: "PAID" | "REJECTED";
    trxId?: string;
    notes?: string;
  }
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const payout = await tx.affiliatePayout.findFirst({
      where: { id: payoutId, tenantId },
      include: { affiliate: true },
    });
    if (!payout) throw new NotFoundError("Payout request not found");
    if (payout.status !== "REQUESTED") {
      throw new ValidationError(`Payout request is already ${payout.status}`);
    }

    const amount = Number(payout.amount);

    if (input.status === "PAID") {
      await tx.affiliatePayout.update({
        where: { id: payout.id },
        data: {
          status: "PAID",
          trxId: input.trxId?.trim() || null,
          notes: input.notes?.trim() || null,
          processedAt: new Date(),
        },
      });

      await tx.affiliatePartner.update({
        where: { id: payout.affiliateId },
        data: {
          totalPaid: { increment: amount },
        },
      });
    } else {
      // Re-credit partner's payable balance if rejected
      await tx.affiliatePayout.update({
        where: { id: payout.id },
        data: {
          status: "REJECTED",
          notes: input.notes?.trim() || null,
          processedAt: new Date(),
        },
      });

      await tx.affiliatePartner.update({
        where: { id: payout.affiliateId },
        data: {
          payableBalance: { increment: amount },
        },
      });
    }
  });
}

/** List all payouts for admin review */
export async function listAffiliatePayouts(tenantId: string): Promise<AffiliatePayoutDto[]> {
  return withTenant(tenantId, async (tx) => {
    const payouts = await tx.affiliatePayout.findMany({
      where: { tenantId },
      orderBy: { requestedAt: "desc" },
      include: {
        affiliate: {
          select: { name: true },
        },
      },
    });

    return payouts.map((py) => ({
      id: py.id,
      tenantId: py.tenantId,
      affiliateId: py.affiliateId,
      amount: Number(py.amount),
      method: py.method as "BKASH" | "NAGAD" | "ROCKET" | "BANK",
      accountNumber: py.accountNumber,
      bankDetails: py.bankDetails,
      status: py.status as "REQUESTED" | "PAID" | "REJECTED",
      trxId: py.trxId,
      notes: py.notes,
      requestedAt: py.requestedAt,
      processedAt: py.processedAt,
      affiliateName: py.affiliate.name,
    }));
  });
}

/** List all referrals for admin audit ledger */
export async function listAffiliateReferrals(tenantId: string): Promise<AffiliateReferralDto[]> {
  return withTenant(tenantId, async (tx) => {
    const referrals = await tx.affiliateReferral.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        affiliate: {
          select: { name: true, code: true },
        },
      },
    });

    return referrals.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      affiliateId: r.affiliateId,
      orderId: r.orderId,
      customerPhone: r.customerPhone,
      orderSubtotal: Number(r.orderSubtotal),
      commissionAmount: Number(r.commissionAmount),
      commissionType: r.commissionType as "PERCENTAGE" | "FLAT",
      commissionValue: Number(r.commissionValue),
      status: r.status as "PENDING" | "APPROVED" | "PAID" | "VOID",
      attributedVia: r.attributedVia as "LINK" | "COUPON",
      createdAt: r.createdAt,
      settledAt: r.settledAt,
      affiliateName: r.affiliate.name,
      affiliateCode: r.affiliate.code,
    }));
  });
}
