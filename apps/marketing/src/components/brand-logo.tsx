/** Growth b logo (design/brand/BRAND.md). Geometry is shared with design/brand/symbol-*.svg. */
const GREEN_DEEP = "#0B4D3B";
const MARIGOLD = "#F2A900";

const STEM = <rect x="472" y="527" width="124" height="495" rx="26" />;
const RING = (
  <path fillRule="evenodd" d="M789 596a233 233 0 1 0 0 466a233 233 0 1 0 0-466zM789 719a110 110 0 1 1 0 220a110 110 0 1 1 0-220z" />
);
const ARROW = <path d="M534 362L678 527H390z" />;

/** Symbol on its deep green rounded square (app icon), or open (no square) for light grounds. */
export function BrandSymbol({ size = 30, tile = true, onDark = false, title = "BizTrackBD" }: { size?: number; tile?: boolean; onDark?: boolean; title?: string }) {
  if (!tile) {
    return (
      <svg width={size * 0.91} height={size} viewBox="370 342 672 740" role="img" aria-label={title}>
        <g fill={onDark ? "#FFFFFF" : GREEN_DEEP}>{STEM}{RING}</g>
        <g fill={MARIGOLD}>{ARROW}</g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 1440 1440" role="img" aria-label={title}>
      <rect width="1440" height="1440" rx="330" fill={GREEN_DEEP} />
      <g transform="translate(14 8)">
        <g fill="#FFFFFF">{STEM}{RING}</g>
        <g fill={MARIGOLD}>{ARROW}</g>
      </g>
    </svg>
  );
}

/** Lowercase `biztrack.bd` in the display face. ".bd" is marigold on dark and dark gold on light. */
export function BrandWordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className={`brand-wordmark brand-wordmark-${tone}`}>
      biztrack<span className="brand-wordmark-bd">.bd</span>
    </span>
  );
}

/** Primary lockup: symbol tile + wordmark. On dark grounds the symbol is open (no square), as in the logo set. */
export function BrandLockup({ size = 30, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  return (
    <>
      <BrandSymbol size={size} tile={tone !== "dark"} onDark={tone === "dark"} title="" />
      <BrandWordmark tone={tone} />
    </>
  );
}
