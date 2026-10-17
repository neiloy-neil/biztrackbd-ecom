"use server";

import { headers, cookies } from "next/headers";
import {
  fetchUnifiedCourierFraud,
  normalizeBdPhone,
  type ExternalCourierFraudData,
} from "@biztrackbd/core";

export interface FraudCheckResult {
  success: boolean;
  data?: ExternalCourierFraudData;
  rateLimited?: boolean;
  remainingChecks: number;
  error?: string;
}

const MAX_FREE_DAILY_CHECKS = 5;

// In-memory rate limiting map keyed by IP and date
const ipDailyChecks = new Map<string, { count: number; dateStr: string }>();

function getDhakaDateStr(): string {
  // Returns YYYY-MM-DD in UTC+6
  const now = new Date(Date.now() + 6 * 3600_000);
  return now.toISOString().slice(0, 10);
}

export async function getRemainingDailyChecks(): Promise<number> {
  const reqCookies = await cookies();
  const today = getDhakaDateStr();
  const val = reqCookies.get("bt_fraud_usage")?.value;
  if (!val) return MAX_FREE_DAILY_CHECKS;
  try {
    const [d, c] = val.split(":");
    if (d === today) {
      const count = parseInt(c || "0", 10);
      return Math.max(0, MAX_FREE_DAILY_CHECKS - (isNaN(count) ? 0 : count));
    }
  } catch {
    // ignore
  }
  return MAX_FREE_DAILY_CHECKS;
}

export async function checkCourierFraudAction(phoneInput: string): Promise<FraudCheckResult> {
  const reqHeaders = await headers();
  const reqCookies = await cookies();

  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    "local-ip";

  const clientCookieId = reqCookies.get("bt_fraud_client_id")?.value || ip;
  const today = getDhakaDateStr();
  const trackerKey = `${clientCookieId}_${today}`;

  // Read persisted usage from cookie first, fallback to in-memory tracker
  let count = 0;
  const val = reqCookies.get("bt_fraud_usage")?.value;
  if (val) {
    const [d, c] = val.split(":");
    if (d === today) {
      count = parseInt(c || "0", 10);
      if (isNaN(count)) count = 0;
    }
  }
  const mem = ipDailyChecks.get(trackerKey);
  if (mem && mem.dateStr === today && mem.count > count) {
    count = mem.count;
  }

  if (count >= MAX_FREE_DAILY_CHECKS) {
    return {
      success: false,
      rateLimited: true,
      remainingChecks: 0,
      error:
        "আজকের জন্য আপনার ৫টি ফ্রি সার্চ কোটা পূর্ণ হয়েছে। আপনার স্টোরে আনলিমিটেড রিয়েল-টাইম ফ্রড গার্ড সক্রিয় করতে ফ্রি একাউন্ট তৈরি করুন।",
    };
  }

  let phone: string;
  try {
    phone = normalizeBdPhone(phoneInput);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return {
        success: false,
        remainingChecks: Math.max(0, MAX_FREE_DAILY_CHECKS - count),
        error: "অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।",
      };
    }
  } catch {
    return {
      success: false,
      remainingChecks: Math.max(0, MAX_FREE_DAILY_CHECKS - count),
      error: "সঠিক মোবাইল নম্বর পাওয়া যায়নি। নম্বরটি ভালো করে চেক করুন।",
    };
  }

  try {
    const fraudData = await fetchUnifiedCourierFraud(phone);

    if (!fraudData) {
      // Upstream courier service unavailable - do NOT decrement quota and do NOT fabricate safe score
      return {
        success: false,
        remainingChecks: Math.max(0, MAX_FREE_DAILY_CHECKS - count),
        error: "কুরিয়ার ডাটাবেজ সাময়িকভাবে অনুপলব্ধ। কোনো ঝুঁকি মূল্যায়ন করা সম্ভব হয়নি। আপনার ফ্রি কোটা কাটা হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
      };
    }

    // Increment usage count only upon successful data retrieval
    count += 1;
    ipDailyChecks.set(trackerKey, { count, dateStr: today });
    reqCookies.set("bt_fraud_usage", `${today}:${count}`, {
      maxAge: 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    // Set cookie for browser session tracking if not set
    if (!reqCookies.get("bt_fraud_client_id")?.value) {
      reqCookies.set("bt_fraud_client_id", `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, {
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return {
      success: true,
      data: fraudData,
      remainingChecks: Math.max(0, MAX_FREE_DAILY_CHECKS - count),
    };
  } catch (err) {
    console.error("[fraud-checker action] error", err);
    return {
      success: false,
      remainingChecks: Math.max(0, MAX_FREE_DAILY_CHECKS - count),
      error: "কুরিয়ার সার্ভারে সংযোগ করতে সমস্যা হয়েছে। আপনার ফ্রি কোটা কাটা হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
    };
  }
}
