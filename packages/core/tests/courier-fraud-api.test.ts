import { describe, expect, it, beforeEach } from "vitest";
import {
  fetchUnifiedCourierFraud,
  toCourierFraudStats,
  clearFraudCheckerCache,
  type ExternalCourierFraudData,
} from "../src/index";

describe("Unified 5-Courier Fraud API Engine", () => {
  beforeEach(() => {
    clearFraudCheckerCache();
  });

  const mockApiResponse: ExternalCourierFraudData = {
    phone: "01712345678",
    score: 92,
    status: "Safe",
    source: "courier_network",
    total_parcel: 25,
    success_parcel: 23,
    cancel_parcel: 2,
    unresolved_reports: 0,
    community_reports: [],
    response: {
      steadfast: {
        status: true,
        message: "Data found",
        data: {
          total: 10,
          success: 9,
          cancel: 1,
          deliveredPercentage: 90,
          returnPercentage: 10,
        },
      },
      pathao: {
        status: true,
        message: "Data found",
        data: {
          total: 8,
          success: 8,
          cancel: 0,
          deliveredPercentage: 100,
          returnPercentage: 0,
        },
      },
      redx: {
        status: true,
        message: "Data found",
        data: {
          total: 4,
          success: 3,
          cancel: 1,
          deliveredPercentage: 75,
          returnPercentage: 25,
        },
      },
      carrybee: {
        status: true,
        message: "Data found",
        data: {
          total: 3,
          success: 3,
          cancel: 0,
          deliveredPercentage: 100,
          returnPercentage: 0,
        },
      },
      paperfly: {
        status: false,
        message: "No data",
        data: {
          total: 0,
          success: 0,
          cancel: 0,
          deliveredPercentage: 0,
          returnPercentage: 0,
        },
      },
    },
  };

  it("successfully fetches courier metrics via POST with API key header and normalizes BD phone number", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    const mockFetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      capturedUrl = String(input);
      capturedMethod = init?.method ?? "GET";
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = String(init?.body ?? "");

      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    // Passing messy phone format (+880 1712-345678)
    const result = await fetchUnifiedCourierFraud("+880 1712-345678", {
      fetchImpl: mockFetch as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.phone).toBe("01712345678");
    expect(result?.score).toBe(92);
    expect(result?.total_parcel).toBe(25);
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["X-API-KEY"]).toBeTruthy();
    expect(JSON.parse(capturedBody)).toEqual({ phone: "01712345678" });
  });

  it("converts multi-courier external data into internal CourierFraudStats format", () => {
    const stats = toCourierFraudStats(mockApiResponse);
    expect(stats.provider).toBe("MULTI_COURIER");
    expect(stats.totalParcels).toBe(25);
    expect(stats.deliveredParcels).toBe(23);
    expect(stats.cancelledParcels).toBe(2);
    expect(stats.successRatio).toBe(92);
  });

  it("serves repeated lookups from local 15-day in-memory cache without secondary network requests", async () => {
    let networkCalls = 0;
    const mockFetch = async () => {
      networkCalls++;
      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    // First call: hits network
    const first = await fetchUnifiedCourierFraud("01712345678", { fetchImpl: mockFetch as typeof fetch });
    expect(networkCalls).toBe(1);
    expect(first?.source).toBe("courier_network");

    // Second call: served instantly from cache
    const second = await fetchUnifiedCourierFraud("01712345678", { fetchImpl: mockFetch as typeof fetch });
    expect(networkCalls).toBe(1); // No new network call
    expect(second?.source).toBe("database_cache");
    expect(second?.score).toBe(92);

    // Bypass cache flag forces network call
    const third = await fetchUnifiedCourierFraud("01712345678", {
      fetchImpl: mockFetch as typeof fetch,
      bypassCache: true,
    });
    expect(networkCalls).toBe(2);
    expect(third?.source).toBe("courier_network");
  });

  it("falls back to GET endpoint if POST fails", async () => {
    let attempts: string[] = [];

    const mockFetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const method = init?.method ?? "GET";
      attempts.push(`${method} ${input}`);

      if (method === "POST") {
        return new Response("Service Unavailable", { status: 503 });
      }

      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await fetchUnifiedCourierFraud("01712345678", {
      fetchImpl: mockFetch as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.score).toBe(92);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toContain("POST");
    expect(attempts[1]).toContain("GET");
  });

  it("gracefully returns null for invalid phone numbers without querying upstream", async () => {
    let called = false;
    const mockFetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };

    const result = await fetchUnifiedCourierFraud("invalid-phone-string", {
      fetchImpl: mockFetch as typeof fetch,
    });

    expect(result).toBeNull();
    expect(called).toBe(false);
  });
});
