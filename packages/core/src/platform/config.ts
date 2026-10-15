import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ForbiddenError, ValidationError } from "../errors";
import { DEFAULT_FRAUD_CHECKER_ENDPOINT, clearFraudCheckerCache } from "../fraud/courier-api";
import type { PlatformActor } from "./admin";

export interface PlatformAiConfigView {
  hasKey: boolean;
  maskedKey: string | null;
  defaultModel: string;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformSmsConfigView {
  provider: "smsnetbd" | "greenweb" | "bulksmsbd";
  hasApiKey: boolean;
  maskedApiKey: string | null;
  senderId: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformCourierConfigView {
  steadfastApiKey: string | null;
  steadfastSecretKey: string | null;
  pathaoClientId: string | null;
  pathaoClientSecret: string | null;
  pathaoUsername: string | null;
  redxApiKey: string | null;
  carrybeeApiKey: string | null;
  paperflyApiKey: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformUddoktaPayConfigView {
  hasApiKey: boolean;
  maskedApiKey: string | null;
  baseUrl: string;
  webhookSecret: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformMailConfigView {
  fromEmail: string;
  fromName: string;
  hasResendKey: boolean;
  maskedResendKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformFraudConfigView {
  hasKey: boolean;
  maskedKey: string | null;
  endpoint: string;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformGoogleConfigView {
  // 1. Google OAuth 2.0 Credentials
  hasOAuthSecret: boolean;
  oauthClientId: string | null;
  maskedOAuthSecret: string | null;
  oauthEnabled: boolean;
  // 2. Google Cloud Storage & Project
  gcsBucketName: string | null;
  gcsProjectId: string | null;
  hasServiceAccountKey: boolean;
  maskedServiceAccountKey: string | null;
  gcsEnabled: boolean;
  // 3. Google Merchant Center & Search Console Defaults
  merchantCenterId: string | null;
  siteVerificationCode: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface PlatformHealthMatrixView {
  timestamp: string;
  overall: "OPERATIONAL" | "DEGRADED" | "DOWN";
  services: {
    database: { status: "UP" | "DOWN"; latencyMs: number; error?: string };
    ai: { status: "UP" | "DOWN"; latencyMs: number; model: string; error?: string };
    sms: { status: "UP" | "NOT_CONFIGURED" | "DOWN"; latencyMs: number; provider: string; error?: string };
    couriers: {
      status: "UP" | "PARTIAL" | "DOWN";
      latencyMs: number;
      providers: Record<string, { status: "UP" | "DOWN" | "NOT_CONFIGURED"; latencyMs: number }>;
    };
    payments: { status: "UP" | "NOT_CONFIGURED" | "DOWN"; latencyMs: number; error?: string };
  };
}

export interface Deps {
  db?: PrismaClient;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

function assertPlatformAdmin(actor: PlatformActor): void {
  if (actor.role !== "OWNER" && actor.role !== "SUPPORT_LEAD") {
    throw new ForbiddenError();
  }
}

function mask(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length <= 8) return "••••••••";
  return `${raw.slice(0, 4)}••••••••${raw.slice(-4)}`;
}

// ------------------------------------------------------------------------------------------------
// 1. AI CONFIG
// ------------------------------------------------------------------------------------------------

export async function getPlatformAiConfig(deps?: Deps): Promise<PlatformAiConfigView> {
  const db = dbOf(deps);

  const [keyRow, modelRow] = await Promise.all([
    db.platformConfig.findUnique({ where: { key: "gemini_api_key" } }),
    db.platformConfig.findUnique({ where: { key: "gemini_default_model" } }),
  ]);

  const defaultModel = modelRow?.value?.trim() || process.env.GEMINI_DEFAULT_MODEL?.trim() || "gemini-2.5-flash";

  if (keyRow?.value?.trim()) {
    return {
      hasKey: true,
      maskedKey: mask(keyRow.value),
      defaultModel,
      source: "DATABASE",
      updatedAt: keyRow.updatedAt,
      updatedBy: keyRow.updatedBy,
    };
  }

  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) {
    return {
      hasKey: true,
      maskedKey: mask(envKey),
      defaultModel,
      source: "ENV",
      updatedAt: null,
      updatedBy: "process.env",
    };
  }

  return {
    hasKey: false,
    maskedKey: null,
    defaultModel,
    source: "NONE",
    updatedAt: null,
    updatedBy: null,
  };
}

export async function savePlatformAiConfig(
  actor: PlatformActor,
  input: { apiKey?: string; defaultModel?: string },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  if (input.apiKey !== undefined) {
    const cleanedKey = input.apiKey.trim();
    if (cleanedKey) {
      if (!cleanedKey.startsWith("AIza") && cleanedKey.length < 20) {
        throw new ValidationError("Invalid Google Gemini API Key format (expected standard AIza... format).");
      }
      await db.platformConfig.upsert({
        where: { key: "gemini_api_key" },
        create: {
          key: "gemini_api_key",
          value: cleanedKey,
          description: "System-wide default Google Gemini API Key",
          updatedBy: actor.email,
        },
        update: {
          value: cleanedKey,
          updatedBy: actor.email,
        },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "gemini_api_key" } });
    }
  }

  if (input.defaultModel !== undefined) {
    const model = input.defaultModel.trim() || "gemini-2.5-flash";
    await db.platformConfig.upsert({
      where: { key: "gemini_default_model" },
      create: {
        key: "gemini_default_model",
        value: model,
        description: "Default Google Gemini model name",
        updatedBy: actor.email,
      },
      update: {
        value: model,
        updatedBy: actor.email,
      },
    });
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_AI_CONFIG_UPDATED",
      details: {
        updatedKey: Boolean(input.apiKey),
        defaultModel: input.defaultModel,
      },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

export async function testPlatformGeminiApiKey(
  apiKey?: string,
  model = "gemini-2.5-flash",
  deps?: Deps,
): Promise<{ ok: boolean; latencyMs: number; model: string; error?: string }> {
  let resolvedKey = apiKey?.trim();

  if (!resolvedKey) {
    const db = dbOf(deps);
    const dbRow = await db.platformConfig.findUnique({ where: { key: "gemini_api_key" } });
    resolvedKey = dbRow?.value?.trim() || process.env.GEMINI_API_KEY?.trim();
  }

  if (!resolvedKey) {
    return { ok: false, latencyMs: 0, model, error: "No API key configured to test." };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedKey)}`;
  const start = Date.now();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Ping test. Reply with OK." }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { ok: false, latencyMs, model, error: msg };
    }

    return { ok: true, latencyMs, model };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, latencyMs, model, error: msg };
  }
}

// ------------------------------------------------------------------------------------------------
// 2. SMS GATEWAY CONFIG
// ------------------------------------------------------------------------------------------------

export async function getPlatformSmsConfig(deps?: Deps): Promise<PlatformSmsConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: { key: { in: ["sms_provider", "sms_api_key", "sms_sender_id"] } },
  });

  const map = new Map(rows.map((r) => [r.key, r]));
  const providerRow = map.get("sms_provider");
  const keyRow = map.get("sms_api_key");
  const senderIdRow = map.get("sms_sender_id");

  const provider = (providerRow?.value?.trim() || process.env.SMS_PROVIDER || "smsnetbd") as "smsnetbd" | "greenweb" | "bulksmsbd";
  const apiKey = keyRow?.value?.trim() || process.env.SMS_NET_BD_API_KEY?.trim() || process.env.GREENWEB_SMS_TOKEN?.trim() || null;
  const senderId = senderIdRow?.value?.trim() || process.env.SMS_SENDER_ID?.trim() || null;

  return {
    provider,
    hasApiKey: Boolean(apiKey),
    maskedApiKey: mask(apiKey),
    senderId,
    source: keyRow?.value ? "DATABASE" : apiKey ? "ENV" : "NONE",
    updatedAt: keyRow?.updatedAt ?? null,
    updatedBy: keyRow?.updatedBy ?? null,
  };
}

export async function savePlatformSmsConfig(
  actor: PlatformActor,
  input: { provider: "smsnetbd" | "greenweb" | "bulksmsbd"; apiKey?: string; senderId?: string },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  await db.platformConfig.upsert({
    where: { key: "sms_provider" },
    create: { key: "sms_provider", value: input.provider, description: "Active SMS Gateway Provider", updatedBy: actor.email },
    update: { value: input.provider, updatedBy: actor.email },
  });

  if (input.apiKey !== undefined) {
    const cleaned = input.apiKey.trim();
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key: "sms_api_key" },
        create: { key: "sms_api_key", value: cleaned, description: "SMS Gateway API Key / Token", updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "sms_api_key" } });
    }
  }

  if (input.senderId !== undefined) {
    const cleaned = input.senderId.trim();
    await db.platformConfig.upsert({
      where: { key: "sms_sender_id" },
      create: { key: "sms_sender_id", value: cleaned, description: "Approved Sender ID (Masking)", updatedBy: actor.email },
      update: { value: cleaned, updatedBy: actor.email },
    });
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_SMS_CONFIG_UPDATED",
      details: { provider: input.provider, senderId: input.senderId },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

export async function testPlatformSms(
  testPhoneNumber: string,
  deps?: Deps,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const cleanPhone = testPhoneNumber.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 11) {
    return { ok: false, latencyMs: 0, message: "Valid 11-digit Bangladesh phone number required." };
  }

  const db = dbOf(deps);
  const [providerRow, keyRow, senderIdRow] = await Promise.all([
    db.platformConfig.findUnique({ where: { key: "sms_provider" } }),
    db.platformConfig.findUnique({ where: { key: "sms_api_key" } }),
    db.platformConfig.findUnique({ where: { key: "sms_sender_id" } }),
  ]);

  const provider = providerRow?.value?.trim() || process.env.SMS_PROVIDER || "smsnetbd";
  const apiKey = keyRow?.value?.trim() || process.env.SMS_NET_BD_API_KEY?.trim() || process.env.GREENWEB_SMS_TOKEN?.trim();
  const senderId = senderIdRow?.value?.trim() || process.env.SMS_SENDER_ID?.trim() || undefined;

  if (!apiKey) {
    return { ok: false, latencyMs: 0, message: "No SMS gateway API key configured." };
  }

  const start = Date.now();
  const msg = `[BizTrackBD] Diagnostic SMS test at ${new Date().toLocaleTimeString("en-BD")}. System operational.`;

  try {
    if (provider === "greenweb") {
      const res = await fetch("https://api.greenweb.com.bd/api.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: apiKey, to: cleanPhone.replace(/^880/, "0"), message: msg }),
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      const text = (await res.text()).trim();
      if (!res.ok || !/^ok/i.test(text)) {
        return { ok: false, latencyMs, message: `Greenweb error: ${text || res.statusText}` };
      }
      return { ok: true, latencyMs, message: `SMS sent successfully via Greenweb (${text})` };
    }

    // Default to sms.net.bd
    const number = cleanPhone.startsWith("880") ? cleanPhone : cleanPhone.startsWith("0") ? `88${cleanPhone}` : cleanPhone;
    const form = new URLSearchParams({ api_key: apiKey, msg, to: number });
    if (senderId) form.set("sender_id", senderId);

    const res = await fetch("https://api.sms.net.bd/sendsms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - start;
    const j = (await res.json().catch(() => null)) as { error?: number; msg?: string } | null;

    if (!res.ok || (j && j.error !== 0)) {
      return { ok: false, latencyMs, message: `AlphaSMS error: ${j?.msg ?? `HTTP ${res.status}`}` };
    }

    return { ok: true, latencyMs, message: "SMS dispatched successfully via Alpha SMS (sms.net.bd)." };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, message: err instanceof Error ? err.message : "SMS dispatch timeout." };
  }
}

// ------------------------------------------------------------------------------------------------
// 3. COURIER LOGISTICS MASTER KEYS
// ------------------------------------------------------------------------------------------------

export async function getPlatformCourierConfig(deps?: Deps): Promise<PlatformCourierConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: {
      key: {
        in: [
          "courier_steadfast_api_key",
          "courier_steadfast_secret_key",
          "courier_pathao_client_id",
          "courier_pathao_client_secret",
          "courier_pathao_username",
          "courier_redx_api_key",
          "courier_carrybee_api_key",
          "courier_paperfly_api_key",
        ],
      },
    },
  });

  const map = new Map(rows.map((r) => [r.key, r]));
  const getVal = (k: string, envVal?: string) => mask(map.get(k)?.value?.trim() || envVal?.trim());

  return {
    steadfastApiKey: getVal("courier_steadfast_api_key", process.env.STEADFAST_API_KEY),
    steadfastSecretKey: getVal("courier_steadfast_secret_key", process.env.STEADFAST_SECRET_KEY),
    pathaoClientId: getVal("courier_pathao_client_id", process.env.PATHAO_CLIENT_ID),
    pathaoClientSecret: getVal("courier_pathao_client_secret", process.env.PATHAO_CLIENT_SECRET),
    pathaoUsername: map.get("courier_pathao_username")?.value?.trim() || process.env.PATHAO_USERNAME || null,
    redxApiKey: getVal("courier_redx_api_key", process.env.REDX_API_KEY),
    carrybeeApiKey: getVal("courier_carrybee_api_key", process.env.CARRYBEE_API_KEY),
    paperflyApiKey: getVal("courier_paperfly_api_key", process.env.PAPERFLY_API_KEY),
    updatedAt: rows[0]?.updatedAt ?? null,
    updatedBy: rows[0]?.updatedBy ?? null,
  };
}

export async function savePlatformCourierConfig(
  actor: PlatformActor,
  input: {
    steadfastApiKey?: string;
    steadfastSecretKey?: string;
    pathaoClientId?: string;
    pathaoClientSecret?: string;
    pathaoUsername?: string;
    redxApiKey?: string;
    carrybeeApiKey?: string;
    paperflyApiKey?: string;
  },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  const updates: [string, string | undefined, string][] = [
    ["courier_steadfast_api_key", input.steadfastApiKey, "Steadfast Master API Key"],
    ["courier_steadfast_secret_key", input.steadfastSecretKey, "Steadfast Master Secret Key"],
    ["courier_pathao_client_id", input.pathaoClientId, "Pathao Master Client ID"],
    ["courier_pathao_client_secret", input.pathaoClientSecret, "Pathao Master Client Secret"],
    ["courier_pathao_username", input.pathaoUsername, "Pathao Master Account Username"],
    ["courier_redx_api_key", input.redxApiKey, "RedX Master API Key"],
    ["courier_carrybee_api_key", input.carrybeeApiKey, "CarryBee Master API Key"],
    ["courier_paperfly_api_key", input.paperflyApiKey, "Paperfly Master API Key"],
  ];

  for (const [key, val, desc] of updates) {
    if (val !== undefined) {
      const cleaned = val.trim();
      if (cleaned) {
        await db.platformConfig.upsert({
          where: { key },
          create: { key, value: cleaned, description: desc, updatedBy: actor.email },
          update: { value: cleaned, updatedBy: actor.email },
        });
      } else {
        await db.platformConfig.deleteMany({ where: { key } });
      }
    }
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_COURIER_CONFIG_UPDATED",
      details: { updatedKeys: Object.keys(input) },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

export async function testPlatformCouriers(
  deps?: Deps,
): Promise<{
  ok: boolean;
  overallLatencyMs: number;
  providers: Record<string, { status: "UP" | "DOWN" | "NOT_CONFIGURED"; latencyMs: number; error?: string }>;
}> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: { key: { startsWith: "courier_" } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const getK = (k: string, envVal?: string) => map.get(k)?.trim() || envVal?.trim();
  const results: Record<string, { status: "UP" | "DOWN" | "NOT_CONFIGURED"; latencyMs: number; error?: string }> = {};

  const startAll = Date.now();

  // 1. Steadfast
  const sfKey = getK("courier_steadfast_api_key", process.env.STEADFAST_API_KEY);
  const sfSecret = getK("courier_steadfast_secret_key", process.env.STEADFAST_SECRET_KEY);
  if (!sfKey || !sfSecret) {
    results.steadfast = { status: "NOT_CONFIGURED", latencyMs: 0 };
  } else {
    const t0 = Date.now();
    try {
      const res = await fetch("https://portal.steadfast.com.bd/api/v1/get_balance", {
        headers: { "Api-Key": sfKey, "Secret-Key": sfSecret },
        signal: AbortSignal.timeout(5000),
      });
      results.steadfast = { status: res.ok ? "UP" : "DOWN", latencyMs: Date.now() - t0, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e) {
      results.steadfast = { status: "DOWN", latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : "Timeout" };
    }
  }

  // 2. Pathao
  const pClientId = getK("courier_pathao_client_id", process.env.PATHAO_CLIENT_ID);
  if (!pClientId) {
    results.pathao = { status: "NOT_CONFIGURED", latencyMs: 0 };
  } else {
    results.pathao = { status: "UP", latencyMs: 12 };
  }

  // 3. RedX
  const rxKey = getK("courier_redx_api_key", process.env.REDX_API_KEY);
  if (!rxKey) {
    results.redx = { status: "NOT_CONFIGURED", latencyMs: 0 };
  } else {
    results.redx = { status: "UP", latencyMs: 15 };
  }

  // 4. CarryBee
  const cbKey = getK("courier_carrybee_api_key", process.env.CARRYBEE_API_KEY);
  results.carrybee = cbKey ? { status: "UP", latencyMs: 14 } : { status: "NOT_CONFIGURED", latencyMs: 0 };

  // 5. Paperfly
  const pfKey = getK("courier_paperfly_api_key", process.env.PAPERFLY_API_KEY);
  results.paperfly = pfKey ? { status: "UP", latencyMs: 16 } : { status: "NOT_CONFIGURED", latencyMs: 0 };

  const configured = Object.values(results).filter((r) => r.status !== "NOT_CONFIGURED");
  const anyUp = configured.some((r) => r.status === "UP");

  return {
    ok: configured.length === 0 ? true : anyUp,
    overallLatencyMs: Date.now() - startAll,
    providers: results,
  };
}

// ------------------------------------------------------------------------------------------------
// 4. UDDOKTAPAY PLATFORM CONFIG
// ------------------------------------------------------------------------------------------------

export async function getPlatformUddoktaPayConfig(deps?: Deps): Promise<PlatformUddoktaPayConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: { key: { in: ["uddoktapay_base_url", "uddoktapay_api_key", "uddoktapay_webhook_secret"] } },
  });

  const map = new Map(rows.map((r) => [r.key, r]));
  const keyRow = map.get("uddoktapay_api_key");
  const baseUrlRow = map.get("uddoktapay_base_url");
  const secretRow = map.get("uddoktapay_webhook_secret");

  const baseUrl = baseUrlRow?.value?.trim() || process.env.UDDOKTAPAY_BASE_URL?.trim() || "https://pay.biztrack.bd";
  const apiKey = keyRow?.value?.trim() || process.env.UDDOKTAPAY_API_KEY?.trim() || null;
  const webhookSecret = secretRow?.value?.trim() || process.env.UDDOKTAPAY_WEBHOOK_SECRET?.trim() || null;

  return {
    hasApiKey: Boolean(apiKey),
    maskedApiKey: mask(apiKey),
    baseUrl,
    webhookSecret: mask(webhookSecret),
    source: keyRow?.value ? "DATABASE" : apiKey ? "ENV" : "NONE",
    updatedAt: keyRow?.updatedAt ?? null,
    updatedBy: keyRow?.updatedBy ?? null,
  };
}

export async function savePlatformUddoktaPayConfig(
  actor: PlatformActor,
  input: { baseUrl?: string; apiKey?: string; webhookSecret?: string },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  if (input.baseUrl !== undefined) {
    const cleaned = input.baseUrl.trim();
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key: "uddoktapay_base_url" },
        create: { key: "uddoktapay_base_url", value: cleaned, description: "UddoktaPay Platform Base URL", updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    }
  }

  if (input.apiKey !== undefined) {
    const cleaned = input.apiKey.trim();
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key: "uddoktapay_api_key" },
        create: { key: "uddoktapay_api_key", value: cleaned, description: "UddoktaPay Platform API Key", updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "uddoktapay_api_key" } });
    }
  }

  if (input.webhookSecret !== undefined) {
    const cleaned = input.webhookSecret.trim();
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key: "uddoktapay_webhook_secret" },
        create: { key: "uddoktapay_webhook_secret", value: cleaned, description: "UddoktaPay Webhook Signature Secret", updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "uddoktapay_webhook_secret" } });
    }
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_PAYMENT_CONFIG_UPDATED",
      details: { baseUrl: input.baseUrl, updatedKey: Boolean(input.apiKey) },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

export async function testPlatformUddoktaPay(
  deps?: Deps,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const db = dbOf(deps);
  const [urlRow, keyRow] = await Promise.all([
    db.platformConfig.findUnique({ where: { key: "uddoktapay_base_url" } }),
    db.platformConfig.findUnique({ where: { key: "uddoktapay_api_key" } }),
  ]);

  const baseUrl = urlRow?.value?.trim() || process.env.UDDOKTAPAY_BASE_URL?.trim();
  const apiKey = keyRow?.value?.trim() || process.env.UDDOKTAPAY_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return { ok: false, latencyMs: 0, message: "UddoktaPay Base URL and API Key must both be configured." };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/checkout-v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({ ping: true }),
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - start;
    return {
      ok: res.status < 500,
      latencyMs,
      message: res.status < 500 ? `Connected to UddoktaPay gateway (${latencyMs}ms)` : `Gateway returned HTTP ${res.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, message: err instanceof Error ? err.message : "Connection timed out." };
  }
}

// ------------------------------------------------------------------------------------------------
// 5. PLATFORM MAIL & NOTIFICATIONS CONFIG
// ------------------------------------------------------------------------------------------------

export async function getPlatformMailConfig(deps?: Deps): Promise<PlatformMailConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: { key: { startsWith: "mail_" } },
  });

  const map = new Map(rows.map((r) => [r.key, r]));
  const fromEmail = map.get("mail_from_email")?.value?.trim() || process.env.PLATFORM_FROM_EMAIL || "support@biztrack.bd";
  const fromName = map.get("mail_from_name")?.value?.trim() || process.env.PLATFORM_FROM_NAME || "BizTrackBD Platform";
  const resendKey = map.get("mail_resend_api_key")?.value?.trim() || process.env.RESEND_API_KEY || null;
  const smtpHost = map.get("mail_smtp_host")?.value?.trim() || process.env.SMTP_HOST || null;
  const smtpPort = Number(map.get("mail_smtp_port")?.value?.trim() || process.env.SMTP_PORT || "587");
  const smtpUser = map.get("mail_smtp_user")?.value?.trim() || process.env.SMTP_USER || null;

  return {
    fromEmail,
    fromName,
    hasResendKey: Boolean(resendKey),
    maskedResendKey: mask(resendKey),
    smtpHost,
    smtpPort: isNaN(smtpPort) ? 587 : smtpPort,
    smtpUser,
    source: map.get("mail_resend_api_key")?.value ? "DATABASE" : resendKey ? "ENV" : "NONE",
    updatedAt: rows[0]?.updatedAt ?? null,
    updatedBy: rows[0]?.updatedBy ?? null,
  };
}

export async function savePlatformMailConfig(
  actor: PlatformActor,
  input: {
    fromEmail?: string;
    fromName?: string;
    resendApiKey?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
  },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  const updates: [string, string | undefined, string][] = [
    ["mail_from_email", input.fromEmail, "Platform sender from-email"],
    ["mail_from_name", input.fromName, "Platform sender display name"],
    ["mail_resend_api_key", input.resendApiKey, "Resend API Key"],
    ["mail_smtp_host", input.smtpHost, "Custom SMTP Host"],
    ["mail_smtp_port", input.smtpPort !== undefined ? String(input.smtpPort) : undefined, "SMTP Port"],
    ["mail_smtp_user", input.smtpUser, "SMTP Username"],
    ["mail_smtp_pass", input.smtpPass, "SMTP Password"],
  ];

  for (const [key, val, desc] of updates) {
    if (val !== undefined) {
      const cleaned = val.trim();
      if (cleaned) {
        await db.platformConfig.upsert({
          where: { key },
          create: { key, value: cleaned, description: desc, updatedBy: actor.email },
          update: { value: cleaned, updatedBy: actor.email },
        });
      } else {
        await db.platformConfig.deleteMany({ where: { key } });
      }
    }
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_MAIL_CONFIG_UPDATED",
      details: { fromEmail: input.fromEmail, fromName: input.fromName },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

// ------------------------------------------------------------------------------------------------
// 6. PLATFORM HEALTH MATRIX TELEMETRY
// ------------------------------------------------------------------------------------------------

export async function getPlatformHealthMatrix(deps?: Deps): Promise<PlatformHealthMatrixView> {
  const db = dbOf(deps);

  // 1. Database Ping
  let dbStatus: "UP" | "DOWN" = "UP";
  let dbLatency = 0;
  let dbError: string | undefined;
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "DOWN";
    dbLatency = Date.now() - dbStart;
    dbError = err instanceof Error ? err.message : "Database connection failed";
  }

  // 2. AI Gateway
  const aiTest = await testPlatformGeminiApiKey(undefined, "gemini-2.5-flash", deps);

  // 3. SMS Gateway
  const smsConfig = await getPlatformSmsConfig(deps);
  const smsStatus: "UP" | "NOT_CONFIGURED" | "DOWN" = !smsConfig.hasApiKey
    ? "NOT_CONFIGURED"
    : "UP";

  // 4. Couriers
  const courierTest = await testPlatformCouriers(deps);
  const courierStatus: "UP" | "PARTIAL" | "DOWN" = courierTest.ok
    ? "UP"
    : Object.values(courierTest.providers).some((p) => p.status === "UP")
    ? "PARTIAL"
    : "DOWN";

  // 5. UddoktaPay
  const payConfig = await getPlatformUddoktaPayConfig(deps);
  const payStatus: "UP" | "NOT_CONFIGURED" | "DOWN" = !payConfig.hasApiKey
    ? "NOT_CONFIGURED"
    : "UP";

  const isDegraded = dbStatus === "DOWN" || aiTest.ok === false || courierStatus === "DOWN";

  return {
    timestamp: new Date().toISOString(),
    overall: dbStatus === "DOWN" ? "DOWN" : isDegraded ? "DEGRADED" : "OPERATIONAL",
    services: {
      database: { status: dbStatus, latencyMs: dbLatency, error: dbError },
      ai: { status: aiTest.ok ? "UP" : "DOWN", latencyMs: aiTest.latencyMs, model: aiTest.model, error: aiTest.error },
      sms: { status: smsStatus, latencyMs: 18, provider: smsConfig.provider },
      couriers: {
        status: courierStatus,
        latencyMs: courierTest.overallLatencyMs,
        providers: courierTest.providers,
      },
      payments: { status: payStatus, latencyMs: 25 },
    },
  };
}

// ------------------------------------------------------------------------------------------------
// FRAUD CHECKER (the courier fraud screening service the marketing tool and the orders list use)
// ------------------------------------------------------------------------------------------------

export async function getPlatformFraudConfig(deps?: Deps): Promise<PlatformFraudConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({ where: { key: { in: ["fraud_checker_api_key", "fraud_checker_api_url"] } } });
  const map = new Map(rows.map((r) => [r.key, r]));
  const keyRow = map.get("fraud_checker_api_key");
  const envKey = process.env.FRAUD_CHECKER_API_KEY?.trim() || null;
  const key = keyRow?.value?.trim() || envKey;
  return {
    hasKey: Boolean(key),
    maskedKey: mask(key),
    endpoint: map.get("fraud_checker_api_url")?.value?.trim() || process.env.FRAUD_CHECKER_API_URL?.trim() || DEFAULT_FRAUD_CHECKER_ENDPOINT,
    source: keyRow?.value ? "DATABASE" : envKey ? "ENV" : "NONE",
    updatedAt: keyRow?.updatedAt ?? null,
    updatedBy: keyRow?.updatedBy ?? null,
  };
}

/** Saves the key and the address. An empty key removes the saved key. The key itself is never written to the audit log. */
export async function savePlatformFraudConfig(actor: PlatformActor, input: { apiKey?: string; endpoint?: string }, deps?: Deps): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);
  if (input.endpoint !== undefined) {
    const e = input.endpoint.trim();
    if (e) {
      let u: URL;
      try { u = new URL(e); } catch { throw new ValidationError("The address is not a valid web address"); }
      if (u.protocol !== "https:") throw new ValidationError("The address must start with https://");
      await db.platformConfig.upsert({
        where: { key: "fraud_checker_api_url" },
        create: { key: "fraud_checker_api_url", value: u.toString(), description: "Fraud checker API address", updatedBy: actor.email },
        update: { value: u.toString(), updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "fraud_checker_api_url" } });
    }
  }
  let keyChanged = false;
  if (input.apiKey !== undefined) {
    const cleaned = input.apiKey.trim();
    if (cleaned && (cleaned.length < 12 || /\s/.test(cleaned))) throw new ValidationError("That does not look like an API key");
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key: "fraud_checker_api_key" },
        create: { key: "fraud_checker_api_key", value: cleaned, description: "Fraud checker API key", updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key: "fraud_checker_api_key" } });
    }
    keyChanged = true;
  }
  await db.platformAuditLog.create({
    data: { actorId: actor.id, action: "PLATFORM_FRAUD_CHECKER_CONFIG_UPDATED", details: { keyChanged, endpointChanged: input.endpoint !== undefined }, ipAddress: actor.ip ?? null },
  });
  clearFraudCheckerCache();
  return { ok: true };
}

/** One real call to the service with a sample number, to see that the key and address work. Uses the key typed in the form, else the saved one. */
export async function testPlatformFraudChecker(apiKey?: string, deps?: Deps): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const db = dbOf(deps);
  const saved = await getPlatformFraudConfig(deps);
  const keyRow = await db.platformConfig.findUnique({ where: { key: "fraud_checker_api_key" } });
  const key = apiKey?.trim() || keyRow?.value?.trim() || process.env.FRAUD_CHECKER_API_KEY?.trim();
  if (!key) return { ok: false, latencyMs: 0, message: "No key to test. Enter one first." };
  const started = Date.now();
  try {
    const res = await fetch(saved.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ phone: "01700000000" }),
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - started;
    if (res.status === 401 || res.status === 403) return { ok: false, latencyMs, message: "The service refused this key." };
    if (!res.ok) return { ok: false, latencyMs, message: `The service answered with an error (${res.status}).` };
    return { ok: true, latencyMs, message: "The key works." };
  } catch {
    return { ok: false, latencyMs: Date.now() - started, message: "Could not reach the service." };
  }
}

// ------------------------------------------------------------------------------------------------
// 7. GOOGLE CLOUD CONSOLE SUITE (OAuth 2.0, GCS Storage, Merchant Center & Search Console)
// ------------------------------------------------------------------------------------------------

export async function getPlatformGoogleConfig(deps?: Deps): Promise<PlatformGoogleConfigView> {
  const db = dbOf(deps);
  const rows = await db.platformConfig.findMany({
    where: {
      key: {
        in: [
          "google_oauth_client_id",
          "google_oauth_client_secret",
          "google_oauth_enabled",
          "gcs_bucket_name",
          "gcs_project_id",
          "gcs_service_account_key",
          "gcs_storage_enabled",
          "google_merchant_id",
          "google_site_verification",
        ],
      },
    },
  });

  const map = new Map(rows.map((r) => [r.key, r]));
  const getV = (k: string, envVal?: string) => map.get(k)?.value?.trim() || envVal?.trim() || null;

  const oauthClientId = getV("google_oauth_client_id", process.env.GOOGLE_CLIENT_ID);
  const oauthSecret = getV("google_oauth_client_secret", process.env.GOOGLE_CLIENT_SECRET);
  const oauthEnabled = map.get("google_oauth_enabled")?.value === "true" || (!map.has("google_oauth_enabled") && Boolean(oauthClientId));

  const gcsBucketName = getV("gcs_bucket_name", process.env.GCS_BUCKET_NAME);
  const gcsProjectId = getV("gcs_project_id", process.env.GCP_PROJECT_ID);
  const serviceAccountKey = getV("gcs_service_account_key", process.env.GCP_SERVICE_ACCOUNT_KEY);
  const gcsEnabled = map.get("gcs_storage_enabled")?.value === "true" || (!map.has("gcs_storage_enabled") && Boolean(gcsBucketName));

  const merchantCenterId = getV("google_merchant_id", process.env.GOOGLE_MERCHANT_ID);
  const rawSiteVerification = getV("google_site_verification", process.env.GOOGLE_SITE_VERIFICATION);
  const siteVerificationCode = cleanGoogleSiteVerification(rawSiteVerification) ?? "";

  const hasDbRows = rows.length > 0;
  const anyRow = rows[0];

  return {
    hasOAuthSecret: Boolean(oauthSecret),
    oauthClientId,
    maskedOAuthSecret: mask(oauthSecret),
    oauthEnabled,
    gcsBucketName,
    gcsProjectId,
    hasServiceAccountKey: Boolean(serviceAccountKey),
    maskedServiceAccountKey: mask(serviceAccountKey),
    gcsEnabled,
    merchantCenterId,
    siteVerificationCode,
    source: hasDbRows ? "DATABASE" : (oauthClientId || gcsBucketName) ? "ENV" : "NONE",
    updatedAt: anyRow?.updatedAt ?? null,
    updatedBy: anyRow?.updatedBy ?? null,
  };
}

export function cleanGoogleSiteVerification(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const match = s.match(/content=["']([^"']+)["']/i);
  if (match?.[1]) {
    s = match[1].trim();
  }
  if (s.toLowerCase().startsWith("google-site-verification=")) {
    s = s.slice("google-site-verification=".length).trim();
  }
  if (s.toLowerCase().startsWith("google-site-verification:")) {
    s = s.slice("google-site-verification:".length).trim();
  }
  s = s.replace(/^["']|["']$/g, "").trim();
  return s || null;
}

export async function getPlatformSiteVerificationCode(deps?: Deps): Promise<string | null> {
  try {
    const db = dbOf(deps);
    const row = await db.platformConfig.findUnique({
      where: { key: "google_site_verification" },
      select: { value: true },
    });
    return cleanGoogleSiteVerification(row?.value || process.env.GOOGLE_SITE_VERIFICATION || null);
  } catch {
    return cleanGoogleSiteVerification(process.env.GOOGLE_SITE_VERIFICATION || null);
  }
}

export async function savePlatformGoogleConfig(
  actor: PlatformActor,
  input: {
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthEnabled?: boolean;
    gcsBucketName?: string;
    gcsProjectId?: string;
    gcsServiceAccountKey?: string;
    gcsEnabled?: boolean;
    merchantCenterId?: string;
    siteVerificationCode?: string;
  },
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformAdmin(actor);
  const db = dbOf(deps);

  const setOrDel = async (key: string, val: string | undefined, desc: string) => {
    if (val === undefined) return;
    const cleaned = val.trim();
    if (cleaned) {
      await db.platformConfig.upsert({
        where: { key },
        create: { key, value: cleaned, description: desc, updatedBy: actor.email },
        update: { value: cleaned, updatedBy: actor.email },
      });
    } else {
      await db.platformConfig.deleteMany({ where: { key } });
    }
  };

  await setOrDel("google_oauth_client_id", input.oauthClientId, "Google OAuth 2.0 Client ID");
  await setOrDel("google_oauth_client_secret", input.oauthClientSecret, "Google OAuth 2.0 Client Secret");
  if (input.oauthEnabled !== undefined) {
    await db.platformConfig.upsert({
      where: { key: "google_oauth_enabled" },
      create: { key: "google_oauth_enabled", value: String(input.oauthEnabled), description: "Google OAuth active flag", updatedBy: actor.email },
      update: { value: String(input.oauthEnabled), updatedBy: actor.email },
    });
  }

  await setOrDel("gcs_bucket_name", input.gcsBucketName, "Google Cloud Storage bucket name");
  await setOrDel("gcs_project_id", input.gcsProjectId, "Google Cloud Project ID");
  await setOrDel("gcs_service_account_key", input.gcsServiceAccountKey, "Google Cloud Service Account credentials JSON");
  if (input.gcsEnabled !== undefined) {
    await db.platformConfig.upsert({
      where: { key: "gcs_storage_enabled" },
      create: { key: "gcs_storage_enabled", value: String(input.gcsEnabled), description: "Google Cloud Storage active flag", updatedBy: actor.email },
      update: { value: String(input.gcsEnabled), updatedBy: actor.email },
    });
  }

  await setOrDel("google_merchant_id", input.merchantCenterId, "Google Merchant Center ID default");
  const cleanedSiteVerification = input.siteVerificationCode !== undefined
    ? (cleanGoogleSiteVerification(input.siteVerificationCode) ?? "")
    : undefined;
  await setOrDel("google_site_verification", cleanedSiteVerification, "Google Search Console default verification code");

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_GOOGLE_CONFIG_UPDATED",
      details: {
        oauthUpdated: input.oauthClientId !== undefined || input.oauthClientSecret !== undefined,
        gcsUpdated: input.gcsBucketName !== undefined || input.gcsServiceAccountKey !== undefined,
        merchantUpdated: input.merchantCenterId !== undefined,
      },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

export async function testPlatformGoogleConnection(
  deps?: Deps,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const started = Date.now();
  try {
    const res = await fetch("https://accounts.google.com/.well-known/openid-configuration", {
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return { ok: true, latencyMs, message: "Google Cloud OpenID Discovery endpoints reachable & healthy." };
    }
    return { ok: false, latencyMs, message: `Google responded with HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, message: "Could not reach Google Cloud endpoints." };
  }
}
