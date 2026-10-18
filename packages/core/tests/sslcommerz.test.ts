import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createSslCommerzSession,
  verifySslCommerzPayment,
  processSslCommerzOrderSuccess,
  setSslCommerzFetchForTests,
} from "../src/payments/sslcommerz";
import { withTenant } from "@biztrackbd/db";
import { saveIntegration } from "../src";
import { randomUUID } from "node:crypto";

describe("SSLCommerz Payment Integration Engine", () => {
  beforeEach(() => {
    setSslCommerzFetchForTests(undefined);
  });

  afterEach(() => {
    setSslCommerzFetchForTests(undefined);
  });

  it("creates an SSLCommerz session with urlencoded parameters and returns gatewayPageUrl", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    setSslCommerzFetchForTests(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = String(init?.body || "");
      return new Response(
        JSON.stringify({
          status: "SUCCESS",
          failedreason: "",
          sessionkey: "SESSION_XYZ123",
          GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/testcde123",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const res = await createSslCommerzSession({
      storeId: "test_store_id",
      storePassword: "test_store_password",
      isSandbox: true,
      tenantId: "ten_001",
      orderId: "ord_001",
      orderNumber: 1001,
      totalAmount: 1850,
      customerName: "Rahim Ahmed",
      customerEmail: "rahim@example.com",
      customerPhone: "01712345678",
      customerAddress: "Dhanmondi, Dhaka",
      customerCity: "Dhaka",
      successUrl: "https://example.com/api/payments/sslcommerz/callback",
      failUrl: "https://example.com/order/ord_001?paymentStatus=failed",
      cancelUrl: "https://example.com/order/ord_001?paymentStatus=cancelled",
      ipnUrl: "https://example.com/api/payments/sslcommerz/ipn",
    });

    expect(capturedUrl).toBe("https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    expect(capturedHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const parsed = new URLSearchParams(capturedBody);
    expect(parsed.get("store_id")).toBe("test_store_id");
    expect(parsed.get("store_passwd")).toBe("test_store_password");
    expect(parsed.get("total_amount")).toBe("1850.00");
    expect(parsed.get("tran_id")).toBe("ord_001");
    expect(parsed.get("cus_name")).toBe("Rahim Ahmed");
    expect(parsed.get("cus_phone")).toBe("01712345678");
    expect(parsed.get("value_a")).toBe("ten_001");

    expect(res.status).toBe("SUCCESS");
    expect(res.sessionKey).toBe("SESSION_XYZ123");
    expect(res.gatewayPageUrl).toBe("https://sandbox.sslcommerz.com/EasyCheckOut/testcde123");
  });

  it("verifies transaction via validationserverAPI.php", async () => {
    let capturedUrl = "";

    setSslCommerzFetchForTests(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          status: "VALID",
          tran_date: "2026-10-18 22:30:00",
          tran_id: "ord_001",
          val_id: "VAL_998877",
          amount: "1850.00",
          store_amount: "1800.00",
          currency: "BDT",
          bank_tran_id: "BANK_TRX_5544",
          card_type: "VISA-Dutch Bangla",
          card_brand: "VISA",
          card_issuer: "DBBL",
          value_a: "ten_001",
          value_b: "ord_001",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const verified = await verifySslCommerzPayment({
      storeId: "test_store_id",
      storePassword: "test_store_password",
      isSandbox: true,
      valId: "VAL_998877",
    });

    expect(capturedUrl).toContain("validator/api/validationserverAPI.php");
    expect(capturedUrl).toContain("val_id=VAL_998877");
    expect(capturedUrl).toContain("store_id=test_store_id");

    expect(verified.status).toBe("VALID");
    expect(verified.valId).toBe("VAL_998877");
    expect(verified.bankTranId).toBe("BANK_TRX_5544");
    expect(verified.amount).toBe("1850.00");
    expect(verified.cardType).toBe("VISA-Dutch Bangla");
  });

  it("processes order success and marks order as PAID and CONFIRMED with state log", async () => {
    const tenantId = `test_ssl_${randomUUID().slice(0, 8)}`;
    const orderId = `ord_ssl_${randomUUID().slice(0, 8)}`;

    // Create a mock tenant and order
    await withTenant(tenantId, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: "SSLCommerz Test Store",
          subdomain: `sub${randomUUID().slice(0, 8)}`,
          status: "ACTIVE",
          trialEndsAt: new Date(Date.now() + 86400000),
        },
      });
    });

    await saveIntegration(tenantId, {
      provider: "SSLCOMMERZ",
      mode: "TEST",
      secrets: { storeId: "test_store", storePassword: "test_pwd" },
      config: { isSandbox: "true" },
    });

    await withTenant(tenantId, async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          phone: "01700000000",
          name: "Customer Rahim",
        },
      });

      await tx.order.create({
        data: {
          id: orderId,
          tenantId,
          orderNumber: "BT-2001",
          idempotencyKey: randomUUID(),
          customerId: customer.id,
          customerName: "Customer Rahim",
          customerPhone: "01700000000",
          shippingAddress: "House 1, Road 2, Dhanmondi",
          shippingCity: "Dhaka",
          shippingDistrict: "Dhaka",
          shippingDivision: "Dhaka",
          deliveryZone: "Dhaka",
          paymentMethod: "GATEWAY_SSLCOMMERZ",
          paymentStatus: "UNPAID",
          status: "PENDING",
          subtotalAmount: 1850,
          deliveryCharge: 0,
          totalAmount: 1850,
        },
      });
    });

    setSslCommerzFetchForTests(async () => {
      return new Response(
        JSON.stringify({
          status: "VALID",
          tran_id: orderId,
          val_id: "VAL_SUCCESS_123",
          amount: "1850.00",
          bank_tran_id: "BANK_TRX_999",
          card_type: "BKASH-bKash",
          card_brand: "bKash",
          value_a: tenantId,
          value_b: orderId,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await processSslCommerzOrderSuccess(tenantId, "VAL_SUCCESS_123");

    expect(result.ok).toBe(true);
    expect(result.orderId).toBe(orderId);
    expect(result.status).toBe("CONFIRMED");

    // Verify DB state
    await withTenant(tenantId, async (tx) => {
      const updated = await tx.order.findFirst({ where: { id: orderId } });
      expect(updated?.paymentStatus).toBe("PAID");
      expect(updated?.status).toBe("CONFIRMED");
      expect(updated?.mfsTrxId).toBe("BANK_TRX_999");
      expect(updated?.mfsVerifiedBy).toBe("sslcommerz");

      const log = await tx.orderStateLog.findFirst({
        where: { orderId, toStatus: "CONFIRMED" },
      });
      expect(log).toBeDefined();
      expect(log?.actorId).toBe("sslcommerz");
    });
  });
});
