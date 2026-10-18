import { randomUUID } from "node:crypto";
import { getBasePrisma, withTenant } from "@biztrackbd/db";
import { validateSubdomain } from "../routing/host";
import type { BusinessVertical, SiteMode } from "./mode";

export interface CreateAdditionalBusinessInput {
  name: string;
  subdomain: string;
  siteMode: SiteMode;
  businessVertical?: BusinessVertical | null;
  ownerUserId: string;
  ownerEmail: string;
  ownerName?: string;
  customDomain?: string | null;
}

export interface CreatedBusinessResult {
  tenantId: string;
  subdomain: string;
  name: string;
  siteMode: string;
  businessVertical: string | null;
}

/**
 * Provisions a new independent business tenant under an existing merchant's account.
 * Assigns a 14-day trial, binds the current user as STORE_OWNER, sets appropriate siteMode & vertical,
 * and provisions starter records (e.g. shipping zones for ecommerce, digital menu backing products for restaurant).
 */
export async function createAdditionalBusiness(
  input: CreateAdditionalBusinessInput
): Promise<CreatedBusinessResult> {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    throw new Error("Business name must be at least 2 characters.");
  }

  const check = validateSubdomain(input.subdomain);
  if (!check.ok) {
    if (check.reason === "too_short") throw new Error("Subdomain must be at least 3 characters.");
    if (check.reason === "too_long") throw new Error("Subdomain cannot exceed 40 characters.");
    if (check.reason === "reserved") throw new Error("This subdomain is reserved. Please choose another.");
    throw new Error("Subdomain can only contain lowercase letters, numbers, and hyphens.");
  }
  const cleanSubdomain = check.label;

  const db = getBasePrisma();
  const existing = await db.tenant.findUnique({
    where: { subdomain: cleanSubdomain },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Subdomain is already taken by another store. Please choose a different one.");
  }

  // Pick starter theme based on siteMode and vertical
  let themeId = "kapor";
  if (input.siteMode === "PORTFOLIO") {
    if (input.businessVertical === "RESTAURANT") {
      themeId = "dhakabistro";
    } else if (input.businessVertical === "DOCTOR_CLINIC") {
      themeId = "modernclinic";
    } else if (input.businessVertical === "BUSINESS_COMPANY") {
      themeId = "apexcorp";
    } else {
      themeId = "bold";
    }
  }

  const tenantId = randomUUID();
  try {
    await db.$queryRaw`SELECT signup_create_tenant(
      ${tenantId},
      ${cleanName},
      ${cleanSubdomain},
      ${themeId},
      'STARTER'::"PlanTier",
      ${input.ownerName ?? cleanName},
      ${input.ownerEmail.toLowerCase()},
      '01700000000',
      14,
      false,
      null,
      20
    )`;
  } catch (err: any) {
    if (err?.message?.includes("subdomain taken")) {
      throw new Error("Subdomain is already taken by another store. Please choose a different one.");
    }
    throw err;
  }

  // Provision vertical-specific starter records within tenant RLS boundary
  await withTenant(tenantId, async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        siteMode: input.siteMode,
        businessVertical: input.businessVertical ?? null,
      },
    });

    // Attach the merchant user as STORE_OWNER
    await tx.tenantUser.create({
      data: {
        tenantId,
        email: input.ownerEmail.toLowerCase(),
        name: input.ownerName ?? cleanName,
        role: "STORE_OWNER",
        passwordHash: "ACCOUNT_MANAGED_AUTH",
        authUserId: input.ownerUserId,
        isActive: true,
      },
    });

    await tx.storeSettings.create({
      data: {
        tenantId,
        storeName: cleanName,
        tagline:
          input.businessVertical === "RESTAURANT"
            ? "Authentic Dining & Takeout"
            : input.siteMode === "ECOMMERCE"
            ? "Quality Products Delivered Fast"
            : "Professional Services & Consultation",
        announcement:
          input.businessVertical === "RESTAURANT"
            ? "Welcome to our dining experience! Order directly from your table."
            : "Welcome to our official online store!",
        announcementBn:
          input.businessVertical === "RESTAURANT"
            ? "আমাদের রেস্তোরাঁয় স্বাগতম! টেবিল থেকে সরাসরি অর্ডার করুন।"
            : "আমাদের অফিসিয়াল অনলাইন শপে স্বাগতম!",
      },
    });

    if (input.businessVertical === "RESTAURANT") {
      // Provision backing anchor product for digital dining table orders
      const anchor = await tx.product.create({
        data: {
          tenantId,
          title: "Dining Menu",
          titleBn: "ডাইনিং মেনু",
          slug: "dining-menu",
          basePrice: 0,
          descriptionHtml: "<p>Backing product for digital dining orders.</p>",
          status: "ACTIVE",
        },
      });
      await tx.productVariant.create({
        data: {
          tenantId,
          productId: anchor.id,
          title: "Regular",
          price: 0,
          stockQuantity: 999999,
          options: { Item: "Dining" },
        },
      });

      // Provision starter menu category & item
      const category = await tx.menuCategory.create({
        data: {
          tenantId,
          name: "Chef's Specials",
          nameBn: "শেফের বিশেষ পদ",
          sortOrder: 1,
          isActive: true,
        },
      });
      await tx.menuItem.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: "Signature Dish",
          nameBn: "সিগনেচার ডিশ",
          description: "Chef's daily recommendation prepared fresh to order.",
          descriptionBn: "তাজা উপকরণ দিয়ে তৈরি শেফের বিশেষ পরামর্শ।",
          price: 450,
          isAvailable: true,
          dietaryLabels: ["chef_special"],
          sortOrder: 1,
        },
      });
    } else if (input.siteMode === "ECOMMERCE") {
      // Provision starter shipping zones
      await tx.shippingZone.createMany({
        data: [
          {
            tenantId,
            name: "Inside Dhaka city",
            districts: ["Dhaka"],
            rate: 80,
            freeOverAmount: 3000,
          },
          {
            tenantId,
            name: "Outside Dhaka",
            districts: ["*"],
            rate: 130,
            freeOverAmount: 5000,
          },
        ],
      });

      // Provision starter category & product
      const category = await tx.category.create({
        data: {
          tenantId,
          name: "Featured Collection",
          slug: "featured",
        },
      });
      const prod = await tx.product.create({
        data: {
          tenantId,
          categoryId: category.id,
          title: "Featured Product",
          slug: "featured-product",
          basePrice: 990,
          status: "ACTIVE",
          descriptionHtml: "<p>Welcome to our new store. High-quality products curated for you.</p>",
        },
      });
      await tx.productVariant.create({
        data: {
          tenantId,
          productId: prod.id,
          title: "Standard",
          price: 990,
          stockQuantity: 50,
          options: { Size: "Standard" },
        },
      });
    }
  });

  return {
    tenantId,
    subdomain: cleanSubdomain,
    name: cleanName,
    siteMode: input.siteMode,
    businessVertical: input.businessVertical ?? null,
  };
}
