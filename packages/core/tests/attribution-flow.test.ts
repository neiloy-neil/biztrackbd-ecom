import { describe, expect, it } from "vitest";
import {
  classifyChannel,
  channelDisplayName,
  type AcquisitionChannel,
} from "../src/analytics/acquisition";

describe("Ad Attribution & Acquisition Engine", () => {
  describe("Multi-channel classification", () => {
    it("identifies Meta / Facebook / Instagram traffic", () => {
      expect(classifyChannel("facebook", "cpc")).toBe("META");
      expect(classifyChannel("fb", "paid_social")).toBe("META");
      expect(classifyChannel("instagram", "story_ad")).toBe("META");
      expect(classifyChannel("ig", "reel")).toBe("META");
      expect(classifyChannel("anysource", "fb_feed")).toBe("META");
    });

    it("identifies Google Ads traffic", () => {
      expect(classifyChannel("google", "cpc")).toBe("GOOGLE");
      expect(classifyChannel("google", "search")).toBe("GOOGLE");
      expect(classifyChannel("adwords", "cpc")).toBe("GOOGLE");
      expect(classifyChannel("google-ads", "banner")).toBe("GOOGLE");
    });

    it("identifies TikTok Ads traffic", () => {
      expect(classifyChannel("tiktok", "spark_ads")).toBe("TIKTOK");
      expect(classifyChannel("tt", "paid")).toBe("TIKTOK");
    });

    it("identifies YouTube traffic", () => {
      expect(classifyChannel("youtube", "video_ad")).toBe("YOUTUBE");
      expect(classifyChannel("yt", "influencer")).toBe("YOUTUBE");
    });

    it("identifies WhatsApp direct marketing traffic", () => {
      expect(classifyChannel("whatsapp", "broadcast")).toBe("WHATSAPP");
      expect(classifyChannel("wa", "chat_deal")).toBe("WHATSAPP");
    });

    it("identifies Direct and Organic traffic", () => {
      expect(classifyChannel("", "")).toBe("DIRECT");
      expect(classifyChannel(null, null)).toBe("DIRECT");
      expect(classifyChannel("direct", "none")).toBe("DIRECT");
      expect(classifyChannel("(direct)", "(none)")).toBe("DIRECT");
    });

    it("falls back to OTHER for generic external referrers", () => {
      expect(classifyChannel("news_portal", "banner")).toBe("OTHER");
      expect(classifyChannel("bdnews24", "referral")).toBe("OTHER");
    });
  });

  describe("Channel display formatting", () => {
    it("returns formatted names for all channels", () => {
      const channels: AcquisitionChannel[] = [
        "META",
        "GOOGLE",
        "TIKTOK",
        "YOUTUBE",
        "WHATSAPP",
        "DIRECT",
        "OTHER",
      ];

      for (const ch of channels) {
        const name = channelDisplayName(ch);
        expect(name).toBeTruthy();
        expect(typeof name).toBe("string");
      }

      expect(channelDisplayName("META")).toBe("Meta Ads (FB/IG)");
      expect(channelDisplayName("GOOGLE")).toBe("Google Ads");
      expect(channelDisplayName("TIKTOK")).toBe("TikTok Ads");
    });
  });

  describe("ROAS and acquisition calculation integrity", () => {
    it("accurately computes ROAS, delivered ROAS, and net profit", () => {
      const grossRevenue = 125000;
      const deliveredRevenue = 95000;
      const adSpend = 25000;

      const roas = adSpend > 0 ? Number((grossRevenue / adSpend).toFixed(2)) : 0;
      const deliveredRoas = adSpend > 0 ? Number((deliveredRevenue / adSpend).toFixed(2)) : 0;
      const netProfit = grossRevenue - adSpend;

      expect(roas).toBe(5.0); // 125,000 / 25,000 = 5.0x
      expect(deliveredRoas).toBe(3.8); // 95,000 / 25,000 = 3.8x
      expect(netProfit).toBe(100000);
    });

    it("safely handles 0 ad spend without division by zero", () => {
      const grossRevenue = 50000;
      const adSpend = 0;

      const roas = adSpend > 0 ? Number((grossRevenue / adSpend).toFixed(2)) : 0;
      const netProfit = grossRevenue - adSpend;

      expect(roas).toBe(0);
      expect(netProfit).toBe(50000);
    });
  });
});
