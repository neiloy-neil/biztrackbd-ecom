import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  grantBkashToken,
  createBkashPayment,
  executeBkashPayment,
  queryBkashPayment,
  processBkashOrderSuccess,
  setBkashFetchForTests,
} from "../src/payments/bkash";
import { withTenant } from "@biztrackbd/db";
import { saveIntegration } from "../src";
import { randomUUID } from "node:crypto";

describe("Direct bKash Tokenized Checkout Integration Engine", () => {
  beforeEach(() => {
    setBkashFetchForTests(undefined);
  });

  afterEach(() => {
    setBkashFetchForTests(undefined);
  });

  const mockConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
    username: "test_username",
    password: "test_password",
    isSandbox: true,
    isCustom: true,
  };

  it("grants and caches bKash ID token", async () => {
    let callCount = 0;
    setBkashFetchForTests(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          statusCode: "0000",
          statusMessage: "Successful",
          id_token: "MOCK_BKASH_JWT_TOKEN",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const token1 = await grantBkashToken(mockConfig);
    expect(token1).toBe("MOCK_BKASH_JWT_TOKEN");
    expect(callCount).toBe(1);

    // Second call should hit in-memory cache
    const token2 = await grantBkashToken(mockConfig);
    expect(token2).toBe("MOCK_BKASH_JWT_TOKEN");
    expect(callCount).toBe(1);
  });

  it("creates a checkout payment session and returns bkashURL", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    setBkashFetchForTests(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(String(init?.body || "{}"));

      if (capturedUrl.includes("/token/grant")) {
        return new Response(
          JSON.stringify({
            statusCode: "0000",
            statusMessage: "Successful",
            id_token: "TOKEN_FOR_CREATE",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          statusCode: "0000",
          statusMessage: "Successful",
          paymentID: "TR0011TESTPAYMENTID",
          bkashURL: "https://tokenized.sandbox.bka.sh/checkout?paymentID=TR0011TESTPAYMENTID",
          amount: "2450.00",
          currency: "BDT",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const cfg = { ...mockConfig, appKey: `app_${randomUUID().slice(0, 8)}` };
    const res = await createBkashPayment(cfg, {
      tenantId: "ten_001",
      orderId: "ord_002",
      orderNumber: 1002,
      amount: 2450,
      customerPhone: "01812345678",
      callbackUrl: "https://mystore.biztrack.bd/api/payments/bkash/callback",
    });

    expect(capturedUrl).toContain("/tokenized/checkout/create");
    expect(capturedHeaders["Authorization"]).toBe("TOKEN_FOR_CREATE");
    expect(capturedHeaders["X-APP-Key"]).toBe(cfg.appKey);
    expect(capturedBody.amount).toBe("2450.00");
    expect(capturedBody.merchantInvoiceNumber).toBe("1002");
    expect(res.status).toBe("SUCCESS");
    expect(res.paymentId).toBe("TR0011TESTPAYMENTID");
    expect(res.bkashUrl).toContain("paymentID=TR0011TESTPAYMENTID");
  });

  it("executes and verifies payment via /tokenized/checkout/execute", async () => {
    setBkashFetchForTests(async (url) => {
      const u = String(url);
      if (u.includes("/token/grant")) {
        return new Response(
          JSON.stringify({
            statusCode: "0000",
            statusMessage: "Successful",
            id_token: "TOKEN_FOR_EXECUTE",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          statusCode: "0000",
          statusMessage: "Successful",
          paymentID: "TR0011TESTPAYMENTID",
          trxID: "BKASH_TRX_887766",
          transactionStatus: "Completed",
          amount: "2450.00",
          customerMsisdn: "01812345678",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const cfg = { ...mockConfig, appKey: `app_${randomUUID().slice(0, 8)}` };
    const exec = await executeBkashPayment(cfg, "TR0011TESTPAYMENTID");

    expect(exec.statusCode).toBe("0000");
    expect(exec.trxId).toBe("BKASH_TRX_887766");
    expect(exec.customerMsisdn).toBe("01812345678");
  });

  it("processes order success and marks order as PAID and CONFIRMED with state log", async () => {
    const tenantId = `test_bk_${randomUUID().slice(0, 8)}`;
    const orderId = `ord_bk_${randomUUID().slice(0, 8)}`;

    // Create a mock tenant, vault credentials, and order
    await withTenant(tenantId, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: "bKash Test Store",
          subdomain: `sub${randomUUID().slice(0, 8)}`,
          status: "ACTIVE",
          trialEndsAt: new Date(Date.now() + 86400000),
        },
      });
    });

    await saveIntegration(tenantId, {
      provider: "BKASH_DIRECT",
      mode: "TEST",
      secrets: {
        appKey: "bk_key",
        appSecret: "bk_sec",
        username: "bk_user",
        password: "bk_pwd",
      },
      config: { isSandbox: "true" },
    });

    await withTenant(tenantId, async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          phone: "01800000000",
          name: "Customer Karim",
        },
      });

      await tx.order.create({
        data: {
          id: orderId,
          tenantId,
          orderNumber: "BT-3001",
          idempotencyKey: randomUUID(),
          customerId: customer.id,
          customerName: "Customer Karim",
          customerPhone: "01800000000",
          shippingAddress: "Gulshan 1, Dhaka",
          shippingCity: "Dhaka",
          shippingDistrict: "Dhaka",
          shippingDivision: "Dhaka",
          deliveryZone: "Dhaka",
          paymentMethod: "GATEWAY_BKASH",
          paymentStatus: "UNPAID",
          status: "PENDING",
          subtotalAmount: 2450,
          deliveryCharge: 0,
          totalAmount: 2450,
        },
      });
    });

    setBkashFetchForTests(async (url) => {
      const u = String(url);
      if (u.includes("/token/grant")) {
        return new Response(
          JSON.stringify({
            statusCode: "0000",
            statusMessage: "Successful",
            id_token: "TOKEN_FOR_PROCESS",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          statusCode: "0000",
          statusMessage: "Successful",
          paymentID: "PAY_12345",
          trxID: "BKASH_SUCCESS_TRX",
          transactionStatus: "Completed",
          amount: "2450.00",
          customerMsisdn: "01800000000",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await processBkashOrderSuccess(tenantId, "PAY_12345", orderId);

    expect(result.ok).toBe(true);
    expect(result.orderId).toBe(orderId);
    expect(result.trxId).toBe("BKASH_SUCCESS_TRX");
    expect(result.status).toBe("CONFIRMED");

    // Verify DB state
    await withTenant(tenantId, async (tx) => {
      const updated = await tx.order.findFirst({ where: { id: orderId } });
      expect(updated?.paymentStatus).toBe("PAID");
      expect(updated?.status).toBe("CONFIRMED");
      expect(updated?.mfsTrxId).toBe("BKASH_SUCCESS_TRX");
      expect(updated?.mfsVerifiedBy).toBe("bkash_direct");

      const log = await tx.orderStateLog.findFirst({
        where: { orderId, toStatus: "CONFIRMED" },
      });
      expect(log).toBeDefined();
      expect(log?.actorId).toBe("bkash_direct");
    });
  });
});
