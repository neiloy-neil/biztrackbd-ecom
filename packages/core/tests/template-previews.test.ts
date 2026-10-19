import { describe, expect, it } from "vitest";
import { ValidationError, isAllowedPreviewUrl, previewTargetFor, setTemplatePreviews, storeUrl, type PlatformActor } from "../src";

const boss: PlatformActor = { id: "pa-owner", email: "boss@example.test", role: "OWNER" };
const SB = "https://abc.supabase.co";
const ok = `${SB}/storage/v1/object/public/template-previews/eid-kapor/desktop-1.jpg`;

describe("template previews", () => {
  it("accepts only pictures in our own preview storage", () => {
    const env = { SUPABASE_URL: SB } as NodeJS.ProcessEnv;
    expect(isAllowedPreviewUrl(ok, env)).toBe(true);
    expect(isAllowedPreviewUrl(`${SB}/storage/v1/object/public/store-media/x.jpg`, env)).toBe(false);
    expect(isAllowedPreviewUrl("https://evil.example/a.jpg", env)).toBe(false);
    expect(isAllowedPreviewUrl("http://abc.supabase.co/storage/v1/object/public/template-previews/a.jpg", env)).toBe(false);
    expect(isAllowedPreviewUrl("javascript:alert(1)", env)).toBe(false);
    expect(isAllowedPreviewUrl("https://example.com/a.jpg", {} as NodeJS.ProcessEnv)).toBe(true);
  });

  it("refuses a bad template id or a report with no pictures before touching the database", async () => {
    await expect(setTemplatePreviews("Bad Id!", { desktop: ok })).rejects.toThrow(ValidationError);
    await expect(setTemplatePreviews("eid-kapor", {})).rejects.toThrow(/at least one/);
    await expect(previewTargetFor(boss, "Bad Id!")).rejects.toThrow(ValidationError);
  });

  it("builds the store address from the root domain", () => {
    expect(storeUrl("ws-eid")).toMatch(/^https?:\/\/ws-eid\./);
  });
});
