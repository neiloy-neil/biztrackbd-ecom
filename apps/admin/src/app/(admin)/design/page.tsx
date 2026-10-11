import type { Metadata } from "next";
import { can, createPreviewToken, getBuilderAccess, listVersions, loadForEdit } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Editor } from "./editor";
import { ThemePicker } from "./theme-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store design" };

export default async function Design() {
  const s = await requireAccess("design");
  const [state, versions, access] = await Promise.all([loadForEdit(s.tenantId, s.actor, "home"), listVersions(s.tenantId, s.actor, "home"), getBuilderAccess(s.tenantId)]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  return (
    <Editor
      key={`${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
      pageKey="home"
      kind="home"
      title="Store design"
      initialPage={state.page}
      initialTheme={state.theme}
      hasDraft={state.isDraft}
      stamp={state.stamp}
      unpublished={state.unpublished}
      publishedVersion={state.publishedVersion}
      versions={versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString(), isLive: v.isLive }))}
      previewUrl={`${origin}/preview?token=${createPreviewToken(s.tenantId)}`}
      previewOrigin={origin}
      liveUrl={origin}
      canEdit={can(s.user.role, "design", "edit")}
      sectionsLocked={!access.sectionsEditable}
      header={<ThemePicker active={state.themeId} canEdit={can(s.user.role, "design", "edit")} />}
    />
  );
}
