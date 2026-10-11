import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { HEADERS, getStoreInfo } from "@biztrackbd/core";
import { getLang, makeT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Shown for suspended and cancelled stores (the proxy rewrites here with a 503). Direct visits get a 404. */
export default async function Offline() {
  const h = await headers();
  if (h.get(HEADERS.route) !== "offline") notFound();
  const tenantId = h.get(HEADERS.tenantId);
  if (!tenantId) notFound();
  const lang = await getLang(h.get(HEADERS.locale) ?? "en");
  const t = makeT(lang);
  const info = await getStoreInfo(tenantId);
  return (
    <main className="offline">
      <div className="logo" style={{ flex: "none" }}>{info.storeName.toUpperCase()}</div>
      <h1>{t("offlineTitle")}</h1>
      <p className="muted" style={{ maxWidth: 420 }}>{info.offlineMessage ?? t("offlineText")}</p>
      {info.contactPhone && <a className="btn btn-primary btn-round" href={`tel:${info.contactPhone}`}>{t("callUs", { phone: info.contactPhone })}</a>}
      {info.whatsappNumber && <a className="btn btn-ghost btn-round" href={`https://wa.me/88${info.whatsappNumber}`} rel="noopener noreferrer">{t("whatsapp")}</a>}
      {info.facebookUrl && <a className="btn btn-ghost btn-round" href={info.facebookUrl} rel="noopener noreferrer">{t("facebook")}</a>}
      <p className="legal-small" style={{ marginTop: 24 }}>{t("poweredBy")}</p>
    </main>
  );
}
