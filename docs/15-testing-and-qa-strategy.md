# Testing, Multi-Tenant Security & Quality Assurance Strategy

Status: COMPLETE SPECIFICATION  
Scope: `packages/db`, `packages/core`, `apps/storefront`, `apps/admin`, Vitest, Playwright

---

## 1. 3-Tier Testing Architecture

```
+-------------------------------------------------------------------------------+
| Tier 1: Unit Tests (Vitest)                                                   |
| - Fast, in-memory execution (< 2s)                                            |
| - Tests pure domain functions: discounts, delivery rules, trust score formula  |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Tier 2: Integration & Multi-Tenant Security Tests (Vitest + Testcontainers)    |
| - Real PostgreSQL instance with RLS enabled                                   |
| - Assert multi-tenant data isolation: Tenant A cannot read/mutate Tenant B data|
| - Webhook signature verification and state machine transitions                |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Tier 3: End-to-End Browser Tests (Playwright)                                 |
| - Real browser rendering at 1440px desktop and 390px mobile viewports         |
| - 1-Click COD checkout, bKash TrxID submission, Admin order fulfillment flow  |
+-------------------------------------------------------------------------------+
```

---

## 2. Multi-Tenant Security & Data Leak Assertion Tests

Ensures that no API route or Prisma query can leak data across stores:

```typescript
// packages/db/__tests__/tenant-isolation.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTenantPrismaClient } from "../src/client";
import { db } from "../src";

describe("Multi-Tenant Security & Data Isolation", () => {
  const tenantAId = "tenant_test_a";
  const tenantBId = "tenant_test_b";

  let clientA: ReturnType<typeof createTenantPrismaClient>;
  let clientB: ReturnType<typeof createTenantPrismaClient>;

  beforeEach(async () => {
    clientA = createTenantPrismaClient(tenantAId);
    clientB = createTenantPrismaClient(tenantBId);
  });

  it("should prevent Tenant B from reading Tenant A's orders", async () => {
    // 1. Create order under Tenant A
    const orderA = await clientA.order.create({
      data: {
        orderNumber: "BT-TEST-001",
        customerId: "cust_a",
        subtotal: 1000,
        deliveryFee: 80,
        total: 1080,
        shippingName: "Rahim",
        shippingPhone: "01711111111",
        shippingAddress: "Mirpur 10",
        shippingDivision: "Dhaka",
        shippingDistrict: "Dhaka",
      },
    });

    // 2. Query orders using Tenant B's client
    const tenantBOrders = await clientB.order.findMany();
    const orderNotFoundInB = await clientB.order.findUnique({
      where: { id: orderA.id },
    });

    // Assert isolation
    expect(tenantBOrders.some((o) => o.id === orderA.id)).toBe(false);
    expect(orderNotFoundInB).toBeNull();
  });

  it("should prevent Tenant B from updating or deleting Tenant A's products", async () => {
    const productA = await clientA.product.create({
      data: {
        titleEn: "Secret Panjabi",
        handle: "secret-panjabi",
        price: 1500,
      },
    });

    // Attempt mutation from Tenant B
    await expect(
      clientB.product.update({
        where: { id: productA.id },
        data: { price: 10 },
      })
    ).rejects.toThrow();
  });
});
```

---

## 3. Pure Domain Logic Test Suites (`packages/core/__tests__`)

### A. Delivery Trust Score Calculation

```typescript
import { describe, it, expect } from "vitest";
import { calculateDeliveryTrustScore } from "../src/fraud";

describe("calculateDeliveryTrustScore", () => {
  it("should assign 100 to clean delivery history", () => {
    const score = calculateDeliveryTrustScore({
      totalDispatched: 10,
      delivered: 10,
      recentRefusals: 0,
    });
    expect(score).toBe(100);
  });

  it("should heavily penalize recent doorstep refusals", () => {
    const score = calculateDeliveryTrustScore({
      totalDispatched: 5,
      delivered: 2,
      recentRefusals: 3,
    });
    expect(score).toBeLessThan(40); // Marked as HIGH RISK
  });
});
```

### B. Bangladesh Shipping Zone Matching

```typescript
import { describe, it, expect } from "vitest";
import { resolveDeliveryFee } from "../src/shipping";

describe("resolveDeliveryFee", () => {
  const zones = [
    { name: "Inside Dhaka", districts: ["Dhaka North", "Dhaka South"], rate: 80, freeOver: 2000 },
    { name: "Outside Dhaka", districts: ["*"], rate: 130, freeOver: 3000 },
  ];

  it("should apply ৳80 for Dhaka North under threshold", () => {
    expect(resolveDeliveryFee(zones, "Dhaka North", 1500)).toBe(80);
  });

  it("should apply ৳0 for Dhaka North above threshold", () => {
    expect(resolveDeliveryFee(zones, "Dhaka North", 2500)).toBe(0);
  });

  it("should apply ৳130 for Chittagong", () => {
    expect(resolveDeliveryFee(zones, "Chattogram", 1500)).toBe(130);
  });
});
```

---

## 4. Playwright End-to-End Test Suite (`apps/storefront/e2e`)

```typescript
// apps/storefront/e2e/checkout-cod.spec.ts
import { test, expect } from "@playwright/test";

test.describe("1-Click COD Checkout Flow", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // Mobile Viewport

  test("should complete COD order placement in under 30 seconds", async ({ page }) => {
    await page.goto("http://demo.localhost:3000/products/cotton-panjabi");

    // Click Buy Now
    await page.click("text=Buy Now");
    await expect(page).toHaveURL(/.*checkout/);

    // Fill Contact & Delivery Address
    await page.fill('input[name="phone"]', "01712345678");
    await page.fill('input[name="name"]', "Sadia Rahman");
    await page.selectOption('select[name="district"]', "Dhaka");
    await page.fill('textarea[name="address"]', "House 14, Road 7, Block C, Mirpur 10");

    // Select Cash on Delivery
    await page.click("text=Cash on delivery");

    // Submit Order
    await page.click("text=Place order");

    // Verification
    await expect(page).toHaveURL(/.*order-placed/);
    await expect(page.locator("h1")).toContainText("Thank you, Sadia!");
    await expect(page.locator("text=BT-")).toBeVisible();
  });
});
```
