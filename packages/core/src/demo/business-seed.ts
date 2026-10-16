import { withTenant, type Prisma } from "@biztrackbd/db";
import {
  findBusinessDemoTemplate,
  type BusinessDemoTemplate,
} from "./business-templates";
import { setTenantModeAndVertical } from "../site/mode";
import { upsertMenuCategory, upsertMenuItem } from "../site/menu";
import { upsertContentItem } from "../site/content-items";
import { upsertDownload } from "../site/downloads";
import { getBusinessTemplateByVertical } from "../site/templates/manifests";

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
