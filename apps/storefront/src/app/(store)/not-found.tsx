import Link from "next/link";
import { getLang, makeT } from "@/lib/i18n";
import { findStore } from "@/lib/tenant";

export default async function NotFound() {
  const store = await findStore();
  const t = makeT(await getLang(store?.locale ?? "en"));
  return (
    <div className="wrap empty">
      <h1 style={{ fontSize: 26, color: "var(--ink)" }}>{t("notFound")}</h1>
      <p style={{ marginTop: 8 }}>{t("notFoundS")}</p>
      <p style={{ marginTop: 20 }}><Link href="/" className="btn btn-primary">{t("home")}</Link></p>
    </div>
  );
}
