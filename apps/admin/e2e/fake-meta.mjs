// A stand-in for Meta's Conversions API, for end-to-end tests. Never talks to Facebook.
//   POST /:pixelId/events   records the call and answers like Meta
//   GET  /__hits            what was received, for assertions
//   POST /__reset           forget everything
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_META_PORT ?? 4011);
let hits = [];

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/__hits") return send(200, hits);
  if (url.pathname === "/__reset") { hits = []; return send(200, { ok: true }); }
  let raw = "";
  for await (const c of req) raw += c;
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
  const m = url.pathname.match(/^\/(\d+)\/events$/);
  if (!m || req.method !== "POST") return send(404, { error: { message: "Not found" } });
  if (req.headers.authorization !== "Bearer e2e-meta-token") return send(401, { error: { message: "Invalid OAuth access token" } });
  hits.push({ pixel: m[1], body });
  return send(200, { events_received: Array.isArray(body.data) ? body.data.length : 0 });
}).listen(PORT, () => console.log(`fake meta on :${PORT}`));
