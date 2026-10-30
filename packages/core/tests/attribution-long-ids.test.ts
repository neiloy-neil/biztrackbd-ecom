import { describe, expect, it } from "vitest";
import { AttributionSchema, formatFbc, parseAttributionFromParams } from "../src/growth/attribution";

// Meta click ids are usually short, but they can run well past 150 characters. They must be kept whole (a cut id no longer matches the
// click) or dropped, and attribution as a whole must still be saved.
describe("long ad click ids", () => {
  const fbclid = `IwY2xjawN${"a1B2c3".repeat(30)}`; // 189 characters

  it("formatFbc keeps a long fbclid whole", () => {
    expect(fbclid.length).toBeGreaterThan(150);
    expect(formatFbc(fbclid, 1700000000000)).toBe(`fb.1.1700000000000.${fbclid}`);
  });

  it("parseAttributionFromParams keeps fbclid and the fbc built from it", () => {
    const payload = parseAttributionFromParams(new URLSearchParams({ fbclid, utm_source: "meta" }), { capturedAt: new Date(1700000000000) });
    expect(payload?.fbclid).toBe(fbclid);
    expect(payload?.fbc).toBe(`fb.1.1700000000000.${fbclid}`);
  });

  it("the saved attribution still validates with a long fbclid and fbc", () => {
    const payload = parseAttributionFromParams(new URLSearchParams({ fbclid }), { capturedAt: new Date(1700000000000) });
    expect(AttributionSchema.safeParse(payload).success).toBe(true);
  });

  it("an absurd click id is cut to 300 characters and the rest of the attribution survives", () => {
    const payload = parseAttributionFromParams(new URLSearchParams({ fbclid: "z".repeat(2000), utm_campaign: "c".repeat(500) }), {
      capturedAt: new Date(1700000000000),
    });
    expect(payload?.fbclid).toHaveLength(300);
    expect(payload?.utmCampaign).toHaveLength(100);
  });
});
