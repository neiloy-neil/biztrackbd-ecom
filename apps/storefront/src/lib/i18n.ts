import { cookies } from "next/headers";
import type { Lang } from "./i18n-core";

export * from "./i18n-core";

export const LANG_COOKIE = "bt_lang";

/** Shopper's language: cookie first, then the store's locale. */
export async function getLang(storeLocale: string): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c === "en" || c === "bn") return c;
  return storeLocale.startsWith("bn") ? "bn" : "en";
}
