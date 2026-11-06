import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { withTenant } from "@biztrackbd/db";
import { createOwnerClient, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { DomainError, processUddoktaPayOrderSuccess, saveIntegration, setUddoktaPayFetchForTests } from "../src";

/** A cash-on-delivery order of `total` whose store asked for `advance` online. */
async function advanceOrder(total: number, advance: number, over: Record<string, unknown> = {}) {
  const tenantId = `adg_tenant_${randomUUID().slice(0, 8)}`;
  const orderId = `adg_order_${randomUUID().slice(0, 8)}`;
  await withTenant(tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, name: "Advance Store", subdomain: `adg${randomUUID().slice(0, 8)}`, status: "ACTIVE", planTier: "BUSINESS", trialEndsAt: new Date(Date.now() + 86400000) } });
    await tx.order.create({
      data: {
        id: orderId, tenantId, orderNumber: "BT-99903", customerName: "Buyer", customerPhone: "01711223344", shippingAddress: "House 1, Road 2, Dhaka", shippingCity: "Mirpur",
        shippingDistrict: "Dhaka", shippingDivision: "Dhaka", deliveryZone: "Dhaka", subtotalAmount: total - 100, deliveryCharge: 100, totalAmount: total,
        paymentMethod: "COD", paymentStatus: "UNPAID", channel: "STOREFRONT",
        advanceRequiredAmount: advance, advanceDueAt: new Date(Date.now() + 86_400_000), advanceMethod: "GATEWAY_UDDOKTAPAY", ...over,
      },
    });
  });
  await saveIntegration(tenantId, { provider: "UDDOKTAPAY", mode: "LIVE", config: { baseUrl: "https://pay.example-store.test" }, secrets: { apiKey: "store-own-key-123" } } as never);
  return { tenantId, orderId };
}

const gatewayAnswers = (orderId: string, tenantId: string, amount: string) =>
  setUddoktaPayFetchForTests(async () => new Response(
    JSON.stringify({ status: "COMPLETED", invoice_id: "inv_adv", amount, payment_method: "bkash", transaction_id: `TRX_${randomUUID().slice(0, 6)}`, sender_number: "01811223344", metadata: { orderId, tenantId } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  ));

const load = (tenantId: string, orderId: string) => withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: orderId } }));

describe("an advance paid through UddoktaPay", () => {
  beforeAll(async () => {
    process.env.INTEGRATION_VAULT_SECRET = randomBytes(32).toString("hex");
    const owner = createOwnerClient(testUrls().direct);
    await seedPlans(owner);
    await owner.$disconnect();
  }, 60_000);
  afterEach(() => setUddoktaPayFetchForTests(undefined));

  it("credits only the advance, confirms the order and leaves the balance for the courier", async () => {
    const { tenantId, orderId } = await advanceOrder(1500, 400);
    gatewayAnswers(orderId, tenantId, "400.00");
    expect((await processUddoktaPayOrderSuccess(tenantId, "inv_adv")).ok).toBe(true);
    const o = await load(tenantId, orderId);
    expect(o.status).toBe("CONFIRMED");
    expect(o.paymentStatus).toBe("PARTIALLY_PAID");
    expect(o.paymentMethod).toBe("COD");
    expect(Number(o.advancePaidAmount)).toBe(400);
    expect(Number(o.balanceDue)).toBe(1100);
  });

  it("a whole-order advance leaves the order fully paid", async () => {
    const { tenantId, orderId } = await advanceOrder(1500, 1500);
    gatewayAnswers(orderId, tenantId, "1500");
    await processUddoktaPayOrderSuccess(tenantId, "inv_adv");
    const o = await load(tenantId, orderId);
    expect(o.paymentStatus).toBe("PAID");
    expect(Number(o.balanceDue)).toBe(0);
  });

  it("refuses a payment smaller than the advance and leaves the order untouched", async () => {
    const { tenantId, orderId } = await advanceOrder(1500, 400);
    gatewayAnswers(orderId, tenantId, "40");
    const e = await processUddoktaPayOrderSuccess(tenantId, "inv_adv").then(() => null, (x) => x as Error);
    expect(e).toBeInstanceOf(DomainError);
    expect(e!.message).toMatch(/less than the advance/);
    const o = await load(tenantId, orderId);
    expect(o.paymentStatus).toBe("UNPAID");
    expect(o.status).toBe("PENDING");
    expect(Number(o.advancePaidAmount)).toBe(0);
  });

  it("a repeated notice does not credit the advance twice", async () => {
    const { tenantId, orderId } = await advanceOrder(1500, 400);
    gatewayAnswers(orderId, tenantId, "400");
    await processUddoktaPayOrderSuccess(tenantId, "inv_adv");
    gatewayAnswers(orderId, tenantId, "400");
    await processUddoktaPayOrderSuccess(tenantId, "inv_adv");
    const o = await load(tenantId, orderId);
    expect(Number(o.advancePaidAmount)).toBe(400);
    expect(Number(o.balanceDue)).toBe(1100);
  });

  it("does not reopen an order the deadline already cancelled, and tells the owner the money arrived", async () => {
    const { tenantId, orderId } = await advanceOrder(1500, 400, { status: "CANCELLED" });
    gatewayAnswers(orderId, tenantId, "400");
    await processUddoktaPayOrderSuccess(tenantId, "inv_adv");
    const o = await load(tenantId, orderId);
    expect(o.status).toBe("CANCELLED");
    expect(Number(o.advancePaidAmount)).toBe(0);
    const events = await withTenant(tenantId, (tx) => tx.orderEvent.findMany({ where: { orderId } }));
    expect(events.some((x) => /arrived after the order was cancelled/.test(x.message))).toBe(true);
  });
});
