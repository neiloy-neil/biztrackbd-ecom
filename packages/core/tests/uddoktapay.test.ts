import { describe, expect, it, beforeAll, beforeEach, afterEach } from "vitest";
import {
  createUddoktaPayCharge,
  verifyUddoktaPayPayment,
  processUddoktaPayOrderSuccess,
  processUddoktaPaySubscriptionSuccess,
  setUddoktaPayFetchForTests,
  DEFAULT_UDDOKTAPAY_API_KEY,
  DEFAULT_UDDOKTAPAY_BASE_URL,
} from "../src/payments/uddoktapay";
import { withTenant } from "@biztrackbd/db";
import { randomBytes, randomUUID } from "node:crypto";
import { getStoreUddoktaPayConfig, saveIntegration, getPlatformUddoktaPayCredentials } from "../src";
import { getPlatformPrisma } from "@biztrackbd/db";

describe("UddoktaPay Automated Payment Engine", () => {
  beforeAll(() => {
    process.env.INTEGRATION_VAULT_SECRET = randomBytes(32).toString("hex");
  });

  beforeEach(() => {
    setUddoktaPayFetchForTests(undefined);
  });

  afterEach(() => {
    setUddoktaPayFetchForTests(undefined);
  });

  it("creates a checkout-v2 charge with correct headers and payload", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    setUddoktaPayFetchForTests(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          status: true,
          payment_url: "https://sandbox.uddoktapay.com/checkout/inv_12345",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await createUddoktaPayCharge({
      fullName: "Arif Hossain",
      email: "arif@example.com",
      amount: 1550,
      metadata: { orderId: "ord_001", tenantId: "ten_001" },
      redirectUrl: "https://mystore.biztrack.bd/api/payments/uddoktapay/callback",
      cancelUrl: "https://mystore.biztrack.bd/checkout?cancelled=1",
    });

    expect(capturedUrl).toBe("https://sandbox.uddoktapay.com/api/checkout-v2");
    expect(capturedHeaders["RT-UDDOKTAPAY-API-KEY"]).toBe(DEFAULT_UDDOKTAPAY_API_KEY);
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedBody.full_name).toBe("Arif Hossain");
    expect(Number(capturedBody.amount)).toBe(1550);
    expect(capturedBody.metadata.orderId).toBe("ord_001");
    expect(res.status).toBe(true);
    expect(res.paymentUrl).toBe("https://sandbox.uddoktapay.com/checkout/inv_12345");
  });

  it("verifies payment via /api/verify-payment", async () => {
    let capturedBody: any = null;

    setUddoktaPayFetchForTests(async (url, init) => {
      capturedBody = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          invoice_id: "inv_12345",
          amount: "1550.00",
          payment_method: "bkash",
          transaction_id: "TRX998877",
          sender_number: "01712345678",
          metadata: { orderId: "ord_001", tenantId: "ten_001" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const verify = await verifyUddoktaPayPayment({ invoiceId: "inv_12345" });
    expect(capturedBody.invoice_id).toBe("inv_12345");
    expect(verify.status).toBe("COMPLETED");
    expect(verify.transactionId).toBe("TRX998877");
    expect(verify.paymentMethod).toBe("bkash");
    expect(verify.senderNumber).toBe("01712345678");
  });

  it("processes order success and marks order as PAID with state log", async () => {
    const tenantId = `test_tenant_${randomUUID().slice(0, 8)}`;
    const orderId = `test_order_${randomUUID().slice(0, 8)}`;

    // Create a mock tenant and order
    await withTenant(tenantId, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: "Test Store",
          subdomain: `sub${randomUUID().slice(0, 8)}`,
          status: "ACTIVE",
          trialEndsAt: new Date(Date.now() + 86400000),
        },
      });

      await tx.order.create({
        data: {
          id: orderId,
          tenantId,
          orderNumber: "BT-99901",
          customerName: "Buyer",
          customerPhone: "01711223344",
          shippingAddress: "House 1, Road 2, Dhaka",
          shippingCity: "Mirpur",
          shippingDistrict: "Dhaka",
          shippingDivision: "Dhaka",
          deliveryZone: "Dhaka",
          subtotalAmount: 1400,
          deliveryCharge: 100,
          totalAmount: 1500,
          paymentMethod: "GATEWAY_UDDOKTAPAY",
          paymentStatus: "UNPAID",
          channel: "STOREFRONT",
        },
      });
    });

    setUddoktaPayFetchForTests(async () => {
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          invoice_id: "inv_9988",
          amount: "1500.00",
          payment_method: "nagad",
          transaction_id: "NAGAD_TRX_123",
          sender_number: "01811223344",
          metadata: { orderId, tenantId },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    // The store has its own UddoktaPay keys; without them it has no online payment at all.
    await saveIntegration(tenantId, { provider: "UDDOKTAPAY", mode: "LIVE", config: { baseUrl: "https://pay.example-store.test" }, secrets: { apiKey: "store-own-key-123" } });

    const res = await processUddoktaPayOrderSuccess(tenantId, "inv_9988");
    expect(res.ok).toBe(true);
    expect(res.orderId).toBe(orderId);

    // Verify order in DB
    await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.mfsTrxId).toBe("NAGAD_TRX_123");
      expect(order?.mfsSenderNumber).toBe("01811223344");
      expect(order?.mfsVerifiedAt).toBeDefined();

      const logs = await tx.orderStateLog.findMany({ where: { orderId } });
      expect(logs.some((l) => l.actorId === "uddoktapay")).toBe(true);
    });
  });

  it("processes subscription success and auto-activates tenant plan", async () => {
    const tenantId = `test_tenant_sub_${randomUUID().slice(0, 8)}`;

    await withTenant(tenantId, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: "Sub Test Store",
          subdomain: `sub2${randomUUID().slice(0, 8)}`,
          status: "TRIAL",
          planTier: "STARTER",
          trialEndsAt: new Date(Date.now() + 86400000),
        },
      });
    });

    const dynamicTrx = `BKASH_SUB_TRX_${randomUUID().slice(0, 8)}`;
    setUddoktaPayFetchForTests(async () => {
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          invoice_id: "inv_sub_555",
          amount: "1990.00",
          payment_method: "bkash",
          transaction_id: dynamicTrx,
          sender_number: "01999888777",
          metadata: { tenantId, plan: "PRO", interval: "MONTHLY", type: "subscription" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await processUddoktaPaySubscriptionSuccess("inv_sub_555");
    expect(res.ok).toBe(true);
    expect(res.tenantId).toBe(tenantId);
    expect(res.plan).toBe("PRO");

    // Verify subscription and payment proof in DB
    await withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      expect(tenant?.status).toBe("ACTIVE");

      const sub = await tx.subscription.findUnique({ where: { tenantId } });
      expect(sub?.status).toBe("ACTIVE");
      expect(sub?.planTier).toBe("PRO");
      expect(sub?.gateway).toBe("UDDOKTAPAY");

      const proof = await tx.paymentProof.findFirst({ where: { tenantId, trxId: dynamicTrx } });
      expect(proof?.status).toBe("APPROVED");
      expect(proof?.mfsProvider).toBe("BKASH");
      expect(proof?.senderNumber).toBe("01999888777");
    });

    // The gateway's webhook (or a refreshed return page) reports the same payment again: nothing changes, nothing is added.
    const before = await withTenant(tenantId, (tx) => tx.subscription.findUniqueOrThrow({ where: { tenantId } }));
    await new Promise((r) => setTimeout(r, 25));
    const again = await processUddoktaPaySubscriptionSuccess("inv_sub_555");
    expect(again.ok).toBe(true);
    await withTenant(tenantId, async (tx) => {
      const sub = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
      expect(sub.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime());
      expect(sub.currentPeriodStart.getTime()).toBe(before.currentPeriodStart.getTime());
      expect(await tx.paymentProof.count({ where: { tenantId, trxId: dynamicTrx } })).toBe(1);
    });
  });
  it("a store with no keys of its own gets no gateway: it never falls back to BizTrackBD's key", async () => {
    const tenantId = `test_tenant_nokey_${randomUUID().slice(0, 8)}`;
    await withTenant(tenantId, async (tx) => {
      await tx.tenant.create({ data: { id: tenantId, name: "No Key Store", subdomain: `nk${randomUUID().slice(0, 8)}`, status: "ACTIVE", planTier: "PRO", trialEndsAt: new Date(Date.now() + 86400000) } });
    });

    const cfg = await getStoreUddoktaPayConfig(tenantId);
    expect(cfg.isCustom).toBe(false);
    expect(cfg.apiKey).toBe("");

    let called = false;
    setUddoktaPayFetchForTests(async () => {
      called = true;
      return new Response("{}", { status: 200 });
    });
    await expect(processUddoktaPayOrderSuccess(tenantId, "inv_x")).rejects.toThrow(/not set up for this store/i);
    expect(called).toBe(false);
  });

  it("plan payments use the account saved in Platform Admin, and fall back to the environment only when nothing is saved", async () => {
    const db = getPlatformPrisma();
    await db.platformConfig.deleteMany({ where: { key: { in: ["uddoktapay_api_key", "uddoktapay_base_url"] } } });
    const before = await getPlatformUddoktaPayCredentials();
    expect(before === null || before.apiKey === DEFAULT_UDDOKTAPAY_API_KEY).toBe(true);

    await db.platformConfig.create({ data: { key: "uddoktapay_api_key", value: "platform-saved-key-1", description: "test", updatedBy: "test" } });
    await db.platformConfig.create({ data: { key: "uddoktapay_base_url", value: "https://biztrack.paymently.io", description: "test", updatedBy: "test" } });
    expect(await getPlatformUddoktaPayCredentials()).toEqual({ apiKey: "platform-saved-key-1", baseUrl: "https://biztrack.paymently.io" });

    await db.platformConfig.deleteMany({ where: { key: { in: ["uddoktapay_api_key", "uddoktapay_base_url"] } } });
  });
});
