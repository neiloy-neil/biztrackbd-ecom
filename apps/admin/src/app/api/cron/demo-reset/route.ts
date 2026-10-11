import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_TEMPLATE_IDS, resetDemoStore, type DemoDeps } from "@biztrackbd/core";
import { configuredDriver, removeImage, saveImage, svgToPng } from "@biztrackbd/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 60 seconds is the longest Vercel Hobby allows. One template takes a few seconds, so the scheduler calls this once per template.
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Rebuilds the template demo stores from their template data (docs/38): the old store, its pictures and anything visitors left
 * behind are removed, then a clean one is made. `?template=kapor` does one; with none it does all five in turn.
 * Point a scheduler at it each night with `Authorization: Bearer $CRON_SECRET`.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const wanted = req.nextUrl.searchParams.get("template");
  if (wanted && !DEMO_TEMPLATE_IDS.includes(wanted as never)) return NextResponse.json({ ok: false, error: "Unknown template" }, { status: 400 });
  const driver = configuredDriver();
  const deps: DemoDeps = {
    rasterize: svgToPng,
    save: async (tenantId, picture) => ({ url: (await saveImage(tenantId, picture, driver)).url }),
    remove: (tenantId, url) => removeImage(tenantId, url, driver),
  };
  const results = [];
  for (const id of wanted ? [wanted] : DEMO_TEMPLATE_IDS) {
    try {
      results.push(await resetDemoStore(id, deps));
    } catch (e) {
      console.error("demo reset failed", id, e instanceof Error ? e.message : "unknown");
      return NextResponse.json({ ok: false, failed: id, done: results }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, stores: results.map((r) => ({ template: r.template, subdomain: r.subdomain, products: r.products, pictures: r.pictures })) });
}

export const GET = run;
export const POST = run;
