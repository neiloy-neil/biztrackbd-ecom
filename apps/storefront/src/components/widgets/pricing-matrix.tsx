"use client";

import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export interface PricingPlanItem {
  name: string;
  nameBn?: string;
  badge?: string;
  badgeBn?: string;
  price: string;
  period?: string;
  periodBn?: string;
  description?: string;
  descriptionBn?: string;
  highlighted?: boolean;
  features?: string;
  featuresBn?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
}

export function PricingMatrixSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  items = [],
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  badge?: string;
  badgeBn?: string;
  items?: PricingPlanItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  return (
    <section className="bt-pricing-sec">
      <div className="wrap">
        {(displayBadge || displayTitle || displaySubtitle || editing) && (
          <div className="bt-pricing-head">
            {displayBadge && (
              <span className="bt-pricing-badge" {...ed("badge")}>
                {displayBadge}
              </span>
            )}
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && <p className="muted" {...ed("subtitle")}>{displaySubtitle}</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className={`bt-pricing-grid bt-cols-${Math.min(4, Math.max(1, items.length))}`}>
            {items.map((plan, idx) => {
              const name = lang === "bn" && plan.nameBn ? plan.nameBn : plan.name;
              const planBadge = lang === "bn" && plan.badgeBn ? plan.badgeBn : plan.badge;
              const period = lang === "bn" && plan.periodBn ? plan.periodBn : plan.period;
              const desc = lang === "bn" && plan.descriptionBn ? plan.descriptionBn : plan.description;
              const cta = lang === "bn" && plan.ctaTextBn ? plan.ctaTextBn : plan.ctaText;

              const rawFeatureLines = (lang === "bn" && plan.featuresBn ? plan.featuresBn : plan.features || "")
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);

              const isHighlighted = Boolean(plan.highlighted);

              return (
                <div
                  key={idx}
                  className={`bt-pricing-card ${isHighlighted ? "highlighted" : ""}`}
                >
                  {planBadge && (
                    <div className="bt-pricing-ribbon" {...ed(`items.${idx}.badge`)}>
                      {planBadge}
                    </div>
                  )}

                  <div className="bt-pricing-card-head">
                    <h3 className="bt-plan-name" {...ed(`items.${idx}.name`)}>
                      {name}
                    </h3>
                    {desc && (
                      <p className="bt-plan-desc" {...ed(`items.${idx}.description`)}>
                        {desc}
                      </p>
                    )}

                    <div className="bt-plan-price-wrap">
                      <span className="bt-plan-price" {...ed(`items.${idx}.price`)}>
                        {plan.price}
                      </span>
                      {period && (
                        <span className="bt-plan-period" {...ed(`items.${idx}.period`)}>
                          {period}
                        </span>
                      )}
                    </div>
                  </div>

                  {rawFeatureLines.length > 0 && (
                    <ul className="bt-plan-features">
                      {rawFeatureLines.map((feat, fIdx) => (
                        <li key={fIdx} className="bt-plan-feature-item">
                          <span className="bt-plan-feat-icon">
                            <WidgetIcon name="check" size={16} />
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {cta && plan.ctaLink && (
                    <div className="bt-plan-cta">
                      {plan.ctaLink.startsWith("/") ? (
                        <Link
                          href={plan.ctaLink}
                          className={`btn ${isHighlighted ? "btn-primary" : "btn-secondary"} btn-block`}
                          {...ed(`items.${idx}.ctaText`)}
                        >
                          {cta}
                        </Link>
                      ) : (
                        <a
                          href={plan.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`btn ${isHighlighted ? "btn-primary" : "btn-secondary"} btn-block`}
                          {...ed(`items.${idx}.ctaText`)}
                        >
                          {cta}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
