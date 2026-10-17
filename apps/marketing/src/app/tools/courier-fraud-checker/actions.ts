"use server";

import { headers, cookies } from "next/headers";
import {
  fetchUnifiedCourierFraud,
  normalizeBdPhone,
  type ExternalCourierFraudData,
  verifyDeviceToken,
  resolveClientIp,
  hashClientIp,
  checkPublicToolQuota,
  incrementPublicToolQuota,
  MAX_DEVICE_DAILY_CHECKS,
  PUBLIC_TOOL_COURIER_FRAUD,
} from "@biztrackbd/core";

export interface FraudCheckResult {
  success: boolean;
  data?: ExternalCourierFraudData;
  rateLimited?: boolean;
  remainingChecks: number;
  error?: string;
}

const DEVICE_COOKIE_NAME = "bt_dev_sig_v1";

async function getOrAssignDeviceIdentity(): Promise<{ deviceId: string; signedToken: string; isNew: boolean }> {
  const reqCookies = await cookies();
  const rawToken = reqCookies.get(DEVICE_COOKIE_NAME)?.value;
  const verified = verifyDeviceToken(rawToken);

  if (!verified.valid) {
    reqCookies.set(DEVICE_COOKIE_NAME, verified.signedToken, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return { deviceId: verified.deviceId, signedToken: verified.signedToken, isNew: true };
  }

  return { deviceId: verified.deviceId, signedToken: verified.signedToken, isNew: false };
}

export async function getRemainingDailyChecks(): Promise<number> {
  try {
    const reqHeaders = await headers();
    const { deviceId } = await getOrAssignDeviceIdentity();
    const clientIp = resolveClientIp(reqHeaders);
    const ipHash = hashClientIp(clientIp);

    const quota = await checkPublicToolQuota({
      deviceId,
      ipHash,
      tool: PUBLIC_TOOL_COURIER_FRAUD,
    });

    return quota.remainingChecks;
  } catch (err) {
    console.error("[getRemainingDailyChecks] error", err);
    return MAX_DEVICE_DAILY_CHECKS;
  }
}

export async function checkCourierFraudAction(phoneInput: string): Promise<FraudCheckResult> {
  const reqHeaders = await headers();
  const reqCookies = await cookies();

  let phone: string;
  try {
    phone = normalizeBdPhone(phoneInput);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      const remaining = await getRemainingDailyChecks();
      return {
        success: false,
        remainingChecks: remaining,
        error: "অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।",
      };
    }
  } catch {
    const remaining = await getRemainingDailyChecks();
    return {
      success: false,
      remainingChecks: remaining,
      error: "সঠিক মোবাইল নম্বর পাওয়া যায়নি। নম্বরটি ভালো করে চেক করুন।",
    };
  }

  const { deviceId, signedToken } = await getOrAssignDeviceIdentity();
  const clientIp = resolveClientIp(reqHeaders);
  const ipHash = hashClientIp(clientIp);

  // Check quota across device, IP ceiling, and burst limits
  const quotaCheck = await checkPublicToolQuota({
    deviceId,
    ipHash,
    tool: PUBLIC_TOOL_COURIER_FRAUD,
  });

  if (!quotaCheck.allowed) {
    let errorMessage =
      "আজকের জন্য আপনার ৫টি ফ্রি সার্চ কোটা পূর্ণ হয়েছে। আপনার স্টোরে আনলিমিটেড রিয়েল-টাইম ফ্রড গার্ড সক্রিয় করতে ফ্রি একাউন্ট তৈরি করুন।";

    if (quotaCheck.reason === "BURST_EXCEEDED") {
      errorMessage = "খুব দ্রুত অনুসন্ধান করা হয়েছে। অনুগ্রহ করে এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।";
    } else if (quotaCheck.reason === "IP_CEILING_EXCEEDED") {
      errorMessage =
        "আপনার নেটওয়ার্ক থেকে দৈনিক সর্বোচ্চ ফ্রি ফ্রড চেক কোটা পূর্ণ হয়েছে। আনলিমিটেড সিকিউরিটি পেতে বিজট্র্যাকবিডিতে রেজিস্ট্রেশন করুন।";
    }

    return {
      success: false,
      rateLimited: true,
      remainingChecks: 0,
      error: errorMessage,
    };
  }

  try {
    const fraudData = await fetchUnifiedCourierFraud(phone);

    if (!fraudData) {
      // Upstream courier service unavailable - do NOT decrement quota and do NOT fabricate safe score (RISK-001)
      return {
        success: false,
        remainingChecks: quotaCheck.remainingChecks,
        error:
          "কুরিয়ার ডাটাবেজ সাময়িকভাবে অনুপলব্ধ। কোনো ঝুঁকি মূল্যায়ন করা সম্ভব হয়নি। আপনার ফ্রি কোটা কাটা হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
      };
    }

    // Atomically increment quota only upon successful upstream response
    const incResult = await incrementPublicToolQuota({
      deviceId,
      ipHash,
      tool: PUBLIC_TOOL_COURIER_FRAUD,
    });

    // Ensure device token cookie is refreshed
    reqCookies.set(DEVICE_COOKIE_NAME, signedToken, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return {
      success: true,
      data: fraudData,
      remainingChecks: incResult.remainingChecks,
    };
  } catch (err) {
    console.error("[fraud-checker action] error", err);
    return {
      success: false,
      remainingChecks: quotaCheck.remainingChecks,
      error: "কুরিয়ার সার্ভারে সংযোগ করতে সমস্যা হয়েছে। আপনার ফ্রি কোটা কাটা হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
    };
  }
}
