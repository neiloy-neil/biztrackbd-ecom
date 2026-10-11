import { describe, expect, it } from "vitest";
import { BD_GEO, divisionNames, divisionOfDistrict, districtsOf, isValidAddress, upazilasOf } from "../src";

describe("Bangladesh geography data", () => {
  const districts = BD_GEO.flatMap((d) => d.districts.map((x) => ({ division: d.name, ...x })));

  it("has 8 divisions and 64 districts", () => {
    expect(divisionNames().sort()).toEqual(["Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"].sort());
    expect(districts).toHaveLength(64);
  });

  it("has no duplicate district names and no district without upazilas", () => {
    const names = districts.map((d) => d.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    expect(districts.filter((d) => d.upazilas.length === 0).map((d) => d.name)).toEqual([]);
  });

  it("has no blank or padded names, and no duplicate upazilas within a district", () => {
    for (const d of districts) {
      expect(d.name).toBe(d.name.trim());
      expect(new Set(d.upazilas).size).toBe(d.upazilas.length);
      for (const u of d.upazilas) expect(u.trim()).toBe(u);
    }
  });

  it("answers the lookups the checkout needs", () => {
    expect(districtsOf("Dhaka").map((d) => d.name)).toContain("Gazipur");
    expect(upazilasOf("Dhaka", "Dhaka")).toContain("Mirpur");
    expect(divisionOfDistrict("Sylhet")).toBe("Sylhet");
    expect(divisionOfDistrict("Atlantis")).toBeUndefined();
    expect(districtsOf("Nowhere")).toEqual([]);
  });

  it("validates addresses against the data", () => {
    expect(isValidAddress("Dhaka", "Dhaka", "Mirpur")).toBe(true);
    expect(isValidAddress("Dhaka", "Dhaka")).toBe(true);
    expect(isValidAddress("Dhaka", "Dhaka", "Not A Place")).toBe(false);
    expect(isValidAddress("Sylhet", "Dhaka")).toBe(false);
    expect(isValidAddress("Nowhere", "Nowhere")).toBe(false);
  });
});
