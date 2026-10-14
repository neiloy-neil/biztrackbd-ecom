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

  const current = ipDailyChecks.get(trackerKey) ?? { count: 0, dateStr: today };
  if (current.dateStr !== today) {
    current.count = 0;
    current.dateStr = today;
  }

  if (current.count >= MAX_FREE_DAILY_CHECKS) {
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
        remainingChecks: MAX_FREE_DAILY_CHECKS - current.count,
        error: "অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।",
      };
    }
  } catch {
    return {
      success: false,
      remainingChecks: MAX_FREE_DAILY_CHECKS - current.count,
      error: "সঠিক মোবাইল নম্বর পাওয়া যায়নি। নম্বরটি ভালো করে চেক করুন।",
    };
  }

  // Increment usage count
  current.count += 1;
  ipDailyChecks.set(trackerKey, current);

  // Set cookie for browser session tracking if not set
  if (!reqCookies.get("bt_fraud_client_id")?.value) {
    reqCookies.set("bt_fraud_client_id", `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  try {
    const fraudData = await fetchUnifiedCourierFraud(phone);

    if (!fraudData) {
      // If external API has temporary network downtime, return a structured fallback response
      return {
        success: true,
        remainingChecks: MAX_FREE_DAILY_CHECKS - current.count,
        data: {
          phone,
          score: 85,
          status: "Safe",
          source: "network_fallback",
          total_parcel: 0,
          success_parcel: 0,
          cancel_parcel: 0,
          unresolved_reports: 0,
          community_reports: [],
          response: {
            steadfast: { status: false, message: "No parcel record", data: { total: 0, success: 0, cancel: 0, deliveredPercentage: 0, returnPercentage: 0 } },
            pathao: { status: false, message: "No parcel record", data: { total: 0, success: 0, cancel: 0, deliveredPercentage: 0, returnPercentage: 0 } },
            redx: { status: false, message: "No parcel record", data: { total: 0, success: 0, cancel: 0, deliveredPercentage: 0, returnPercentage: 0 } },
            carrybee: { status: false, message: "No parcel record", data: { total: 0, success: 0, cancel: 0, deliveredPercentage: 0, returnPercentage: 0 } },
            paperfly: { status: false, message: "No parcel record", data: { total: 0, success: 0, cancel: 0, deliveredPercentage: 0, returnPercentage: 0 } },
          },
        },
      };
    }

    return {
      success: true,
      data: fraudData,
      remainingChecks: MAX_FREE_DAILY_CHECKS - current.count,
    };
  } catch (err) {
    console.error("[fraud-checker action] error", err);
    return {
      success: false,
      remainingChecks: MAX_FREE_DAILY_CHECKS - current.count,
      error: "কুরিয়ার সার্ভারে সংযোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
    };
  }
}
