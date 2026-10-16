import { withTenant, type Prisma, type SiteDownload } from "@biztrackbd/db";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../errors";

export const DOWNLOAD_KINDS = [
  "CV",
  "BROCHURE",
  "PROFILE",
  "MENU_PDF",
  "CATALOG",
  "FILE",
] as const;

export type DownloadKind = (typeof DOWNLOAD_KINDS)[number] | string;

// ---------------------------------------------------------------------------
// Input validation schema
// ---------------------------------------------------------------------------

export const UpsertDownloadSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label is required").max(150),
  labelBn: z.string().max(150).optional().nullable(),
  kind: z.string().default("FILE"),
  fileUrl: z.string().min(1, "File URL is required"),
  fileName: z.string().min(1, "File name is required").max(255),
  fileSize: z.number().int().min(0).optional().nullable(),
  mimeType: z.string().max(100).optional().nullable(),
  /**
   * isPublic determines download access mode:
   * - true: Direct 1-click download
   * - false: Gated (Lead Magnet mode) requiring visitor contact capture first
   */
  isPublic: z.boolean().default(true),
  /**
   * Merchant UI alias: setting requiresLead=true enforces isPublic=false
   */
  requiresLead: z.boolean().optional(),
  sortOrder: z.number().int().default(0),
}).transform((data) => ({
  ...data,
  isPublic: data.requiresLead !== undefined ? !data.requiresLead : data.isPublic,
}));

export type UpsertDownloadInput = z.input<typeof UpsertDownloadSchema>;

export interface PublicDownloadView {
  id: string;
  label: string;
  labelBn: string | null;
  kind: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  isPublic: boolean;
  requiresLead: boolean;
  downloadCount: number;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Service operations
// ---------------------------------------------------------------------------

/**
 * List all downloadable assets for a tenant with optional filtering.
 */
export async function listDownloads(
  tenantId: string,
  filter?: {
    isPublic?: boolean;
    search?: string;
  }
): Promise<SiteDownload[]> {
  return withTenant(tenantId, async (tx) => {
    const where: Prisma.SiteDownloadWhereInput = {
      tenantId,
      ...(filter?.isPublic !== undefined ? { isPublic: filter.isPublic } : {}),
      ...(filter?.search
        ? {
            OR: [
              { label: { contains: filter.search, mode: "insensitive" } },
              { labelBn: { contains: filter.search, mode: "insensitive" } },
              { fileName: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return tx.siteDownload.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  });
}

/**
 * Fetch a single download by ID.
 */
export async function getDownloadById(
  tenantId: string,
  id: string
): Promise<SiteDownload> {
  return withTenant(tenantId, async (tx) => {
    const download = await tx.siteDownload.findFirst({
      where: { id, tenantId },
    });
    if (!download) {
      throw new NotFoundError("Download asset not found");
    }
    return download;
  });
}

/**
 * Create or update a downloadable asset with lead-gate toggle support.
 */
export async function upsertDownload(
  tenantId: string,
  rawInput: UpsertDownloadInput
): Promise<SiteDownload> {
  const parsed = UpsertDownloadSchema.parse(rawInput);

  // If requiresLead was explicitly passed, it dictates isPublic
  const isPublic =
    parsed.requiresLead !== undefined ? !parsed.requiresLead : parsed.isPublic;

  return withTenant(tenantId, async (tx) => {
    if (parsed.id) {
      const existing = await tx.siteDownload.findFirst({
        where: { id: parsed.id, tenantId },
      });
      if (!existing) {
        throw new NotFoundError("Download asset not found");
      }

      return tx.siteDownload.update({
        where: { id: parsed.id },
        data: {
          label: parsed.label,
          labelBn: parsed.labelBn ?? null,
          kind: parsed.kind,
          fileUrl: parsed.fileUrl,
          fileName: parsed.fileName,
          fileSize: parsed.fileSize ?? null,
          mimeType: parsed.mimeType ?? null,
          isPublic,
          sortOrder: parsed.sortOrder,
        },
      });
    }

    let sortOrder = parsed.sortOrder;
    if (sortOrder === 0) {
      const count = await tx.siteDownload.count({ where: { tenantId } });
      sortOrder = count;
    }

    return tx.siteDownload.create({
      data: {
        tenantId,
        label: parsed.label,
        labelBn: parsed.labelBn ?? null,
        kind: parsed.kind,
        fileUrl: parsed.fileUrl,
        fileName: parsed.fileName,
        fileSize: parsed.fileSize ?? null,
        mimeType: parsed.mimeType ?? null,
        isPublic,
        sortOrder,
      },
    });
  });
}

/**
 * Delete a download asset by ID.
 */
export async function deleteDownload(tenantId: string, id: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.siteDownload.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Download asset not found");
    }

    await tx.siteDownload.delete({
      where: { id },
    });
    return true;
  });
}

/**
 * Reorder downloads for a tenant.
 */
export async function reorderDownloads(
  tenantId: string,
  itemIds: string[]
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await Promise.all(
      itemIds.map((id, index) =>
        tx.siteDownload.updateMany({
          where: { id, tenantId },
          data: { sortOrder: index },
        })
      )
    );
  });
}

/**
 * Increment the download count atomically when a user downloads an asset.
 */
export async function recordDownloadIncrement(
  tenantId: string,
  id: string
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const updated = await tx.siteDownload.update({
      where: { id },
      data: {
        downloadCount: { increment: 1 },
      },
      select: { downloadCount: true },
    });
    return updated.downloadCount;
  });
}

/**
 * Public query for storefront widgets (e.g. download-card section).
 */
export async function getPublicDownloads(tenantId: string): Promise<PublicDownloadView[]> {
  return withTenant(tenantId, async (tx) => {
    const items = await tx.siteDownload.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });

    return items.map((item) => ({
      id: item.id,
      label: item.label,
      labelBn: item.labelBn,
      kind: item.kind,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      isPublic: item.isPublic,
      requiresLead: !item.isPublic,
      downloadCount: item.downloadCount,
      sortOrder: item.sortOrder,
    }));
  });
}

// ---------------------------------------------------------------------------
// CSV Export with formula injection prevention
// ---------------------------------------------------------------------------

function sanitizeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

export function downloadsCsv(items: SiteDownload[]): string {
  const headers = [
    "ID",
    "Label",
    "Label (BN)",
    "Kind",
    "File Name",
    "File URL",
    "File Size (Bytes)",
    "Access Mode",
    "Download Count",
    "Sort Order",
    "Created At",
  ];

  const rows = items.map((it) => [
    sanitizeCsvValue(it.id),
    sanitizeCsvValue(it.label),
    sanitizeCsvValue(it.labelBn),
    sanitizeCsvValue(it.kind),
    sanitizeCsvValue(it.fileName),
    sanitizeCsvValue(it.fileUrl),
    sanitizeCsvValue(it.fileSize),
    sanitizeCsvValue(it.isPublic ? "Direct 1-Click" : "Gated (Lead Required)"),
    sanitizeCsvValue(it.downloadCount),
    sanitizeCsvValue(it.sortOrder),
    sanitizeCsvValue(it.createdAt.toISOString()),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
