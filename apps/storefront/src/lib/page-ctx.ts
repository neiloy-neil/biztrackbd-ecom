import type { ProductSort, getProductBySlug, getReviewSummary, listProducts, listPublicReviews } from "@biztrackbd/core";
import type { CART_STRINGS } from "@/lib/strings";

/**
 * The data the product, collection and cart blocks draw from (docs/39). Plain values only, so the live store (server) and the editor's
 * preview (browser) draw the same blocks from the same shape. Product descriptions arrive already sanitised.
 */
export interface ProductCtx {
  p: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
  /** The description, cleaned on the server. */
  descriptionHtml: string;
  summary: Awaited<ReturnType<typeof getReviewSummary>>;
  reviews: Awaited<ReturnType<typeof listPublicReviews>>;
}

export interface CollectionCtx {
  category: { slug: string; name: string; description: string | null };
  result: Awaited<ReturnType<typeof listProducts>>;
  sort: ProductSort;
  basePath: string;
}

export interface CartCtx {
  freeOver: number | null;
  s: Record<(typeof CART_STRINGS)[number], string>;
}

export interface PageCtx {
  product?: ProductCtx;
  collection?: CollectionCtx;
  cart?: CartCtx;
  /** The editor's preview: the cart shows two sample lines instead of the visitor's own. */
  preview?: boolean;
}
