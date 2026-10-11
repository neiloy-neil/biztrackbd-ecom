// Load test of the order path (docs/16 Phase 8): many customers ordering at once, across several stores, with less stock than demand.
//   pnpm --filter @biztrackbd/core exec tsx scripts/load-orders.ts [orders=600] [concurrency=40] [stores=3] [demand=4]  (demand 4 = four times as many buyers as units; 0.5 = plenty of stock)
// Runs against TEST_DATABASE_URL (it resets that database first). It checks correctness under pressure, then reports timings:
//   - stock is never oversold and never negative, even when 4 times as many people want a product as there are units
//   - a retry of the same order (same idempotency key) never creates a second order, even sent at the same moment
//   - every store ends with the right numbers, and no store's orders touch another's stock
// Timings come from one developer machine with the database on the same machine, so they show relative cost and contention,
// not what a deployed Supabase over a real network would do. Do not quote them as production capacity.
import { resolve } from "node:path";
import { createBaseClient, setBasePrisma } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { InsufficientStockError, createOrder, setEventPublisher } from "../src";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}
const total = Number(process.argv[2] ?? 600), concurrency = Number(process.argv[3] ?? 40), storeCount = Number(process.argv[4] ?? 3), demand = Number(process.argv[5] ?? 4);
const urls = testUrls();
if (/prod/i.test(urls.direct)) throw new Error("Refusing to load test a database whose URL contains 'prod'");

setEventPublisher(async () => {});
await resetDatabase(urls.direct);
const owner = createOwnerClient(urls.direct);
const app = createBaseClient(urls.app, 20);
setBasePrisma(app);
await seedPlans(owner);

// Each store sells one product with `stock` units; demand is `demand` times that, one unit per order.
const stock = Math.floor(total / storeCount / demand);
const stores = [];
for (let i = 0; i < storeCount; i++) {
  const f = await createTenantFixture(owner, { name: `Load ${i}`, subdomain: `load-${i}`, stock });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "BUSINESS" } });
  await owner.productVariant.update({ where: { id: f.products[0]!.variants[0]!.id }, data: { stockQuantity: stock } });
  stores.push(f);
}

let seq = 0;
const phone = () => `01${3 + (seq % 6)}${String(10_000_000 + ++seq).slice(-8)}`;
const orderFor = (f: (typeof stores)[number], key: string, ph = phone()) =>
  createOrder(f.tenantId, {
    idempotencyKey: key, customer: { name: "Load Tester", phone: ph }, shipping: { address: "House 1, Road 1, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: f.products[0]!.variants[0]!.id, quantity: 1 }], paymentMethod: "COD",
  });

const pct = (xs: number[], p: number) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))]!;
const lat: number[] = [];
let ok = 0, soldOut = 0, other = 0;
const errors = new Map<string, number>();

async function worker(queue: (() => Promise<void>)[]) {
  for (let job = queue.shift(); job; job = queue.shift()) await job();
}

// ---- 1. Oversell pressure ------------------------------------------------------------------------------------------
const jobs: (() => Promise<void>)[] = [];
for (let i = 0; i < total; i++) {
  const f = stores[i % storeCount]!;
  jobs.push(async () => {
    const t = performance.now();
    try {
      await orderFor(f, `load-${Date.now()}-${i}`);
      ok++;
    } catch (e) {
      if (e instanceof InsufficientStockError) soldOut++;
      else {
        other++;
        errors.set((e as Error).message.slice(0, 80), (errors.get((e as Error).message.slice(0, 80)) ?? 0) + 1);
      }
    }
    lat.push(performance.now() - t);
  });
}
const t0 = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker(jobs)));
const wall = (performance.now() - t0) / 1000;

// ---- 2. Retries sent at the same instant ---------------------------------------------------------------------------
const retryStore = stores[0]!;
await owner.productVariant.update({ where: { id: retryStore.products[0]!.variants[0]!.id }, data: { stockQuantity: 50 } });
const before = await owner.order.count({ where: { tenantId: retryStore.tenantId } });
const keys = Array.from({ length: 20 }, (_, i) => `retry-${Date.now()}-${i}`);
const phones = keys.map(() => phone());
const results = await Promise.all(keys.flatMap((k, i) => Array.from({ length: 5 }, () => orderFor(retryStore, k, phones[i]).then((r) => r.orderId, () => "ERR"))));
const distinct = new Set(results.filter((r) => r !== "ERR")).size;
const after = await owner.order.count({ where: { tenantId: retryStore.tenantId } });

// ---- 3. The books must balance -----------------------------------------------------------------------------------------
const problems: string[] = [];
for (const f of stores) {
  const v = await owner.productVariant.findFirstOrThrow({ where: { id: f.products[0]!.variants[0]!.id } });
  if (v.stockQuantity < 0) problems.push(`${f.tenantId}: negative stock ${v.stockQuantity}`);
}
// Store 1 and 2 were not touched by the retry test, so stock + sold must equal what they started with.
for (const f of stores.slice(1)) {
  const vid = f.products[0]!.variants[0]!.id;
  const v = await owner.productVariant.findFirstOrThrow({ where: { id: vid } });
  const sold = await owner.orderItem.aggregate({ where: { tenantId: f.tenantId, variantId: vid }, _sum: { quantity: true } });
  if (v.stockQuantity + (sold._sum.quantity ?? 0) !== stock) problems.push(`${f.tenantId}: stock ${v.stockQuantity} + sold ${sold._sum.quantity} != ${stock}`);
  if (demand >= 1 && sold._sum.quantity !== stock) problems.push(`${f.tenantId}: sold ${sold._sum.quantity} of ${stock} units although demand was ${demand}x`);
}
if (ok !== Math.min(total, stock * storeCount) && storeCount > 0) problems.push(`successes ${ok} != units available ${stock * storeCount}`);
if (other > 0) problems.push(`${other} unexpected errors: ${[...errors].map(([m, n]) => `${m} x${n}`).join("; ")}`);
if (distinct !== 20 || after - before !== 20) problems.push(`retries created ${after - before} orders (${distinct} distinct ids) for 20 keys sent 5 times each`);

console.log(`orders attempted: ${total} over ${storeCount} stores at concurrency ${concurrency}; units available ${stock * storeCount}`);
console.log(`placed: ${ok}, refused as sold out: ${soldOut}, other errors: ${other}`);
console.log(`throughput: ${(total / wall).toFixed(1)} order attempts per second (${wall.toFixed(1)} s)`);
console.log(`latency per attempt: p50 ${pct(lat, 50).toFixed(0)} ms, p95 ${pct(lat, 95).toFixed(0)} ms, p99 ${pct(lat, 99).toFixed(0)} ms, max ${Math.max(...lat).toFixed(0)} ms`);
console.log(`retries: 20 orders each sent 5 times at once -> ${after - before} orders created`);
await owner.$disconnect();
await app.$disconnect();
if (problems.length) {
  console.error("PROBLEMS:\n" + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log("OK: no oversell, no duplicate orders, books balance");
