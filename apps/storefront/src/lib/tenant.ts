import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { HEADERS } from "@biztrackbd/core";

export interface StoreContext {
  id: string;
  subdomain: string;
  themeId: string;
  locale: string;
  status: string;
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
  return {
    id,
    subdomain: h.get(HEADERS.subdomain) ?? "",
    themeId: h.get(HEADERS.theme) ?? "kapor",
    locale: h.get(HEADERS.locale) ?? "bn-BD",
    status: h.get(HEADERS.status) ?? "ACTIVE",
  };
});

/** For pages: no store for this host is a 404. */
export async function getStore(): Promise<StoreContext> {
  const store = await findStore();
  if (!store) notFound();
  return store;
}
