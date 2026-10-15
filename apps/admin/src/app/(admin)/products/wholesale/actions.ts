"use server";

import { revalidatePath } from "next/cache";
import {
  getWholesaleOverview,
  listWholesaleApplications,
  listWholesaleTiers,
  listWholesalePrices,
  getWholesaleSettings,
  approveWholesaleCustomer,
  rejectWholesaleCustomer,
  upsertWholesaleTier,
  deleteWholesaleTier,
  setVariantWholesalePrice,
  deleteVariantWholesalePrice,
  updateWholesaleSettings,
  type WholesaleTierInput,
  type WholesalePriceOverrideInput,
  type WholesaleSettingsInput,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export async function getWholesaleManagerDataAction() {
  const s = await requireAccess("products");
  const [overview, applications, tiers, prices, settings] = await Promise.all([
    getWholesaleOverview(s.tenantId),
    listWholesaleApplications(s.tenantId),
    listWholesaleTiers(s.tenantId),
    listWholesalePrices(s.tenantId),
    getWholesaleSettings(s.tenantId),
  ]);

  return {
    overview,
    applications: applications.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      tradeLicense: a.tradeLicense,
      businessType: a.businessType,
      taxId: a.taxId,
      whatsappNumber: a.whatsappNumber,
      address: a.address,
      district: a.district,
      status: a.status,
      approvedAt: a.approvedAt,
      rejectionReason: a.rejectionReason,
      creditLimit: Number(a.creditLimit),
      createdAt: a.createdAt,
      customer: a.customer,
      tier: a.tier ? { id: a.tier.id, name: a.tier.name, discountPercent: Number(a.tier.discountPercent) } : null,
    })),
    tiers,
    prices: prices.map((p) => ({
      id: p.id,
      variantId: p.variantId,
      tierId: p.tierId,
      minQuantity: p.minQuantity,
      price: Number(p.price),
      tier: p.tier ? { id: p.tier.id, name: p.tier.name, discountPercent: Number(p.tier.discountPercent) } : null,
      variant: {
        id: p.variant.id,
        title: p.variant.title,
        price: Number(p.variant.price),
        sku: p.variant.sku,
        product: p.variant.product,
      },
    })),
    settings,
  };
}

export async function approveApplicationAction(
  wholesaleCustomerId: string,
  tierId: string,
  creditLimit?: number
) {
  const s = await requireAccess("products");
  await approveWholesaleCustomer(s.tenantId, wholesaleCustomerId, {
    tierId,
    creditLimit,
  });
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function rejectApplicationAction(
  wholesaleCustomerId: string,
  reason?: string
) {
  const s = await requireAccess("products");
  await rejectWholesaleCustomer(s.tenantId, wholesaleCustomerId, reason);
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function saveTierAction(input: WholesaleTierInput) {
  const s = await requireAccess("products");
  await upsertWholesaleTier(s.tenantId, input);
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function deleteTierAction(tierId: string) {
  const s = await requireAccess("products");
  await deleteWholesaleTier(s.tenantId, tierId);
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function savePriceOverrideAction(input: WholesalePriceOverrideInput) {
  const s = await requireAccess("products");
  await setVariantWholesalePrice(s.tenantId, input);
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function deletePriceOverrideAction(priceId: string) {
  const s = await requireAccess("products");
  await deleteVariantWholesalePrice(s.tenantId, priceId);
  revalidatePath("/products/wholesale");
  return { ok: true };
}

export async function saveWholesaleSettingsAction(input: WholesaleSettingsInput) {
  const s = await requireAccess("products");
  await updateWholesaleSettings(s.tenantId, input);
  revalidatePath("/products/wholesale");
  return { ok: true };
}
