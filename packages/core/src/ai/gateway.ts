import { withTenant } from "@biztrackbd/db";
import { AiQuotaExhaustedError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";

export const PLAN_AI_QUOTAS: Record<string, number> = {
  STARTER: 50,
  PRO: 250,
  BUSINESS: 1000,
  ENTERPRISE: 5000,
};

export function getDhakaMonthStr(): string {
  const now = new Date(Date.now() + 6 * 3600_000); // UTC+6
  return now.toISOString().slice(0, 7); // "YYYY-MM"
}

export interface ResolvedAiKey {
  apiKey: string;
  isCustom: boolean;
  remaining: number;
  model: string;
}

/**
 * Resolves the active Gemini API Key and default Model for a tenant.
 * If the merchant saved their own key, it is returned with unlimited remaining quota.
 * Otherwise, the shared platform key is used, subject to the plan's monthly generation quota.
 */
export async function resolveGeminiApiKey(tenantId: string): Promise<ResolvedAiKey> {
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst({
      select: { customGeminiApiKey: true },
    });

    // The platform AI key & default model, set in Platform settings (migration 36).
    const [dbKeyRow, dbModelRow] = await Promise.all([
      tx.$queryRaw<{ v: string | null }[]>`SELECT platform_config_value('gemini_api_key') AS v`,
      tx.$queryRaw<{ v: string | null }[]>`SELECT platform_config_value('gemini_default_model') AS v`,
    ]);

    const rawModel = dbModelRow[0]?.v?.trim() || process.env.GEMINI_DEFAULT_MODEL?.trim() || "gemini-2.5-flash";
    const resolvedModel = (rawModel === "gemini-2.0-flash" || !rawModel)
      ? "gemini-2.5-flash"
      : rawModel;

    if (s?.customGeminiApiKey?.trim()) {
      return {
        apiKey: s.customGeminiApiKey.trim(),
        isCustom: true,
        remaining: 999999,
        model: resolvedModel,
      };
    }

    const dbKey = dbKeyRow[0]?.v;
    const platformKey = dbKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!platformKey) {
      throw new ValidationError(
        "AI engine is not configured on this platform. Please add your own Google Gemini API key in Store Settings > AI Suite."
      );
    }

    const tenant = await tx.tenant.findFirstOrThrow({
      select: { planTier: true },
    });

    const quota = PLAN_AI_QUOTAS[tenant.planTier] ?? PLAN_AI_QUOTAS.STARTER ?? 50;
    const periodMonth = getDhakaMonthStr();

    const usage = await tx.tenantAiUsage.findUnique({
      where: { tenantId_periodMonth: { tenantId, periodMonth } },
    });

    const used = usage?.generationCount ?? 0;
    if (used >= quota) {
      throw new AiQuotaExhaustedError(
        `Monthly quota of ${quota} AI generations reached for your ${tenant.planTier} plan. Add your own free Google Gemini API key in Store Settings for unlimited generations.`
      );
    }

    return {
      apiKey: platformKey,
      isCustom: false,
      remaining: Math.max(0, quota - used),
      model: resolvedModel,
    };
  });
}

/**
 * Increments tenant AI usage for the current month when using the platform key.
 */
export async function recordAiGeneration(tenantId: string, isCustom: boolean): Promise<void> {
  if (isCustom) return; // BYOK is unlimited and free of platform meter

  const periodMonth = getDhakaMonthStr();
  await withTenant(tenantId, async (tx) => {
    await tx.tenantAiUsage.upsert({
      where: { tenantId_periodMonth: { tenantId, periodMonth } },
      create: {
        tenantId,
        periodMonth,
        generationCount: 1,
      },
      update: {
        generationCount: { increment: 1 },
      },
    });
  });
}

export interface AiSettingsView {
  hasCustomKey: boolean;
  maskedKey: string | null;
  planTier: string;
  monthlyQuota: number;
  usedThisMonth: number;
  remainingThisMonth: number;
  chatbotEnabled: boolean;
  chatbotName: string;
  chatbotWelcome: string | null;
  chatbotEscalatePhone: string | null;
  chatbotInstructions: string | null;
}

export async function getAiSettings(tenantId: string, actor: StaffActor): Promise<AiSettingsView> {
  assertCan(actor, "design", "view");

  return withTenant(tenantId, async (tx) => {
    const [tenant, settings, usage] = await Promise.all([
      tx.tenant.findFirstOrThrow({ select: { planTier: true } }),
      tx.storeSettings.findFirst({
        select: {
          customGeminiApiKey: true,
          aiChatbotEnabled: true,
          aiChatbotName: true,
          aiChatbotWelcome: true,
          aiChatbotEscalatePhone: true,
          aiChatbotInstructions: true,
        },
      }),
      tx.tenantAiUsage.findUnique({
        where: { tenantId_periodMonth: { tenantId, periodMonth: getDhakaMonthStr() } },
      }),
    ]);

    const hasCustomKey = Boolean(settings?.customGeminiApiKey?.trim());
    const quota = PLAN_AI_QUOTAS[tenant.planTier] ?? PLAN_AI_QUOTAS.STARTER ?? 50;
    const used = usage?.generationCount ?? 0;
    const remaining = hasCustomKey ? 999999 : Math.max(0, quota - used);

    const rawKey = settings?.customGeminiApiKey?.trim();
    const maskedKey = rawKey
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : null;

    return {
      hasCustomKey,
      maskedKey,
      planTier: tenant.planTier,
      monthlyQuota: hasCustomKey ? 999999 : quota,
      usedThisMonth: used,
      remainingThisMonth: remaining,
      chatbotEnabled: settings?.aiChatbotEnabled ?? true,
      chatbotName: settings?.aiChatbotName ?? "শপ অ্যাসিস্ট্যান্ট",
      chatbotWelcome: settings?.aiChatbotWelcome ?? null,
      chatbotEscalatePhone: settings?.aiChatbotEscalatePhone ?? null,
      chatbotInstructions: settings?.aiChatbotInstructions ?? null,
    };
  });
}

export interface SaveAiSettingsInput {
  customGeminiApiKey?: string | null;
  aiChatbotEnabled?: boolean;
  aiChatbotName?: string;
  aiChatbotWelcome?: string | null;
  aiChatbotEscalatePhone?: string | null;
  aiChatbotInstructions?: string | null;
}

export async function saveAiSettings(
  tenantId: string,
  actor: StaffActor,
  input: SaveAiSettingsInput
): Promise<void> {
  assertCan(actor, "design", "edit");

  let phone: string | null = null;
  if (input.aiChatbotEscalatePhone?.trim()) {
    try {
      phone = normalizeBdPhone(input.aiChatbotEscalatePhone);
    } catch {
      throw new ValidationError("Invalid WhatsApp/escalation mobile number");
    }
  }

  await withTenant(tenantId, async (tx) => {
    const dataToUpdate: Record<string, unknown> = {};

    if (input.customGeminiApiKey !== undefined) {
      const trimmed = input.customGeminiApiKey?.trim();
      // If user submits empty string, clear it. If user leaves masked value unchanged, don't update.
      if (trimmed === "") {
        dataToUpdate.customGeminiApiKey = null;
      } else if (trimmed && !trimmed.includes("••••")) {
        dataToUpdate.customGeminiApiKey = trimmed;
      }
    }

    if (input.aiChatbotEnabled !== undefined) {
      dataToUpdate.aiChatbotEnabled = input.aiChatbotEnabled;
    }
    if (input.aiChatbotName !== undefined) {
      dataToUpdate.aiChatbotName = input.aiChatbotName.trim().slice(0, 50) || "শপ অ্যাসিস্ট্যান্ট";
    }
    if (input.aiChatbotWelcome !== undefined) {
      dataToUpdate.aiChatbotWelcome = input.aiChatbotWelcome?.trim().slice(0, 300) || null;
    }
    if (input.aiChatbotEscalatePhone !== undefined) {
      dataToUpdate.aiChatbotEscalatePhone = phone;
    }
    if (input.aiChatbotInstructions !== undefined) {
      dataToUpdate.aiChatbotInstructions = input.aiChatbotInstructions?.trim().slice(0, 3000) || null;
    }

    await tx.storeSettings.update({
      where: { tenantId },
      data: dataToUpdate,
    });
  });
}

/**
 * Tests a Gemini API Key to verify it can successfully contact the API.
 */
export async function testGeminiApiKey(
  apiKey: string,
  model = "gemini-2.5-flash",
  options?: { fetchImpl?: typeof fetch }
): Promise<{ valid: boolean; error?: string }> {
  const fetcher = options?.fetchImpl ?? globalThis.fetch;
  const rawModel = model?.trim() || "gemini-2.5-flash";
  const preferredModel = (rawModel === "gemini-2.0-flash" || rawModel === "gemini-1.5-flash" || rawModel === "gemini-1.5-pro")
    ? "gemini-2.5-flash"
    : rawModel;
  const candidateModels = Array.from(new Set([preferredModel, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]));

  let lastError = "Network error contacting Google Gemini API";

  for (const m of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${apiKey.trim()}`;

    try {
      const res = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (res.ok) {
        return { valid: true };
      }

      const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      lastError = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

      const isUnavailable =
        res.status === 404 ||
        lastError.toLowerCase().includes("not found") ||
        lastError.toLowerCase().includes("no longer available") ||
        lastError.toLowerCase().includes("not supported") ||
        lastError.toLowerCase().includes("high demand");

      if (isUnavailable) {
        continue;
      }

      return { valid: false, error: lastError };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error contacting Google Gemini API";
    }
  }

  return { valid: false, error: lastError };
}

export interface CallGeminiParams {
  apiKey: string;
  model?: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: { mimeType: string; data: string };
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Core resilient wrapper executing requests against the Google Gemini API.
 * Automatically tries candidate models (preferred model, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-flash-latest)
 * if the requested model returns 404, deprecated/no longer available, or unsupported.
 */
export async function callGemini(params: CallGeminiParams): Promise<string> {
  const fetcher = params.fetchImpl ?? globalThis.fetch;
  const rawModel = params.model?.trim() || "gemini-2.5-flash";
  const preferredModel = (rawModel === "gemini-2.0-flash" || rawModel === "gemini-1.5-flash" || rawModel === "gemini-1.5-pro")
    ? "gemini-2.5-flash"
    : rawModel;

  // Build ordered, deduplicated candidate models list
  const candidateModels = Array.from(new Set([
    preferredModel,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
  ]));

  const parts: Array<Record<string, unknown>> = [];

  if (params.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: params.imageBase64.mimeType,
        data: params.imageBase64.data,
      },
    });
  }

  parts.push({ text: params.prompt });

  const bodyPayload: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxOutputTokens ?? 2048,
    },
  };

  if (params.responseMimeType) {
    (bodyPayload.generationConfig as Record<string, unknown>).responseMimeType = params.responseMimeType;
  }

  if (params.responseSchema) {
    (bodyPayload.generationConfig as Record<string, unknown>).responseSchema = params.responseSchema;
  }

  if (params.systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: params.systemInstruction }],
    };
  }

  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${params.apiKey.trim()}`;

    try {
      const res = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        const msg = errJson?.error?.message || `Gemini API request failed with status ${res.status}`;
        // If 404/not found or unsupported model or deprecated/high demand, try next candidate model
        const isFallbackCandidate =
          res.status === 404 ||
          msg.toLowerCase().includes("not found") ||
          msg.toLowerCase().includes("no longer available") ||
          msg.toLowerCase().includes("not supported") ||
          msg.toLowerCase().includes("high demand");

        if (isFallbackCandidate) {
          console.warn(`[gemini] model ${modelName} unavailable (${msg}), trying fallback candidate...`);
          lastError = new Error(msg);
          continue;
        }
        console.error("[gemini] api error", msg);
        throw new Error(msg);
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No text content returned from Gemini model");
      }

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If error is network or non-404, we don't necessarily abort unless it's the last candidate
    }
  }

  throw lastError ?? new Error("Failed to generate content from any available Gemini model");
}
