import { ValidationError } from "../errors";
import { createPathao } from "./pathao";
import { createRedx } from "./redx";
import { createSteadfast } from "./steadfast";
import type { AdapterContext, CourierAdapter, CourierProviderKey } from "./types";

export type AdapterFactory = (provider: CourierProviderKey, ctx: Omit<AdapterContext, "fetch">) => CourierAdapter;

/** Development and end-to-end tests may point a courier at a local fake. Ignored in production so a stray variable cannot redirect real parcels. */
function override(provider: CourierProviderKey): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return process.env[`COURIER_BASE_URL_${provider}`] || undefined;
}

export const defaultAdapterFactory: AdapterFactory = (provider, ctx) => {
  const full: AdapterContext = { ...ctx, fetch: (...a) => fetch(...a) };
  switch (provider) {
    case "STEADFAST": return createSteadfast(full, override(provider));
    case "PATHAO": return createPathao(full, override(provider));
    case "REDX": return createRedx(full, override(provider));
    default: throw new ValidationError("Unknown courier");
  }
};

let factory: AdapterFactory = defaultAdapterFactory;
/** Tests swap in a fake courier. */
export function setAdapterFactory(f: AdapterFactory): void {
  factory = f;
}
export function adapterFactory(): AdapterFactory {
  return factory;
}
