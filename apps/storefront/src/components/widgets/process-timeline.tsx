import { WidgetIcon } from "./widget-icons";

export interface TimelineStepItem {
  stepNumber?: string;
  title?: string;
  titleBn?: string;
  description?: string;
  descriptionBn?: string;
  badge?: string;
  badgeBn?: string;
  icon?: string;
}

export function ProcessTimelineSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  layout = "vertical",
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
  layout?: "vertical" | "horizontal";
  items?: TimelineStepItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  return (
    <section className="bt-timeline-sec">
      <div className="wrap">
        {(displayTitle || displaySubtitle || displayBadge || editing) && (
          <div className="bt-widget-header text-center">
            {displayBadge && (
              <span className="bt-widget-badge" {...ed("badge")}>
                {displayBadge}
              </span>
            )}
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && (
              <p className="muted" {...ed("subtitle")}>
                {displaySubtitle}
              </p>
            )}
          </div>
        )}

        <div className={`bt-timeline-flow bt-timeline-${layout}`}>
          <div className="bt-timeline-spine" aria-hidden="true" />

          {items.map((step, idx) => {
            const stepTitle = lang === "bn" && step.titleBn ? step.titleBn : step.title;
            const stepDesc = lang === "bn" && step.descriptionBn ? step.descriptionBn : step.description;
            const stepBadge = lang === "bn" && step.badgeBn ? step.badgeBn : step.badge;
            const stepNum = step.stepNumber || String(idx + 1).padStart(2, "0");

            return (
              <div
                key={`${stepNum}-${idx}`}
                className={`bt-timeline-node ${idx % 2 === 0 ? "bt-node-left" : "bt-node-right"}`}
                {...ed(`items.${idx}.title`)}
              >
                {/* TIMELINE ICON / NUMBER BADGE */}
                <div className="bt-timeline-badge-wrap">
                  <div className="bt-timeline-badge">
                    {step.icon ? (
                      <WidgetIcon name={step.icon} size={20} className="bt-timeline-icon" />
                    ) : (
                      <span className="bt-timeline-num">{stepNum}</span>
                    )}
                  </div>
                </div>

                {/* TIMELINE CARD CONTENT */}
                <div className="bt-timeline-card">
                  <div className="bt-timeline-card-header">
                    <span className="bt-step-counter">STEP {stepNum}</span>
                    {stepBadge && <span className="bt-step-tag">{stepBadge}</span>}
                  </div>
                  {stepTitle && <h3 className="bt-timeline-card-title">{stepTitle}</h3>}
                  {stepDesc && <p className="bt-timeline-card-desc">{stepDesc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
