import type { Metadata } from "next";
import { getKaporSettings } from "@biztrackbd/core";
import { CartView } from "@/components/cart-view";
import { getLang, pickStrings } from "@/lib/i18n";
import { CART_STRINGS } from "@/lib/strings";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const store = await getStore();
  const lang = await getLang(store.locale);
  const theme = await getKaporSettings(store.id);
  const s = pickStrings(lang, CART_STRINGS);
  return (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      <h1 className="page-title">{s.yourCart}</h1>
      <CartView lang={lang} s={s} freeOver={theme.freeDeliveryOver} />
    </div>
  );
}
