import { withTenant, type Prisma } from "@biztrackbd/db";
import { z } from "zod";

export const DIETARY_LABELS = [
  "halal",
  "spicy",
  "vegetarian",
  "vegan",
  "chef_special",
  "popular",
  "gluten_free",
  "beverage",
] as const;

export type DietaryLabel = (typeof DIETARY_LABELS)[number];

export const UpsertCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100),
  nameBn: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  descriptionBn: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type UpsertCategoryInput = z.input<typeof UpsertCategorySchema>;

export const UpsertMenuItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required").max(120),
  nameBn: z.string().max(120).optional().nullable(),
  description: z.string().max(600).optional().nullable(),
  descriptionBn: z.string().max(600).optional().nullable(),
  price: z.number().min(0, "Price must be non-negative"),
  compareAtPrice: z.number().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  dietaryLabels: z.array(z.string()).default([]),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type UpsertMenuItemInput = z.input<typeof UpsertMenuItemSchema>;

export interface PublicMenuCategory {
  id: string;
  name: string;
  nameBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface PublicMenuItem {
  id: string;
  categoryId: string;
  name: string;
  nameBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  dietaryLabels: string[];
  isAvailable: boolean;
  sortOrder: number;
}

/**
 * Fetch full public menu for storefront display, ordered by category and item sortOrder.
 * Only returns active categories.
 */
export async function getPublicMenu(tenantId: string): Promise<PublicMenuCategory[]> {
  return withTenant(tenantId, async (tx) => {
    const categories = await tx.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      nameBn: cat.nameBn,
      description: cat.description,
      descriptionBn: cat.descriptionBn,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        nameBn: item.nameBn,
        description: item.description,
        descriptionBn: item.descriptionBn,
        price: Number(item.price),
        compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : null,
        imageUrl: item.imageUrl,
        dietaryLabels: Array.isArray(item.dietaryLabels) ? (item.dietaryLabels as string[]) : [],
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
      })),
    }));
  });
}

/**
 * Fetch all categories and items for the merchant admin screen.
 */
export async function getAdminMenu(tenantId: string): Promise<PublicMenuCategory[]> {
  return withTenant(tenantId, async (tx) => {
    const categories = await tx.menuCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      nameBn: cat.nameBn,
      description: cat.description,
      descriptionBn: cat.descriptionBn,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        nameBn: item.nameBn,
        description: item.description,
        descriptionBn: item.descriptionBn,
        price: Number(item.price),
        compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : null,
        imageUrl: item.imageUrl,
        dietaryLabels: Array.isArray(item.dietaryLabels) ? (item.dietaryLabels as string[]) : [],
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
      })),
    }));
  });
}

/**
 * Create or update a menu category.
 */
export async function upsertMenuCategory(
  tenantId: string,
  rawInput: UpsertCategoryInput
): Promise<{ id: string; name: string }> {
  const input = UpsertCategorySchema.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    if (input.id) {
      const existing = await tx.menuCategory.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!existing) {
        throw new Error("Category not found");
      }
      const updated = await tx.menuCategory.update({
        where: { id: input.id },
        data: {
          name: input.name,
          nameBn: input.nameBn ?? null,
          description: input.description ?? null,
          descriptionBn: input.descriptionBn ?? null,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      });
      return { id: updated.id, name: updated.name };
    }

    const count = await tx.menuCategory.count({ where: { tenantId } });
    const created = await tx.menuCategory.create({
      data: {
        tenantId,
        name: input.name,
        nameBn: input.nameBn ?? null,
        description: input.description ?? null,
        descriptionBn: input.descriptionBn ?? null,
        sortOrder: input.sortOrder ?? count,
        isActive: input.isActive,
      },
    });
    return { id: created.id, name: created.name };
  });
}

/**
 * Delete a category and cascade delete its menu items.
 */
export async function deleteMenuCategory(tenantId: string, categoryId: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.menuCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!existing) {
      throw new Error("Category not found");
    }

    await tx.menuCategory.delete({
      where: { id: categoryId },
    });
    return true;
  });
}

/**
 * Create or update a menu item.
 */
export async function upsertMenuItem(
  tenantId: string,
  rawInput: UpsertMenuItemInput
): Promise<{ id: string; name: string }> {
  const input = UpsertMenuItemSchema.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    // Verify category belongs to tenant
    const category = await tx.menuCategory.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new Error("Invalid category");
    }

    const imageUrl = input.imageUrl ? input.imageUrl : null;
    const dietaryLabels = input.dietaryLabels as unknown as Prisma.InputJsonValue;

    if (input.id) {
      const existing = await tx.menuItem.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!existing) {
        throw new Error("Menu item not found");
      }

      const updated = await tx.menuItem.update({
        where: { id: input.id },
        data: {
          categoryId: input.categoryId,
          name: input.name,
          nameBn: input.nameBn ?? null,
          description: input.description ?? null,
          descriptionBn: input.descriptionBn ?? null,
          price: input.price,
          compareAtPrice: input.compareAtPrice ?? null,
          imageUrl,
          dietaryLabels,
          isAvailable: input.isAvailable,
          sortOrder: input.sortOrder,
        },
      });
      return { id: updated.id, name: updated.name };
    }

    const count = await tx.menuItem.count({
      where: { tenantId, categoryId: input.categoryId },
    });

    const created = await tx.menuItem.create({
      data: {
        tenantId,
        categoryId: input.categoryId,
        name: input.name,
        nameBn: input.nameBn ?? null,
        description: input.description ?? null,
        descriptionBn: input.descriptionBn ?? null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        imageUrl,
        dietaryLabels,
        isAvailable: input.isAvailable,
        sortOrder: input.sortOrder ?? count,
      },
    });
    return { id: created.id, name: created.name };
  });
}

/**
 * Instantly toggle availability of a dish (e.g. Sold Out / Available).
 */
export async function toggleMenuItemAvailability(
  tenantId: string,
  itemId: string,
  isAvailable: boolean
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.menuItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) {
      throw new Error("Menu item not found");
    }

    await tx.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
    });
    return true;
  });
}

/**
 * Delete a menu item.
 */
export async function deleteMenuItem(tenantId: string, itemId: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.menuItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) {
      throw new Error("Menu item not found");
    }

    await tx.menuItem.delete({
      where: { id: itemId },
    });
    return true;
  });
}
