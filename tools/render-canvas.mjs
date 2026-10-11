// Flattens the design canvas artboards (design/canvas/project/*.dc.html) into plain, standalone HTML files so they can be opened in a
// browser and screenshotted. The canvas runtime (support.js) is not in the repository, so this reads the same format itself:
//   <x-dc> template  +  <script data-dc-script> class Component { renderVals() }  +  <dc-import>, <sc-for>, <sc-if>, {{expression}}.
//   node tools/render-canvas.mjs <outDir> [Board ...]       (no boards: all of them)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../design/canvas/project");
const [outDir, ...only] = process.argv.slice(2);
if (!outDir) throw new Error("usage: node tools/render-canvas.mjs <outDir> [Board ...]");
mkdirSync(outDir, { recursive: true });

const canvas = JSON.parse(readFileSync(join(SRC, "canvas.json"), "utf8"));
const cache = new Map();

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const raw = readFileSync(join(SRC, `${name}.dc.html`), "utf8");
  const body = raw.match(/<x-dc>([\s\S]*?)<\/x-dc>/)?.[1] ?? "";
  const helmet = body.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? "";
  const template = body.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  const script = raw.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
  const propsDecl = raw.match(/data-props='([^']*)'/)?.[1];
  const decl = propsDecl ? JSON.parse(propsDecl.replace(/&quot;/g, '"')) : {};
  let Component = null;
  if (script.includes("class Component")) {
    Component = new Function("DCLogic", `${script}\nreturn Component;`)(class DCLogic { constructor(props) { this.props = props; } });
  }
  const entry = { template, helmet, Component, decl };
  cache.set(name, entry);
  return entry;
}

const evalExpr = (expr, scope) => {
  try {
    return new Function("scope", `with (scope) { return (${expr}); }`)(scope);
  } catch {
    return undefined;
  }
};
const interpolate = (text, scope) =>
  text.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => {
    const v = evalExpr(e, scope);
    return v == null || v === false ? "" : String(v);
  });

/** Index of the matching close tag for the open tag that ends at `from`. */
function closeOf(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start: m.index, end: re.lastIndex };
  }
  throw new Error(`unclosed <${tag}>`);
}

const attr = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

function render(html, scope, fonts) {
  let out = "", i = 0;
  const special = /<(sc-for|sc-if|dc-import)\b([^>]*)>/g;
  for (;;) {
    special.lastIndex = i;
    const m = special.exec(html);
    if (!m) break;
    out += interpolate(html.slice(i, m.index), scope);
    const [, tag, attrs] = m;
    const close = closeOf(html, tag, special.lastIndex);
    const inner = html.slice(special.lastIndex, close.start);
    if (tag === "sc-for") {
      const list = evalExpr(attr(attrs, "list").replace(/^\{\{|\}\}$/g, ""), scope) ?? [];
      const as = attr(attrs, "as") ?? "item";
      list.forEach((item, index) => { out += render(inner, { ...scope, [as]: item, index }, fonts); });
    } else if (tag === "sc-if") {
      if (evalExpr(attr(attrs, "value").replace(/^\{\{|\}\}$/g, ""), scope)) out += render(inner, scope, fonts);
    } else {
      const name = attr(attrs, "name");
      const props = {};
      for (const [, k, v] of attrs.matchAll(/\b([a-zA-Z][\w-]*)="([^"]*)"/g)) {
        if (k === "name" || k.startsWith("hint-")) continue;
        props[k] = /^\{\{[\s\S]*\}\}$/.test(v) ? evalExpr(v.slice(2, -2), scope) : v;
      }
      out += renderBoard(name, props, fonts);
    }
    i = close.end;
  }
  return out + interpolate(html.slice(i), scope);
}

function renderBoard(name, props, fonts) {
  const { template, helmet, Component, decl } = load(name);
  for (const l of helmet.matchAll(/<link[^>]*>/g)) fonts.add(l[0]);
  const defaults = Object.fromEntries(Object.entries(decl).filter(([k, v]) => !k.startsWith("$") && v && "default" in v).map(([k, v]) => [k, v.default]));
  const merged = { ...defaults, ...props };
  const vals = Component ? new Component(merged).renderVals?.() ?? {} : {};
  return render(template, { ...merged, ...vals }, fonts);
}

const boards = Object.keys(canvas.boards).map((f) => f.replace(/\.dc\.html$/, ""));
for (const name of boards.filter((b) => only.length === 0 || only.includes(b))) {
  const fonts = new Set();
  const body = renderBoard(name, {}, fonts);
  const { w, h } = canvas.boards[`${name}.dc.html`];
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title>${[...fonts].join("")}<style>body{margin:0}a{color:inherit;text-decoration:none}</style></head><body data-w="${w}" data-h="${h}">${body}</body></html>`;
  writeFileSync(join(outDir, `${name}.html`), page);
}
console.log(`rendered ${only.length || boards.length} board(s) into ${outDir}`);
