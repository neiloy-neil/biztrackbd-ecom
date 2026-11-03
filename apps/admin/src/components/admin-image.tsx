import Image from "next/image";
import type { ComponentProps } from "react";

/** The hosts next.config.ts lets the optimiser fetch from. Anything else (an address pasted by hand) stays a plain tag, or the optimiser would refuse it. */
const optimisable = (src: string) => src.startsWith("/") || /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src);

/** A product photo shown small in a list. Served resized as AVIF or WebP when its host is known, else as the plain tag it always was. */
export function AdminImage({ src, alt, fill, width, height, sizes, className }: { src: string; alt: string; className?: string } & Pick<ComponentProps<typeof Image>, "fill" | "width" | "height" | "sizes">) {
  if (!optimisable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={fill ? undefined : width} height={fill ? undefined : height} className={className} loading="lazy" decoding="async" />;
  }
  return <Image src={src} alt={alt} fill={fill} width={width} height={height} sizes={sizes} quality={60} className={className} />;
}
