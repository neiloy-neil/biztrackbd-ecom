import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTableOrder,
  CreateTableOrderSchema,
  emitMerchantWebhookEvent,
  saveMerchantWebhookSubscription,
  __resetMemoryWebhooks,
} from "../src";
import {
  __getMemoryNotificationJobs,
  __resetMemoryNotificationQueue,
} from "../src/messaging/queue";
import type { StaffActor } from "../src/permissions";

const mockDishes = [
  {
    id: "dish_kacchi_1",
    tenantId: "tenant_dining_1",
    name: "Kacchi Biryani Platter",
    nameBn: "কাচ্চি বিরিয়ানি প্ল্যাটার",
    price: 450,
    isAvailable: true,
  },
  {
    id: "dish_borhani_2",
    tenantId: "tenant_dining_1",
    name: "Borhani (Glass)",
    nameBn: "বোরহানি",
    price: 80,
    isAvailable: true,
  },
  {
    id: "dish_sold_out_3",
    tenantId: "tenant_dining_1",
    name: "Special Firni",
    nameBn: "স্পেশাল ফিরনি",
    price: 120,
    isAvailable: false,
  },
];

const mockTx = {
  menuItem: {
    findMany: vi.fn().mockImplementation(async ({ where }) => {
      const ids: string[] = where?.id?.in || [];
      return mockDishes.filter((d) => ids.includes(d.id));
    }),
  },
  product: {
    findFirst: vi.fn().mockResolvedValue({
      id: "prod_dining_anchor",
      slug: "dining-menu",
      variants: [{ id: "var_dining_regular" }],
    }),
    create: vi.fn(),
  },
  $queryRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
    const raw = strings.join(" ");
    if (raw.includes("Tenant")) {
      return [{ orderPrefix: "TBL-", n: 1042 }];
    }
    if (raw.includes("Customer")) {
      return [{ id: "cust_dining_1" }];
    }
    return [];
  }),
  order: {
    create: vi.fn().mockImplementation(async ({ data }) => ({
      id: "ord_table_1042",
      orderNumber: data.orderNumber,
      status: "PENDING",
      createdAt: new Date(),
      totalAmount: data.totalAmount,
      subtotalAmount: data.subtotalAmount,
      ...data,
    })),
  },
  orderEvent: {
    create: vi.fn().mockResolvedValue({ id: "evt_1" }),
  },
};

vi.mock("@biztrackbd/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@biztrackbd/db")>();
  return {
    ...actual,
    withTenant: vi.fn().mockImplementation(async (_tenantId, fn) => fn(mockTx)),
  };
});

describe("Digital Table Ordering & Kitchen Slip Integration Tests", () => {
  const tenantId = "tenant_dining_1";
  const ownerActor: StaffActor = {
    userId: "usr_owner_dining",
    email: "owner@diningbistro.com",
    role: "STORE_OWNER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    __resetMemoryWebhooks();
    __resetMemoryNotificationQueue();
  });

  describe("Schema Validation", () => {
    it("validates valid table order input", () => {
      const parsed = CreateTableOrderSchema.safeParse({
        table: "4",
        customerPhone: "01712345678",
        customerName: "Tanvir Ahmed",
        notes: "Less spicy",
        items: [{ menuItemId: "dish_kacchi_1", quantity: 2, note: "Extra alu" }],
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects when table number is empty", () => {
      const parsed = CreateTableOrderSchema.safeParse({
        table: "   ",
        customerPhone: "01712345678",
        items: [{ menuItemId: "dish_kacchi_1", quantity: 1 }],
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("Table number is required");
      }
    });

    it("rejects when items array is empty", () => {
      const parsed = CreateTableOrderSchema.safeParse({
        table: "VIP-2",
        customerPhone: "01712345678",
        items: [],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("createTableOrder Service Execution", () => {
    it("successfully creates table order and emits order.created webhook event", async () => {
      // 1. Subscribe to order.created webhook
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://pos-kitchen.example.com/webhooks/orders",
        events: ["order.created"],
        isActive: true,
      });

      // 2. Submit table order
      const result = await createTableOrder(tenantId, {
        table: "4",
        customerPhone: "01712345678",
        customerName: "Rahim Chowdhury",
        notes: "Serve drinks first",
        items: [
          { menuItemId: "dish_kacchi_1", quantity: 2, note: "Extra meat" },
          { menuItemId: "dish_borhani_2", quantity: 2 },
        ],
      });

      // 3. Verify returned order details
      expect(result.orderNumber).toBe("TBL-1042");
      expect(result.table).toBe("4");
      // 2x 450 + 2x 80 = 900 + 160 = 1060
      expect(result.totalAmount).toBe(1060);
      expect(result.subtotalAmount).toBe(1060);
      expect(result.itemCount).toBe(2);
      expect(result.status).toBe("PENDING");
      expect(result.items).toHaveLength(2);

      // 4. Verify Order was created with TABLE_ORDER channel & table tags
      expect(mockTx.order.create).toHaveBeenCalledTimes(1);
      const createdData = mockTx.order.create.mock.calls[0]![0].data;
      expect(createdData.channel).toBe("TABLE_ORDER");
      expect(createdData.shippingAddress).toBe("Dine-in: Table 4");
      expect(createdData.notes).toBe("Table 4 | Serve drinks first");
      expect(createdData.tags).toEqual(["Table 4", "Dine-In"]);
      expect(createdData.customerName).toBe("Rahim Chowdhury");
      expect(createdData.totalAmount).toBe(1060);

      // 5. Wait for non-blocking outbox enqueue to resolve
      await new Promise((r) => setTimeout(r, 25));

      // 6. Verify outbound webhook job was enqueued for order.created
      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);
      const job = jobs[0]!;
      expect(job.event).toBe("order.created");
      expect(job.recipient).toBe("https://pos-kitchen.example.com/webhooks/orders");

      const envelope = JSON.parse(job.body);
      expect(envelope.event).toBe("order.created");
      expect(envelope.data.table).toBe("4");
      expect(envelope.data.total).toBe(1060);
      expect(envelope.data.items).toHaveLength(2);
    });

    it("rejects order when a dish is sold out", async () => {
      await expect(
        createTableOrder(tenantId, {
          table: "7",
          customerPhone: "01812345678",
          items: [{ menuItemId: "dish_sold_out_3", quantity: 1 }],
        })
      ).rejects.toThrow('currently sold out');
    });

    it("rejects order when a dish ID does not exist", async () => {
      await expect(
        createTableOrder(tenantId, {
          table: "7",
          customerPhone: "01812345678",
          items: [{ menuItemId: "dish_ghost_999", quantity: 1 }],
        })
      ).rejects.toThrow('no longer on the menu');
    });
  });
});
