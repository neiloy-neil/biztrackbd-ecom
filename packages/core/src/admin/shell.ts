import { withTenant } from "@biztrackbd/db";
import { can, type StaffActor } from "../permissions";

export interface SearchHit {
  kind: "order" | "product" | "customer";
  id: string;
  title: string;
  sub: string;
  href: string;
}

/** Top few matches across orders, products and customers, only in the areas this person may see. Powers the Ctrl+K box. */
export async function adminSearch(tenantId: string, actor: StaffActor, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return [];
  // Prisma passes "contains" to LIKE as is, so a typed % or _ would act as a wildcard. Escape them.
  const like = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const digits = q.replace(/\D/g, "");
  const phone = digits.length >= 4 ? digits.replace(/^880/, "0") : null;

  return withTenant(tenantId, async (tx) => {
    // One query at a time: a transaction owns a single connection, and overlapping queries on it are deprecated in pg.
    const orders = can(actor.role, "orders")
      ? await tx.order.findMany({
          where: { deletedAt: null, OR: [{ orderNumber: { contains: like, mode: "insensitive" } }, { customerName: { contains: like, mode: "insensitive" } }, ...(phone ? [{ customerPhone: { contains: phone } }] : [])] },
          orderBy: { createdAt: "desc" }, take: 5, select: { id: true, orderNumber: true, customerName: true, totalAmount: true, status: true },
        })
      : [];
    const products = can(actor.role, "products")
      ? await tx.product.findMany({
          where: { deletedAt: null, OR: [{ title: { contains: like, mode: "insensitive" } }, { sku: { contains: like, mode: "insensitive" } }] },
          orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, status: true, sku: true },
        })
      : [];
    const customers = can(actor.role, "customers")
      ? await tx.customer.findMany({
          where: { OR: [{ name: { contains: like, mode: "insensitive" } }, { email: { contains: like, mode: "insensitive" } }, ...(phone ? [{ phone: { contains: phone } }] : [])] },
          orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, phone: true },
        })
      : [];
    return [
      ...orders.map<SearchHit>((o) => ({ kind: "order", id: o.id, title: o.orderNumber, sub: `${o.customerName} · ৳${Math.round(Number(o.totalAmount)).toLocaleString("en-US")} · ${o.status.toLowerCase().replace(/_/g, " ")}`, href: `/orders/${o.id}` })),
      ...products.map<SearchHit>((p) => ({ kind: "product", id: p.id, title: p.title, sub: `${p.status.toLowerCase()}${p.sku ? ` · ${p.sku}` : ""}`, href: `/products/${p.id}` })),
      ...customers.map<SearchHit>((c) => ({ kind: "customer", id: c.id, title: c.name || c.phone, sub: c.phone, href: `/customers/${c.id}` })),
    ];
  });
}

export interface ShellCounts {
  /** bKash or Nagad payments waiting for someone to check. */
  check: number;
  newOrders: number;
  toPack: number;
  returnsPending: number;
  lowStock: number;
  /** The newest few things worth a look, for the bell. */
  items: { key: string; text: string; href: string; tone: "bad" | "warn" | "info"; count: number }[];
}

/** Light numbers for the sidebar badges and the notifications bell. Cheap enough to ask every half minute. */
export async function shellCounts(tenantId: string, actor: StaffActor): Promise<ShellCounts> {
  const sees = (a: Parameters<typeof can>[1]) => can(actor.role, a);
  return withTenant(tenantId, async (tx) => {
    // One query at a time, for the same reason as above.
    const check = sees("orders") ? await tx.order.count({ where: { deletedAt: null, paymentStatus: "PENDING_VERIFICATION", status: { notIn: ["CANCELLED", "REFUNDED"] } } }) : 0;
    const newOrders = sees("orders") ? await tx.order.count({ where: { deletedAt: null, status: "PENDING" } }) : 0;
    const toPack = sees("orders") ? await tx.order.count({ where: { deletedAt: null, status: { in: ["CONFIRMED", "PROCESSING"] } } }) : 0;
    const returnsPending = sees("orders") ? await tx.returnRequest.count({ where: { status: "PENDING" } }) : 0;
    const low = sees("products")
      ? ((await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p.status = 'ACTIVE' AND p."deletedAt" IS NULL AND v."stockQuantity" <= v."reorderLevel"`)[0]?.n ?? 0)
      : 0;
    const items: ShellCounts["items"] = [];
    if (check > 0) items.push({ key: "check", text: `${check} ${check === 1 ? "payment" : "payments"} to check`, href: "/orders?tab=check", tone: "bad", count: check });
    if (newOrders > 0) items.push({ key: "new", text: `${newOrders} new ${newOrders === 1 ? "order" : "orders"}`, href: "/orders?tab=new", tone: "info", count: newOrders });
    if (returnsPending > 0) items.push({ key: "returns", text: `${returnsPending} ${returnsPending === 1 ? "return" : "returns"} waiting`, href: "/returns", tone: "warn", count: returnsPending });
    if (low > 0) items.push({ key: "stock", text: `${low} ${low === 1 ? "item" : "items"} low on stock`, href: "/inventory", tone: "warn", count: low });
    return { check, newOrders, toPack, returnsPending, lowStock: low, items };
  });
}
