import Image from "next/image";

const TINTS = ["var(--tint-1)", "var(--tint-2)", "var(--tint-3)", "var(--tint-4)"];

/** Deterministic tint per product so placeholders look intentional until the store uploads photos. */
export const tintFor = (seed: string) => TINTS[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;

/**
 * A product photo in a fixed-ratio box (no layout shift). Served through Next's optimiser as AVIF or WebP at the size the
 * layout needs. `priority` is for the one image that is the page's largest paint (LCP).
 */
export function ProductImage({ src, alt, seed, sizes, priority = false, className = "" }: { src: string | null; alt: string; seed: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={`pimg ${className}`} style={{ background: tintFor(seed) }}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} quality={72} />
      ) : (
        <div className="ph" aria-hidden="true"><i /></div>
      )}
    </div>
  );
}
