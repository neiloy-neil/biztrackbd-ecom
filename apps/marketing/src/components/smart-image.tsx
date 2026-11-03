import Image from "next/image";
import type { CSSProperties } from "react";

/** The hosts next.config.ts lets the optimiser fetch from. Anything else (a picture hosted elsewhere) stays a plain tag, or the optimiser would refuse it. */
const optimisable = (src: string) => src.startsWith("/") || /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src);

/**
 * A picture served as AVIF or WebP when its host is one the optimiser knows, else as the plain tag it always was.
 * Sized by the parent through `style`, the same way the bare tag was.
 */
export function SmartImage({ src, alt, sizes, style, className, priority = false }: { src: string; alt: string; sizes: string; style?: CSSProperties; className?: string; priority?: boolean }) {
  if (!optimisable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} style={style} className={className} loading={priority ? undefined : "lazy"} decoding="async" />;
  }
  return <Image src={src} alt={alt} width={0} height={0} sizes={sizes} quality={72} priority={priority} style={style} className={className} />;
}
