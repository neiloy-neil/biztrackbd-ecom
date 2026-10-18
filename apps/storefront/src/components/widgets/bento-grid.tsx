import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export interface BentoItem {
  badge?: string;
  badgeBn?: string;
  title?: string;
  titleBn?: string;
  text?: string;
  textBn?: string;
  metric?: string;
  metricLabel?: string;
  metricLabelBn?: string;
  image?: string;
  icon?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
  cardStyle?: "surface" | "accent" | "dark" | "gradient" | "glass";
  span?: "1" | "2";
}

export function BentoGridSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  layout = "bento-3",
  items = [],
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  layout?: string;
  items?: BentoItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;

  return (
    <section className="bt-bento-sec">
      <div className="wrap">
        {(displayTitle || displaySubtitle || editing) && (
          <div className="bt-bento-head">
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && <p className="muted" {...ed("subtitle")}>{displaySubtitle}</p>}
          </div>
        )}

        <div className={`bt-bento-grid bt-bento-layout-${layout}`}>
          {items.map((it, idx) => {
            const itTitle = lang === "bn" && it.titleBn ? it.titleBn : it.title;
            const itText = lang === "bn" && it.textBn ? it.textBn : it.text;
            const itBadge = lang === "bn" && it.badgeBn ? it.badgeBn : it.badge;
            const itMetricLabel = lang === "bn" && it.metricLabelBn ? it.metricLabelBn : it.metricLabel;
            const itCta = lang === "bn" && it.ctaTextBn ? it.ctaTextBn : it.ctaText;
            const styleClass = `bt-bento-card-${it.cardStyle ?? "surface"}`;
            const spanClass = it.span === "2" ? "bt-span-2" : "bt-span-1";

            const hasImg = Boolean(it.image);

            return (
              <div
                key={idx}
                className={`bt-bento-card ${styleClass} ${spanClass}`}
                style={hasImg ? { backgroundImage: `url(${it.image})` } : undefined}
              >
                {hasImg && <div className="bt-bento-card-overlay" aria-hidden="true" />}
                <div className="bt-bento-card-inner">
                  <div className="bt-bento-card-top">
                    {it.icon && (
                      <div className="bt-bento-icon-badge">
                        <WidgetIcon name={it.icon} size={20} />
                      </div>
                    )}
                    {itBadge && (
                      <span className="bt-bento-pill-badge" {...ed(`items.${idx}.badge`)}>
                        {itBadge}
                      </span>
                    )}
                  </div>

                  {it.metric && (
                    <div className="bt-bento-metric-group">
                      <div className="bt-bento-metric-val">{it.metric}</div>
                      {itMetricLabel && <div className="bt-bento-metric-sub">{itMetricLabel}</div>}
                    </div>
                  )}

                  <div className="bt-bento-card-body">
                    {itTitle && <h3 className="bt-bento-title" {...ed(`items.${idx}.title`)}>{itTitle}</h3>}
                    {itText && <p className="bt-bento-desc" {...ed(`items.${idx}.text`)}>{itText}</p>}
                  </div>

                  {itCta && it.ctaLink && (
                    <div className="bt-bento-card-cta">
                      {it.ctaLink.startsWith("/") ? (
                        <Link href={it.ctaLink} className="btn btn-secondary btn-sm" {...ed(`items.${idx}.ctaText`)}>
                          {itCta} &rarr;
                        </Link>
                      ) : (
                        <a href={it.ctaLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" {...ed(`items.${idx}.ctaText`)}>
                          {itCta} &rarr;
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
