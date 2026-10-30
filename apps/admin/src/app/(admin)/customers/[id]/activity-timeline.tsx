import Link from "next/link";
import type { CustomerActivityItem } from "@biztrackbd/core";
import { friendlyDate } from "@/lib/format";

const TYPE_CONFIG: Record<CustomerActivityItem["type"], { badgeClass: string; label: string }> = {
  ORDER: { badgeClass: "timeline-badge timeline-badge-order", label: "ORD" },
  SMS: { badgeClass: "timeline-badge timeline-badge-sms", label: "SMS" },
  REVIEW: { badgeClass: "timeline-badge timeline-badge-review", label: "REV" },
  LOYALTY: { badgeClass: "timeline-badge timeline-badge-loyalty", label: "PTS" },
  CREDIT: { badgeClass: "timeline-badge timeline-badge-credit", label: "৳" },
  STAFF: { badgeClass: "timeline-badge timeline-badge-staff", label: "LOG" },
};

export function CustomerActivityTimeline({ items }: { items: CustomerActivityItem[] }) {
  if (items.length === 0) {
    return <p className="muted py-sm">No recorded activity yet.</p>;
  }

  return (
    <div className="stack gap-md">
      {items.map((item) => {
        const conf = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.STAFF;
        const content = (
          <div key={item.id} className="timeline-row">
            <div className={conf.badgeClass}>
              {conf.label}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex-between gap-sm">
                <span className="text-bold">
                  {item.title}
                </span>
                <span className="muted text-xs nowrap">
                  {friendlyDate(item.date)}
                </span>
              </div>
              {item.detail && (
                <div className="muted text-xs mt-xs break-word">
                  {item.detail}
                </div>
              )}
            </div>
          </div>
        );

        if (item.link) {
          return (
            <Link
              key={item.id}
              href={item.link}
              prefetch={false}
              className="link-block"
            >
              {content}
            </Link>
          );
        }

        return content;
      })}
    </div>
  );
}
