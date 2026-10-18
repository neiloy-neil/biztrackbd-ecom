import { randomUUID } from "node:crypto";
import { withTenant, type Prisma } from "@biztrackbd/db";
import { z } from "zod";
import { ValidationError, NotFoundError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { emitMerchantWebhookEvent } from "../messaging/webhook";
import { recordOrderEvent } from "../admin/order-events";

export const CreateTableOrderSchema = z.object({
  table: z.string().trim().min(1, "Table number is required").max(30),
  customerPhone: z.string().trim().min(10, "Valid phone number is required").max(20),
  customerName: z.string().trim().max(100).optional(),
  customerEmail: z.string().email().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(1).max(50),
      note: z.string().max(200).optional(),
    })
  ).min(1, "At least one dish must be selected"),
});

export type CreateTableOrderInput = z.infer<typeof CreateTableOrderSchema>;

export interface TableOrderDishSummary {
  menuItemId: string;
  name: string;
  nameBn?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string;
}

export interface TableOrderResult {
  orderId: string;
  orderNumber: string;
  table: string;
  totalAmount: number;
  subtotalAmount: number;
  itemCount: number;
  status: string;
  createdAt: string;
  items?: TableOrderDishSummary[];
}

/**
 * Places an in-restaurant digital table order.
 * Links into BizTrack's unified order lifecycle with channel "TABLE_ORDER",
 * satisfying OrderItem relations, writing timeline events, and emitting order.created webhook.
 */
export async function createTableOrder(
  tenantId: string,
  rawInput: unknown
): Promise<TableOrderResult> {
  const parsed = CreateTableOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid table order", {
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data;
  const phone = normalizeBdPhone(input.customerPhone);
  const table = input.table.trim();
  const guestName = input.customerName?.trim() || `Guest (Table ${table})`;

  const result = await withTenant(tenantId, async (tx) => {
    // 1. Fetch menu items to verify availability & use authoritative DB prices
    const itemIds = input.items.map((i) => i.menuItemId);
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: itemIds }, tenantId },
    });

    const itemsMap = new Map(menuItems.map((m) => [m.id, m]));
    let subtotal = 0;
    const lines = [];

    for (const it of input.items) {
      const dish = itemsMap.get(it.menuItemId);
      if (!dish) {
        throw new ValidationError("One or more selected dishes are no longer on the menu.");
      }
      if (!dish.isAvailable) {
        throw new ValidationError(`"${dish.name}" is currently sold out.`);
      }

      const price = Number(dish.price);
      const lineTotal = price * it.quantity;
      subtotal += lineTotal;
      lines.push({
        menuItemId: dish.id,
        name: dish.name,
        nameBn: dish.nameBn,
        unitPrice: price,
        quantity: it.quantity,
        lineTotal,
        note: it.note,
      });
    }

    // 2. Resolve or provision a backing Product anchor for dining line items
    let diningProduct = await tx.product.findFirst({
      where: { tenantId, slug: "dining-menu" },
      include: { variants: true },
    });

    if (!diningProduct) {
      diningProduct = await tx.product.create({
        data: {
          tenantId,
          title: "Restaurant Dining Menu",
          slug: "dining-menu",
          descriptionHtml: "<p>Internal catalog anchor for in-restaurant table and dining orders</p>",
          basePrice: 0,
          status: "ACTIVE",
          variants: {
            create: [
              {
                tenantId,
                title: "Regular",
                sku: "DINE-MENU",
                price: 0,
                stockQuantity: 999999,
                options: {},
              },
            ],
          },
        },
        include: { variants: true },
      });
    }

    const resolvedProduct = diningProduct;
    if (!resolvedProduct) {
      throw new ValidationError("Failed to initialize dining menu catalog anchor.");
    }

    const variantId = resolvedProduct.variants[0]?.id;

    // 3. Increment tenant order counter atomically
    let orderNumber: string;
    try {
      const [counter] = await tx.$queryRaw<{ orderPrefix: string; n: number }[]>`
        UPDATE "Tenant" SET "nextOrderNumber" = "nextOrderNumber" + 1 WHERE "id" = ${tenantId}
        RETURNING "orderPrefix", ("nextOrderNumber" - 1)::int AS n`;
      orderNumber = counter ? `${counter.orderPrefix}${counter.n}` : `TBL-${Date.now().toString().slice(-6)}`;
    } catch {
      orderNumber = `TBL-${Date.now().toString().slice(-6)}`;
    }

    // 4. Upsert customer record
    const [customer] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "email", "totalOrders", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${guestName}, ${phone}, ${input.customerEmail ?? null}, 1, now())
      ON CONFLICT ("tenantId", "phone") DO UPDATE
        SET "totalOrders" = "Customer"."totalOrders" + 1, "updatedAt" = now()
      RETURNING "id"`;

    if (!customer?.id) {
      throw new ValidationError("Failed to register customer for table order.");
    }

    // 5. Create Order record with TABLE_ORDER channel
    const notesText = input.notes ? `Table ${table} | ${input.notes}` : `Table ${table}`;
    const order = await tx.order.create({
      data: {
        tenantId,
        orderNumber,
        customerId: customer.id,
        customerName: guestName,
        customerPhone: phone,
        customerEmail: input.customerEmail ?? null,
        shippingAddress: `Dine-in: Table ${table}`,
        shippingCity: "Dhaka",
        shippingDistrict: "Dhaka",
        shippingDivision: "Dhaka",
        deliveryZone: "INSIDE_DHAKA",
        channel: "TABLE_ORDER",
        status: "PENDING",
        paymentStatus: "UNPAID",
        paymentMethod: "COD",
        subtotalAmount: subtotal,
        deliveryCharge: 0,
        totalAmount: subtotal,
        notes: notesText,
        tags: [`Table ${table}`, "Dine-In"],
        items: {
          create: lines.map((l) => ({
            tenantId,
            productId: resolvedProduct.id,
            variantId,
            productTitle: l.name,
            variantTitle: l.note ? `Note: ${l.note}` : undefined,
            sku: `DISH-${l.menuItemId.slice(-6)}`,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            totalPrice: l.lineTotal,
          })),
        },
      },
    });

    // 6. Record initial timeline event
    try {
      await recordOrderEvent(tx, tenantId, order.id, {
        type: "PLACED",
        message: `Table order placed from Table ${table} (${lines.length} dish${lines.length === 1 ? "" : "es"})`,
        actor: { name: `Guest (Table ${table})` },
        data: { channel: "TABLE_ORDER", table },
      });
    } catch {
      // Non-blocking timeline event
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      table,
      totalAmount: subtotal,
      subtotalAmount: subtotal,
      itemCount: lines.length,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      items: lines,
    };
  });

  // Outbound Webhook dispatch (non-blocking)
  emitMerchantWebhookEvent(tenantId, "order.created", {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    table: result.table,
    customer: {
      name: guestName,
      phone,
      address: `Dine-in: Table ${result.table}`,
    },
    subtotal: result.subtotalAmount,
    deliveryFee: 0,
    total: result.totalAmount,
    paymentMethod: "COD",
    items: result.items.map((l) => ({
      sku: `DISH-${l.menuItemId.slice(-6)}`,
      title: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
  }).catch((err) => {
    console.warn("[table-orders] Webhook emission warning:", err instanceof Error ? err.message : err);
  });

  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    table: result.table,
    totalAmount: result.totalAmount,
    subtotalAmount: result.subtotalAmount,
    itemCount: result.itemCount,
    status: result.status,
    createdAt: result.createdAt,
    items: result.items,
  };
}
