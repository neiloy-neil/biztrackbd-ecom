// A stand-in for Steadfast's API, for end-to-end tests and local development. Never talks to the real service.
// Point the admin at it with COURIER_BASE_URL_STEADFAST=http://localhost:4010 (ignored in production builds).
//   POST /create_order, GET /status_by_cid/:id, GET /get_balance   what Steadfast offers
//   POST /__set {id, status}   change what the next status check says
//   GET  /__bookings           what was booked, for assertions
//   POST /__reset              forget everything
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_COURIER_PORT ?? 4010);
const KEY = "e2e-api-key";
const SECRET = "e2e-secret-key";
// Unique per start, like a real courier's consignment ids, so one run's callbacks cannot be mistaken for the next run's.
let next = Math.floor(Date.now() / 1000);
let bookings = [];
const statuses = new Map();

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  if (path.startsWith("/__")) {
    if (path === "/__bookings") return send(res, 200, bookings);
    if (path === "/__reset") {
      bookings = [];
      statuses.clear();
      return send(res, 200, { ok: true });
    }
    if (path === "/__set") {
      const b = await readJson(req);
      statuses.set(String(b.id), String(b.status));
      return send(res, 200, { ok: true });
    }
    return send(res, 404, {});
  }
  if (req.headers["api-key"] !== KEY || req.headers["secret-key"] !== SECRET) return send(res, 401, { status: 401, message: "Unauthorized" });
  if (path === "/get_balance") return send(res, 200, { status: 200, current_balance: 0 });
  if (path === "/create_order" && req.method === "POST") {
    const b = await readJson(req);
    if (!b.recipient_phone || !/^01\d{9}$/.test(String(b.recipient_phone))) return send(res, 400, { status: 400, message: "Invalid recipient phone" });
    const id = ++next;
    bookings.push({ id, ...b });
    statuses.set(String(id), "in_review");
    return send(res, 200, { status: 200, message: "Consignment has been created successfully.", consignment: { consignment_id: id, invoice: b.invoice, tracking_code: `TRK${id}`, recipient_name: b.recipient_name, cod_amount: b.cod_amount, status: "in_review" } });
  }
  const m = path.match(/^\/status_by_cid\/(\d+)$/);
  if (m) {
    const s = statuses.get(m[1]);
    return s ? send(res, 200, { status: 200, delivery_status: s }) : send(res, 404, { status: 404, message: "Not found" });
  }
  return send(res, 404, { status: 404 });
}).listen(PORT, () => console.log(`fake courier on :${PORT}`));
