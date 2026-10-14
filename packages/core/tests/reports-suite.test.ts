import { describe, expect, it } from "vitest";
import {
  createCsvDocument,
  escapeCsvCell,
  ForbiddenError,
  getCourierReport,
  getCustomerReport,
  getProductReport,
  getSalesReport,
  resolveReportRange,
  type StaffActor,
  ValidationError,
} from "../src";

const ownerActor: StaffActor = {
  userId: "user-owner",
  email: "owner@example.com",
  name: "Owner",
  role: "STORE_OWNER",
};

const packerActor: StaffActor = {
  userId: "user-packer",
  email: "packer@example.com",
  name: "Packer",
  role: "ORDER_PACKER",
};

describe("Reports Suite - Date Resolution Engine", () => {
  const fakeNow = new Date("2026-10-14T12:00:00Z");

  it("resolves last 7 days preset accurately", () => {
    const res = resolveReportRange({ range: "7" }, fakeNow);
    expect(res.days).toBe(7);
    expect(res.to).toBe("2026-10-14");
    expect(res.from).toBe("2026-10-08");
    expect(res.prevTo).toBe("2026-10-07");
    expect(res.prevFrom).toBe("2026-10-01");
  });

  it("resolves last 30 days preset accurately", () => {
    const res = resolveReportRange({ range: "30" }, fakeNow);
    expect(res.days).toBe(30);
    expect(res.to).toBe("2026-10-14");
    expect(res.from).toBe("2026-09-15");
  });

  it("resolves this month preset starting from day 1", () => {
    const res = resolveReportRange({ range: "month" }, fakeNow);
    expect(res.from).toBe("2026-10-01");
    expect(res.to).toBe("2026-10-14");
    expect(res.days).toBe(14);
  });

  it("resolves custom date range and computes matching prior window", () => {
    const res = resolveReportRange(
      { from: "2026-05-01", to: "2026-05-10" },
      fakeNow
    );
    expect(res.presetKey).toBe("custom");
    expect(res.from).toBe("2026-05-01");
    expect(res.to).toBe("2026-05-10");
    expect(res.days).toBe(10);
    expect(res.prevTo).toBe("2026-04-30");
    expect(res.prevFrom).toBe("2026-04-21");
  });

  it("validates from <= to and max days boundary", () => {
    expect(() =>
      resolveReportRange({ from: "2026-06-10", to: "2026-06-01" }, fakeNow)
    ).toThrow(ValidationError);

    expect(() =>
      resolveReportRange({ from: "2024-01-01", to: "2026-06-01" }, fakeNow)
    ).toThrow("Choose a date range of up to 400 days");
  });
});

describe("Reports Suite - Excel CSV Safety & UTF-8 BOM", () => {
  it("prepends UTF-8 BOM to CSV documents", () => {
    const doc = createCsvDocument([
      ["Header 1", "Header 2"],
      ["বিকাশ", "৳ 1,500"],
    ]);
    expect(doc.charCodeAt(0)).toBe(0xfeff);
    expect(doc).toContain('"বিকাশ"');
  });

  it("safely escapes formula injection and quotes in CSV cells", () => {
    expect(escapeCsvCell('=CMD("calc")')).toBe('"\'' + '=CMD(""calc"")"');
    expect(escapeCsvCell('@SUM(A1:A5)')).toBe('"\'' + '@SUM(A1:A5)"');
    expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(escapeCsvCell(null)).toBe('""');
  });
});

describe("Reports Suite - Role Permissions", () => {
  it("forbids non-report staff roles from fetching report analytics", async () => {
    const range = { from: "2026-10-01", to: "2026-10-14" };

    await expect(getSalesReport("t1", packerActor, range)).rejects.toThrow(
      ForbiddenError
    );
    await expect(getProductReport("t1", packerActor, range)).rejects.toThrow(
      ForbiddenError
    );
    await expect(getCourierReport("t1", packerActor, range)).rejects.toThrow(
      ForbiddenError
    );
    await expect(getCustomerReport("t1", packerActor, range)).rejects.toThrow(
      ForbiddenError
    );
  });
});
