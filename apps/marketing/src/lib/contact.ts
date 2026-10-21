/** BizTrackBD's own contact details, used in the footer, the contact page and structured data. Env values win if set. */
const digits = (v: string) => v.replace(/\D/g, "");

const whatsappRaw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+8801886675596";

export const CONTACT = {
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "biztrackbd@gmail.com",
  /** Shown to people. */
  phoneDisplay: "+880 1886-675596",
  /** For tel: links. */
  phoneTel: "+8801886675596",
  whatsappDisplay: whatsappRaw,
  /** International digits only, for wa.me. */
  whatsappDigits: digits(whatsappRaw),
  facebook: "https://facebook.com/biztrackbd/",
  instagram: "https://www.instagram.com/biztrackbd/",
} as const;

export const whatsappLink = (text?: string) =>
  `https://wa.me/${CONTACT.whatsappDigits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
