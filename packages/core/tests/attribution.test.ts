import { describe, expect, it } from "vitest";
import {
  parseAttributionFromParams,
  formatFbc,
  serializeAttributionCookie,
  parseAttributionCookie,
  resolveDualAttribution,
  type AttributionPayload,
} from "../src/growth/attribution";

describe("Marketing Attribution Engine (DATA-003)", () => {
  it("extracts UTM tags, referrer, and landing URL correctly", () => {
    const searchParams = new URLSearchParams(
      "utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&utm_term=tshirt&utm_content=banner_ad"
    );

    const payload = parseAttributionFromParams(searchParams, {
      referrer: "https://l.facebook.com/l.php",
      landingUrl: "https://biztrackbd.com/pricing",
      landingPath: "/pricing",
      capturedAt: new Date("2026-10-17T12:00:00Z"),
    });

    expect(payload).not.toBeNull();
    expect(payload?.utmSource).toBe("facebook");
    expect(payload?.utmMedium).toBe("cpc");
    expect(payload?.utmCampaign).toBe("summer_sale");
    expect(payload?.utmTerm).toBe("tshirt");
    expect(payload?.utmContent).toBe("banner_ad");
    expect(payload?.referrer).toBe("https://l.facebook.com/l.php");
    expect(payload?.landingPage).toBe("https://biztrackbd.com/pricing");
    expect(payload?.landingPath).toBe("/pricing");
    expect(payload?.capturedAt).toBe("2026-10-17T12:00:00.000Z");
  });

  it("formats fbclid into canonical Meta _fbc format", () => {
    const fbc = formatFbc("IwAR0example123", 1700000000000);
    expect(fbc).toBe("fb.1.1700000000000.IwAR0example123");

    const searchParams = new URLSearchParams("fbclid=IwAR999test");
    const payload = parseAttributionFromParams(searchParams, {
      capturedAt: new Date(1700000000000),
    });
    expect(payload?.fbc).toBe("fb.1.1700000000000.IwAR999test");
    expect(payload?.fbclid).toBe("IwAR999test");
  });

  it("filters out self-referrals where landing host matches referrer host", () => {
    const searchParams = new URLSearchParams("utm_source=internal");
    const payload = parseAttributionFromParams(searchParams, {
      referrer: "https://biztrackbd.com/features",
      landingUrl: "https://biztrackbd.com/start",
    });

    expect(payload?.referrer).toBeNull();
  });

  it("serializes and deserializes safely from cookie strings", () => {
    const original: AttributionPayload = {
      utmSource: "google",
      utmMedium: "organic",
      utmCampaign: "brand_search",
      referrer: "https://www.google.com/",
      landingPage: "https://biztrackbd.com/",
      landingPath: "/",
      capturedAt: "2026-10-17T10:00:00.000Z",
    };

    const cookieStr = serializeAttributionCookie(original);
    const parsed = parseAttributionCookie(cookieStr);

    expect(parsed).toEqual(original);
  });

  it("preserves immutable first-touch while updating last-touch upon new campaign arrival", () => {
    const firstTouch: AttributionPayload = {
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "winter_campaign",
      capturedAt: "2026-10-01T10:00:00.000Z",
    };

    const secondTouch: AttributionPayload = {
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "retargeting",
      capturedAt: "2026-10-17T12:00:00.000Z",
    };

    const dual = resolveDualAttribution(firstTouch, firstTouch, secondTouch);

    expect(dual.firstTouch?.utmSource).toBe("facebook");
    expect(dual.firstTouch?.utmCampaign).toBe("winter_campaign");
    expect(dual.lastTouch?.utmSource).toBe("google");
    expect(dual.lastTouch?.utmCampaign).toBe("retargeting");
  });

  it("returns null when no attribution parameters or campaign cookies are present", () => {
    const payload = parseAttributionFromParams(new URLSearchParams(""));
    expect(payload).toBeNull();
  });
});
