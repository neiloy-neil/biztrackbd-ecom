// Seeds the demo store "Rongdhonu Fashion" on the Kapor theme. Safe to run repeatedly.
// Runs as the OWNER role (DIRECT_URL) because it creates a tenant and plans.
import { config } from "dotenv";
import { createBaseClient } from "../src/client";
import { seedPlans } from "../src/testing";

config({ path: "../../.env.local" });

const DEMO_SUBDOMAIN = "rongdhonu";

/** Storefront content for the demo store: details, theme text, delivery times, product images. Safe to run again. */
async function seedStorefront(db: ReturnType<typeof createBaseClient>, t: string) {
  await db.storeSettings.upsert({
    where: { tenantId: t },
    create: {
      tenantId: t, storeName: "Rongdhonu Fashion", tagline: "Handloom clothing from Narayanganj", contactPhone: "01712345678",
      whatsappNumber: "01712345678", facebookUrl: "https://facebook.com/rongdhonufashion", addressLine: "Mirpur, Dhaka",
      announcement: "Free delivery in Dhaka on orders over ৳ 3,000 · Pay with bKash, Nagad or cash on delivery",
      announcementBn: "ঢাকায় ৳ ৩,০০০ এর বেশি অর্ডারে ডেলিভারি ফ্রি · বিকাশ, নগদ বা ক্যাশ অন ডেলিভারি",
      bkashNumber: "01712345678", bkashKind: "PERSONAL", nagadNumber: "01712345678", nagadKind: "PERSONAL",
    },
    update: {},
  });
  await db.themeInstall.upsert({
    where: { tenantId_themeId: { tenantId: t, themeId: "kapor" } },
    create: {
      tenantId: t, themeId: "kapor", isActive: true, pagesJson: {},
      settings: {
        heroEyebrow: "EID COLLECTION 2026", heroEyebrowBn: "ঈদ কালেকশন ২০২৬",
        heroTitle: "Cotton that stays cool in the heat", heroTitleBn: "গরমে আরামের সুতি পোশাক",
        heroText: "Handloom panjabi and linen shirts, cut straight and stitched in Narayanganj. Delivered across Bangladesh.",
        heroTextBn: "নারায়ণগঞ্জে সেলাই করা হ্যান্ডলুম পাঞ্জাবি ও লিনেন শার্ট। সারা বাংলাদেশে ডেলিভারি।",
      },
    },
    update: {},
  });
  const eta: Record<string, [number, number]> = { "Inside Dhaka city": [1, 2], "Dhaka suburbs": [2, 3], "Outside Dhaka": [3, 4] };
  for (const [name, [min, max]] of Object.entries(eta)) {
    await db.shippingZone.updateMany({ where: { tenantId: t, name }, data: { etaMinDays: min, etaMaxDays: max } });
  }
  const products = await db.product.findMany({ where: { tenantId: t }, select: { id: true, slug: true, titleBn: true } });
  for (const p of products) {
    if ((await db.productImage.count({ where: { productId: p.id } })) > 0) continue;
    await db.productImage.createMany({
      data: [1, 2].map((i) => ({ tenantId: t, productId: p.id, url: `/demo/${p.slug}-${i}.webp`, altText: i === 1 ? "Front view" : "Detail view", sortOrder: i })),
    });
  }
  await db.product.updateMany({ where: { tenantId: t, slug: "cotton-panjabi-off-white" }, data: { isFeatured: true } });
}

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is not set");
  if (/prod/i.test(url)) throw new Error("Refusing to seed a database whose URL contains 'prod'");
  const db = createBaseClient(url, 3);

  await seedPlans(db);
  // The platform team (docs/07 section 25). Development sign-in picks one by cookie; real sign-in replaces it.
  for (const [email, name, role] of [
    ["owner@biztrackbd.example", "Sumi Rahman", "OWNER"], ["finance@biztrackbd.example", "Farhan Finance", "FINANCE"],
    ["lead@biztrackbd.example", "Lamia Lead", "SUPPORT_LEAD"], ["support@biztrackbd.example", "Sabbir Support", "SUPPORT"],
  ] as const) {
    await db.platformUser.upsert({ where: { email }, create: { email, name, role }, update: { name, role, isActive: true } });
  }

  const existing = await db.tenant.findUnique({ where: { subdomain: DEMO_SUBDOMAIN } });
  if (existing) {
    await seedStorefront(db, existing.id);
    console.log(`Demo tenant already exists (${existing.id}). Storefront content refreshed.`);
    await db.$disconnect();
    return;
  }

  const tenant = await db.tenant.create({
    data: {
      name: "Rongdhonu Fashion",
      subdomain: DEMO_SUBDOMAIN,
      themeId: "kapor",
      status: "TRIAL",
      planTier: "PRO",
      locale: "bn-BD",
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  const t = tenant.id;

  await db.tenantUser.create({
    data: {
      tenantId: t, email: "owner@rongdhonu.example", name: "Nusrat Jahan", role: "STORE_OWNER",
      // Phase 0 dev stub. Real sign-in is Supabase Auth (docs/16 Phase 1). This is not a usable password hash.
      passwordHash: "DEV_ONLY_NOT_A_HASH",
    },
  });

  // One account per role so every permission set can be tried from the dev switcher in admin.
  await db.tenantUser.createMany({
    data: [
      { tenantId: t, email: "manager@rongdhonu.example", name: "Kamrul Hasan", role: "STORE_MANAGER", passwordHash: "DEV_ONLY_NOT_A_HASH" },
      { tenantId: t, email: "packer@rongdhonu.example", name: "Rubel Mia", role: "ORDER_PACKER", passwordHash: "DEV_ONLY_NOT_A_HASH" },
      { tenantId: t, email: "support@rongdhonu.example", name: "Sumaiya Rahman", role: "TELEMARKETER", passwordHash: "DEV_ONLY_NOT_A_HASH" },
    ],
  });

  await db.shippingZone.createMany({
    data: [
      { tenantId: t, name: "Inside Dhaka city", districts: ["Dhaka"], rate: 80, freeOverAmount: 3000 },
      { tenantId: t, name: "Dhaka suburbs", districts: ["Gazipur", "Narayanganj", "Savar"], rate: 110, freeOverAmount: 4000 },
      { tenantId: t, name: "Outside Dhaka", districts: ["*"], rate: 130, freeOverAmount: 5000 },
    ],
  });

  const categories = await Promise.all(
    ["Panjabi", "Shirts", "Trousers"].map((name, i) =>
      db.category.create({ data: { tenantId: t, name, slug: name.toLowerCase(), sortOrder: i } }),
    ),
  );
  const cat = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const products = [
    { title: "Cotton Panjabi, Off-white", titleBn: "সুতি পাঞ্জাবি, অফ-হোয়াইট", slug: "cotton-panjabi-off-white", price: 1150, compare: 1450, cost: 640, cat: "Panjabi", sizes: ["M", "L", "XL", "XXL"] },
    { title: "Eid Special Fatua", titleBn: "ঈদ স্পেশাল ফতুয়া", slug: "eid-special-fatua", price: 1890, compare: null, cost: 1100, cat: "Panjabi", sizes: ["M", "L", "XL"] },
    { title: "Linen Shirt, Sage", titleBn: "লিনেন শার্ট, সেজ", slug: "linen-shirt-sage", price: 850, compare: null, cost: 480, cat: "Shirts", sizes: ["S", "M", "L", "XL"] },
    { title: "Printed Kurti, Rose", titleBn: "প্রিন্টেড কুর্তি, রোজ", slug: "printed-kurti-rose", price: 1480, compare: 1780, cost: 820, cat: "Shirts", sizes: ["S", "M", "L"] },
    { title: "Slim Chino, Navy", titleBn: "স্লিম চিনো, নেভি", slug: "slim-chino-navy", price: 1290, compare: null, cost: 760, cat: "Trousers", sizes: ["30", "32", "34", "36"] },
    { title: "Cotton Socks, 3-pack", titleBn: "সুতি মোজা, ৩ জোড়া", slug: "cotton-socks-3-pack", price: 300, compare: null, cost: 150, cat: "Trousers", sizes: ["Free size"] },
  ];
  for (const p of products) {
    const product = await db.product.create({
      data: {
        tenantId: t, title: p.title, titleBn: p.titleBn, slug: p.slug, status: "ACTIVE", basePrice: p.price,
        compareAtPrice: p.compare ?? undefined, costPrice: p.cost, categoryId: cat[p.cat],
        descriptionHtml: "<p>Handloom cotton, cut straight and stitched in Narayanganj.</p>", isFeatured: true,
      },
    });
    for (const size of p.sizes) {
      await db.productVariant.create({
        data: {
          tenantId: t, productId: product.id, title: size, sku: `${p.slug}-${size}`.toUpperCase().replace(/\s+/g, "-"),
          price: p.price, stockQuantity: 8 + (size.length % 4) * 6, options: { Size: size },
        },
      });
    }
  }

  await db.tenant.update({ where: { id: t }, data: { productCount: products.length } });

  await db.coupon.create({
    data: { tenantId: t, code: "EID10", type: "PERCENTAGE", value: 10, minOrderValue: 1500, usageLimit: 500, perCustomerLimit: 1 },
  });

  for (const moduleKey of ["bespoke", "drops"]) {
    await db.tenantModule.create({ data: { tenantId: t, moduleKey } });
  }

  await seedStorefront(db, t);
  console.log(`Seeded demo tenant ${tenant.id} (${DEMO_SUBDOMAIN}.localhost): ${products.length} products, 3 zones, coupon EID10.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
