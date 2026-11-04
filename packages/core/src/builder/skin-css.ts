import { ValidationError } from "../errors";

/**
 * The look a theme package adds on top of one of the built-in looks: a small piece of CSS. It runs in front of every customer of every store
 * that uses the theme, so nothing in it is trusted. The rules, all checked here and not in the browser:
 *  - plain rules and @media blocks only (no @import, @font-face, @keyframes with url, @supports, @namespace, @charset);
 *  - no url(), image-set(), expression(), behavior, -moz-binding or script-like text, so the CSS cannot load anything from anywhere;
 *  - no position fixed or sticky and no z-index above 50, so a theme cannot cover the checkout or the store's own controls;
 *  - no < sign or backslash, so it cannot close the style tag or hide a forbidden word with an escape;
 *  - every selector is rewritten to live under body[data-skin="<theme id>"], so it can only restyle stores wearing this theme.
 */

export const MAX_SKIN_CSS_BYTES = 40_000;

const FORBIDDEN_AT = /@(?:import|font-face|namespace|charset|supports|property|layer|container|document|page|counter-style|font-feature-values|viewport)\b/i;
const FORBIDDEN_TEXT = /url\s*\(|image-set\s*\(|expression\s*\(|javascript:|vbscript:|data:|behavior\s*:|-moz-binding|@-moz|\bsrc\s*:/i;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, " ");

const fail = (why: string): never => { throw new ValidationError(`Theme CSS: ${why}`); };

/** One selector, kept under the theme's scope. `body`, `html` and `:root` mean the scope itself. */
function scopeSelector(sel: string, scope: string): string {
  const s = sel.trim();
  if (!s) return fail("an empty selector");
  if (/[{}]/.test(s)) return fail("a selector has a stray brace");
  if (/^(?:html|body|:root)(?=$|[\s.:#[>+~])/i.test(s)) {
    const rest = s.replace(/^(?:html|body|:root)/i, "");
    return `${scope}${rest}`;
  }
  return `${scope} ${s}`;
}

function checkDeclarations(block: string): string {
  const out: string[] = [];
  for (const raw of block.split(";")) {
    const d = raw.trim();
    if (!d) continue;
    const i = d.indexOf(":");
    if (i < 1) return fail(`"${d.slice(0, 40)}" is not a property`);
    const prop = d.slice(0, i).trim().toLowerCase();
    const value = d.slice(i + 1).trim();
    if (!/^(?:--[a-z0-9-]+|[a-z-]+)$/.test(prop)) return fail(`"${prop.slice(0, 40)}" is not a valid property name`);
    if (prop === "position" && /\b(?:fixed|sticky)\b/i.test(value)) return fail("position fixed and sticky are not allowed");
    if (prop === "z-index" && !(Number(value) <= 50)) return fail("z-index cannot be above 50");
    if (prop === "content" && /["']\s*(?:https?:|\/\/)/i.test(value)) return fail("content cannot carry a link");
    out.push(`${prop}:${value}`);
  }
  return out.join(";");
}

/**
 * Checks the CSS and returns it scoped to `body[data-skin="<id>"]`. Throws a ValidationError that says what is wrong. An empty string stays empty.
 * Nesting is allowed one level deep, for @media only.
 */
export function scopeSkinCss(id: string, rawCss: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return fail("the theme id is not valid");
  if (Buffer.byteLength(rawCss, "utf8") > MAX_SKIN_CSS_BYTES) return fail(`it is too large (${MAX_SKIN_CSS_BYTES / 1000} KB at most)`);
  if (/[<\\]/.test(rawCss)) return fail("the < sign and backslashes are not allowed");
  const css = stripComments(rawCss).trim();
  if (!css) return "";
  if (FORBIDDEN_AT.test(css)) return fail("that @ rule is not allowed. Only @media is");
  if (FORBIDDEN_TEXT.test(css)) return fail("url(), data: links, expression() and similar are not allowed, so a theme cannot load anything from outside");
  const scope = `body[data-skin="${id}"]`;

  const rules = (text: string, depth: number): string[] => {
    const parts: string[] = [];
    let j = 0;
    while (j < text.length) {
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (j >= text.length) break;
      const open = text.indexOf("{", j);
      if (open < 0) return fail("a rule is missing its { }");
      const head = text.slice(j, open).trim();
      let d = 1, k = open + 1;
      while (k < text.length && d > 0) { const c = text[k++]; if (c === "{") d++; else if (c === "}") d--; }
      if (d !== 0) return fail("a { is never closed");
      const body = text.slice(open + 1, k - 1);
      j = k;
      if (head.startsWith("@")) {
        if (!/^@media\b/i.test(head)) return fail("only @media is allowed");
        if (depth > 0) return fail("@media cannot be nested");
        if (!/^@media\s+[a-z0-9\s:()\-.,]*$/i.test(head)) return fail("that @media query is not valid");
        parts.push(`${head}{${rules(body, depth + 1).join("")}}`);
      } else {
        if (body.includes("{")) return fail("rules cannot be nested here");
        const selectors = head.split(",").map((x) => scopeSelector(x, scope));
        const decl = checkDeclarations(body);
        if (decl) parts.push(`${selectors.join(",")}{${decl}}`);
      }
    }
    return parts;
  };
  return rules(css, 0).join("\n");
}
