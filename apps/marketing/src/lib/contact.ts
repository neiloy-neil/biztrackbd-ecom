import { cache } from "react";
import { getPlatformContactConfig, type PlatformContactConfigView } from "@biztrackbd/core";

/** +8801886675596 -> "+880 1886-675596". Anything that is not a Bangladeshi international number is shown as saved. */
function displayPhone(intl: string): string {
  const m = intl.match(/^\+880(\d{4})(\d{6})$/);
  return m ? `+880 ${m[1]}-${m[2]}` : intl;
}

export function shapeContact(cfg: PlatformContactConfigView) {
  const whatsappDigits = cfg.whatsapp.replace(/\D/g, "");
  const whatsappBase = `https://wa.me/${whatsappDigits}`;
  return {
    email: cfg.email,
    /** Shown to people. */
    phoneDisplay: displayPhone(cfg.phone),
    /** For tel: links. */
    phoneTel: cfg.phone,
    whatsappDisplay: cfg.whatsapp,
    /** International digits only. */
    whatsappDigits,
    /** https://wa.me/<digits>, ready for a "?text=" suffix. */
    whatsappBase,
    whatsappLink: (text?: string) => (text ? `${whatsappBase}?text=${encodeURIComponent(text)}` : whatsappBase),
    facebook: cfg.facebookUrl,
    instagram: cfg.instagramUrl,
  };
}

export type Contact = ReturnType<typeof shapeContact>;

/**
 * BizTrackBD's own contact details, set in Platform Admin -> Settings -> Contact & Social. Falls back to the built-in defaults
 * if the database cannot be read, so the footer is never empty. Cached per request.
 */
export const getContact = cache(async (): Promise<Contact> => shapeContact(await getPlatformContactConfig()));
