import type { Metadata } from "next";
import Link from "next/link";
import { FraudCheckerTool } from "./fraud-checker-tool";
import { getRemainingDailyChecks } from "./actions";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "ফ্রি কুরিয়ার ফ্রড চেকার (Steadfast, Pathao, RedX)",
  description:
    "Steadfast, Pathao, RedX, CarryBee ও Paperfly থেকে এক ক্লিকে গ্রাহকের ডেলিভারি হিস্ট্রি যাচাই করুন। ১০০% ফ্রি COD ঝুঁকি চেকার, এখনই ব্যবহার করুন।",
  keywords: [
    "কুরিয়ার ফ্রড চেকার",
    "courier fraud checker bangladesh",
    "free fraud screening tool bangladesh",
    "steadfast fraud check",
    "pathao courier return checker",
    "redx delivery fraud check",
    "paperfly fraud checker",
    "cod return parcel protection",
    "ecommerce fraud bangladesh",
    "cash on delivery return loss",
  ],
  alternates: {
    canonical: `${siteUrl}/tools/courier-fraud-checker`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/tools/courier-fraud-checker`,
    siteName: "BizTrackBD",
    title: "ফ্রি কুরিয়ার ফ্রড চেকার | Multi-Courier Fraud Screening",
    description:
      "Steadfast, Pathao, RedX, CarryBee ও Paperfly থেকে মাত্র একটি ক্লিকে গ্রাহকের ডেলিভারি হিস্ট্রি যাচাই করে ক্যাশ-অন-ডেলিভারি রিটার্ন লস বন্ধ করুন।",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Courier Fraud Checker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ফ্রি কুরিয়ার ফ্রড চেকার | Multi-Courier Fraud Screening",
    description: "৫টি কুরিয়ার নেটওয়ার্কের অতীত ডেলিভারি হিস্ট্রি ও ফ্রড স্কোর যাচাই করুন।",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const structuredSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "BizTrackBD Multi-Courier Fraud Screening Engine",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web / Cloud",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "BDT",
      },
      description:
        "Instant cash-on-delivery return fraud screening engine aggregating Steadfast, Pathao, RedX, CarryBee, and Paperfly delivery metrics across Bangladesh.",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "কুরিয়ার ফ্রড চেকার কী এবং এটি কেন প্রয়োজন?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "কুরিয়ার ফ্রড চেকার হলো একটি ঝুঁকি যাচাই সিস্টেম যা কোনো ক্রেতার ফোন নম্বর দিয়ে Steadfast, Pathao, RedX, CarryBee ও Paperfly কুরিয়ারে তার অতীত পার্সেল ডেলিভারি ও রিটার্ন রেকর্ড যাচাই করে। এর মাধ্যমে অসাধু বা বারবার পার্সেল ফেরত দেওয়া গ্রাহকদের শনাক্ত করে রিটার্ন কুরিয়ার ফি অপচয় রোধ করা যায়।",
          },
        },
        {
          "@type": "Question",
          name: "এই ফ্রড চেকিং টুল কি সত্যিই ১০০% ফ্রি?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "হ্যাঁ, যেকোনো মার্চেন্ট পাবলিক টুলে প্রতিদিন ৫টি ফ্রি চেক সুবিধা ব্যবহার করতে পারেন এবং BizTrackBD প্ল্যাটফর্মের প্রতিটি স্টোরে এটি স্বয়ংক্রিয়ভাবে আনলিমিটেড অর্ডারে ব্যাকগ্রাউন্ডে কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "যাচাই করা ফোন নম্বর কি কোনো ডাটাবেসে সেভ বা মার্কেটিংয়ের জন্য ব্যবহার করা হয়?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "না, সম্পূর্ণ কঠোরভাবে না। BizTrackBD-এর জিরো-হারভেস্টিং চার্টার অনুযায়ী স্ক্রিনিংকৃত ফোন নম্বর কখনোই সংরক্ষণ, বিজ্ঞাপনের জন্য ব্যবহার বা কোনো প্রতিদ্বন্দ্বী মার্চেন্টের সাথে শেয়ার করা হয় না। এটি কেবল রিয়েল-টাইম কুরিয়ার মেট্রিক প্রদর্শনের জন্য ব্যবহৃত হয়।",
          },
        },
        {
          "@type": "Question",
          name: "একটি রিটার্ন পার্সেল বাতিল হলে কত টাকা ক্ষতি বাঁচে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "বাংলাদেশে গড়ে প্রতিটি রিটার্ন পার্সেলে মার্চেন্টের আনুমানিক ৳ ১৩৫ কুরিয়ার আসা-যাওয়ার চার্জ এবং ৳ ২৫ প্যাকেজিং বক্স নষ্ট বাবদ মোট ৳ ১৬০ সরাসরি নগদ লোকসান হয়।",
          },
        },
      ],
    },
  ],
};

export default async function CourierFraudCheckerPage() {
  const initialRemaining = await getRemainingDailyChecks();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-20">
      {/* Schema.org Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredSchema) }}
      />

      {/* Hero Header */}
      <section className="border-b border-[var(--border)] bg-[var(--surface-subtle)] py-14 md:py-18">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono mb-4">
            <span className="stamp stamp-paid text-[10px]">১০০% ফ্রি পাবলিক টুল</span>
            <span className="text-[var(--muted)]">৫টি কুরিয়ার নেটওয়ার্ক একীভূত</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] max-w-4xl mx-auto">
            ফ্রি কুরিয়ার ফ্রড স্ক্রিনিং ও রিটার্ন রিস্ক চেকার
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted)] max-w-3xl mx-auto leading-relaxed">
            বাংলাদেশের অনলাইন মার্চেন্টদের জন্য ইনস্ট্যান্ট ক্যাশ-অন-ডেলিভারি (সিওডি) ঝুঁকি যাচাই ইঞ্জিন।{" "}
            <strong>Steadfast, Pathao, RedX, CarryBee ও Paperfly</strong> থেকে মাত্র একটি ক্লিকে গ্রাহকের অতীত ডেলিভারি হিস্ট্রি যাচাই করুন।
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-mono text-[var(--muted)]">
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
              <span className="text-emerald-600 font-bold">✓</span> ইনস্ট্যান্ট কুরিয়ার ডাটাবেস
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
              <span className="text-emerald-600 font-bold">✓</span> দ্রুত রেসপন্স স্পিড
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
              <span className="text-emerald-600 font-bold">✓</span> নো ফোন নাম্বার হারভেস্টিং
            </span>
          </div>
        </div>
      </section>

      {/* Main Interactive Tool Container */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 mb-16">
        <FraudCheckerTool initialRemaining={initialRemaining} />
      </section>

      {/* Privacy Guarantee & Quota Transparency Box */}
      <section className="py-12 border-y border-[var(--border)] bg-[var(--surface-subtle)] mb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Privacy Charter */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="stamp stamp-paid text-[10px]">প্রাইভেসি প্রতিশ্রুতি</span>
                <h3 className="font-bold text-base text-[var(--foreground)]">
                  জিরো-হারভেস্টিং ফোন প্রাইভেসি গ্যারান্টি
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                আপনার অনুসন্ধানকৃত গ্রাহকের ফোন নম্বর BizTrackBD কখনোই কোনো মার্কেটিং ডাটাবেসে সেভ করে না, কোনো বিজ্ঞাপনী সংস্থাকে বিক্রি করে না এবং অন্য কোনো প্রতিযোগীর কাছে শেয়ার করে না। সম্পূর্ণ কুয়েরি মেমোরি-অনলি রিয়েল-টাইম কুরিয়ার নোডের মাধ্যমে সম্পাদিত হয়।
              </p>
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                <span>🛡️</span>
                <span>এনক্রিপ্টেড কুয়েরি · জিরো ট্র্যাকিং ডাটাবেস</span>
              </div>
            </div>

            {/* Quota Transparency */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="stamp stamp-review text-[10px]">কোটাসমূহ</span>
                <h3 className="font-bold text-base text-[var(--foreground)]">
                  দৈনিক ৫টি ফ্রি পাবলিক চেক ও আনলিমিটেড মার্চেন্ট ডেক্স
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                সার্ভার অপব্যবহার রোধে পাবলিক ওয়েব টুলে প্রতিদিন প্রতি ব্রাউজারে ৫টি ফ্রি স্ক্রিনিং সীমাবদ্ধ রয়েছে। আপনি যদি BizTrackBD স্টোর পরিচালনা করেন, তবে প্রতিটি ইনকামিং অর্ডারে এই ফ্রড স্ক্রিনিং স্বয়ংক্রিয়ভাবে ব্যাকগ্রাউন্ডে আনলিমিটেড আনলক থাকে।
              </p>
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">সব অর্ডারে অটোমেটিক স্ক্রিনিং চান?</span>
                <a
                  href={demoAdminUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[var(--primary)] hover:underline"
                >
                  লাইভ ডেমো দেখুন →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Refused Parcel Loss Estimator */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-16">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 shadow-xs">
          <div className="mb-6">
            <span className="stamp stamp-risk text-[10px]">আর্থিক লোকসান রোধ</span>
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mt-2">
              ১টি রিটার্ন পার্সেল ঠেকানো মানে কত টাকার সরাসরি সেভিংস?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              বাংলাদেশের অনলাইন ব্যবসায় প্রতিটি আনডেলিভার্ড সিওডি পার্সেলের বাস্তব আর্থিক হিসাব:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[var(--muted)] font-sans">কুরিয়ার রিটার্ন চার্জ</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">৳ ১৩৫</div>
              <div className="text-[10px] text-[var(--muted)] mt-1 font-sans">আসা-যাওয়ার ডেলিভারি ফি</div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[var(--muted)] font-sans">নষ্ট প্যাকেজিং ম্যাটেরিয়াল</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">৳ ২৫</div>
              <div className="text-[10px] text-[var(--muted)] mt-1 font-sans">বক্স, বাবল র‍্যাপ ও বারকোড স্টিকার</div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                প্রতি পার্সেলে মোট ক্ষতি
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">৳ ১৬০</div>
              <div className="text-[10px] text-[var(--muted)] mt-1 font-sans">সরাসরি বাঁচানো সম্ভব</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted)] leading-relaxed">
            মাসে যদি আপনার ৫০টি পার্সেল রিটার্ন আসে, তবে শুধু কুরিয়ার ফি ও প্যাকেজিং নষ্ট বাবদ <strong>৳ ৮,০০০ টাকা</strong> সম্পূর্ণ জলে যায়। সন্দেহজনক পার্সেল চিহ্নিত করে অগ্রিম ডেলিভারি চার্জ নেওয়ার মাধ্যমে এই সম্পূর্ণ অপচয় বন্ধ করা যায়।
          </div>
        </div>
      </section>

      {/* Educational Guide: Why COD Protection is Critical */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            কেন প্রতিটি ক্যাশ-অন-ডেলিভারি অর্ডার যাচাই করা জরুরি?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] max-w-2xl mx-auto mt-2 leading-relaxed">
            বাংলাদেশে ই-কমার্সে উল্লেখযোগ্য সংখ্যক পার্সেল ডেলিভারি না হয়ে রিটার্ন আসে। গ্রাহকের অতীত ট্র্যাক রেকর্ড আগে থেকেই জেনে সিদ্ধান্ত নিন।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
            <div className="text-2xl mb-3">💸</div>
            <h3 className="font-bold text-base text-[var(--foreground)] mb-2">
              নগদ মূলধন ও পণ্যের নিরাপত্তা
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              পার্সেল ৭-১০ দিন কুরিয়ার ভ্যানে আটকে থাকলে ড্যামেজ হওয়ার ঝুঁকি বাড়ে এবং সিজনাল স্টক ব্লকেজ তৈরি হয়।
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
            <div className="text-2xl mb-3">📦</div>
            <h3 className="font-bold text-base text-[var(--foreground)] mb-2">
              ৫টি কুরিয়ারের সমন্বিত তথ্য
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              গ্রাহক হয়তো পাঠাওতে কম পার্সেল নিয়েছে কিন্তু স্টিডফাস্টে নিয়মিত রিটার্ন করেছে—একীভূত এপিআই দিয়ে সম্পূর্ণ চিত্র পাবেন।
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="font-bold text-base text-[var(--foreground)] mb-2">
              সাব-২০ms আল্ট্রা ফাস্ট রেসপন্স
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              ইন-মেমোরি ক্যাশিং প্রযুক্তির কারণে যেকোনো চেকআউট বা ব্যাকগ্রাউন্ড স্ক্রিনিং কোনো প্রকার স্লো না করেই তাৎক্ষণিক রেজাল্ট দেয়।
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            সাধারণ জিজ্ঞাসা (FAQ)
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            টুল ব্যবহারের নিয়ম, প্রাইভেসি ও এপিআই সম্পর্কিত উত্তর।
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "কুরিয়ার ফ্রড চেকার কীভাবে আমার ব্যবসার টাকা বাঁচায়?",
              a: "অনেক ক্রেতা একই সাথে বিভিন্ন পেজে বা শপে ক্যাশ অন ডেলিভারিতে অর্ডার করে ডেলিভারির সময় ফোন বন্ধ রাখেন বা পার্সেল ফেরত দেন। ফ্রড চেকারের মাধ্যমে তাদের অতীতের রিটার্ন পার্সেল রেট দেখে অর্ডার কনফার্ম করার আগেই যাচাই বা অগ্রিম ডেলিভারি চার্জ নেওয়া সম্ভব হয়।",
            },
            {
              q: "এই টুল ব্যবহার করার জন্য কি আমার নিজস্ব কুরিয়ার অ্যাকাউন্টের প্রয়োজন আছে?",
              a: "না! এই পাবলিক টুল ব্যবহার করার জন্য কোনো নির্দিষ্ট কুরিয়ার অ্যাকাউন্টের প্রয়োজন নেই। এটি কেন্দ্রীয় পাবলিক ডাটাবেস ও একীভূত কুরিয়ার নেটওয়ার্ক থেকে ডাটা সংগ্রহ করে।",
            },
            {
              q: "BizTrackBD প্ল্যাটফর্মে এটি কীভাবে স্বয়ংক্রিয়ভাবে কাজ করে?",
              a: "BizTrackBD-তে আপনার ই-কমার্স ওয়েবসাইট তৈরি করলে প্রতিটি গ্রাহকের অর্ডারের সাথে সাথেই ব্যাকগ্রাউন্ডে এই ৫টি কুরিয়ার ডাটা স্ক্যান হয় এবং 50% কুরিয়ার স্কোর + 30% প্ল্যাটফর্ম ট্রাস্ট + 20% স্টোর হিস্ট্রি মিলিয়ে অটোমেটিক ফ্রড লেভেল নির্ধারণ করে দেওয়া হয়।",
            },
            {
              q: "সার্চ রেজাল্ট কত দ্রুত আসে?",
              a: "আমাদের ইঞ্জিনে ১৫ দিনের ইন-মেমোরি ক্যাশিং প্রযুক্তি রয়েছে। ফলে যে নম্বরগুলো ইতিমধ্যেই যাচাই হয়েছে, সেগুলোর উত্তর দ্রুত কয়েক মিলিসেকেন্ডের মধ্যেই স্ক্রিনে প্রদর্শিত হয়।",
            },
            {
              q: "অন্যান্য মার্চেন্টদের কমপ্লেন রিপোর্ট কীভাবে কাজে লাগে?",
              a: "যদি কোনো গ্রাহক ইতিপূর্বে কোনো মার্চেন্টের পার্সেল উদ্দেশ্যপ্রণোদিতভাবে না নিয়ে হয়রানি করে থাকে এবং মার্চেন্ট কমপ্লেন জমা দিয়ে থাকে, তবে সেই সতর্কবার্তা আপনি সরাসরি রেজাল্ট কার্ডে দেখতে পাবেন।",
            },
          ].map((faq, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-sm font-bold text-[var(--foreground)]">{faq.q}</h3>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Conversion CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] p-8 md:p-12 text-center shadow-xs">
          <span className="stamp stamp-paid text-[10px]">অটোমেটিক স্ক্রিনিং</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mt-3">
            প্রতিটি অর্ডারে স্বয়ংক্রিয় কুরিয়ার ফ্রড প্রোটেকশন চান?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] max-w-2xl mx-auto mt-2 leading-relaxed">
            BizTrackBD-তে আপনার নিজস্ব ব্র্যান্ডেড ই-কমার্স স্টোর চালু করুন। ০% সেলস কমিশনে অটোমেটিক কুরিয়ার বুকিং, লাইভ ট্র্যাকিং এবং ব্যাকগ্রাউন্ড ফ্রড প্রোটেকশন উপভোগ করুন।
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/start"
              className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-xs sm:text-sm font-bold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
            >
              ১৪ দিনের ফ্রি ট্রায়াল শুরু করুন →
            </Link>
            <a
              href={demoAdminUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition"
            >
              লাইভ অ্যাডমিন ডেস্কে দেখুন
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
