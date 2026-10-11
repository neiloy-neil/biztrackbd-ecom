import type { Metadata } from "next";
import Link from "next/link";
import { can, createPreviewToken, getBuilderAccess, listVersions, loadForEdit } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Builder } from "./builder";
import { ThemePicker } from "./theme-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store design" };

// The pages every store has one layout of (docs/39). Landing pages are edited from their own list.
const PAGES = [
  { key: "home", label: "Home page" },
  { key: "product", label: "Product page" },
  { key: "collection", label: "Collection page" },
  { key: "cart", label: "Cart page" },
] as const;

export default async function Design({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const pageKey = PAGES.find((p) => p.key === page)?.key ?? "home";
  const s = await requireAccess("design");
  const [state, versions, access] = await Promise.all([loadForEdit(s.tenantId, s.actor, pageKey), listVersions(s.tenantId, s.actor, pageKey), getBuilderAccess(s.tenantId)]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const canEdit = can(s.user.role, "design", "edit");
  const token = createPreviewToken(s.tenantId);
  const label = PAGES.find((p) => p.key === pageKey)!.label;
  return (
    <Builder
      key={`${pageKey}-${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
      pageKey={pageKey}
      kind={state.kind}
      title={pageKey === "home" ? "Store design" : label}
      pages={PAGES.map((p) => ({ key: p.key, label: p.label }))}
      initialPage={state.page}
      initialTheme={state.theme}
      hasDraft={state.isDraft}
      stamp={state.stamp}
      unpublished={state.unpublished}
      publishedVersion={state.publishedVersion}
      versions={versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString(), isLive: v.isLive }))}
      previewUrl={`${origin}/preview?token=${token}${pageKey === "home" ? "" : `&page=${pageKey}`}`}
      previewOrigin={origin}
      liveUrl={origin}
      canEdit={canEdit}
      sectionsLocked={pageKey === "home" ? !access.sectionsEditable : !access.allPagesEditable}
      exitHref="/"
      header={pageKey === "home"
        ? <ThemePicker active={state.themeId} canEdit={canEdit} />
        : <div className="notice info" role="note">Colours, fonts and the template are set once for the whole store, on the <Link className="link" href="/design">Home page</Link>.</div>}
    />
  );
}
