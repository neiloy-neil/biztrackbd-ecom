import { describe, it, expect } from "vitest";
import {
  APP_CATALOG,
  MODULES,
  getAppCatalogItem,
  getPlatformAiConfig,
  savePlatformAiConfig,
  testPlatformGeminiApiKey,
} from "../src/index";

describe("App Store Plan Gating & Module Management", () => {
  describe("App Catalog Metadata & Plan Constraints", () => {
    it("contains pos_barcode with PRO plan requirement and ADDON tier", () => {
      const app = getAppCatalogItem("pos_barcode");
      expect(app).toBeDefined();
      expect(app?.built).toBe(true);
      expect(app?.tier).toBe("ADDON");
      expect(app?.minPlan).toBe("PRO");
      expect(app?.configureHref).toBe("/pos");
    });

    it("contains ai_suite with PRO plan requirement and ADDON tier", () => {
      const app = getAppCatalogItem("ai_suite");
      expect(app).toBeDefined();
      expect(app?.built).toBe(true);
      expect(app?.tier).toBe("ADDON");
      expect(app?.minPlan).toBe("PRO");
      expect(app?.configureHref).toBe("/settings/ai");
    });

    it("contains marketing_campaigns with PRO plan requirement and ADDON tier", () => {
      const app = getAppCatalogItem("marketing_campaigns");
      expect(app).toBeDefined();
      expect(app?.built).toBe(true);
      expect(app?.tier).toBe("ADDON");
      expect(app?.minPlan).toBe("PRO");
      expect(app?.configureHref).toBe("/marketing/campaigns");
    });

    it("contains fraud_shield with PRO plan requirement and ADDON tier", () => {
      const app = getAppCatalogItem("fraud_shield");
      expect(app).toBeDefined();
      expect(app?.built).toBe(true);
      expect(app?.tier).toBe("ADDON");
      expect(app?.minPlan).toBe("PRO");
    });

    it("registers built modules in MODULES list for database persistence", () => {
      const keys = MODULES.map((m) => m.key);
      expect(keys).toContain("loyalty");
      expect(keys).toContain("pos_barcode");
      expect(keys).toContain("ai_suite");
      expect(keys).toContain("marketing_campaigns");
      expect(keys).toContain("fraud_shield");

      const pos = MODULES.find((m) => m.key === "pos_barcode");
      expect(pos?.built).toBe(true);
      const ai = MODULES.find((m) => m.key === "ai_suite");
      expect(ai?.built).toBe(true);
    });
  });

  describe("Platform AI Configuration Service", () => {
    it("retrieves masked platform AI config using fake DB client", async () => {
      const fakeDb = {
        platformConfig: {
          findUnique: async ({ where }: { where: { key: string } }) => {
            if (where.key === "gemini_api_key") {
              return { key: "gemini_api_key", value: "AIzaSyTestApiKey1234567890", updatedAt: new Date(), updatedBy: "admin@platform.com" };
            }
            if (where.key === "gemini_default_model") {
              return { key: "gemini_default_model", value: "gemini-2.5-flash", updatedAt: new Date(), updatedBy: "admin@platform.com" };
            }
            return null;
          },
        },
      };

      const config = await getPlatformAiConfig({ db: fakeDb as any });
      expect(config.hasKey).toBe(true);
      expect(config.source).toBe("DATABASE");
      expect(config.maskedKey).toContain("••••••••");
      expect(config.defaultModel).toBe("gemini-2.5-flash");
      expect(config.updatedBy).toBe("admin@platform.com");
    });

    it("saves platform AI config with audit log entry", async () => {
      let savedKey = "";
      let savedModel = "";
      let auditLogged = false;

      const fakeDb = {
        platformConfig: {
          upsert: async ({ where, create, update }: any) => {
            if (where.key === "gemini_api_key") savedKey = update.value;
            if (where.key === "gemini_default_model") savedModel = update.value;
            return { key: where.key, value: update.value };
          },
          deleteMany: async () => {},
        },
        platformAuditLog: {
          create: async ({ data }: any) => {
            if (data.action === "PLATFORM_AI_CONFIG_UPDATED") auditLogged = true;
            return { id: "log-1", ...data };
          },
        },
      };

      const actor = { id: "user-sa", email: "sa@biztrack.bd", role: "OWNER" as const };
      const res = await savePlatformAiConfig(
        actor,
        { apiKey: "AIzaSyNewSuperSecretKey999", defaultModel: "gemini-1.5-pro" },
        { db: fakeDb as any }
      );

      expect(res.ok).toBe(true);
      expect(savedKey).toBe("AIzaSyNewSuperSecretKey999");
      expect(savedModel).toBe("gemini-1.5-pro");
      expect(auditLogged).toBe(true);
    });

    it("prevents non-admin actors from modifying platform configuration", async () => {
      const nonAdminActor = { id: "user-fin", email: "finance@biztrack.bd", role: "FINANCE" as const };
      await expect(
        savePlatformAiConfig(nonAdminActor, { apiKey: "AIzaSyKey123456789012345" })
      ).rejects.toThrow();
    });

    it("reports failure when testing connection with missing key", async () => {
      const fakeDb = {
        platformConfig: {
          findUnique: async () => null,
        },
      };

      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const res = await testPlatformGeminiApiKey(undefined, "gemini-2.5-flash", { db: fakeDb as any });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("No API key configured to test.");

      if (originalEnv) process.env.GEMINI_API_KEY = originalEnv;
    });
  });
});
