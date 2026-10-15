import { withTenant, Prisma } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import {
  CreateDropInput,
  UpdateDropInput,
  WaitlistSubscriptionInput,
  type DropDepositCalculation,
  type DropStatus,
} from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return "0" + digits.slice(3);
  if (digits.startsWith("88") && digits.length === 13) return "0" + digits.slice(2);
  if (digits.length === 11 && digits.startsWith("01")) return digits;
  return digits;
}

// ==========================================
// 1. ADMIN DROP MANAGEMENT
// ==========================================

export async function listDrops(
  tenantId: string,
  filter?: { status?: DropStatus; search?: string }
) {
  return withTenant(tenantId, async (tx) => {
    const where: Prisma.LimitedDropWhereInput = {
      tenantId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { slug: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const drops = await tx.limitedDrop.findMany({
      where,
      orderBy: { startsAt: "desc" },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                images: { take: 1, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        _count: {
          select: {
            subscribers: true,
          },
        },
      },
    });

    const now = new Date();

    return drops.map((d) => {
      let computedStatus: DropStatus = d.status;
      if (d.status === "SCHEDULED" && d.startsAt <= now) {
        computedStatus = "LIVE";
      }
      if (d.status === "LIVE" && d.endsAt && d.endsAt <= now) {
        computedStatus = "ENDED";
      }

      return {
        ...d,
        computedStatus,
        subscriberCount: d._count.subscribers,
        depositValueNumber: Number(d.depositValue),
      };
    });
  });
}

export async function getDropById(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const drop = await tx.limitedDrop.findFirst({
      where: { id, tenantId },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                images: { take: 1, orderBy: { sortOrder: "asc" } },
                variants: {
                  select: {
                    id: true,
                    title: true,
                    price: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { subscribers: true },
        },
      },
    });

    if (!drop) {
      throw new NotFoundError(`Drop with ID ${id} not found.`);
    }

    return {
      ...drop,
      subscriberCount: drop._count.subscribers,
      depositValueNumber: Number(drop.depositValue),
    };
  });
}

export async function createDrop(tenantId: string, input: CreateDropInput) {
  const parsed = CreateDropInput.parse(input);
  const baseSlug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.title);

  return withTenant(tenantId, async (tx) => {
    // Ensure slug uniqueness for tenant
    let slug = baseSlug;
    let suffix = 1;
    while (await tx.limitedDrop.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    // Auto-detect status if scheduled vs draft
    const now = new Date();
    let initialStatus = parsed.status;
    if (initialStatus === "DRAFT" && parsed.startsAt > now) {
      initialStatus = "SCHEDULED";
    } else if (initialStatus === "DRAFT" && parsed.startsAt <= now) {
      initialStatus = "LIVE";
    }

    const drop = await tx.limitedDrop.create({
      data: {
        tenantId,
        title: parsed.title,
        slug,
        description: parsed.description,
        bannerImage: parsed.bannerImage,
        mode: parsed.mode,
        status: initialStatus,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        estimatedShipDate: parsed.estimatedShipDate,
        depositType: parsed.depositType,
        depositValue: new Prisma.Decimal(parsed.depositValue),
        allocationCap: parsed.allocationCap,
        products: {
          create: parsed.productItems.map((item) => ({
            tenantId,
            productId: item.productId,
            variantId: item.variantId,
            allocatedQty: item.allocatedQty,
          })),
        },
      },
      include: {
        products: true,
      },
    });

    return drop;
  });
}

export async function updateDrop(tenantId: string, id: string, input: UpdateDropInput) {
  const parsed = UpdateDropInput.parse(input);

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.limitedDrop.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundError(`Drop with ID ${id} not found.`);

    let slug = existing.slug;
    if (parsed.slug && parsed.slug !== existing.slug) {
      const baseSlug = slugify(parsed.slug);
      slug = baseSlug;
      let suffix = 1;
      while (
        await tx.limitedDrop.findFirst({
          where: { tenantId, slug, NOT: { id } },
        })
      ) {
        slug = `${baseSlug}-${suffix++}`;
      }
    }

    // Update products relation if provided
    if (parsed.productItems) {
      await tx.dropProduct.deleteMany({
        where: { dropId: id, tenantId },
      });
      await tx.dropProduct.createMany({
        data: parsed.productItems.map((item) => ({
          tenantId,
          dropId: id,
          productId: item.productId,
          variantId: item.variantId,
          allocatedQty: item.allocatedQty,
        })),
      });
    }

    const updated = await tx.limitedDrop.update({
      where: { id },
      data: {
        title: parsed.title,
        slug,
        description: parsed.description,
        bannerImage: parsed.bannerImage,
        mode: parsed.mode,
        status: parsed.status,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        estimatedShipDate: parsed.estimatedShipDate,
        depositType: parsed.depositType,
        depositValue: parsed.depositValue !== undefined ? new Prisma.Decimal(parsed.depositValue) : undefined,
        allocationCap: parsed.allocationCap,
      },
      include: {
        products: true,
      },
    });

    return updated;
  });
}

export async function deleteDrop(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.limitedDrop.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundError(`Drop with ID ${id} not found.`);

    await tx.limitedDrop.delete({
      where: { id },
    });

    return { ok: true, deletedId: id };
  });
}

// ==========================================
// 2. WAITLIST SUBSCRIBERS & NOTIFICATIONS
// ==========================================

export async function subscribeDropWaitlist(tenantId: string, input: WaitlistSubscriptionInput) {
  const parsed = WaitlistSubscriptionInput.parse(input);
  const cleanPhone = cleanBdPhone(parsed.phone);

  if (!cleanPhone || cleanPhone.length < 11) {
    throw new ValidationError("Please provide a valid Bangladeshi mobile number (01XXXXXXXXX).");
  }

  return withTenant(tenantId, async (tx) => {
    const drop = await tx.limitedDrop.findFirst({
      where: { id: parsed.dropId, tenantId },
    });
    if (!drop) throw new NotFoundError("Drop not found.");

    const subscriber = await tx.dropWaitlistSubscriber.upsert({
      where: {
        dropId_phone: {
          dropId: parsed.dropId,
          phone: cleanPhone,
        },
      },
      create: {
        tenantId,
        dropId: parsed.dropId,
        phone: cleanPhone,
        name: parsed.name,
      },
      update: {
        name: parsed.name || undefined,
      },
    });

    return {
      ok: true,
      subscriberId: subscriber.id,
      phone: subscriber.phone,
      dropTitle: drop.title,
    };
  });
}

export async function listDropSubscribers(tenantId: string, dropId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.dropWaitlistSubscriber.findMany({
      where: { dropId, tenantId },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function notifyDropWaitlistSubscribers(tenantId: string, dropId: string) {
  return withTenant(tenantId, async (tx) => {
    const drop = await tx.limitedDrop.findFirst({
      where: { id: dropId, tenantId },
    });
    if (!drop) throw new NotFoundError("Drop not found.");

    const unnotified = await tx.dropWaitlistSubscriber.findMany({
      where: { dropId, tenantId, notifiedAt: null },
      take: 200, // batch limit
    });

    if (unnotified.length === 0) {
      return { count: 0, message: "No unnotified subscribers on the waitlist." };
    }

    const now = new Date();
    await tx.dropWaitlistSubscriber.updateMany({
      where: {
        id: { in: unnotified.map((s) => s.id) },
        tenantId,
      },
      data: {
        notifiedAt: now,
      },
    });

    return {
      count: unnotified.length,
      dropTitle: drop.title,
      notifiedAt: now,
    };
  });
}

// ==========================================
// 3. FULFILLMENT & INVENTORY RECEIPT
// ==========================================

export async function markDropStockReceived(tenantId: string, dropId: string) {
  return withTenant(tenantId, async (tx) => {
    const drop = await tx.limitedDrop.findFirst({
      where: { id: dropId, tenantId },
    });
    if (!drop) throw new NotFoundError("Drop not found.");

    // Find all orders tagged with this drop currently in HOLD state
    const heldOrders = await tx.order.findMany({
      where: {
        tenantId,
        preOrderDropId: dropId,
        fraudReview: "HELD",
      },
      select: { id: true, orderNumber: true },
    });

    if (heldOrders.length > 0) {
      await tx.order.updateMany({
        where: {
          id: { in: heldOrders.map((o) => o.id) },
          tenantId,
        },
        data: {
          fraudReview: "CLEARED", // release fulfillment hold
        },
      });

      // Log order state release
      for (const order of heldOrders) {
        await tx.orderStateLog.create({
          data: {
            tenantId,
            orderId: order.id,
            fromStatus: "PENDING",
            toStatus: "CONFIRMED",
            actorType: "ADMIN",
            actorId: "system",
            reason: `Pre-order stock received for drop "${drop.title}". Fulfillment hold released.`,
          },
        });
      }
    }

    // Set drop status to ENDED if was LIVE
    if (drop.status === "LIVE") {
      await tx.limitedDrop.update({
        where: { id: dropId },
        data: { status: "ENDED" },
      });
    }

    return {
      ok: true,
      releasedOrderCount: heldOrders.length,
      dropTitle: drop.title,
    };
  });
}

// ==========================================
// 4. STOREFRONT PUBLIC QUERIES & DEPOSIT
// ==========================================

export async function getPublicDropBySlug(tenantId: string, slug: string) {
  return withTenant(tenantId, async (tx) => {
    const drop = await tx.limitedDrop.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: "asc" } },
                variants: {
                  where: { isActive: true },
                  orderBy: { price: "asc" },
                },
              },
            },
          },
        },
        _count: {
          select: { subscribers: true },
        },
      },
    });

    if (!drop) return null;

    const now = new Date();
    const isLive = drop.status === "LIVE" || (drop.startsAt <= now && (!drop.endsAt || drop.endsAt > now));
    const isUpcoming = drop.startsAt > now;
    const isEnded = (drop.endsAt && drop.endsAt <= now) || drop.status === "ENDED";

    return {
      ...drop,
      depositValueNumber: Number(drop.depositValue),
      isLive,
      isUpcoming,
      isEnded,
      subscriberCount: drop._count.subscribers,
    };
  });
}

export async function getActiveDropForProduct(tenantId: string, productId: string) {
  return withTenant(tenantId, async (tx) => {
    const dropProduct = await tx.dropProduct.findFirst({
      where: {
        tenantId,
        productId,
        drop: {
          status: { in: ["SCHEDULED", "LIVE"] },
        },
      },
      include: {
        drop: true,
      },
      orderBy: {
        drop: { startsAt: "asc" },
      },
    });

    if (!dropProduct || !dropProduct.drop) return null;

    const drop = dropProduct.drop;
    const now = new Date();
    const isLive = drop.status === "LIVE" || (drop.startsAt <= now && (!drop.endsAt || drop.endsAt > now));
    const isUpcoming = drop.startsAt > now;

    return {
      dropId: drop.id,
      title: drop.title,
      slug: drop.slug,
      mode: drop.mode,
      startsAt: drop.startsAt,
      endsAt: drop.endsAt,
      estimatedShipDate: drop.estimatedShipDate,
      depositType: drop.depositType,
      depositValue: Number(drop.depositValue),
      allocationCap: drop.allocationCap,
      claimedUnits: drop.claimedUnits,
      isLive,
      isUpcoming,
    };
  });
}

export function calculateDropDeposit(
  depositType: "NONE" | "FIXED" | "PERCENTAGE" | "FULL",
  depositValue: number,
  itemPrice: number
): DropDepositCalculation {
  if (depositType === "NONE" || (depositType !== "FULL" && depositValue <= 0)) {
    return {
      depositRequired: 0,
      balanceDue: itemPrice,
      depositType: "NONE",
      depositValue: 0,
      isPreOrder: true,
    };
  }

  let required = 0;
  if (depositType === "FULL") {
    required = itemPrice;
  } else if (depositType === "FIXED") {
    required = Math.min(itemPrice, depositValue);
  } else if (depositType === "PERCENTAGE") {
    required = Math.round((itemPrice * depositValue) / 100);
  }

  const balance = Math.max(0, itemPrice - required);

  return {
    depositRequired: required,
    balanceDue: balance,
    depositType,
    depositValue,
    isPreOrder: true,
  };
}
