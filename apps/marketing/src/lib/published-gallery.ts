import { BUSINESS_TEMPLATES, THEMES, type TemplateInfo } from "@biztrackbd/core";
import type { PublishedGalleryTheme } from "@/components/template-gallery";

const LABELS: Record<string, string> = { fashion: "Fashion", electronics: "Electronics", kids: "Kids", streetwear: "Streetwear", beauty: "Beauty", other: "More" };

/** Gallery category ids for a business vertical (the business tab filters on these). */
const VERTICAL_CATEGORY: Record<string, string> = {
  RESTAURANT: "restaurant", DOCTOR_CLINIC: "doctor", BUSINESS_COMPANY: "corporate", SERVICE_PROVIDER: "services", PERSONAL_PORTFOLIO: "portfolio", PUBLIC_FIGURE: "public-figure",
};

/**
 * Splits the templates staff published into what the two gallery tabs add on top of the built-in ones: uploaded stores, uploaded business
 * sites, and the built-in store looks that were taken down. Uploaded ones appear with no deploy and are shown from their preview pictures.
 */
export function splitPublishedTemplates(published: TemplateInfo[]): { extra: PublishedGalleryTheme[]; businessExtra: PublishedGalleryTheme[]; hidden: string[] } {
  const storeIds = new Set<string>(THEMES.map((t) => t.id));
  const businessIds = new Set<string>(BUSINESS_TEMPLATES.map((t) => t.id));
  const hidden = published.length ? THEMES.filter((t) => !published.some((p) => p.id === t.id)).map((t) => t.id) : [];
  const card = (p: TemplateInfo): PublishedGalleryTheme => ({
    id: p.id, name: p.name, sub: p.blurb,
    category: p.category === "other" ? "fashion" : p.category, categoryLabel: LABELS[p.category] ?? "More",
    tag1: p.tags[0] ?? p.audience ?? "", tag2: p.tags[1] ?? "", module: p.moduleLabel ?? "New",
    colors: { accent: p.settings.accent, background: p.settings.background, text: p.settings.text },
    uploaded: true, previewDesktop: p.previews?.desktop, previewMobile: p.previews?.mobile,
  });
  const fresh = published.filter((p) => !storeIds.has(p.id) && !businessIds.has(p.id));
  const isBusiness = (p: TemplateInfo) => !!p.siteMode && p.siteMode !== "ECOMMERCE" && !!p.vertical;
  return {
    extra: fresh.filter((p) => !isBusiness(p)).map(card),
    businessExtra: fresh.filter(isBusiness).map((p) => ({ ...card(p), mode: "business" as const, vertical: p.vertical, category: VERTICAL_CATEGORY[p.vertical!] ?? "services", categoryLabel: "Business" })),
    hidden,
  };
}
