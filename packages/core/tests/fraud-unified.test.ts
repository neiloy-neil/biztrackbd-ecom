import { describe, expect, it } from "vitest";
import {
  computeUnifiedFraudScore,
  APP_CATALOG,
  getAppCatalogItem,
  type CourierFraudStats,
  type TrustScore,
} from "../src/index";

describe("Unified Fraud Assessment Engine", () => {
  const newNetworkTrust: TrustScore = {
    level: "NEW",
    score: null,
    delivered: 0,
    failed: 0,
    refused: 0,
    stores: 0,
  };

  const cleanStoreHistory = { orders: 0, delivered: 0, returned: 0, cancelled: 0 };

  it("evaluates a new customer with strong external courier track record as LOW risk", () => {
    const courierStats: CourierFraudStats = {
      provider: "STEADFAST",
      totalParcels: 20,
      deliveredParcels: 19,
      cancelledParcels: 1,
      successRatio: 95.0,
    };

    const res = computeUnifiedFraudScore({
      courierStats,
      networkTrust: newNetworkTrust,
      storeHistory: cleanStoreHistory,
      flags: [],
      isCod: true,
      customerFacing: true,
    });

    expect(res.level).toBe("LOW");
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.hold).toBe(false);
    expect(res.sources.courier?.totalParcels).toBe(20);
  });

  it("caps an order as HIGH risk when external courier delivery rate is < 50% with multiple parcels", () => {
    const courierStats: CourierFraudStats = {
      provider: "STEADFAST",
      totalParcels: 8,
      deliveredParcels: 2,
      cancelledParcels: 6,
      successRatio: 25.0,
    };

    const res = computeUnifiedFraudScore({
      courierStats,
      networkTrust: newNetworkTrust,
      storeHistory: cleanStoreHistory,
      flags: [],
      isCod: true,
      customerFacing: true,
    });

    expect(res.level).toBe("HIGH");
    expect(res.score).toBeLessThanOrEqual(50);
    expect(res.hold).toBe(true); // High risk COD order is auto-held
  });

  it("applies heuristic penalties for incomplete address and high-value COD on a new number", () => {
    const res = computeUnifiedFraudScore({
      courierStats: null,
      networkTrust: newNetworkTrust,
      storeHistory: cleanStoreHistory,
      flags: ["ADDRESS_INCOMPLETE", "HIGH_VALUE_COD_NEW_NUMBER"],
      isCod: true,
      customerFacing: true,
    });

    // Baseline ~85 minus penalties
    expect(res.score).toBeLessThanOrEqual(65);
    expect(res.level).toBe("MEDIUM");
  });

  it("rewards repeat buyers with previous successful deliveries in the same store", () => {
    const res = computeUnifiedFraudScore({
      courierStats: null,
      networkTrust: newNetworkTrust,
      storeHistory: { orders: 3, delivered: 3, returned: 0, cancelled: 0 },
      flags: [],
      isCod: true,
      customerFacing: true,
    });

    expect(res.score).toBeGreaterThanOrEqual(85);
    expect(res.level).toBe("LOW");
    expect(res.hold).toBe(false);
  });
});

describe("App Store Catalog & Native Modules", () => {
  it("contains all 5 categories across the catalog", () => {
    const categories = new Set(APP_CATALOG.map((a) => a.category));
    expect(categories.has("MARKETING")).toBe(true);
    expect(categories.has("COURIERS")).toBe(true);
    expect(categories.has("GROWTH")).toBe(true);
    expect(categories.has("AUTOMATION")).toBe(true);
    expect(categories.has("COMMERCE")).toBe(true);
  });

  it("retrieves individual apps by key with complete metadata", () => {
    const meta = getAppCatalogItem("meta_pixel_capi");
    expect(meta).toBeDefined();
    expect(meta?.label).toContain("Meta Pixel");
    expect(meta?.category).toBe("MARKETING");
    expect(meta?.tier).toBe("INCLUDED");
    expect(meta?.configureHref).toBe("/settings/integrations#marketing");

    const steadfast = getAppCatalogItem("steadfast_courier");
    expect(steadfast).toBeDefined();
    expect(steadfast?.category).toBe("COURIERS");

    const loyalty = getAppCatalogItem("loyalty_vip");
    expect(loyalty).toBeDefined();
    expect(loyalty?.tier).toBe("ADDON");
  });
});
