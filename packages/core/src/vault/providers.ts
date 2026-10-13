import { z } from "zod";

/** What each integration stores. `secrets` are encrypted and write-only; `config` is plain and shown in the UI. */
export interface ProviderSpec {
  label: string;
  secrets: readonly string[];
  config: readonly string[];
}

export const PROVIDERS = {
  STEADFAST: { label: "Steadfast", secrets: ["apiKey", "secretKey"], config: ["baseUrl"] },
  PATHAO: { label: "Pathao", secrets: ["clientId", "clientSecret", "username", "password"], config: ["storeId"] },
  REDX: { label: "RedX", secrets: ["accessToken"], config: ["pickupStoreId", "baseUrl"] },
  SSLCOMMERZ: { label: "SSLCommerz", secrets: ["storeId", "storePassword"], config: [] },
  UDDOKTAPAY: { label: "UddoktaPay", secrets: ["apiKey"], config: ["baseUrl"] },
  META_CAPI: { label: "Meta Conversions API", secrets: ["accessToken"], config: ["pixelId"] },
  GA4: { label: "Google Analytics 4", secrets: ["apiSecret"], config: ["measurementId"] },
  BREVO_BYO: { label: "Brevo (own account)", secrets: ["apiKey"], config: ["senderEmail", "senderName"] },
  SMS_BYO: { label: "SMS (own account)", secrets: ["apiKey"], config: ["senderId"] },
} as const satisfies Record<string, ProviderSpec>;

export type ProviderKey = keyof typeof PROVIDERS;
export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

export const ProviderSchema = z.enum(PROVIDER_KEYS as [ProviderKey, ...ProviderKey[]]);
export const ModeSchema = z.enum(["TEST", "LIVE"]);
