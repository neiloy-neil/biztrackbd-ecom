import type { SVGProps } from "react";

export type ContactIconName = "email" | "phone" | "whatsapp" | "facebook" | "instagram";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Small, one-colour icons for contact and social links. They take the text colour of whatever they sit in. */
export function ContactIcon({ name, size = 18, ...rest }: { name: ContactIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false, ...rest } as SVGProps<SVGSVGElement>;
  switch (name) {
    case "email":
      return (
        <svg {...common}>
          <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" {...STROKE} />
          <path d="m3 7 9 6.5L21 7" {...STROKE} />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...STROKE} />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M3 21l1.65-4.9A9 9 0 1 1 8 19.5L3 21z" {...STROKE} />
          <path d="M9.4 8.3c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c.8 1.5 2 2.5 3.4 3.2l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5v.5c0 .6-.5 1.3-1.6 1.5-1.6.3-4-.8-5.8-2.6-1.8-1.8-2.8-4-2.5-5.7z" fill="currentColor" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="currentColor" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" {...STROKE} />
          <circle cx="12" cy="12" r="4.2" {...STROKE} />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
        </svg>
      );
  }
}

export const CONTACT_LABELS: Record<ContactIconName, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
};
