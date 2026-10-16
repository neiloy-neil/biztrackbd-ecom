import type { Metadata } from "next";
import Link from "next/link";
import {
  can, createPreviewToken, getBuilderAccess, listCategories, listCustomPages,
  listPublishedTemplates, listChromeVersions, listFooterPages, listVersions,
  loadChromeForEdit, loadForEdit, templateUpdateAvailable
} from "@biztrackbd/core";
import type { SiteMode, BusinessVertical } from "@biztrackbd/core/builder-client";
import { withTenant } from "@biztrackbd/db";
import { SubmitButton } from "@/components/ui";
import { applyTemplateUpdateAction } from "./actions";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Builder } from "./builder";
import { ChromeEditor } from "./chrome-editor";
import { TemplateSwitcher } from "./template-switcher";
import { ThemePicker } from "./theme-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store design" };

// The pages every ecommerce store has one layout of (docs/39).
const PAGES = [
  { key: "home", label: "Home page" },
  { key: "product", label: "Product page" },
  { key: "collection", label: "Collection page" },
  { key: "cart", label: "Cart page" },
] as const;

export default async function Design({ searchParams }: { searchParams: Promise<{ page?: string; note?: string }> }) {
  const { page, note } = await searchParams;
  const pageKey = PAGES.find((p) => p.key === page)?.key ?? "home";
  const s = await requireAccess("design");

  if (page === "chrome") {
    const [state, versions, categories, pages, tenantData, customPages] = await Promise.all([
      loadChromeForEdit(s.tenantId, s.actor),
      listChromeVersions(s.tenantId, s.actor),
      listCategories(s.tenantId),
      listFooterPages(s.tenantId),
      withTenant(s.tenantId, (tx) =>
        tx.tenant.findFirstOrThrow({
          select: { siteMode: true },
        })
      ).catch(() => ({ siteMode: "ECOMMERCE" })),
      listCustomPages(s.tenantId, s.actor).catch(() => []),
    ]);
    const origin = storefrontOrigin(s.tenantSubdomain);
    const siteMode = (tenantData.siteMode ?? "ECOMMERCE") as SiteMode;
    const chromeChoices = siteMode === "PORTFOLIO"
      ? [
          { key: "home", label: "Home page" },
          { key: "chrome", label: "Header and footer" },
          ...customPages.map((cp) => ({ key: `custom:${cp.id}`, label: cp.title })),
        ]
      : siteMode === "HYBRID"
      ? [
          ...PAGES.map((p) => ({ key: p.key as string, label: p.label as string })),
          { key: "chrome", label: "Header and footer" },
          ...customPages.map((cp) => ({ key: `custom:${cp.id}`, label: `Page: ${cp.title}` })),
        ]
      : [...PAGES.map((p) => ({ key: p.key as string, label: p.label as string })), { key: "chrome", label: "Header and footer" }];

    return (
      <ChromeEditor
        key={`${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
        initial={state.chrome}
        stamp={state.stamp}
        hasDraft={state.isDraft}
        unpublished={state.unpublished}
        publishedVersion={state.publishedVersion}
        versions={versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString(), isLive: v.isLive }))}
        editable={state.editable}
        canEdit={can(s.user.role, "design", "edit")}
        previewUrl={`${origin}/chrome-preview?token=${createPreviewToken(s.tenantId)}`}
        previewOrigin={origin}
        liveUrl={origin}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        pages={pages}
        pageChoices={chromeChoices}
      />
    );
  }

  const [state, versions, access, tenantData, customPages] = await Promise.all([
    loadForEdit(s.tenantId, s.actor, pageKey),
    listVersions(s.tenantId, s.actor, pageKey),
    getBuilderAccess(s.tenantId),
    withTenant(s.tenantId, (tx) =>
      tx.tenant.findFirstOrThrow({
        select: { templateId: true, siteMode: true, businessVertical: true },
      })
    ).catch(() => ({ templateId: null, siteMode: "ECOMMERCE", businessVertical: null })),
    listCustomPages(s.tenantId, s.actor).catch(() => []),
  ]);

  const origin = storefrontOrigin(s.tenantSubdomain);
  const canEdit = can(s.user.role, "design", "edit");
  const token = createPreviewToken(s.tenantId);
  const label = PAGES.find((p) => p.key === pageKey)?.label ?? "Custom page";
  const siteMode = (tenantData.siteMode ?? "ECOMMERCE") as SiteMode;
  const businessVertical = (tenantData.businessVertical ?? undefined) as BusinessVertical | undefined;

  const pageChoices: { key: string; label: string }[] = siteMode === "PORTFOLIO"
    ? [
        { key: "home", label: "Home page" },
        { key: "chrome", label: "Header and footer" },
        ...customPages.map((cp) => ({ key: `custom:${cp.id}`, label: cp.title })),
      ]
    : siteMode === "HYBRID"
    ? [
        ...PAGES.map((p) => ({ key: p.key as string, label: p.label as string })),
        { key: "chrome", label: "Header and footer" },
        ...customPages.map((cp) => ({ key: `custom:${cp.id}`, label: `Page: ${cp.title}` })),
      ]
    : [...PAGES.map((p) => ({ key: p.key as string, label: p.label as string })), { key: "chrome", label: "Header and footer" }];

  // A newer version of the template this store started from (docs/46 stage 5): offered, never forced.
  const update = canEdit ? await templateUpdateAvailable(s.tenantId).catch(() => null) : null;
  const templates = pageKey === "home" ? await listPublishedTemplates().catch(() => []) : [];
  const currentTemplate = tenantData.templateId;
  const notice = (
    <>
      {note === "applied" && <div className="notice good" role="status" data-testid="template-applied">The new version of the template is in your drafts. Look through each page and press Publish when you like it. Your live store has not changed.</div>}
      {note && note !== "applied" && <div className="notice bad" role="alert">{note}</div>}
      {update && (
        <div className="notice info" role="note" data-testid="template-update">
          <b>A newer version of {update.name} is available</b> (you have version {update.have}, the latest is {update.latest}). Taking it puts the new layouts and colours in your drafts so you can look at them first. Nothing changes on your live store until you publish, and your own sections are replaced only in the drafts.
          <form action={applyTemplateUpdateAction} style={{ marginTop: 8 }}><SubmitButton className="btn btn-secondary btn-sm" pending="Preparing drafts…">Put it in my drafts</SubmitButton></form>
        </div>
      )}
    </>
  );

  return (
    <Builder
      key={`${pageKey}-${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
      pageKey={pageKey}
      kind={state.kind}
      title={pageKey === "home" ? (siteMode === "PORTFOLIO" ? "Website design" : "Store design") : label}
      pages={pageChoices}
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
      initialTab={update || note ? "theme" : undefined}
      siteMode={siteMode}
      businessVertical={businessVertical}
      header={pageKey === "home"
        ? <>{notice}<ThemePicker active={state.themeId} canEdit={canEdit} /><TemplateSwitcher templates={templates} currentLook={state.themeId} currentTemplate={currentTemplate} canEdit={canEdit} /></>
        : <>{notice}<div className="notice info" role="note">Colours, fonts and the template are set once for the whole website, on the <Link className="link" href="/design">Home page</Link>.</div></>}
    />
  );
}
