import { withTenant, type SupportQuickReply } from "@biztrackbd/db";

export type { SupportQuickReply };

export interface CreateQuickReplyInput {
  shortcut: string;
  title: string;
  body: string;
  category?: string;
  sortOrder?: number;
}

export interface UpdateQuickReplyInput {
  shortcut?: string;
  title?: string;
  body?: string;
  category?: string;
  sortOrder?: number;
}

export const DEFAULT_BANGLA_QUICK_REPLIES: Omit<CreateQuickReplyInput, "id">[] = [
  {
    shortcut: "confirm",
    title: "Order Confirmed",
    category: "Orders",
    body: "ধন্যবাদ! আপনার অর্ডারটি কনফার্ম করা হয়েছে। আমরা খুব দ্রুত প্যাকেজিং শেষ করে কুরিয়ারে হ্যান্ডওভার করব।",
    sortOrder: 1,
  },
  {
    shortcut: "delivery",
    title: "Delivery Timeline",
    category: "Delivery",
    body: "আপনার পার্সেল কুরিয়ারে পাঠানো হয়েছে। ঢাকা সিটির ভেতরে ২৪-৪৮ ঘণ্টা এবং ঢাকার বাইরে ২-৩ কার্যদিবসের মধ্যে ডেলিভারি পৌঁছে যাবে।",
    sortOrder: 2,
  },
  {
    shortcut: "cod",
    title: "Cash on Delivery",
    category: "Payments",
    body: "ডেলিভারি ম্যানের কাছ থেকে পার্সেল গ্রহণের সময় মোট বিলের সঠিক ক্যাশ টাকা প্রস্তুত রাখুন। পার্সেল চেক করে গ্রহণ করুন।",
    sortOrder: 3,
  },
  {
    shortcut: "bkash",
    title: "bKash Payment",
    category: "Payments",
    body: "আমাদের বিকাশ মার্চেন্ট পেমেন্ট নম্বর: 01XXXXXXXXX (Make Payment)। রেফারেন্সে আপনার অর্ডার নম্বরটি লিখুন এবং পেমেন্ট শেষে TrxID টি এখানে মেসেজ দিন।",
    sortOrder: 4,
  },
  {
    shortcut: "address",
    title: "Address Request",
    category: "General",
    body: "অনুগ্রহ করে আপনার সম্পূর্ণ ডেলিভারি ঠিকানা, জেলা, থানা এবং সচল ফোন নম্বরটি এখানে লিখে পাঠান।",
    sortOrder: 5,
  },
  {
    shortcut: "thanks",
    title: "Thank You Note",
    category: "General",
    body: "আমাদের স্টোরে কেনাকাটা করার জন্য আন্তরিক ধন্যবাদ! যেকোনো প্রয়োজনে আমাদের সাথে যোগাযোগ রাখতে পারেন।",
    sortOrder: 6,
  },
];

/**
 * Lists canned quick replies for a store, seeding default templates on first access.
 */
export async function listSupportQuickReplies(tenantId: string): Promise<SupportQuickReply[]> {
  return withTenant(tenantId, async (tx) => {
    let rows = await tx.supportQuickReply.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (rows.length === 0) {
      // Seed default replies
      for (const tpl of DEFAULT_BANGLA_QUICK_REPLIES) {
        await tx.supportQuickReply.create({
          data: {
            tenantId,
            shortcut: tpl.shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
            title: tpl.title,
            body: tpl.body,
            category: tpl.category || "General",
            sortOrder: tpl.sortOrder || 0,
          },
        });
      }

      rows = await tx.supportQuickReply.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    }

    return rows;
  });
}

/**
 * Creates a new custom canned quick reply.
 */
export async function createSupportQuickReply(
  tenantId: string,
  input: CreateQuickReplyInput
): Promise<SupportQuickReply> {
  const cleanShortcut = input.shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanShortcut) throw new Error("Shortcut must contain alphanumeric characters (e.g. 'confirm', 'bkash')");
  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.body.trim()) throw new Error("Message body is required");

  return withTenant(tenantId, async (tx) => {
    return tx.supportQuickReply.create({
      data: {
        tenantId,
        shortcut: cleanShortcut,
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category?.trim() || "General",
        sortOrder: input.sortOrder ?? 0,
      },
    });
  });
}

/**
 * Updates an existing quick reply.
 */
export async function updateSupportQuickReply(
  tenantId: string,
  id: string,
  input: UpdateQuickReplyInput
): Promise<SupportQuickReply> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.supportQuickReply.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error("Quick reply not found");

    const data: any = {};
    if (input.shortcut !== undefined) {
      data.shortcut = input.shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    }
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.body !== undefined) data.body = input.body.trim();
    if (input.category !== undefined) data.category = input.category.trim();
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    return tx.supportQuickReply.update({
      where: { id },
      data,
    });
  });
}

/**
 * Deletes a quick reply.
 */
export async function deleteSupportQuickReply(tenantId: string, id: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const res = await tx.supportQuickReply.deleteMany({
      where: { id, tenantId },
    });
    return res.count > 0;
  });
}

/**
 * Resets tenant quick replies back to initial default presets.
 */
export async function resetSupportQuickRepliesToDefault(tenantId: string): Promise<SupportQuickReply[]> {
  return withTenant(tenantId, async (tx) => {
    await tx.supportQuickReply.deleteMany({ where: { tenantId } });
    for (const tpl of DEFAULT_BANGLA_QUICK_REPLIES) {
      await tx.supportQuickReply.create({
        data: {
          tenantId,
          shortcut: tpl.shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
          title: tpl.title,
          body: tpl.body,
          category: tpl.category || "General",
          sortOrder: tpl.sortOrder || 0,
        },
      });
    }

    return tx.supportQuickReply.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  });
}
