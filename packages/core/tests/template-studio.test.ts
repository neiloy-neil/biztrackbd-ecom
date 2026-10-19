import { describe, expect, it } from "vitest";
import { ValidationError, createWorkshopStore, type PlatformActor } from "../src";

const boss: PlatformActor = { id: "pa-owner", email: "boss@example.test", role: "OWNER" };
const support: PlatformActor = { id: "pa-sup", email: "sup@example.test", role: "SUPPORT" };

// These checks run before anything touches the database.
describe("template studio: creating a workshop", () => {
  it.each([
    ["short name", { name: "x", slug: "eid" }, /name/i],
    ["bad word", { name: "Eid shop", slug: "Eid Shop!" }, /word/i],
    ["unknown kind", { name: "Eid shop", slug: "eid", siteMode: "NOPE" }, /store or a business/i],
    ["business without type", { name: "Clinic", slug: "clinic", siteMode: "PORTFOLIO" }, /business type/i],
  ])("rejects %s", async (_n, input, re) => {
    await expect(createWorkshopStore(boss, input)).rejects.toThrow(ValidationError);
    await expect(createWorkshopStore(boss, input)).rejects.toThrow(re);
  });

  it("is for staff who can edit plans", async () => {
    await expect(createWorkshopStore(support, { name: "Eid shop", slug: "eid" })).rejects.toThrow();
  });
});
