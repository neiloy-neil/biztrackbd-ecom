#!/usr/bin/env node
'use strict';
// Expands the canvas .dc.html boards to plain HTML and measures each one in headless Chrome.
// Usage: node render.cjs [--measure] [srcDir] [outDir]
//   preview (default): writes expanded HTML to outDir so you can open boards in a browser.
//   --measure: also reports clipped or overly tall boards (exit code 1 if any board clips).
// Set CHROME_PATH if Chrome is not in a standard location.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const MEASURE = args.includes('--measure');
const [argSrc, argOut] = args.filter((a) => !a.startsWith('--'));
const SRC = path.resolve(argSrc || path.join(__dirname, '../../design/canvas/project'));
const OUT = path.resolve(argOut || path.join(__dirname, '.out'));
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const idx = JSON.parse(fs.readFileSync(path.join(SRC, 'canvas.json'), 'utf8'));

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function lookup(ctx, p) {
  p = p.trim();
  if (p === 'true') return true; if (p === 'false') return false;
  let v = ctx; for (const k of p.split('.')) { if (v == null) return undefined; v = v[k]; } return v;
}
function parseAttrs(s) { const o = {}; const re = /([\w-]+)="([^"]*)"/g; let m; while ((m = re.exec(s))) o[m[1]] = m[2]; return o; }
function findClose(html, tag, from) {
  const open = new RegExp('<' + tag + '[\\s>]', 'g'), close = '</' + tag + '>'; let depth = 1, pos = from;
  while (depth > 0) {
    open.lastIndex = pos; const o = open.exec(html); const c = html.indexOf(close, pos);
    if (c < 0) throw new Error('unclosed ' + tag);
    if (o && o.index < c) { depth++; pos = o.index + 1; } else { depth--; pos = c + 1; if (depth === 0) return c; }
  }
}
function loadComponent(file, props) {
  const html = fs.readFileSync(path.join(SRC, file), 'utf8');
  const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
  const body = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(html)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const Comp = new Function('DCLogic', script + '\nreturn Component;')(class { constructor(p) { this.props = p; this.state = {}; } setState() {} });
  const inst = new Comp(props); inst.props = props;
  return { vals: inst.renderVals(), body };
}
function expand(html, ctx) {
  for (;;) {
    const m = /<(sc-for|sc-if|dc-import)(\s[^>]*)?>/.exec(html); if (!m) break;
    const tag = m[1], attrs = parseAttrs(m[2] || ''), start = m.index, innerStart = start + m[0].length;
    const closeAt = findClose(html, tag, innerStart), inner = html.slice(innerStart, closeAt), end = closeAt + tag.length + 3;
    let rep = '';
    if (tag === 'sc-for') {
      const list = lookup(ctx, attrs.list.replace(/[{}]/g, '')) || []; const as = attrs.as;
      list.forEach((it, i) => { rep += expand(inner, { ...ctx, [as]: it, $index: i }); });
    } else if (tag === 'sc-if') {
      const v = lookup(ctx, attrs.value.replace(/[{}]/g, '')); if (v) rep = expand(inner, ctx);
    } else {
      const props = {}; for (const [k, v] of Object.entries(attrs)) { if (k === 'name' || k.startsWith('hint-')) continue; props[camel(k)] = /^\{\{/.test(v) ? lookup(ctx, v.replace(/[{}]/g, '')) : v; }
      const c = loadComponent(attrs.name + '.dc.html', props); rep = expand(c.body, c.vals);
    }
    html = html.slice(0, start) + rep + html.slice(end);
  }
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => { const v = lookup(ctx, p); return v == null ? '' : String(v); });
}
const results = [];
for (const name of idx.order) {
  const b = idx.boards[name];
  const c = loadComponent(name, {});
  const body = expand(c.body, c.vals);
  const fixed = !b.expand;
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;width:${b.w}px}</style></head><body>${body}<script>
window.addEventListener('load',()=>{setTimeout(()=>{const root=document.body.firstElementChild;const sh=Math.max(document.documentElement.scrollHeight,0);const rs=root?root.scrollHeight:0;const rh=root?root.getBoundingClientRect().height:0;const sw=document.documentElement.scrollWidth;
const el=document.createElement('pre');el.id='m';el.textContent=JSON.stringify({sh,rs,rh,sw});document.body.appendChild(el);},300)});</script></body></html>`;
  const f = path.join(OUT, name.replace('.dc.html', '.html')); fs.writeFileSync(f, page);
  let m = {};
  if (MEASURE) try {
    const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--window-size=${b.w},${Math.max(b.h, 900)}`, '--virtual-time-budget=4000', '--dump-dom', 'file:///' + f.replace(/\\/g, '/')], { encoding: 'utf8', maxBuffer: 50e6, timeout: 60000 });
    m = JSON.parse(/<pre id="m">([\s\S]*?)<\/pre>/.exec(dom)[1].replace(/&quot;/g, '"'));
  } catch (e) { m = { err: String(e.message).slice(0, 80) }; }
  results.push({ name: name.replace('.dc.html', ''), page: b.page, w: b.w, h: b.h, fixed, ...m });
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
let clipped = 0;
if (!MEASURE) console.log('Wrote ' + results.length + ' boards to ' + OUT);
if (MEASURE) for (const r of results) {
  const need = r.fixed ? r.rs : r.sh; const flag = r.err ? 'ERR ' + r.err : (need > r.h + 4 ? (clipped++, 'CLIP +' + (need - r.h)) : (need < r.h - 250 ? 'tall -' + (r.h - need) : 'ok'));
  console.log(r.name.padEnd(18), String(r.w).padStart(5), 'h', String(r.h).padStart(5), 'measured', String(need).padStart(5), 'sw', r.sw, flag);
}
if (MEASURE) { console.log(clipped ? clipped + ' board(s) clip' : 'No clipped boards'); process.exit(clipped ? 1 : 0); }
