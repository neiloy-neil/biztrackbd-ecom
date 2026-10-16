import { withTenant, Prisma, type SiteContentKind, type SiteContentItem } from "@biztrackbd/db";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../errors";

export type { SiteContentKind, SiteContentItem };

export const SITE_CONTENT_KINDS = [
  "SERVICE",
  "PORTFOLIO",
  "TEAM",
  "CREDENTIAL",
  "PUBLICATION",
  "EVENT",
] as const;

export const SiteContentKindSchema = z.enum(SITE_CONTENT_KINDS);

export function isSiteContentKind(val: unknown): val is SiteContentKind {
  return typeof val === "string" && SITE_CONTENT_KINDS.includes(val as SiteContentKind);
}

// ---------------------------------------------------------------------------
// Kind-specific typed schemas for `data` JSON payload
// ---------------------------------------------------------------------------

export const ServiceDataSchema = z.object({
  priceStartingAt: z.number().min(0).optional().nullable(),
  priceStartingAtBn: z.string().max(100).optional().nullable(),
  duration: z.string().max(100).optional().nullable(),
  durationBn: z.string().max(100).optional().nullable(),
  features: z.array(z.string().max(200)).default([]),
  featuresBn: z.array(z.string().max(200)).default([]),
  icon: z.string().max(100).optional().nullable(),
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaLabelBn: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().max(300).optional().nullable(),
});
export type ServiceData = z.infer<typeof ServiceDataSchema>;

export const PortfolioDataSchema = z.object({
  clientName: z.string().max(150).optional().nullable(),
  clientNameBn: z.string().max(150).optional().nullable(),
  projectUrl: z.string().max(300).optional().nullable(),
  completionDate: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  galleryUrls: z.array(z.string().max(500)).default([]),
  testimonialQuote: z.string().max(1000).optional().nullable(),
  testimonialAuthor: z.string().max(100).optional().nullable(),
  testimonialRole: z.string().max(100).optional().nullable(),
});
export type PortfolioData = z.infer<typeof PortfolioDataSchema>;

export const TeamDataSchema = z.object({
  role: z.string().max(150).optional().nullable(),
  roleBn: z.string().max(150).optional().nullable(),
  email: z.string().max(150).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  bioBn: z.string().max(2000).optional().nullable(),
  socialLinks: z
    .object({
      linkedin: z.string().optional().nullable(),
      twitter: z.string().optional().nullable(),
      facebook: z.string().optional().nullable(),
      github: z.string().optional().nullable(),
      instagram: z.string().optional().nullable(),
      youtube: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  credentials: z.array(z.string().max(150)).default([]),
});
export type TeamData = z.infer<typeof TeamDataSchema>;

export const CredentialDataSchema = z.object({
  issuer: z.string().max(150).optional().nullable(),
  issuerBn: z.string().max(150).optional().nullable(),
  issuedYear: z.union([z.number(), z.string().max(20)]).optional().nullable(),
  expiryYear: z.union([z.number(), z.string().max(20)]).optional().nullable(),
  credentialId: z.string().max(100).optional().nullable(),
  verificationUrl: z.string().max(500).optional().nullable(),
  badgeImageUrl: z.string().max(500).optional().nullable(),
});
export type CredentialData = z.infer<typeof CredentialDataSchema>;

export const PublicationDataSchema = z.object({
  publisher: z.string().max(150).optional().nullable(),
  publishedAt: z.string().max(50).optional().nullable(),
  authors: z.array(z.string().max(100)).default([]),
  doiUrl: z.string().max(300).optional().nullable(),
  pdfUrl: z.string().max(500).optional().nullable(),
});
export type PublicationData = z.infer<typeof PublicationDataSchema>;

export const EventDataSchema = z.object({
  startDate: z.string().max(50).optional().nullable(),
  endDate: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  locationBn: z.string().max(200).optional().nullable(),
  isVirtual: z.boolean().default(false),
  registrationUrl: z.string().max(500).optional().nullable(),
  speakerNames: z.array(z.string().max(100)).default([]),
});
export type EventData = z.infer<typeof EventDataSchema>;

/** Validates and parses kind-specific data, dropping unknown fields */
export function validateContentItemData(
  kind: SiteContentKind,
  raw: unknown
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  switch (kind) {
    case "SERVICE":
      return ServiceDataSchema.parse(raw);
    case "PORTFOLIO":
      return PortfolioDataSchema.parse(raw);
    case "TEAM":
      return TeamDataSchema.parse(raw);
    case "CREDENTIAL":
      return CredentialDataSchema.parse(raw);
    case "PUBLICATION":
      return PublicationDataSchema.parse(raw);
    case "EVENT":
      return EventDataSchema.parse(raw);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Slugification helper
// ---------------------------------------------------------------------------

export function slugifyContentTitle(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s.length >= 2 ? s : `item-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Input validation schema
// ---------------------------------------------------------------------------

export const UpsertContentItemSchema = z.object({
  id: z.string().optional(),
  kind: SiteContentKindSchema,
  slug: z.string().min(1, "Slug is required").max(100),
  title: z.string().min(1, "Title is required").max(200),
  titleBn: z.string().max(200).optional().nullable(),
  summary: z.string().max(1000).optional().nullable(),
  summaryBn: z.string().max(1000).optional().nullable(),
  bodyHtml: z.string().max(50000).optional().nullable(),
  bodyHtmlBn: z.string().max(50000).optional().nullable(),
  mediaUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  data: z.record(z.unknown()).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean().default(true),
});

export type UpsertContentItemInput = z.input<typeof UpsertContentItemSchema>;

export interface PublicContentItemView {
  id: string;
  kind: SiteContentKind;
  slug: string;
  title: string;
  titleBn: string | null;
  summary: string | null;
  summaryBn: string | null;
  bodyHtml: string | null;
  bodyHtmlBn: string | null;
  mediaUrl: string | null;
  data: Record<string, unknown> | null;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Service operations
// ---------------------------------------------------------------------------

/**
 * List structured content items for a tenant, with optional kind, publication state, and search filters.
 */
export async function listContentItems(
  tenantId: string,
  filter?: {
    kind?: SiteContentKind;
    isPublished?: boolean;
    search?: string;
  }
): Promise<SiteContentItem[]> {
  return withTenant(tenantId, async (tx) => {
    const where: Prisma.SiteContentItemWhereInput = {
      tenantId,
      ...(filter?.kind ? { kind: filter.kind } : {}),
      ...(filter?.isPublished !== undefined ? { isPublished: filter.isPublished } : {}),
      ...(filter?.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { titleBn: { contains: filter.search, mode: "insensitive" } },
              { summary: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return tx.siteContentItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  });
}

/**
 * Fetch a single content item by its ID.
 */
export async function getContentItemById(
  tenantId: string,
  id: string
): Promise<SiteContentItem> {
  return withTenant(tenantId, async (tx) => {
    const item = await tx.siteContentItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) {
      throw new NotFoundError("Content item not found");
    }
    return item;
  });
}

/**
 * Fetch a single content item by its kind and unique slug.
 */
export async function getContentItemBySlug(
  tenantId: string,
  kind: SiteContentKind,
  slug: string
): Promise<SiteContentItem | null> {
  return withTenant(tenantId, async (tx) => {
    return tx.siteContentItem.findUnique({
      where: {
        tenantId_kind_slug: {
          tenantId,
          kind,
          slug,
        },
      },
    });
  });
}

/**
 * Create or update a structured content item with kind-specific validation and slug uniqueness checks.
 */
export async function upsertContentItem(
  tenantId: string,
  rawInput: UpsertContentItemInput
): Promise<SiteContentItem> {
  const parsed = UpsertContentItemSchema.parse(rawInput);

  // Validate kind-specific data
  const validatedData = parsed.data
    ? validateContentItemData(parsed.kind, parsed.data)
    : null;

  return withTenant(tenantId, async (tx) => {
    // Check slug collision within the same kind
    const existingWithSlug = await tx.siteContentItem.findUnique({
      where: {
        tenantId_kind_slug: {
          tenantId,
          kind: parsed.kind,
          slug: parsed.slug,
        },
      },
    });

    if (existingWithSlug && (!parsed.id || existingWithSlug.id !== parsed.id)) {
      throw new ValidationError(
        `A ${parsed.kind.toLowerCase()} item with slug "${parsed.slug}" already exists`,
        { field: "slug" }
      );
    }

    if (parsed.id) {
      const existing = await tx.siteContentItem.findFirst({
        where: { id: parsed.id, tenantId },
      });
      if (!existing) {
        throw new NotFoundError("Content item not found");
      }

      return tx.siteContentItem.update({
        where: { id: parsed.id },
        data: {
          kind: parsed.kind,
          slug: parsed.slug,
          title: parsed.title,
          titleBn: parsed.titleBn ?? null,
          summary: parsed.summary ?? null,
          summaryBn: parsed.summaryBn ?? null,
          bodyHtml: parsed.bodyHtml ?? null,
          bodyHtmlBn: parsed.bodyHtmlBn ?? null,
          mediaUrl: parsed.mediaUrl || null,
          data: (validatedData as Prisma.InputJsonValue) ?? Prisma.DbNull,
          sortOrder: parsed.sortOrder,
          isPublished: parsed.isPublished,
        },
      });
    }

    // Creating new item: default sortOrder to after highest existing
    let sortOrder = parsed.sortOrder;
    if (sortOrder === 0) {
      const count = await tx.siteContentItem.count({
        where: { tenantId, kind: parsed.kind },
      });
      sortOrder = count;
    }

    return tx.siteContentItem.create({
      data: {
        tenantId,
        kind: parsed.kind,
        slug: parsed.slug,
        title: parsed.title,
        titleBn: parsed.titleBn ?? null,
        summary: parsed.summary ?? null,
        summaryBn: parsed.summaryBn ?? null,
        bodyHtml: parsed.bodyHtml ?? null,
        bodyHtmlBn: parsed.bodyHtmlBn ?? null,
        mediaUrl: parsed.mediaUrl || null,
        data: (validatedData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        sortOrder,
        isPublished: parsed.isPublished,
      },
    });
  });
}

/**
 * Delete a content item by ID.
 */
export async function deleteContentItem(tenantId: string, id: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.siteContentItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Content item not found");
    }

    await tx.siteContentItem.delete({
      where: { id },
    });
    return true;
  });
}

/**
 * Reorder content items within a specific kind.
 */
export async function reorderContentItems(
  tenantId: string,
  kind: SiteContentKind,
  itemIds: string[]
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await Promise.all(
      itemIds.map((id, index) =>
        tx.siteContentItem.updateMany({
          where: { id, tenantId, kind },
          data: { sortOrder: index },
        })
      )
    );
  });
}

/**
 * Fetch published content items for storefront display, ordered by sortOrder.
 */
export async function getPublicContentItems(
  tenantId: string,
  kind: SiteContentKind
): Promise<PublicContentItemView[]> {
  return withTenant(tenantId, async (tx) => {
    const items = await tx.siteContentItem.findMany({
      where: {
        tenantId,
        kind,
        isPublished: true,
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        kind: true,
        slug: true,
        title: true,
        titleBn: true,
        summary: true,
        summaryBn: true,
        bodyHtml: true,
        bodyHtmlBn: true,
        mediaUrl: true,
        data: true,
        sortOrder: true,
      },
    });

    return items.map((item) => ({
      ...item,
      data: item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : null,
    }));
  });
}

// ---------------------------------------------------------------------------
// CSV Export with formula injection prevention
// ---------------------------------------------------------------------------

function sanitizeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  // Neutralize CSV formula execution in Excel/Sheets (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

export function contentItemsCsv(items: SiteContentItem[]): string {
  const headers = [
    "ID",
    "Kind",
    "Slug",
    "Title",
    "Title (BN)",
    "Summary",
    "Media URL",
    "Sort Order",
    "Published",
    "Created At",
  ];

  const rows = items.map((it) => [
    sanitizeCsvValue(it.id),
    sanitizeCsvValue(it.kind),
    sanitizeCsvValue(it.slug),
    sanitizeCsvValue(it.title),
    sanitizeCsvValue(it.titleBn),
    sanitizeCsvValue(it.summary),
    sanitizeCsvValue(it.mediaUrl),
    sanitizeCsvValue(it.sortOrder),
    sanitizeCsvValue(it.isPublished ? "Yes" : "No"),
    sanitizeCsvValue(it.createdAt.toISOString()),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
