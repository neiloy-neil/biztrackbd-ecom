"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  getOrCreateDefaultRegister,
  getActivePosSession,
  openPosSession,
  recordPosCashMovement,
  closePosSession,
  searchProductsForPos,
  createPosOrder,
  findVariantByBarcode,
  type PosCheckoutInput,
  type PosReceiptData,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

export async function getPosInitialDataAction() {
  const s = await requireAction("orders", "view");

  const [register, storeInfo] = await withTenant(s.tenantId, async (tx) => {
    let reg = await tx.posRegister.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!reg) {
      reg = await tx.posRegister.create({
        data: {
          tenantId: s.tenantId,
          name: "Main Cash Counter",
          code: "REG-01",
          isActive: true,
          receiptPrinterWidth: 80,
          autoPrintReceipt: true,
        },
      });
    }

    const t = await tx.tenant.findUniqueOrThrow({
      where: { id: s.tenantId },
      include: { storeSettings: true },
    });

    return [reg, t];
  });

  const session = await getActivePosSession(s.tenantId, register.id);
  const initialProducts = await searchProductsForPos(s.tenantId, "", 30);

  return {
    register: {
      id: register.id,
      name: register.name,
      code: register.code,
      receiptPrinterWidth: register.receiptPrinterWidth,
    },
    session: session
      ? {
          id: session.id,
          status: session.status,
          openedAt: session.openedAt,
          openingFloat: session.openingFloat,
          totalSales: session.totalSales,
          totalOrders: session.totalOrders,
          expectedCashInDrawer: session.expectedCashInDrawer,
        }
      : null,
    store: {
      name: storeInfo.storeSettings?.storeName || storeInfo.name,
      phone: storeInfo.storeSettings?.contactPhone || null,
      address: storeInfo.storeSettings?.addressLine || null,
      bkashNumber: storeInfo.storeSettings?.bkashNumber || null,
      nagadNumber: storeInfo.storeSettings?.nagadNumber || null,
    },
    products: initialProducts,
    cashierName: s.user.name || "Cashier",
  };
}

export async function openPosShiftAction(registerId: string, openingFloat: number, note?: string) {
  const s = await requireAction("orders", "edit");
  try {
    const session = await openPosSession(s.tenantId, s.actor, {
      registerId,
      openingFloat,
      note,
    });
    revalidatePath("/pos");
    return { ok: true as const, session };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false as const, error: e.message };
    console.error("openPosShiftAction error", e);
    return { ok: false as const, error: "Failed to open POS shift." };
  }
}

export async function recordPosMovementAction(input: {
  sessionId: string;
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  reason: string;
}) {
  const s = await requireAction("orders", "edit");
  try {
    const movement = await recordPosCashMovement(s.tenantId, s.actor, input);
    revalidatePath("/pos");
    return { ok: true as const, movement };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false as const, error: e.message };
    console.error("recordPosMovementAction error", e);
    return { ok: false as const, error: "Failed to record cash movement." };
  }
}

export async function closePosShiftAction(sessionId: string, closingCounted: number, note?: string) {
  const s = await requireAction("orders", "edit");
  try {
    const result = await closePosSession(s.tenantId, s.actor, {
      sessionId,
      closingCounted,
      note,
    });
    revalidatePath("/pos");
    return { ok: true as const, summary: result.summary };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false as const, error: e.message };
    console.error("closePosShiftAction error", e);
    return { ok: false as const, error: "Failed to close POS shift." };
  }
}

export async function scanBarcodeAction(code: string) {
  const s = await requireAction("orders", "view");
  try {
    const item = await findVariantByBarcode(s.tenantId, code);
    if (!item) return { ok: false as const, error: "No product matches this barcode." };
    return { ok: true as const, item };
  } catch (e) {
    console.error("scanBarcodeAction error", e);
    return { ok: false as const, error: "Scanner lookup failed." };
  }
}

export async function searchPosProductsAction(q: string) {
  const s = await requireAction("orders", "view");
  return searchProductsForPos(s.tenantId, q, 30);
}

export async function lookupCustomerForPosAction(phone: string) {
  const s = await requireAction("orders", "view");
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 10) return null;

  return withTenant(s.tenantId, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: {
        phone: { contains: clean.slice(-10) },
      },
      include: {
        loyaltyAccount: true,
      },
    });

    if (!customer) return null;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalOrders: customer.totalOrders,
      loyaltyPoints: customer.loyaltyAccount?.availablePoints || 0,
      tier: customer.loyaltyAccount?.currentTier || "BRONZE",
    };
  });
}

export async function checkoutPosAction(payload: PosCheckoutInput): Promise<
  { ok: true; receipt: PosReceiptData } | { ok: false; error: string }
> {
  const s = await requireAction("orders", "edit");
  try {
    const receipt = await createPosOrder(s.tenantId, s.actor, payload);
    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/inventory");
    return { ok: true, receipt };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("checkoutPosAction error", e);
    return { ok: false, error: "Checkout failed. Please check stock and try again." };
  }
}
