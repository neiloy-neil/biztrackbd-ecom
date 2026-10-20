import { withTenant, Prisma } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError, InsufficientStockError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { renderCode128Svg } from "./barcode";
import { randomUUID } from "node:crypto";

export interface PosPaymentSplit {
  method: "CASH" | "MANUAL_BKASH" | "MANUAL_NAGAD" | "CARD";
  amount: number;
  trxId?: string;
}

export interface PosCheckoutItem {
  variantId: string;
  quantity: number;
  unitPrice?: number; // Override or standard
  discountAmount?: number;
}

export interface PosCheckoutInput {
  registerId: string;
  sessionId: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: PosCheckoutItem[];
  payments: PosPaymentSplit[];
  tenderedCash?: number; // Cash handed over by customer
  cartDiscount?: number; // Store-level or cashier discount
  discountReason?: string;
  redeemPoints?: number;
  notes?: string;
}

export interface PosReceiptData {
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  storeName: string;
  storePhone: string | null;
  storeAddress: string | null;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    title: string;
    variantTitle: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  payments: PosPaymentSplit[];
  tenderedCash: number;
  changeDue: number;
  barcodeSvg: string;
}

/**
 * Ensures at least one default POS register exists for the tenant.
 */
export async function getOrCreateDefaultRegister(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    let reg = await tx.posRegister.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!reg) {
      reg = await tx.posRegister.create({
        data: {
          tenantId,
          name: "Main Cash Counter",
          code: "REG-01",
          isActive: true,
          receiptPrinterWidth: 80,
          autoPrintReceipt: true,
        },
      });
    }

    return reg;
  });
}

/**
 * Lists all active POS registers in the store.
 */
export async function listPosRegisters(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.posRegister.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
  });
}

/**
 * Retrieves the currently OPEN session on a specific POS register.
 */
export async function getActivePosSession(tenantId: string, registerId: string) {
  return withTenant(tenantId, async (tx) => {
    const session = await tx.posSession.findFirst({
      where: {
        registerId,
        status: "OPEN",
      },
      include: {
        register: true,
        movements: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    if (!session) return null;

    // Get live metrics for this session
    const orders = await tx.order.findMany({
      where: {
        posSessionId: session.id,
        status: { not: "CANCELLED" },
      },
      select: {
        totalAmount: true,
        paymentSplits: true,
        paymentMethod: true,
      },
    });

    let totalCashSales = 0;
    let totalMfsSales = 0;
    let totalCardSales = 0;
    let totalSales = 0;

    for (const o of orders) {
      const orderTotal = Number(o.totalAmount);
      totalSales += orderTotal;

      if (o.paymentSplits && Array.isArray(o.paymentSplits)) {
        for (const p of o.paymentSplits as any[]) {
          const amt = Number(p.amount) || 0;
          if (p.method === "CASH") totalCashSales += amt;
          else if (p.method === "MANUAL_BKASH" || p.method === "MANUAL_NAGAD") totalMfsSales += amt;
          else if (p.method === "CARD") totalCardSales += amt;
        }
      } else {
        if (o.paymentMethod === "COD" || o.paymentMethod === "CASH") totalCashSales += orderTotal;
        else if (o.paymentMethod === "MANUAL_BKASH" || o.paymentMethod === "MANUAL_NAGAD") totalMfsSales += orderTotal;
        else totalCardSales += orderTotal;
      }
    }

    let totalCashIn = 0;
    let totalCashOut = 0;
    for (const m of session.movements) {
      if (m.type === "CASH_IN") totalCashIn += Number(m.amount);
      if (m.type === "CASH_OUT") totalCashOut += Number(m.amount);
    }

    const openingFloat = Number(session.openingFloat);
    const expectedCashInDrawer = openingFloat + totalCashSales + totalCashIn - totalCashOut;

    return {
      ...session,
      openingFloat,
      totalSales,
      totalOrders: orders.length,
      totalCashSales,
      totalMfsSales,
      totalCardSales,
      totalCashIn,
      totalCashOut,
      expectedCashInDrawer,
    };
  });
}

/**
 * Opens a new POS shift session with an opening cash float.
 */
export async function openPosSession(
  tenantId: string,
  actor: StaffActor,
  input: { registerId: string; openingFloat: number; note?: string }
) {
  assertCan(actor, "orders", "edit");

  return withTenant(tenantId, async (tx) => {
    // Check if an existing open session exists on this register
    const existing = await tx.posSession.findFirst({
      where: { registerId: input.registerId, status: "OPEN" },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError("This register already has an open session.");
    }

    return tx.posSession.create({
      data: {
        tenantId,
        registerId: input.registerId,
        openedByUserId: actor.userId,
        openingFloat: input.openingFloat,
        note: input.note?.trim() || null,
        status: "OPEN",
      },
      include: { register: true },
    });
  });
}

/**
 * Records a petty cash adjustment in the cash drawer (CASH_IN or CASH_OUT).
 */
export async function recordPosCashMovement(
  tenantId: string,
  actor: StaffActor,
  input: { sessionId: string; type: "CASH_IN" | "CASH_OUT"; amount: number; reason: string }
) {
  assertCan(actor, "orders", "edit");

  if (input.amount <= 0) {
    throw new ValidationError("Amount must be greater than zero.");
  }
  if (!input.reason.trim()) {
    throw new ValidationError("Please provide a reason for the cash movement.");
  }

  return withTenant(tenantId, async (tx) => {
    const session = await tx.posSession.findUnique({
      where: { id: input.sessionId },
      select: { status: true },
    });
    if (!session || session.status !== "OPEN") {
      throw new ValidationError("Cannot record cash movement on a closed session.");
    }

    return tx.posCashMovement.create({
      data: {
        tenantId,
        sessionId: input.sessionId,
        userId: actor.userId,
        type: input.type,
        amount: input.amount,
        reason: input.reason.trim(),
      },
    });
  });
}

/**
 * Closes an active POS shift session and performs cash drawer reconciliation.
 */
export async function closePosSession(
  tenantId: string,
  actor: StaffActor,
  input: { sessionId: string; closingCounted: number; note?: string }
) {
  assertCan(actor, "orders", "edit");

  return withTenant(tenantId, async (tx) => {
    const session = await tx.posSession.findUnique({
      where: { id: input.sessionId },
      include: { movements: true },
    });
    if (!session || session.status !== "OPEN") {
      throw new ValidationError("Session is already closed or does not exist.");
    }

    // Tally orders in this session
    const orders = await tx.order.findMany({
      where: {
        posSessionId: session.id,
        status: { not: "CANCELLED" },
      },
      select: {
        totalAmount: true,
        paymentSplits: true,
        paymentMethod: true,
      },
    });

    let totalCashSales = 0;
    let totalMfsSales = 0;
    let totalCardSales = 0;
    let totalSales = 0;

    for (const o of orders) {
      const orderTotal = Number(o.totalAmount);
      totalSales += orderTotal;

      if (o.paymentSplits && Array.isArray(o.paymentSplits)) {
        for (const p of o.paymentSplits as any[]) {
          const amt = Number(p.amount) || 0;
          if (p.method === "CASH") totalCashSales += amt;
          else if (p.method === "MANUAL_BKASH" || p.method === "MANUAL_NAGAD") totalMfsSales += amt;
          else if (p.method === "CARD") totalCardSales += amt;
        }
      } else {
        if (o.paymentMethod === "COD" || o.paymentMethod === "CASH") totalCashSales += orderTotal;
        else if (o.paymentMethod === "MANUAL_BKASH" || o.paymentMethod === "MANUAL_NAGAD") totalMfsSales += orderTotal;
        else totalCardSales += orderTotal;
      }
    }

    let totalCashIn = 0;
    let totalCashOut = 0;
    for (const m of session.movements) {
      if (m.type === "CASH_IN") totalCashIn += Number(m.amount);
      if (m.type === "CASH_OUT") totalCashOut += Number(m.amount);
    }

    const openingFloat = Number(session.openingFloat);
    const expectedCash = openingFloat + totalCashSales + totalCashIn - totalCashOut;
    const cashDifference = input.closingCounted - expectedCash;

    const closed = await tx.posSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByUserId: actor.userId,
        closingCounted: input.closingCounted,
        expectedCash,
        cashDifference,
        note: input.note?.trim() || session.note,
      },
      include: { register: true },
    });

    return {
      session: closed,
      summary: {
        totalOrders: orders.length,
        totalSales,
        totalCashSales,
        totalMfsSales,
        totalCardSales,
        openingFloat,
        totalCashIn,
        totalCashOut,
        expectedCash,
        closingCounted: input.closingCounted,
        cashDifference, // Positive = Over, Negative = Short, 0 = Balanced
      },
    };
  });
}

/**
 * Fast product and variant search for POS cashier interface.
 */
export async function searchProductsForPos(
  tenantId: string,
  query: string,
  limit = 24
) {
  const q = query.trim();

  return withTenant(tenantId, async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: {
        isActive: true,
        product: { status: "ACTIVE" },
        ...(q
          ? {
              OR: [
                { barcode: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
                { product: { title: { contains: q, mode: "insensitive" } } },
                { product: { titleBn: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            titleBn: true,
            category: { select: { name: true } },
            images: { take: 1, select: { url: true } },
          },
        },
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    return variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      productTitleBn: v.product.titleBn,
      variantTitle: v.title,
      categoryName: v.product.category?.name || "General",
      sku: v.sku,
      barcode: v.barcode,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      stockQuantity: v.stockQuantity,
      imageUrl: v.imageUrl || v.product.images[0]?.url || null,
    }));
  });
}

/**
 * High-speed POS Checkout:
 * - Deducts central inventory atomically
 * - Calculates change due
 * - Creates DELIVERED & PAID in-store order
 * - Returns thermal receipt data
 */
export async function createPosOrder(
  tenantId: string,
  actor: StaffActor,
  input: PosCheckoutInput
): Promise<PosReceiptData> {
  assertCan(actor, "orders", "edit");

  if (!input.items || input.items.length === 0) {
    throw new ValidationError("Cart is empty.");
  }

  return withTenant(tenantId, async (tx) => {
    // 1. Verify session is OPEN
    const session = await tx.posSession.findUnique({
      where: { id: input.sessionId },
      include: { register: true },
    });
    if (!session || session.status !== "OPEN") {
      throw new ValidationError("POS session is not open. Please open a shift first.");
    }

    // 2. Fetch store details for receipt
    const store = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { storeSettings: true },
    });

    // 3. Atomically check and decrement stock in sorted variantId order
    const variantIds = [...input.items.map((i) => i.variantId)].sort();
    const qtyMap = new Map<string, number>();
    for (const item of input.items) {
      qtyMap.set(item.variantId, (qtyMap.get(item.variantId) || 0) + item.quantity);
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });

    for (const vId of variantIds) {
      const qty = qtyMap.get(vId)!;
      const updated = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stockQuantity" = "stockQuantity" - ${qty}, "updatedAt" = now()
        WHERE "id" = ${vId} AND "stockQuantity" >= ${qty}
      `;
      if (updated === 0) {
        const v = variants.find((x) => x.id === vId);
        throw new InsufficientStockError(
          `Insufficient stock for ${v?.product.title || "item"} (${v?.title || ""}). Stock remaining: ${v?.stockQuantity ?? 0}`,
          vId,
          v?.stockQuantity ?? 0
        );
      }
    }

    // 4. Calculate pricing & lines
    let subtotal = 0;
    const lines = input.items.map((item) => {
      const v = variants.find((x) => x.id === item.variantId)!;
      const unitPrice = item.unitPrice != null ? item.unitPrice : Number(v.price);
      const lineTotal = Math.max(0, unitPrice * item.quantity - (item.discountAmount || 0));
      subtotal += lineTotal;

      return {
        variantId: v.id,
        productId: v.productId,
        title: v.product.title,
        variantTitle: v.title.toLowerCase() === "default" ? null : v.title,
        sku: v.sku,
        unitPrice,
        unitCost: v.product.costPrice ? Number(v.product.costPrice) : null,
        quantity: item.quantity,
        totalPrice: lineTotal,
      };
    });

    const discount = Math.min(subtotal, Math.max(0, input.cartDiscount || 0));
    const total = Math.max(0, subtotal - discount);

    // 5. Payments validation & change calculation
    const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
    const tenderedCash = input.tenderedCash ?? (input.payments.find((p) => p.method === "CASH")?.amount || 0);
    const cashPortion = input.payments.find((p) => p.method === "CASH")?.amount || 0;
    const changeDue = Math.max(0, tenderedCash - cashPortion);

    // 6. Customer lookup or Walk-in assignment
    let customerId: string | null = null;
    const customerName = input.customer?.name?.trim() || "Walk-in Customer";
    let customerPhone = "01000000000";

    if (input.customer?.phone) {
      try {
        customerPhone = normalizeBdPhone(input.customer.phone);
        const [cust] = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "email", "totalOrders", "updatedAt")
          VALUES (${randomUUID()}, ${tenantId}, ${customerName}, ${customerPhone}, ${input.customer.email ?? null}, 1, now())
          ON CONFLICT ("tenantId", "phone") DO UPDATE
            SET "name" = EXCLUDED."name", "totalOrders" = "Customer"."totalOrders" + 1, "updatedAt" = now()
          RETURNING "id"`;
        if (cust) customerId = cust.id;
      } catch (err) {
        console.warn("POS customer upsert fallback", err);
      }
    }

    // 7. Atomic Order Number Generation
    const [counter] = await tx.$queryRaw<{ orderPrefix: string; n: number }[]>`
      UPDATE "Tenant" SET "nextOrderNumber" = "nextOrderNumber" + 1 WHERE "id" = ${tenantId}
      RETURNING "orderPrefix", ("nextOrderNumber" - 1)::int AS n`;
    const orderNumber = counter ? `${counter.orderPrefix}${counter.n}` : `POS-${Date.now().toString().slice(-6)}`;

    // 8. Determine primary payment method enum
    const primaryMethod = input.payments.length === 1
      ? (input.payments[0]!.method)
      : (input.payments.some((p) => p.method === "CASH") ? "CASH" : "MANUAL_BKASH");

    // 9. Create Order
    const order = await tx.order.create({
      data: {
        tenantId,
        orderNumber,
        customerId,
        customerName,
        customerPhone,
        shippingAddress: store.storeSettings?.addressLine || "In-store Counter",
        shippingCity: "Dhaka",
        shippingDistrict: "Dhaka",
        shippingDivision: "Dhaka",
        deliveryZone: "INSIDE_DHAKA",
        deliveryCharge: 0,
        subtotalAmount: subtotal,
        discountAmount: discount,
        totalAmount: total,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: primaryMethod as any,
        channel: "POS",
        posRegisterId: input.registerId,
        posSessionId: input.sessionId,
        paymentSplits: input.payments as any,
        createdByUserId: actor.userId,
        notes: input.notes?.trim() || (input.discountReason ? `Discount: ${input.discountReason}` : null),
        items: {
          create: lines.map((l) => ({
            tenantId,
            productId: l.productId,
            variantId: l.variantId,
            productTitle: l.title,
            variantTitle: l.variantTitle,
            sku: l.sku,
            unitPrice: l.unitPrice,
            unitCost: l.unitCost,
            quantity: l.quantity,
            totalPrice: l.totalPrice,
          })),
        },
      },
    });

    // 10. Generate Barcode SVG for receipt lookup
    const barcodeSvg = renderCode128Svg(order.orderNumber, {
      height: 38,
      barWidth: 1.8,
      showText: true,
      fontSize: 11,
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      storeName: store.storeSettings?.storeName || store.name,
      storePhone: store.storeSettings?.contactPhone || null,
      storeAddress: store.storeSettings?.addressLine || null,
      cashierName: actor.name || "Cashier",
      customerName,
      customerPhone: customerPhone === "01000000000" ? "Walk-in" : customerPhone,
      items: lines.map((l) => ({
        title: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
      })),
      subtotal,
      discount,
      total,
      payments: input.payments,
      tenderedCash,
      changeDue,
      barcodeSvg,
    };
  });
}
