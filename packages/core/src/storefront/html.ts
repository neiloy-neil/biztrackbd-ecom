import sanitizeHtml from "sanitize-html";

/**
 * Product descriptions are written by store staff and shown to every visitor, so they are cleaned on the way out:
 * a short allowlist of formatting tags, links only to http(s), mailto and tel, images only from https, no styles,
 * no scripts, no event handlers, no iframes or SVG. Anything else is dropped, keeping its text.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a", "img", "table", "thead", "tbody", "tr", "th", "td", "hr"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow", ...(attribs.target ? { target: "_blank" } : {}) },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

export function sanitizeProductHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html.slice(0, 100_000), OPTIONS);
}
