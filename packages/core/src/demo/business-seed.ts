import { randomUUID } from "node:crypto";
import { getBasePrisma, withTenant, type Prisma } from "@biztrackbd/db";
import {
  findBusinessDemoTemplate,
  type BusinessDemoTemplate,
} from "./business-templates";
import { setTenantModeAndVertical } from "../site/mode";
import { upsertMenuCategory, upsertMenuItem } from "../site/menu";
import { upsertContentItem } from "../site/content-items";
import { upsertDownload } from "../site/downloads";
import { getBusinessTemplateByVertical, BUSINESS_TEMPLATES } from "../site/templates/manifests";
import { installTemplateForNewStore, type TemplateInfo } from "../platform/templates";

/**
 * Seeds authentic business domain records (Menu categories/dishes, Content Items,
 * Downloads, StoreSettings, and starter theme manifest) for a given business demo template.
 */
export async function seedBusinessDemoStore(
  tenantId: string,
  templateIdOrHost: string
): Promise<{ ok: boolean; template: BusinessDemoTemplate }> {
  const template = findBusinessDemoTemplate(templateIdOrHost);
  if (!template) {
    throw new Error(`Unknown business demo template: ${templateIdOrHost}`);
  }

  // 1. Set tenant siteMode and businessVertical
  await setTenantModeAndVertical(tenantId, "PORTFOLIO", template.vertical);

  // 2. Update storeSettings & themeInstall
  await withTenant(tenantId, async (tx) => {
    await tx.storeSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        storeName: template.name,
        storeNameBn: template.nameBn,
        tagline: template.tagline,
        contactPhone: template.phone,
        whatsappNumber: template.whatsapp,
        addressLine: template.address,
        description: template.description,
      },
      update: {
        storeName: template.name,
        storeNameBn: template.nameBn,
        tagline: template.tagline,
        contactPhone: template.phone,
        whatsappNumber: template.whatsapp,
        addressLine: template.address,
        description: template.description,
      },
    });

    const manifest = getBusinessTemplateByVertical(template.vertical);
    if (manifest) {
      await tx.themeInstall.upsert({
        where: {
          tenantId_themeId: {
            tenantId,
            themeId: manifest.baseLook,
          },
        },
        create: {
          tenantId,
          themeId: manifest.baseLook,
          isActive: true,
          settings: manifest.settings as unknown as Prisma.InputJsonValue,
          pagesJson: manifest.pages as unknown as Prisma.InputJsonValue,
        },
        update: {
          isActive: true,
          settings: manifest.settings as unknown as Prisma.InputJsonValue,
          pagesJson: manifest.pages as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  // 3. Seed Menu Categories & Dishes (Restaurant vertical)
  if (template.menuCategories && template.menuCategories.length > 0) {
    for (const [cIdx, cat] of template.menuCategories.entries()) {
      const createdCat = await upsertMenuCategory(tenantId, {
        name: cat.name,
        nameBn: cat.nameBn,
        description: cat.description,
        sortOrder: cIdx,
        isActive: true,
      });

      for (const [iIdx, item] of cat.items.entries()) {
        await upsertMenuItem(tenantId, {
          categoryId: createdCat.id,
          name: item.name,
          nameBn: item.nameBn,
          description: item.description,
          price: item.price,
          compareAtPrice: item.compareAt,
          dietaryLabels: item.dietary,
          isAvailable: true,
          sortOrder: iIdx,
        });
      }
    }
  }

  // 4. Seed Content Items (Doctor, Corporate, Service Pro, Portfolio verticals)
  if (template.contentItems && template.contentItems.length > 0) {
    for (const [idx, item] of template.contentItems.entries()) {
      await upsertContentItem(tenantId, {
        kind: item.kind,
        slug: item.slug,
        title: item.title,
        titleBn: item.titleBn,
        summary: item.summary,
        summaryBn: item.summaryBn,
        data: item.data,
        isPublished: true,
        sortOrder: idx,
      });
    }
  }

  // 5. Seed Downloads (Corporate profiles, resumes/CVs)
  if (template.downloads && template.downloads.length > 0) {
    for (const [idx, d] of template.downloads.entries()) {
      await upsertDownload(tenantId, {
        label: d.label,
        labelBn: d.labelBn,
        kind: d.kind,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        isPublic: d.isPublic,
        sortOrder: idx,
      });
    }
  }

  return { ok: true, template };
}

/**
 * Builds or rebuilds an authentic business demo store (e.g. Dhaka Bistro, Modern Clinic).
 * Creates the tenant, installs vertical theme manifest pages and custom pages,
 * and seeds authentic domain records (menus, content items, services, downloads).
 */
export async function resetBusinessDemoStore(
  templateIdOrHost: string
): Promise<{ template: string; tenantId: string; subdomain: string }> {
  const t = findBusinessDemoTemplate(templateIdOrHost);
  if (!t) throw new Error(`Unknown business demo template: ${templateIdOrHost}`);

  const manifest = BUSINESS_TEMPLATES.find((bt) => bt.id === t.id) ?? getBusinessTemplateByVertical(t.vertical);
  if (!manifest) throw new Error(`No manifest for business template: ${t.id}`);

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const cleanRoot = root.replace(/:\d+$/, "");
  const base = getBasePrisma();

  // If a store already exists with this host, remove it if it's a demo
  const found = await base.tenant.findFirst({
    where: { subdomain: t.host },
    select: { id: true, isDemo: true },
  });

  if (found) {
    if (!found.isDemo) throw new Error(`${t.host}.${cleanRoot} exists and is not a demo store`);
    await base.tenant.delete({ where: { id: found.id } });
  }

  const id = randomUUID();
  const email = `demo-${t.host}@${cleanRoot}`;
  const PHONE = "01700000000";
  const FAR_FUTURE = new Date("2100-01-01T00:00:00Z");

  // Call signup_create_tenant directly
  await base.$queryRaw`SELECT signup_create_tenant(${id}, ${t.name}, ${t.host}, ${manifest.baseLook}, 'BUSINESS'::"PlanTier", ${"Demo " + t.name}, ${email}, ${PHONE}, 14, false, ${null}, 3)`;

  // Update tenant properties and install full template
  await withTenant(id, async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: {
        isDemo: true,
        demoKind: "TEMPLATE",
        status: "ACTIVE",
        trialEndsAt: FAR_FUTURE,
        themeId: manifest.baseLook,
        locale: "en-BD",
        businessVertical: t.vertical,
        siteMode: manifest.siteMode,
      },
    });

    const templateInfo: TemplateInfo = {
      id: manifest.id,
      name: manifest.name,
      blurb: manifest.blurb,
      audience: manifest.audience,
      baseLook: manifest.baseLook,
      category: manifest.category,
      tags: manifest.tags,
      moduleLabel: manifest.vertical,
      version: 1,
      status: "PUBLISHED",
      builtIn: true,
      settings: manifest.settings,
      pages: manifest.pages,
      chrome: manifest.chrome,
      siteMode: manifest.siteMode,
      vertical: manifest.vertical,
      customPages: manifest.customPages,
    };

    await installTemplateForNewStore(tx, id, templateInfo, "system");
  });

  // Seed authentic business records (dishes, doctors, services, portfolio, downloads, store settings)
  await seedBusinessDemoStore(id, t.id);

  return { template: t.id, tenantId: id, subdomain: t.host };
}
