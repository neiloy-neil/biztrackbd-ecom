import { withTenant } from "@biztrackbd/db";

export interface RecentSaleItem {
  id: string;
  buyerName: string;
  productTitle: string;
  productImage?: string;
  productUrl?: string;
  timeAgoText: string;
  district?: string;
  isRealOrder: boolean;
}

const BD_LOCATIONS = [
  "Dhanmondi, Dhaka",
  "Gulshan, Dhaka",
  "Uttara, Dhaka",
  "Mirpur, Dhaka",
  "Agrabad, Chittagong",
  "Zindabazar, Sylhet",
  "Rajshahi",
  "Khulna",
  "Cumilla",
  "Bogura",
  "Gazipur",
  "Narayanganj",
  "Barishal",
  "Mymensingh",
  "Rangpur",
  "Kushtia",
  "Jessore",
  "Cox's Bazar",
];

const BD_NAMES = [
  "Tanvir",
  "Sadia",
  "Rahim",
  "Nusrat",
  "Anik",
  "Farhana",
  "Mahmud",
  "Ayesha",
  "Shakil",
  "Tasmia",
  "Arif",
  "Nabila",
  "Imran",
  "Sharmin",
  "Hasan",
  "Rimi",
];

const RELATIVE_TIMES = [
  "3 minutes ago",
  "7 minutes ago",
  "14 minutes ago",
  "28 minutes ago",
  "45 minutes ago",
  "1 hour ago",
  "2 hours ago",
  "3 hours ago",
  "5 hours ago",
  "Yesterday",
];

export function anonymizeBuyerName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) return "A customer";
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function formatTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

/**
 * Returns a hybrid smart feed of recent purchases:
 * 1. Anonymized real confirmed store orders from the database
 * 2. Fallback realistic catalog sales when order volume is low
 */
export async function getRecentSalesFeed(tenantId: string, limit = 8): Promise<RecentSaleItem[]> {
  try {
    return await withTenant(tenantId, async (tx) => {
      const items: RecentSaleItem[] = [];

      // 1. Fetch real recent orders
      const realOrders = await tx.order.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          items: {
            take: 1,
            include: {
              product: {
                select: {
                  slug: true,
                  images: {
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      });

      const now = new Date();
      for (const ord of realOrders) {
        const item = ord.items[0];
        if (!item) continue;
        const buyer = anonymizeBuyerName(ord.customerName);
        const district = ord.shippingCity || ord.shippingDistrict || "Dhaka";
        const productImage = item.product?.images?.[0]?.url;
        const productUrl = item.product?.slug ? `/products/${item.product.slug}` : undefined;

        items.push({
          id: `order_${ord.id}`,
          buyerName: buyer,
          productTitle: item.productTitle,
          productImage,
          productUrl,
          timeAgoText: formatTimeAgo(ord.createdAt, now),
          district,
          isRealOrder: true,
        });
      }

      // 2. If fewer than limit, augment with active catalog products
      if (items.length < limit) {
        const needed = limit - items.length;
        const products = await tx.product.findMany({
          where: { status: "ACTIVE" },
          take: needed + 4,
          orderBy: { createdAt: "desc" },
          include: {
            images: {
              take: 1,
              select: { url: true },
            },
          },
        });

        for (let i = 0; i < products.length && items.length < limit; i++) {
          const prod = products[i]!;
          const buyer = BD_NAMES[(i * 3 + items.length) % BD_NAMES.length]!;
          const district = BD_LOCATIONS[(i * 5 + items.length) % BD_LOCATIONS.length]!;
          const timeAgo = RELATIVE_TIMES[(i * 2 + items.length) % RELATIVE_TIMES.length]!;

          items.push({
            id: `cat_${prod.id}_${i}`,
            buyerName: buyer,
            productTitle: prod.title,
            productImage: prod.images?.[0]?.url,
            productUrl: `/products/${prod.slug}`,
            timeAgoText: timeAgo,
            district,
            isRealOrder: false,
          });
        }
      }

      // 3. Fallback if store is brand new with 0 products
      if (items.length === 0) {
        return getFallbackSalesFeed(limit);
      }

      return items;
    });
  } catch {
    // If offline or DB unavailable, return authentic static fallback feed
    return getFallbackSalesFeed(limit);
  }
}

export function getFallbackSalesFeed(limit = 6): RecentSaleItem[] {
  const samples = [
    { buyer: "Tanvir A.", product: "Premium Silk Panjabi", district: "Dhanmondi, Dhaka", time: "4 mins ago", img: "/media/demo/panjabi.jpg" },
    { buyer: "Sadia K.", product: "Handcrafted Cotton Saree", district: "Agrabad, Chittagong", time: "11 mins ago", img: "/media/demo/saree.jpg" },
    { buyer: "Rahim U.", product: "Smart Leather Wallet & Belt Gift Box", district: "Uttara, Dhaka", time: "25 mins ago", img: "/media/demo/wallet.jpg" },
    { buyer: "Nusrat J.", product: "Organic Herbal Hair Care Set", district: "Zindabazar, Sylhet", time: "42 mins ago", img: "/media/demo/oil.jpg" },
    { buyer: "Mahmud H.", product: "Royal Embroidered Kurta", district: "Mirpur, Dhaka", time: "1 hour ago", img: "/media/demo/kurta.jpg" },
    { buyer: "Farhana M.", product: "Festive Embroidered Three Piece", district: "Rajshahi", time: "2 hours ago", img: "/media/demo/dress.jpg" },
  ];

  return samples.slice(0, limit).map((s, idx) => ({
    id: `fallback_${idx}`,
    buyerName: s.buyer,
    productTitle: s.product,
    productImage: s.img,
    productUrl: "/search",
    timeAgoText: s.time,
    district: s.district,
    isRealOrder: false,
  }));
}
