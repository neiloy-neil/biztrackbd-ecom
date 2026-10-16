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
  menu: <><rect x={6} y={6} width={16} height={6} rx={3} {...solid} /><rect x={26} y={6} width={16} height={6} rx={3} {...box} /><rect x={46} y={6} width={16} height={6} rx={3} {...box} />{line(18, 30, 8)}<rect x={52} y={16} width={14} height={6} rx={2} fill="currentColor" opacity={0.6} />{line(28, 34, 8)}<rect x={52} y={26} width={14} height={6} rx={2} fill="currentColor" opacity={0.6} />{line(38, 26, 8)}<rect x={52} y={36} width={14} height={6} rx={2} fill="currentColor" opacity={0.6} /></>,
  hoursMap: <><rect x={6} y={8} width={26} height={32} rx={3} {...box} /><circle cx={19} cy={20} r={4} {...solid} /><path d="M19 24v4" stroke="currentColor" strokeWidth={1.4} />{line(12, 28, 36)}{line(20, 24, 36)}{line(28, 28, 36)}<rect x={36} y={34} width={22} height={6} rx={3} fill="currentColor" opacity={0.7} /></>,
  reservation: <><rect x={8} y={6} width={56} height={36} rx={4} {...box} /><rect x={12} y={10} width={24} height={5} rx={2} {...solid} /><rect x={12} y={18} width={22} height={8} rx={2} {...solid} /><rect x={38} y={18} width={22} height={8} rx={2} {...solid} /><rect x={12} y={29} width={48} height={9} rx={3} fill="currentColor" opacity={0.7} /></>,
  doctor: <><circle cx={20} cy={18} r={9} {...solid} /><circle cx={20} cy={16} r={4} fill="currentColor" opacity={0.5} /><path d="M14 26c1-4 4-5 6-5s5 1 6 5" fill="none" stroke="currentColor" strokeWidth={1.2} /><rect x={34} y={10} width={28} height={5} rx={2} {...solid} />{line(18, 30, 34)}{line(24, 22, 34)}<rect x={34} y={30} width={26} height={8} rx={3} fill="currentColor" opacity={0.7} /></>,
  chambers: <><rect x={6} y={8} width={28} height={32} rx={3} {...box} />{line(13, 20, 10)}{line(19, 16, 10)}{line(25, 20, 10)}<rect x={10} y={30} width={18} height={6} rx={2} fill="currentColor" opacity={0.6} /><rect x={38} y={8} width={28} height={32} rx={3} {...box} />{line(13, 20, 42)}{line(19, 16, 42)}{line(25, 20, 42)}<rect x={42} y={30} width={18} height={6} rx={2} fill="currentColor" opacity={0.6} /></>,
  services: <><rect x={5} y={8} width={18} height={32} rx={3} {...box} /><circle cx={14} cy={15} r={3} {...solid} />{line(22, 12, 8)}{line(27, 10, 8)}<rect x={8} y={32} width={12} height={4} rx={1.5} fill="currentColor" opacity={0.6} /><rect x={27} y={8} width={18} height={32} rx={3} {...box} /><circle cx={36} cy={15} r={3} {...solid} />{line(22, 12, 30)}{line(27, 10, 30)}<rect x={30} y={32} width={12} height={4} rx={1.5} fill="currentColor" opacity={0.6} /><rect x={49} y={8} width={18} height={32} rx={3} {...box} /><circle cx={58} cy={15} r={3} {...solid} />{line(22, 12, 52)}{line(27, 10, 52)}<rect x={52} y={32} width={12} height={4} rx={1.5} fill="currentColor" opacity={0.6} /></>,
  team: <><circle cx={14} cy={16} r={7} {...solid} />{line(26, 14, 7)}{line(32, 10, 9)}<circle cx={36} cy={16} r={7} {...solid} />{line(26, 14, 29)}{line(32, 10, 31)}<circle cx={58} cy={16} r={7} {...solid} />{line(26, 14, 51)}{line(32, 10, 53)}</>,
  portfolio: <><rect x={6} y={8} width={18} height={20} rx={2} {...solid} />{line(31, 14, 8)}{line(36, 10, 8)}<rect x={27} y={8} width={18} height={20} rx={2} {...solid} />{line(31, 14, 29)}{line(36, 10, 29)}<rect x={48} y={8} width={18} height={20} rx={2} {...solid} />{line(31, 14, 50)}{line(36, 10, 50)}</>,
  download: <><rect x={12} y={8} width={48} height={32} rx={4} {...box} /><rect x={16} y={13} width={14} height={10} rx={2} fill="currentColor" opacity={0.8} />{line(15, 24, 34)}{line(21, 18, 34)}<rect x={16} y={28} width={40} height={7} rx={3} fill="currentColor" opacity={0.6} /></>,
  contactForm: <><rect x={10} y={6} width={52} height={36} rx={4} {...box} /><rect x={14} y={10} width={24} height={4} rx={1.5} {...solid} /><rect x={14} y={17} width={44} height={6} rx={2} {...solid} /><rect x={14} y={25} width={44} height={8} rx={2} {...solid} /><rect x={14} y={35} width={20} height={5} rx={2} fill="currentColor" opacity={0.8} /></>,
};

const KIND: Record<string, keyof typeof DRAWINGS> = {
  "lp-hero": "hero", "lp-video": "video", "lp-benefits": "list", "lp-split": "split", "lp-text": "text", "lp-gallery": "gallery", "lp-reviews": "reviews",
  "lp-countdown": "clock", "lp-stock": "bar", "lp-offer-bar": "price", "trust-strip": "bar", "lp-faq": "faq", "lp-order-form": "form", "lp-sticky-cta": "bar", "lp-header": "bar", "lp-marquee": "bar", "lp-compare": "split", "lp-steps": "list", "lp-screens": "gallery", "contact-block": "text",
  hero: "hero", banner: "split", "rich-text": "text", "featured-products": "gallery", "category-grid": "gallery", "announcement-bar": "bar",
  "product-main": "split", "product-reviews": "reviews", "product-related": "gallery", "collection-header": "text", "collection-products": "gallery", "cart-main": "form",
  "countdown-timer": "clock", "accordion-faq": "faq", "marquee-ticker": "bar", "video-reels": "video", "floating-contact": "bar",
  "restaurant-menu": "menu",
  "restaurant-hours-location": "hoursMap",
  "reservation-cta": "reservation",
  "doctor-hero": "doctor",
  "clinic-chambers": "chambers",
  "service-cards": "services",
  "team-grid": "team",
  "portfolio-grid": "portfolio",
  "download-card": "download",
  "contact-form": "contactForm",
};

export function SectionThumb({ type }: { type: string }) {
  return (
    <svg viewBox="0 0 72 48" width={72} height={48} role="img" aria-hidden className="bld-thumb">
      <rect x={0.7} y={0.7} width={70.6} height={46.6} rx={6} fill="none" stroke="currentColor" opacity={0.18} />
      {DRAWINGS[KIND[type] ?? "text"]}
    </svg>
  );
}

export { STORE_SECTION_CATEGORIES, type StoreSectionCategory } from "@biztrackbd/core/builder-client";

/** How the cards are grouped on a landing page; other pages show one list. */
export const LANDING_GROUPS: { title: string; types: string[] }[] = [
  { title: "Top of the page", types: ["lp-header", "lp-hero", "lp-marquee", "lp-video"] },
  { title: "Describe the product", types: ["lp-benefits", "lp-split", "lp-compare", "lp-steps", "lp-text", "lp-gallery"] },
  { title: "Build trust", types: ["lp-reviews", "lp-screens", "trust-strip", "lp-countdown", "lp-stock"] },
  { title: "Close the sale", types: ["lp-offer-bar", "lp-order-form", "lp-faq", "lp-sticky-cta"] },
];
