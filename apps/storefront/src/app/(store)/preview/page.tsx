import type { Metadata } from "next";
import { getPreview, loadPageData, verifyPreviewToken } from "@biztrackbd/core";
import { PreviewBridge } from "@/components/preview-bridge";
import { getLang } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
// The draft is private to the people editing it: never indexed, never cached, never leaked through a referrer.
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

const adminOrigin = () => {
  try {
    return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).origin : undefined;
  } catch {
    return undefined;
  }
};

/** The home page as it is being edited: the saved draft first, then redrawn live from the editor's messages. */
export default async function Preview({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const store = await getStore();
  // The link carries a short-lived signed token for exactly this store. Anything else is a plain 404.
  if (verifyPreviewToken(token) !== store.id) notFound();
  const lang = await getLang(store.locale);
  const { page, theme } = await getPreview(store.id, "home");
  const data = await loadPageData(store.id, page, { everything: true });
  return <PreviewBridge kind="home" initialPage={page} initialTheme={theme} data={data} lang={lang} adminOrigin={adminOrigin()} />;
}
