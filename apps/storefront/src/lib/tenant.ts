import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DEMO_SUBDOMAINS, HEADERS, getTenantCapabilities } from "@biztrackbd/core";

export interface StoreContext {
  id: string;
  subdomain: string;
  themeId: string;
  locale: string;
  status: string;
  isDemo: boolean;
}

/**
 * The store for this request, from the headers proxy.ts set. The proxy deletes any client-sent copy of these headers first,
 * so they can be trusted. Without them (the proxy did not run) there is no store: fail closed, never fall back to a default.
 */
export const findStore = cache(async (): Promise<StoreContext | null> => {
  const h = await headers();
  if (h.get(HEADERS.route) !== "store") return null;
  const id = h.get(HEADERS.tenantId);
  if (!id) return null;
  const subdomain = h.get(HEADERS.subdomain) ?? "";
  const isDemo = DEMO_SUBDOMAINS.has(subdomain);
  return {
    id,
    subdomain,
    themeId: h.get(HEADERS.theme) ?? "kapor",
    locale: h.get(HEADERS.locale) ?? "bn-BD",
    status: h.get(HEADERS.status) ?? "ACTIVE",
    isDemo,
  };
});

/** For pages: no store for this host is a 404. */
export async function getStore(): Promise<StoreContext> {
  const store = await findStore();
  if (!store) notFound();
  return store;
}

export const getStoreCapabilities = cache(async (tenantId: string) => {
  return getTenantCapabilities(tenantId);
});

export async function requireCommerce(tenantId: string) {
  const caps = await getStoreCapabilities(tenantId);
  if (!caps.commerce) notFound();
  return caps;
}
