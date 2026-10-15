import { notFound } from "next/navigation";
import { getPublicDropBySlug } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";
import { DropShowcaseClient } from "./drop-showcase-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const store = await getStore();
  const drop = await getPublicDropBySlug(store.id, slug);

  if (!drop) return { title: "Drop Not Found" };

  return {
    title: `${drop.title} | ${store.subdomain}`,
    description: drop.description || `Exclusive limited drop on ${store.subdomain}`,
  };
}

export default async function DropPage({ params }: Props) {
  const { slug } = await params;
  const store = await getStore();
  const drop = await getPublicDropBySlug(store.id, slug);

  if (!drop) notFound();

  // Serialize dates for client
  const serializedDrop = {
    ...drop,
    startsAt: drop.startsAt.toISOString(),
    endsAt: drop.endsAt ? drop.endsAt.toISOString() : null,
    estimatedShipDate: drop.estimatedShipDate ? drop.estimatedShipDate.toISOString() : null,
    products: drop.products.map((p) => ({
      product: {
        id: p.product.id,
        title: p.product.title,
        slug: p.product.slug,
        images: p.product.images.map((img) => ({ url: img.url, altText: img.altText })),
        variants: p.product.variants.map((v) => ({
          id: v.id,
          title: v.title,
          price: Number(v.price),
          stockQuantity: v.stockQuantity,
        })),
      },
    })),
  };

  return <DropShowcaseClient drop={serializedDrop as any} />;
}
