import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveMerchantWebhookSubscription,
  __resetMemoryWebhooks,
  emitMerchantWebhookEvent,
  WEBHOOK_EVENTS,
} from "../src/messaging/webhook";
import {
  __getMemoryNotificationJobs,
  __resetMemoryNotificationQueue,
} from "../src/messaging/queue";
import { createPublicLead } from "../src/site/leads";
import { createPublicBooking } from "../src/site/bookings";
import type { StaffActor } from "../src/permissions";

const mockTx = {
  siteLead: {
    create: vi.fn().mockImplementation(async ({ data }) => ({
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...data,
      status: "NEW",
      createdAt: new Date(),
    })),
  },
  bookingRequest: {
    create: vi.fn().mockImplementation(async ({ data }) => ({
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...data,
      status: "PENDING",
      createdAt: new Date(),
    })),
  },
  storeSettings: {
    findFirst: vi.fn().mockResolvedValue({
      whatsappNumber: "01700000000",
      contactPhone: "01700000000",
      storeName: "Test Store",
    }),
  },
  webhookSubscription: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
};

vi.mock("@biztrackbd/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@biztrackbd/db")>();
  return {
    ...actual,
    withTenant: vi.fn().mockImplementation(async (_tenantId, fn) => fn(mockTx)),
  };
});

describe("Webhook Emission Wiring Integration Tests", () => {
  const tenantId = "tenant-webhook-wiring";
  const ownerActor: StaffActor = {
    userId: "usr_owner_wiring",
    email: "owner@wiring.com",
    role: "STORE_OWNER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    __resetMemoryWebhooks();
    __resetMemoryNotificationQueue();
  });

  it("verifies all 5 canonical events exist in WEBHOOK_EVENTS catalog", () => {
    const keys = WEBHOOK_EVENTS.map((e) => e.key);
    expect(keys).toContain("order.created");
    expect(keys).toContain("order.delivered");
    expect(keys).toContain("lead.created");
    expect(keys).toContain("booking.created");
    expect(keys).toContain("customer.registered");
  });

  describe("Public Leads & Bookings Webhook Wiring", () => {
    it("dispatches lead.created webhook to outbox on public lead capture", async () => {
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://zapier.example.com/hooks/catch/lead",
        events: ["lead.created"],
        isActive: true,
      });

      const lead = await createPublicLead(tenantId, {
        name: "Tamanna Rahman",
        phone: "01755123456",
        email: "tamanna@example.com",
        message: "Requesting pricing for 50 custom corporate hampers",
        sourcePage: "https://store.biztrack.bd/corporate",
        elapsedMs: 2500,
      });

      expect(lead.id).toBeDefined();

      // Wait for non-blocking outbox enqueue to resolve
      await new Promise((r) => setTimeout(r, 20));

      // Check durable outbox queue
      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);

      const job = jobs[0]!;
      expect(job.event).toBe("lead.created");
      expect(job.recipient).toBe("https://zapier.example.com/hooks/catch/lead");

      const envelope = JSON.parse(job.body);
      expect(envelope.event).toBe("lead.created");
      expect(envelope.tenantId).toBe(tenantId);
      expect(envelope.data.leadId).toBe(lead.id);
      expect(envelope.data.name).toBe("Tamanna Rahman");
      expect(envelope.data.phone).toBe("01755123456");
      expect(envelope.data.email).toBe("tamanna@example.com");
      expect(envelope.data.message).toContain("pricing for 50 custom corporate hampers");
      expect(envelope.data.sourceUrl).toBe("https://store.biztrack.bd/corporate");
    });

    it("dispatches booking.created webhook to outbox on public booking", async () => {
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://make.example.com/webhook/booking",
        events: ["booking.created"],
        isActive: true,
      });

      const booking = await createPublicBooking(tenantId, {
        name: "Dr. Nazmul Huda",
        phone: "01812987654",
        email: "nazmul@clinic.bd",
        serviceName: "Executive Health Consultation",
        requestedDate: "2026-10-25T11:00:00.000Z",
        partySize: 2,
        message: "First appointment, request morning slot",
        elapsedMs: 3200,
      });

      expect(booking.bookingId).toBeDefined();

      // Wait for non-blocking outbox enqueue to resolve
      await new Promise((r) => setTimeout(r, 20));

      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);

      const job = jobs[0]!;
      expect(job.event).toBe("booking.created");
      expect(job.recipient).toBe("https://make.example.com/webhook/booking");

      const envelope = JSON.parse(job.body);
      expect(envelope.event).toBe("booking.created");
      expect(envelope.tenantId).toBe(tenantId);
      expect(envelope.data.bookingId).toBe(booking.bookingId);
      expect(envelope.data.guestName).toBe("Dr. Nazmul Huda");
      expect(envelope.data.phone).toBe("01812987654");
      expect(envelope.data.serviceName).toBe("Executive Health Consultation");
      expect(envelope.data.scheduledAt).toBe("2026-10-25T11:00:00.000Z");
      expect(envelope.data.partySize).toBe(2);
      expect(envelope.data.notes).toBe("First appointment, request morning slot");
      expect(envelope.data.status).toBe("PENDING");
    });
  });

  describe("Order Lifecycle & Customer Registration Webhook Wiring", () => {
    it("formats and enqueues order.created payload to outbox", async () => {
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://zapier.example.com/hooks/catch/order",
        events: ["order.created"],
        isActive: true,
      });

      await emitMerchantWebhookEvent(tenantId, "order.created", {
        orderId: "ord_wiring_101",
        orderNumber: "BT-90210",
        customer: {
          name: "Kazi Anis",
          phone: "01711223344",
          address: "House 10, Road 5, Banani, Dhaka",
        },
        subtotal: 3500,
        deliveryFee: 80,
        total: 3580,
        paymentMethod: "COD",
        items: [
          { sku: "SHIRT-SLIM-M", title: "Oxford Cotton Shirt", quantity: 2, unitPrice: 1750 },
        ],
      });

      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);

      const job = jobs[0]!;
      expect(job.event).toBe("order.created");
      const envelope = JSON.parse(job.body);
      expect(envelope.data.orderNumber).toBe("BT-90210");
      expect(envelope.data.customer.name).toBe("Kazi Anis");
      expect(envelope.data.total).toBe(3580);
      expect(envelope.data.items[0].sku).toBe("SHIRT-SLIM-M");
    });

    it("formats and enqueues order.delivered payload to outbox", async () => {
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://zapier.example.com/hooks/catch/delivered",
        events: ["order.delivered"],
        isActive: true,
      });

      await emitMerchantWebhookEvent(tenantId, "order.delivered", {
        orderId: "ord_wiring_101",
        orderNumber: "BT-90210",
        courier: "STEADFAST",
        consignmentId: "SF-987654321",
        deliveredAt: "2026-10-18T10:00:00.000Z",
        totalCollected: 3580,
        settlementStatus: "COLLECTED_UNSETTLED",
      });

      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);

      const job = jobs[0]!;
      expect(job.event).toBe("order.delivered");
      const envelope = JSON.parse(job.body);
      expect(envelope.data.courier).toBe("STEADFAST");
      expect(envelope.data.consignmentId).toBe("SF-987654321");
      expect(envelope.data.totalCollected).toBe(3580);
    });

    it("formats and enqueues customer.registered payload to outbox", async () => {
      await saveMerchantWebhookSubscription(tenantId, ownerActor, {
        targetUrl: "https://zapier.example.com/hooks/catch/customer",
        events: ["customer.registered"],
        isActive: true,
      });

      await emitMerchantWebhookEvent(tenantId, "customer.registered", {
        customerId: "cust_wiring_888",
        name: "Shakib Al Hasan",
        phone: "01999887766",
        registeredAt: "2026-10-18T09:30:00.000Z",
      });

      const jobs = __getMemoryNotificationJobs().filter(
        (j) => j.tenantId === tenantId && j.channel === "WEBHOOK"
      );
      expect(jobs.length).toBe(1);

      const job = jobs[0]!;
      expect(job.event).toBe("customer.registered");
      const envelope = JSON.parse(job.body);
      expect(envelope.data.customerId).toBe("cust_wiring_888");
      expect(envelope.data.name).toBe("Shakib Al Hasan");
      expect(envelope.data.phone).toBe("01999887766");
    });
  });
});
