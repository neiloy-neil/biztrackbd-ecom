import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { withTenant } from "@biztrackbd/db";
import { createOwnerClient, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { DomainError, processUddoktaPayOrderSuccess, saveIntegration, setUddoktaPayFetchForTests } from "../src";

async function orderOf(total: number) {
  const tenantId = `amt_tenant_${randomUUID().slice(0, 8)}`;
  const orderId = `amt_order_${randomUUID().slice(0, 8)}`;
  await withTenant(tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, name: "Amount Store", subdomain: `amt${randomUUID().slice(0, 8)}`, status: "ACTIVE", planTier: "BUSINESS", trialEndsAt: new Date(Date.now() + 86400000) } });
    await tx.order.create({
      data: {
        id: orderId, tenantId, orderNumber: "BT-99902", customerName: "Buyer", customerPhone: "01711223344", shippingAddress: "House 1, Road 2, Dhaka", shippingCity: "Mirpur",
        shippingDistrict: "Dhaka", shippingDivision: "Dhaka", deliveryZone: "Dhaka", subtotalAmount: total - 100, deliveryCharge: 100, totalAmount: total,
        paymentMethod: "GATEWAY_UDDOKTAPAY", paymentStatus: "UNPAID", channel: "STOREFRONT",
      },
    });
  });
  await saveIntegration(tenantId, { provider: "UDDOKTAPAY", mode: "LIVE", config: { baseUrl: "https://pay.example-store.test" }, secrets: { apiKey: "store-own-key-123" } } as never);
  return { tenantId, orderId };
}

const gatewayAnswers = (orderId: string, tenantId: string, amount: string | undefined) =>
  setUddoktaPayFetchForTests(async () => new Response(
    JSON.stringify({ status: "COMPLETED", invoice_id: "inv_amt", ...(amount === undefined ? {} : { amount }), payment_method: "bkash", transaction_id: `TRX_${randomUUID().slice(0, 6)}`, sender_number: "01811223344", metadata: { orderId, tenantId } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  ));

const paymentStatus = (tenantId: string, orderId: string) => withTenant(tenantId, async (tx) => (await tx.order.findUnique({ where: { id: orderId } }))?.paymentStatus);

describe("UddoktaPay checks the amount paid against the order", () => {
  beforeAll(async () => {
    process.env.INTEGRATION_VAULT_SECRET = randomBytes(32).toString("hex");
    const owner = createOwnerClient(testUrls().direct);
    await seedPlans(owner);
    await owner.$disconnect();
  }, 60_000);
  afterEach(() => setUddoktaPayFetchForTests(undefined));

  it("marks the order paid when the amount matches", async () => {
    const { tenantId, orderId } = await orderOf(1500);
    gatewayAnswers(orderId, tenantId, "1500.00");
    expect((await processUddoktaPayOrderSuccess(tenantId, "inv_amt")).ok).toBe(true);
    expect(await paymentStatus(tenantId, orderId)).toBe("PAID");
  });

  it("accepts a rounding difference of a taka and any overpayment", async () => {
    const a = await orderOf(1500);
    gatewayAnswers(a.orderId, a.tenantId, "1499.50");
    expect((await processUddoktaPayOrderSuccess(a.tenantId, "inv_amt")).ok).toBe(true);
    const b = await orderOf(1500);
    gatewayAnswers(b.orderId, b.tenantId, "1600");
    expect((await processUddoktaPayOrderSuccess(b.tenantId, "inv_amt")).ok).toBe(true);
  });

  it("refuses a short payment and leaves the order unpaid", async () => {
    const { tenantId, orderId } = await orderOf(1500);
    gatewayAnswers(orderId, tenantId, "15.00");
    const e = await processUddoktaPayOrderSuccess(tenantId, "inv_amt").then(() => null, (x) => x as Error);
    expect(e).toBeInstanceOf(DomainError);
    expect(e!.message).toMatch(/less than the order total/);
    expect(await paymentStatus(tenantId, orderId)).toBe("UNPAID");
    await withTenant(tenantId, async (tx) => expect(await tx.orderStateLog.count({ where: { orderId } })).toBe(0));
  });

  it("refuses an answer with no readable amount", async () => {
    for (const amount of [undefined, "abc", ""]) {
      const { tenantId, orderId } = await orderOf(1500);
      gatewayAnswers(orderId, tenantId, amount);
      await expect(processUddoktaPayOrderSuccess(tenantId, "inv_amt")).rejects.toBeInstanceOf(DomainError);
      expect(await paymentStatus(tenantId, orderId)).toBe("UNPAID");
    }
  });

  it("does not look again at an order that is already paid", async () => {
    const { tenantId, orderId } = await orderOf(1500);
    gatewayAnswers(orderId, tenantId, "1500");
    await processUddoktaPayOrderSuccess(tenantId, "inv_amt");
    // A replay of the same notice, even with a wrong amount, changes nothing and does not fail.
    gatewayAnswers(orderId, tenantId, "1");
    expect((await processUddoktaPayOrderSuccess(tenantId, "inv_amt")).ok).toBe(true);
    expect(await paymentStatus(tenantId, orderId)).toBe("PAID");
  });
});
