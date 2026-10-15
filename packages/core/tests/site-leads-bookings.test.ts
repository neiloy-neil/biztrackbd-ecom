import { describe, expect, it } from "vitest";
import { createPublicLead } from "../src/site/leads";
import { createPublicBooking } from "../src/site/bookings";

describe("BizTrack Business Leads & Bookings Bot Shield & Validation", () => {
  it("silently shields bot submissions with honeypot filled on leads", async () => {
    const res = await createPublicLead("dummy-tenant", {
      name: "Spam Bot",
      phone: "01700000000",
      hp: "http://spam-link.com",
    });
    expect(res.status).toBe("SPAM");
    expect(res.id).toBe("lead_bot_shielded");
  });

  it("silently shields rapid bot submissions (elapsedMs < 1500) on leads", async () => {
    const res = await createPublicLead("dummy-tenant", {
      name: "Fast Bot",
      phone: "01700000000",
      elapsedMs: 250,
    });
    expect(res.status).toBe("SPAM");
    expect(res.id).toBe("lead_bot_speed_shielded");
  });

  it("validates required name field on leads", async () => {
    await expect(
      createPublicLead("dummy-tenant", {
        name: "A",
        phone: "01700000000",
        elapsedMs: 3000,
      })
    ).rejects.toThrow(/at least 2 characters/);
  });

  it("validates contact method (phone or email) on leads", async () => {
    await expect(
      createPublicLead("dummy-tenant", {
        name: "Rahim Ahmed",
        elapsedMs: 3000,
      })
    ).rejects.toThrow(/phone number or an email/);
  });

  it("silently shields bot submissions with honeypot filled on bookings", async () => {
    const res = await createPublicBooking("dummy-tenant", {
      name: "Spam Bot",
      phone: "01700000000",
      hp: "spam-bot",
    });
    expect(res.bookingId).toBe("bk_shielded");
  });

  it("silently shields rapid submissions on bookings", async () => {
    const res = await createPublicBooking("dummy-tenant", {
      name: "Rapid Bot",
      phone: "01700000000",
      elapsedMs: 400,
    });
    expect(res.bookingId).toBe("bk_speed_shielded");
  });
});
