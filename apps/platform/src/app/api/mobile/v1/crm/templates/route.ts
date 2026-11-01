import { NextResponse } from "next/server";
import { listPlatformCrmTemplates } from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const FALLBACK_TEMPLATES = [
  {
    id: "crm_tmpl_welcome_bn",
    key: "welcome_bn",
    title: "Welcome & Greeting (বাংলা)",
    body: 'আসসালামু আলাইকুম {ownerName} ভাই! BizTrack BD-তে স্বাগতম। আপনার নতুন স্টোর "{storeName}" ({subdomain}.biztrack.bd) তৈরি হয়েছে দেখেছি। আপনার স্টোর লাইভ করতে বা প্রোডাক্ট আপলোডে কোনো সহায়তা লাগলে আমাকে সরাসরি জানাতে পারেন। শুভকামনা!',
    language: "bn",
    isDefault: true,
  },
  {
    id: "crm_tmpl_setup_help_bn",
    key: "setup_help_bn",
    title: "Free Setup Assistance (বাংলা)",
    body: "হ্যালো {ownerName}, BizTrack BD মার্চেন্ট সাপোর্ট থেকে বলছি। আপনার স্টোরের থিম ডিজাইন ও bKash/Nagad পেমেন্ট সেটআপের জন্য আমরা কি একটি ছোট ফ্রি ডেমো কলে আপনাকে গাইড করতে পারি? আপনি কখন ফ্রি আছেন জানাবেন।",
    language: "bn",
    isDefault: true,
  },
  {
    id: "crm_tmpl_domain_help_bn",
    key: "domain_help_bn",
    title: "Custom Domain Setup (বাংলা)",
    body: "আসসালামু আলাইকুম {ownerName}, আপনার স্টোরে কি নিজস্ব ব্র্যান্ড ডোমেন (.com বা .com.bd) যুক্ত করতে চান? আমাদের টিম সম্পূর্ণ ফ্রিতে আপনার ডোমেন ও SSL কনফিগারেশন করে দিচ্ছে। সাহায্য লাগলে জানাবেন।",
    language: "bn",
    isDefault: true,
  },
  {
    id: "crm_tmpl_trial_checkin_bn",
    key: "trial_checkin_bn",
    title: "Trial Ending Reminder (বাংলা)",
    body: "প্রিয় {ownerName}, আপনার BizTrack BD স্টোরের ফ্রি ট্রায়ালের মেয়াদ শেষ হতে আর মাত্র কয়েক দিন বাকি। আপনার শপটি চালু রাখতে এবং আকর্ষণীয় অফার পেতে এখনই যোগাযোগ করুন।",
    language: "bn",
    isDefault: true,
  },
  {
    id: "crm_tmpl_welcome_en",
    key: "welcome_en",
    title: "Welcome & Onboarding (English)",
    body: 'Hello {ownerName}! Welcome to BizTrack BD. We noticed you just created "{storeName}" ({storeUrl}). Let us know if you need any assistance adding products, configuring payments, or setting up your custom domain!',
    language: "en",
    isDefault: true,
  },
];

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const rawTemplates = await listPlatformCrmTemplates().catch(() => []);
    const templates = rawTemplates.length > 0 ? rawTemplates : FALLBACK_TEMPLATES;

    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("Platform mobile CRM templates error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load CRM templates.", templates: FALLBACK_TEMPLATES },
      { status: 500 }
    );
  }
}
