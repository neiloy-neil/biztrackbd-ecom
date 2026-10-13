import type { ReactNode } from "react";

/**
 * The small drawings on the "Add a section" cards: a wireframe of what the section looks like, so a merchant picks by sight.
 * Colours come from the editor's own variables, so they follow light and dark.
 */

const box = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const solid = { fill: "currentColor", opacity: 0.22 };
const line = (y: number, w = 40, x = 8) => <rect key={`${y}-${x}`} x={x} y={y} width={w} height={3} rx={1.5} fill="currentColor" opacity={0.45} />;

const DRAWINGS: Record<string, ReactNode> = {
  hero: <><rect x={8} y={6} width={30} height={5} rx={2} {...solid} />{line(15, 34)}{line(21, 24)}<rect x={8} y={29} width={20} height={8} rx={4} fill="currentColor" opacity={0.7} /><rect x={42} y={6} width={22} height={34} rx={3} {...solid} /></>,
  video: <><rect x={8} y={8} width={56} height={30} rx={4} {...box} /><path d="M32 17l12 6-12 6z" fill="currentColor" opacity={0.6} /></>,
  list: <><rect x={6} y={10} width={18} height={26} rx={3} {...box} /><rect x={27} y={10} width={18} height={26} rx={3} {...box} /><rect x={48} y={10} width={18} height={26} rx={3} {...box} />{line(16, 10, 10)}{line(16, 10, 31)}{line(16, 10, 52)}{line(24, 12, 10)}{line(24, 12, 31)}{line(24, 12, 52)}</>,
  split: <><rect x={6} y={8} width={28} height={30} rx={3} {...solid} />{line(12, 24, 40)}{line(19, 24, 40)}{line(26, 16, 40)}</>,
  text: <>{line(10, 40, 16)}{line(18, 34, 19)}{line(26, 40, 16)}<rect x={26} y={33} width={20} height={7} rx={3.5} fill="currentColor" opacity={0.7} /></>,
  gallery: <><rect x={8} y={6} width={26} height={16} rx={2} {...solid} /><rect x={38} y={6} width={26} height={16} rx={2} {...solid} /><rect x={8} y={26} width={26} height={16} rx={2} {...solid} /><rect x={38} y={26} width={26} height={16} rx={2} {...solid} /></>,
  reviews: <><rect x={6} y={10} width={18} height={26} rx={3} {...box} /><rect x={27} y={10} width={18} height={26} rx={3} {...box} /><rect x={48} y={10} width={18} height={26} rx={3} {...box} /><text x={10} y={20} fontSize={8} fill="currentColor">★★</text><text x={31} y={20} fontSize={8} fill="currentColor">★★</text><text x={52} y={20} fontSize={8} fill="currentColor">★★</text></>,
  clock: <><rect x={6} y={14} width={14} height={20} rx={3} {...box} /><rect x={23} y={14} width={14} height={20} rx={3} {...box} /><rect x={40} y={14} width={14} height={20} rx={3} {...box} /><rect x={57} y={14} width={10} height={20} rx={3} {...box} /></>,
  bar: <><rect x={6} y={15} width={60} height={18} rx={9} {...box} />{line(22, 32, 18)}</>,
  price: <>{line(8, 22, 24)}<rect x={20} y={15} width={32} height={9} rx={2} fill="currentColor" opacity={0.7} /><rect x={18} y={30} width={36} height={10} rx={5} fill="currentColor" opacity={0.7} /></>,
  faq: <><rect x={8} y={7} width={56} height={9} rx={3} {...box} /><rect x={8} y={20} width={56} height={9} rx={3} {...box} /><rect x={8} y={33} width={56} height={9} rx={3} {...box} />{line(10, 30, 12)}{line(23, 24, 12)}{line(36, 34, 12)}</>,
  form: <><rect x={10} y={6} width={52} height={8} rx={3} {...box} /><rect x={10} y={17} width={52} height={8} rx={3} {...box} /><rect x={10} y={28} width={52} height={8} rx={3} {...box} /><rect x={10} y={39} width={52} height={7} rx={3.5} fill="currentColor" opacity={0.7} /></>,
};

const KIND: Record<string, keyof typeof DRAWINGS> = {
  "lp-hero": "hero", "lp-video": "video", "lp-benefits": "list", "lp-split": "split", "lp-text": "text", "lp-gallery": "gallery", "lp-reviews": "reviews",
  "lp-countdown": "clock", "lp-stock": "bar", "lp-offer-bar": "price", "trust-strip": "bar", "lp-faq": "faq", "lp-order-form": "form", "lp-sticky-cta": "bar",
  hero: "hero", banner: "split", "rich-text": "text", "featured-products": "gallery", "category-grid": "gallery",
};

export function SectionThumb({ type }: { type: string }) {
  return (
    <svg viewBox="0 0 72 48" width={72} height={48} role="img" aria-hidden className="bld-thumb">
      <rect x={0.7} y={0.7} width={70.6} height={46.6} rx={6} fill="none" stroke="currentColor" opacity={0.18} />
      {DRAWINGS[KIND[type] ?? "text"]}
    </svg>
  );
}

/** How the cards are grouped on a landing page; other pages show one list. */
export const LANDING_GROUPS: { title: string; types: string[] }[] = [
  { title: "Top of the page", types: ["lp-hero", "lp-video"] },
  { title: "Describe the product", types: ["lp-benefits", "lp-split", "lp-text", "lp-gallery"] },
  { title: "Build trust", types: ["lp-reviews", "trust-strip", "lp-countdown", "lp-stock"] },
  { title: "Close the sale", types: ["lp-offer-bar", "lp-order-form", "lp-faq", "lp-sticky-cta"] },
];
