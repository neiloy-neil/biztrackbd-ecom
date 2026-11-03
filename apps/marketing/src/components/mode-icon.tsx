import type { SVGProps } from "react";

/**
 * The two product modes, Commerce (a shop bag) and Business (a briefcase), as line icons that take the text colour. They replace the
 * 🛍️ and 💼 emoji in the mode toggles: an emoji looks different on every phone and cannot follow the brand colours.
 */
function Icon({ size = 18, children, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", verticalAlign: "-0.15em" }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function BagIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  );
}

export function BriefcaseIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Icon>
  );
}
