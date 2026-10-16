import { describe, expect, it, vi } from "vitest";
import {
  callGemini,
  testGeminiApiKey,
  handleStorefrontChat,
  handleAdminCopilotChat,
} from "../src/index";

describe("AI Assistant & Model Resilience", () => {
  it("automatically falls back to next candidate model when primary model returns 404", async () => {
    const attemptedUrls: string[] = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      attemptedUrls.push(url);
      if (url.includes("models/nonexistent-model")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: { message: "models/nonexistent-model is not found" },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello from fallback model" }],
              },
            },
          ],
        }),
      };
    });

    const reply = await callGemini({
      apiKey: "test-api-key",
      model: "nonexistent-model",
      prompt: "ping",
      fetchImpl: mockFetch as any,
    });

    expect(reply).toBe("Hello from fallback model");
    expect(attemptedUrls.length).toBeGreaterThanOrEqual(2);
    expect(attemptedUrls[0]).toContain("nonexistent-model");
    expect(attemptedUrls[1]).toContain("gemini-2.0-flash");
  });

  it("filters out invalid gemini-2.5-flash and uses gemini-2.0-flash as primary", async () => {
    const attemptedUrls: string[] = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      attemptedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Model response" }],
              },
            },
          ],
        }),
      };
    });

    await callGemini({
      apiKey: "test-key",
      model: "gemini-2.5-flash",
      prompt: "test",
      fetchImpl: mockFetch as any,
    });

    expect(attemptedUrls[0]).toContain("gemini-2.0-flash");
    expect(attemptedUrls[0]).not.toContain("gemini-2.5-flash");
  });

  it("returns greeting and suggested questions for empty storefront chat message", async () => {
    const res = await handleStorefrontChat("any-tenant", {
      message: "",
    });

    expect(res.reply).toContain("আসসালামু আলাইকুম");
    expect(res.suggestedQuestions).toBeDefined();
    expect(res.suggestedQuestions?.length).toBeGreaterThan(0);
  });

  it("returns greeting, quick action links, and questions for empty admin copilot message", async () => {
    const actor = {
      userId: "admin-1",
      email: "owner@store.bd",
      role: "STORE_OWNER" as const,
    };

    const res = await handleAdminCopilotChat("any-tenant", actor, {
      message: "",
    });

    expect(res.reply).toContain("বিজট্র্যাক এআই বিজনেস কো-পাইলট");
    expect(res.suggestedQuestions).toContain("আজকের সেলস ও অর্ডার সামারি দিন");
    expect(res.actionLinks?.some((l) => l.href === "/orders")).toBe(true);
  });
});
