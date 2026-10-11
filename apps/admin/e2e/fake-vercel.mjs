// A local stand-in for the parts of the Vercel API that connecting a domain uses. For end-to-end tests only.
//   POST /v10/projects/:p/domains            add a domain
//   GET  /v6/domains/:d/config               { misconfigured }
//   GET  /v9/projects/:p/domains/:d          { verified }
//   DELETE /v9/projects/:p/domains/:d        remove
// Control: GET /__state, POST /__reset, POST /__hold (domains stay "not ready"), POST /__release.
import { createServer } from "node:http";

let added = new Set();
let hold = false;
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (!p.startsWith("/__") && req.headers.authorization !== "Bearer e2e-vercel-token") return json(res, 401, { error: { code: "forbidden" } });
    if (p === "/__state") return json(res, 200, { added: [...added], hold });
    if (p === "/__reset") { added = new Set(); hold = false; return json(res, 200, {}); }
    if (p === "/__hold") { hold = true; return json(res, 200, {}); }
    if (p === "/__release") { hold = false; return json(res, 200, {}); }
    let m;
    if (req.method === "POST" && (m = p.match(/^\/v10\/projects\/[^/]+\/domains$/))) {
      const name = JSON.parse(body || "{}").name;
      if (added.has(name)) return json(res, 409, { error: { code: "domain_already_in_use" } });
      added.add(name);
      return json(res, 200, { name, verified: false });
    }
    if (req.method === "GET" && (m = p.match(/^\/v6\/domains\/([^/]+)\/config$/))) return json(res, 200, { misconfigured: hold || !added.has(m[1]) });
    if (req.method === "GET" && (m = p.match(/^\/v9\/projects\/[^/]+\/domains\/([^/]+)$/))) return added.has(m[1]) ? json(res, 200, { name: m[1], verified: !hold }) : json(res, 404, { error: { code: "not_found" } });
    if (req.method === "DELETE" && (m = p.match(/^\/v9\/projects\/[^/]+\/domains\/([^/]+)$/))) { added.delete(m[1]); return json(res, 200, {}); }
    json(res, 404, {});
  });
}).listen(4012, () => console.log("fake vercel on 4012"));
