import { describe, expect, it } from "vitest";
import {
  type FulfillmentFunnel,
  type CodCashflowLedger,
  type CourierHealth,
  type Dashboard,
} from "../src";

describe("Merchant Dashboard Command Center Models & Types", () => {
  it("computes fulfillment funnel structure accurately", () => {
    const funnel: FulfillmentFunnel = {
      unverified: { count: 3, amount: 4500 },
      toPack: { count: 5, amount: 7200 },
      inTransit: { count: 12, amount: 18400 },
      delivered: { count: 48, amount: 72000 },
      returns: { count: 4, amount: 5600 },
    };

    expect(funnel.unverified.count).toBe(3);
    expect(funnel.toPack.count).toBe(5);
    expect(funnel.inTransit.count).toBe(12);
    expect(funnel.delivered.count).toBe(48);
    expect(funnel.returns.count).toBe(4);
    expect(funnel.delivered.amount).toBe(72000);
  });

  it("calculates 3-way COD cashflow ledger correctly", () => {
    const codLedger: CodCashflowLedger = {
      inTransitAmount: 18400,
      inTransitOrders: 12,
      awaitingPayoutAmount: 14200,
      awaitingPayoutOrders: 9,
      settledAmount: 52000,
      settledOrders: 35,
      directMfsAmount: 12500,
      directMfsOrders: 8,
    };

    expect(codLedger.inTransitAmount).toBe(18400);
    expect(codLedger.awaitingPayoutAmount).toBe(14200);
    expect(codLedger.settledAmount).toBe(52000);
    expect(codLedger.directMfsAmount).toBe(12500);
    expect(codLedger.inTransitOrders + codLedger.awaitingPayoutOrders + codLedger.settledOrders).toBe(56);
  });

  it("evaluates courier health metrics and flags elevated return rates", () => {
    const normalCourierHealth: CourierHealth = {
      successRate: 91.2,
      returnRate: 8.8,
      isReturnRateElevated: false,
      totalShipped: 60,
      courierBreakdown: [
        { courier: "STEADFAST", count: 40, percentage: 67 },
        { courier: "PATHAO", count: 20, percentage: 33 },
      ],
    };

    expect(normalCourierHealth.isReturnRateElevated).toBe(false);
    expect(normalCourierHealth.courierBreakdown[0]!.courier).toBe("STEADFAST");

    // Elevated return rate test (>12%)
    const highReturnHealth: CourierHealth = {
      successRate: 82.5,
      returnRate: 17.5,
      isReturnRateElevated: true,
      totalShipped: 40,
      courierBreakdown: [
        { courier: "STEADFAST", count: 25, percentage: 63 },
        { courier: "PATHAO", count: 15, percentage: 37 },
      ],
    };

    expect(highReturnHealth.isReturnRateElevated).toBe(true);
    expect(highReturnHealth.returnRate).toBeGreaterThan(12);
  });
});
