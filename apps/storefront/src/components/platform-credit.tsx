import type { T } from "@/lib/i18n";

const MARKETING = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://biztrack.bd").replace(/\/$/, "");

/**
 * The line every storefront carries: powered by BizTrackBD, and a sister concern of The Digital Dude, each a link. It is part of the platform,
 * not a setting: no template, header and footer builder or plan can switch it off. It is kept small and quiet, like a company's own credit line.
 */
export function PlatformCredit({ t }: { t: T }) {
  return (
    <p className="credit" data-testid="platform-credit">
      <a href={MARKETING} target="_blank" rel="noopener">{t("poweredBy")}</a>
      <span aria-hidden="true"> · </span>
      {t("sisterOf")} <a href="https://digitaldude.co.uk" target="_blank" rel="noopener noreferrer">The Digital Dude</a>
    </p>
  );
}
