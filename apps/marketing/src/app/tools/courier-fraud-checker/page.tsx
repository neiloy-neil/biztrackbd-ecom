import type { Metadata } from "next";
import Link from "next/link";
import { FraudCheckerTool } from "./fraud-checker-tool";
import { getRemainingDailyChecks } from "./actions";

export const metadata: Metadata = {
  title: "ফ্রি কুরিয়ার ফ্রড চেকার REST API | Bangladesh Multi-Courier Fraud Screening",
  description:
    "বাংলাদেশের অনলাইন মার্চেন্টদের জন্য ইনস্ট্যান্ট ক্যাশ-অন-ডেলিভারি (সিওডি) ঝুঁকি যাচাই ইঞ্জিন। Steadfast, Pathao, RedX, CarryBee ও Paperfly থেকে মাত্র ১টি রিকোয়েস্টে গ্রাহকের অতীত ডেলিভারি হিস্ট্রি যাচাই করুন। ১০০% ফ্রি ডেভেলপার REST API।",
  keywords: [
    "কুরিয়ার ফ্রড চেকার",
    "courier fraud checker bangladesh",
    "free fraud screening api bangladesh",
    "steadfast fraud check",
    "pathao courier return checker",
    "redx delivery fraud check",
    "carrybee fraud api",
    "paperfly fraud checker",
    "cod return parcel protection",
    "ecommerce fraud bangladesh",
    "cash on delivery return loss",
  ],
  openGraph: {
    title: "ফ্রি কুরিয়ার ফ্রড চেকার REST API | BizTrackBD",
    description:
      "Steadfast, Pathao, RedX, CarryBee ও Paperfly থেকে মাত্র একটি রিকোয়েস্টে গ্রাহকের ডেলিভারি হিস্ট্রি যাচাই করে ক্যাশ-অন-ডেলিভারি রিটার্ন লস বন্ধ করুন।",
    type: "website",
    url: "https://biztrack.bd/tools/courier-fraud-checker",
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
          name: "এই ফ্রড চেকিং API কি সত্যিই ১০০% ফ্রি?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "হ্যাঁ, ডেভেলপার এবং যেকোনো মার্চেন্ট X-API-KEY হেডারের মাধ্যমে এই ফ্রি REST API ব্যবহার করতে পারেন। পাবলিক টুলে প্রতিদিন ৫টি ফ্রি চেক সুবিধা রয়েছে এবং BizTrackBD প্ল্যাটফর্মের প্রতিটি স্টোরে এটি স্বয়ংক্রিয়ভাবে আনলিমিটেড অর্ডারে ব্যাকগ্রাউন্ডে কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "কোন কোন কুরিয়ার নেটওয়ার্কের হিস্ট্রি এতে অন্তর্ভুক্ত?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "বাংলাদেশের শীর্ষ ৫টি ই-কমার্স ডেলিভারি নেটওয়ার্ক: Steadfast Courier, Pathao Courier, RedX Logistics, CarryBee ও Paperfly-এর একীভূত পার্সেল হিস্ট্রি এই ইঞ্জিনে সংযুক্ত।",
          },
        },
        {
          "@type": "Question",
          name: "BizTrackBD ইকমার্স প্ল্যাটফর্মে এটি কীভাবে কাজ করে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BizTrackBD প্ল্যাটফর্মে কোনো অতিরিক্ত কোডিং ছাড়াই নতুন যেকোনো অর্ডার প্লেস হওয়ার সাথে সাথে এই ৫-কুরিয়ার ফ্রড স্কোর (৫০%), প্ল্যাটফর্ম ট্রাস্ট (৩০%) এবং স্টোর হিস্ট্রি (২০%) একীভূত হয়ে স্বয়ংক্রিয়ভাবে অর্ডার সেফটি লেভেল নির্ধারণ করে এবং ঝুঁকিপূর্ণ অর্ডারকে রিভিউয়ের জন্য হোল্ড করে রাখে।",
          },
        },
      ],
    },
  ],
};

export default async function CourierFraudCheckerPage() {
  const initialRemaining = await getRemainingDailyChecks();
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", color: "#0F172A", paddingBottom: "80px" }}>
      {/* Schema.org Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredSchema) }}
      />

      {/* Hero Header */}
      <section
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)",
          borderBottom: "1px solid #E2E8F0",
          padding: "60px 20px 48px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          {/* Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#EEF2FF",
              border: "1px solid #C7D2FE",
              color: "#3730A3",
              padding: "6px 16px",
              borderRadius: "30px",
              fontSize: "13.5px",
              fontWeight: 700,
              marginBottom: "20px",
            }}
          >
            <span>🛡️</span>
            <span>১০০% ফ্রি ডেভেলপার REST API ও স্ক্রিনিং টুল</span>
          </div>

          <h1
            style={{
              fontSize: "clamp(28px, 4.5vw, 46px)",
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#0F172A",
              letterSpacing: "-0.8px",
              margin: "0 0 16px",
            }}
          >
            ফ্রি কুরিয়ার ফ্রড স্ক্রিনিং REST API
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              color: "#475569",
              lineHeight: 1.6,
              maxWidth: "740px",
              margin: "0 auto 28px",
            }}
          >
            বাংলাদেশের অনলাইন মার্চেন্টদের জন্য ইনস্ট্যান্ট ক্যাশ-অন-ডেলিভারি (সিওডি) ঝুঁকি যাচাই ইঞ্জিন।{" "}
            <strong>Steadfast, Pathao, RedX, CarryBee ও Paperfly</strong> থেকে মাত্র একটি রিকোয়েস্টে গ্রাহকের অতীত ডেলিভারি হিস্ট্রি যাচাই করুন।
          </p>

          {/* Quick Value Highlights */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "14px",
              flexWrap: "wrap",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FFFFFF", padding: "6px 14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#10B981" }}>✓</span> হেডার অথেনটিকেশন (X-API-KEY)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FFFFFF", padding: "6px 14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#10B981" }}>✓</span> সাব-২০ms ইঞ্জিন (১৫ দিনের লোকাল ক্যাশ)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FFFFFF", padding: "6px 14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#10B981" }}>✓</span> ৫টি শীর্ষ কুরিয়ার নেটওয়ার্ক
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Tool Container */}
      <section style={{ maxWidth: "1040px", margin: "-24px auto 60px", padding: "0 16px" }}>
        <FraudCheckerTool initialRemaining={initialRemaining} />
      </section>

      {/* Educational Guide: Why COD Protection is Critical */}
      <section style={{ maxWidth: "1000px", margin: "0 auto 60px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", marginBottom: "12px" }}>
            কেন প্রতিটি ক্যাশ-অন-ডেলিভারি অর্ডার যাচাই করা জরুরি?
          </h2>
          <p style={{ fontSize: "16px", color: "#64748B", maxWidth: "680px", margin: "0 auto" }}>
            বাংলাদেশে ই-কমার্সে গড়ে ১৫% থেকে ৩০% পার্সেল ডেলিভারি না হয়ে রিটার্ন আসে। প্রতিটি রিটার্ন অর্ডারে মার্চেন্টকে গুনতে হয় বিপুল লোকসান।
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {/* Card 1 */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>💸</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
              প্রতি রিটার্নে ৳ ১২০ - ৳ ২৫০ লোকসান
            </h3>
            <p style={{ fontSize: "14.5px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              কুরিয়ার ডেলিভারি চার্জ, রিটার্ন পেনাল্টি চার্জ, প্যাকেজিং বক্সের খরচ এবং পণ্য অবিক্রিত আটকে থাকার কারণে মার্চেন্টের সরাসরি মূলধন নষ্ট হয়।
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>📦</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
              ৫টি কুরিয়ারের সমন্বিত তথ্য
            </h3>
            <p style={{ fontSize: "14.5px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              কোনো ক্রেতা হয়তো পাঠাওতে কম পার্সেল নিয়েছে কিন্তু রেডএক্স বা স্টিডফাস্টে নিয়মিত রিটার্ন করেছে—একটিমাত্র এপিআই দিয়েই সম্পূর্ণ চিত্র পাওয়া যায়।
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚡</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
              সাব-২০ms আল্ট্রা ফাস্ট রেসপন্স
            </h3>
            <p style={{ fontSize: "14.5px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              ১৫ দিনের লোকাল ক্যাশ মেমোরির কারণে চেকআউট বা ব্যাকগ্রাউন্ড স্ক্রিনিং কোনো প্রকার স্লো না করেই চোখের পলকে রেজাল্ট প্রদান করে।
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section style={{ maxWidth: "860px", margin: "0 auto 60px", padding: "0 20px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", textAlign: "center", marginBottom: "32px" }}>
          সাধারণ জিজ্ঞাসা (FAQ)
        </h2>

        <div style={{ display: "grid", gap: "16px" }}>
          {[
            {
              q: "কুরিয়ার ফ্রড চেকার কীভাবে আমার ব্যবসার টাকা বাঁচায়?",
              a: "অনেক ক্রেতা একই সাথে বিভিন্ন পেজে বা শপে ক্যাশ অন ডেলিভারিতে অর্ডার করে ডেলিভারির সময় ফোন বন্ধ রাখেন বা পার্সেল ফেরত দেন। ফ্রড চেকারের মাধ্যমে তাদের অতীতের রিটার্ন পার্সেল রেট দেখে অর্ডার কনফার্ম করার আগেই যাচাই বা অগ্রিম ডেলিভারি চার্জ নেওয়া সম্ভব হয়।",
            },
            {
              q: "এই টুল ব্যবহার করার জন্য কি আমার নিজস্ব কুরিয়ার অ্যাকাউন্টের প্রয়োজন আছে?",
              a: "না! এই পাবলিক টুল এবং ফ্রি REST API ব্যবহার করার জন্য কোনো নির্দিষ্ট কুরিয়ার অ্যাকাউন্টের প্রয়োজন নেই। এটি কেন্দ্রীয় পাবলিক ডাটাবেস ও একীভূত কুরিয়ার নেটওয়ার্ক থেকে ডাটা সংগ্রহ করে।",
            },
            {
              q: "BizTrackBD প্ল্যাটফর্মে এটি কীভাবে স্বয়ংক্রিয়ভাবে কাজ করে?",
              a: "BizTrackBD-তে আপনার ই-কমার্স ওয়েবসাইট তৈরি করলে প্রতিটি গ্রাহকের অর্ডারের সাথে সাথেই ব্যাকগ্রাউন্ডে এই ৫টি কুরিয়ার ডাটা স্ক্যান হয় এবং 50% কুরিয়ার স্কোর + 30% প্ল্যাটফর্ম ট্রাস্ট + 20% স্টোর হিস্ট্রি মিলিয়ে অটোমেটিক ফ্রড লেভেল নির্ধারণ করে দেওয়া হয়।",
            },
            {
              q: "API রিকোয়েস্ট রেসপন্স কত দ্রুত আসে?",
              a: "আমাদের ইঞ্জিনে ১৫ দিনের ইন-মেমোরি ক্যাশিং প্রযুক্তি রয়েছে। ফলে যে নম্বরগুলো ইতিমধ্যেই যাচাই হয়েছে, সেগুলোর উত্তর সাব-২০ মিলিসেকেন্ডে (২০ms-এর কম সময়ে) ফেরত আসে।",
            },
            {
              q: "অন্যান্য মার্চেন্টদের কমপ্লেন রিপোর্ট কীভাবে কাজে লাগে?",
              a: "যদি কোনো গ্রাহক ইতিপূর্বে কোনো মার্চেন্টের পার্সেল উদ্দেশ্যপ্রণোদিতভাবে না নিয়ে হয়রানি করে থাকে এবং মার্চেন্ট কমপ্লেন জমা দিয়ে থাকে, তবে সেই সতর্কবার্তা আপনি সরাসরি রেজাল্ট কার্ডে দেখতে পাবেন।",
            },
          ].map((faq, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "20px 24px",
                border: "1px solid #E2E8F0",
              }}
            >
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
                {faq.q}
              </h3>
              <p style={{ fontSize: "14.5px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Conversion CTA */}
      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 20px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
            borderRadius: "24px",
            padding: "48px 32px",
            textAlign: "center",
            color: "#FFFFFF",
            boxShadow: "0 20px 48px -12px rgba(30, 27, 75, 0.4)",
          }}
        >
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, margin: "0 0 16px" }}>
            আপনার অনলাইন শপের রিটার্ন পার্সেল ৫০% পর্যন্ত কমিয়ে আনুন
          </h2>
          <p
            style={{
              fontSize: "16px",
              color: "#C7D2FE",
              maxWidth: "680px",
              margin: "0 auto 32px",
              lineHeight: 1.6,
            }}
          >
            BizTrackBD-তে আপনার নিজস্ব ব্র্যান্ডেড ই-কমার্স স্টোর চালু করুন। অটোমেটিক কুরিয়ার বুকিং, লাইভ ট্র্যাকিং এবং বিল্ট-ইন ফ্রড স্ক্রিনিং উপভোগ করুন সম্পূর্ণ ফ্রিতে।
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link
              href="/start"
              style={{
                padding: "16px 32px",
                background: "#FFFFFF",
                color: "#1E1B4B",
                borderRadius: "14px",
                fontWeight: 800,
                fontSize: "16px",
                textDecoration: "none",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
              }}
            >
              ফ্রি স্টোর তৈরি করুন →
            </Link>

            <Link
              href="/couriers"
              style={{
                padding: "16px 28px",
                background: "rgba(255, 255, 255, 0.12)",
                color: "#FFFFFF",
                borderRadius: "14px",
                fontWeight: 700,
                fontSize: "16px",
                textDecoration: "none",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              কুরিয়ার অটোমেশন ফিচার দেখুন
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
