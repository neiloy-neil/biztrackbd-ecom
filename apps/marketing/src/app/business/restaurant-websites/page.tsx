import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restaurant & Cafe Website Builder for Bangladesh",
  description:
    "Build a mouthwatering website for your restaurant, cafe, bistro, or cloud kitchen. Offer digital QR dining menus, accept table reservations, and showcase location directions.",
  keywords: [
    "restaurant website builder bangladesh",
    "cafe website dhaka",
    "digital qr menu bangladesh",
    "restaurant table reservation bangladesh",
    "রেস্টুরেন্ট ওয়েবসাইট তৈরি",
  ],
  alternates: {
    canonical: `${siteUrl}/business/restaurant-websites`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/restaurant-websites`,
    siteName: "BizTrackBD",
    title: "Restaurant & Cafe Website Builder for Bangladesh",
    description: "Digital QR menus, table reservations, and branch directions for food establishments.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Restaurant Website Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Restaurant & Cafe Website Builder for Bangladesh",
    description: "Digital dining menus and table reservations with zero food aggregator commissions.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "qr-menu",
    label: "01. Digital QR Menu",
    customerHeading: "Mobile-First Food Menu with Dietary Tags",
    customerSub: "Diners scan the table QR code or browse on mobile. High-resolution food photography with clear BDT prices.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Slow-Braised Mutton Kacchi &middot; ৳ 480 &middot; <span style={{ color: "#D97706" }}>Chef&apos;s Signature</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Served with spiced saffron basmati, braised aloo, boiled egg, and authentic mustard chutney.
        </div>
      </div>
    ),
    ownerHeading: "Live Menu Editor in Admin",
    ownerStatus: { text: "MENU UPDATED", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Action:</strong> Updated item price and marked as &ldquo;In Stock&rdquo;</div>
        <div><strong>Effect:</strong> Instantly reflected on table QR codes without reprinting paper menus</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Save thousands in printed menu reprint costs</div>
      </div>
    ),
  },
  {
    id: "reservations",
    label: "02. Table Reservation",
    customerHeading: "Online Dining Reservation Request",
    customerSub: "Diners select party size, dining date, and time slot with automated WhatsApp confirmation instructions.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Reservation: 4 Guests &middot; Friday 8:00 PM &middot; Banani Branch
        </div>
        <div style={{ fontSize: 12.5, color: "var(--business)", marginTop: 4 }}>
          Special note: Birthday anniversary &middot; Corner dining booth requested
        </div>
      </div>
    ),
    ownerHeading: "Floor Manager Desk Inbox",
    ownerStatus: { text: "TABLE RESERVED", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Table Assigned:</strong> Table #12 (Indoor AC Section)</div>
        <div><strong>Status:</strong> Confirmed via WhatsApp direct reply</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Guest mobile saved for VIP loyalty program</div>
      </div>
    ),
  },
  {
    id: "locations",
    label: "03. Location & Directions",
    customerHeading: "Branch Locations & Dining Hours",
    customerSub: "Diners view weekday and weekend dining hours and open interactive Google Maps pins on their phone.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Banani Branch: Road 11, Block D &middot; Open: 12:00 PM – 11:00 PM
        </div>
        <div style={{ fontSize: 12.5, color: "#15803D", marginTop: 4 }}>
          ✓ Parking available &middot; Dedicated family section
        </div>
      </div>
    ),
    ownerHeading: "Customer Map Conversion",
    ownerStatus: { text: "DIRECTIONS CLICKED", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Metric:</strong> 42 customers clicked &ldquo;Get Directions&rdquo; this Friday</div>
        <div><strong>Referrer:</strong> Local Google Maps Search</div>
        <div style={{ marginTop: 6, color: "#15803D", fontWeight: 700 }}>Direct foot traffic to your banani dining room</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  { icon: "📜", title: "Digital QR Code Menus", desc: "Permanent QR code menus for dining tables; update prices or sold-out dishes in 1 tap." },
  { icon: "🪑", title: "Table Reservation Queue", desc: "Manage dining table bookings, party sizes, and anniversary notes from smartphone admin." },
  { icon: "📸", title: "Atmosphere & Food Gallery", desc: "Showcase gourmet food photography and restaurant interior ambience in fast WebP/AVIF." },
  { icon: "⏰", title: "Dining Hours & Ramadan Timing", desc: "Display regular hours, Friday special schedules, and Iftar/Sehri timings effortlessly." },
  { icon: "📍", title: "Interactive Google Maps", desc: "Give diners 1-tap driving directions to your branch in Banani, Dhanmondi, or Uttara." },
  { icon: "🍽️", title: "Restaurant Schema JSON-LD", desc: "Structured data helping Google show your menus, cuisine tags, and opening hours on search." },
];

const BILINGUAL_PROOF = {
  title: "Bilingual Dining Experience",
  badge: "BILINGUAL RESTAURANT BRANDING",
  enExcerpt: "Celebrating Bangladesh's rich culinary traditions with modern gourmet touches. Call 01700000000 for table reservations.",
  bnExcerpt: "ঐতিহ্যবাহী খাবারের খাঁটি স্বাদ ও আধুনিক ডাইনিং অভিজ্ঞতা। পরিবার নিয়ে টেবিল বুকিং করতে যোগাযোগ করুন ০১৭০০০০০০০০ নম্বরে।",
  note: "Food descriptions, allergen notices, and reservation confirmations display gracefully in Bangla and English.",
};

const FAQ: [string, string][] = [
  [
    "Can we print a QR code for each dining table?",
    "Yes. You receive a clean QR code graphic that points directly to your mobile menu. When you edit a price or add a seasonal dessert, all tables update instantly without reprinting.",
  ],
  [
    "Can we take food delivery orders online?",
    "Yes. You can upgrade to a Hybrid store to sell packaged gourmet goods, catering packages, or takeaway boxes with direct bKash payment and Pathao courier dispatch.",
  ],
  [
    "Can the floor manager manage table reservations from an Android phone?",
    "Yes. The mobile admin allows floor managers to accept reservations, assign table numbers, and reply to guests in seconds.",
  ],
  [
    "Does the website support multiple branches?",
    "Yes. You can add separate branch cards for Banani, Dhanmondi, Uttara, and Chittagong with individual phone numbers and operating hours.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/business/restaurant-websites#webpage`,
      url: `${siteUrl}/business/restaurant-websites`,
      name: "Restaurant & Dining Website Builder for Bangladesh",
      description: "Digital QR menus, contactless table ordering, and table reservation management for Bangladeshi restaurants.",
      about: {
        "@type": "FoodEstablishment",
        name: "Restaurant & Dining Blueprint",
        servesCuisine: ["Bengali", "Continental", "Asian Fusion"],
        areaServed: {
          "@type": "Country",
          name: "Bangladesh",
        },
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/business/restaurant-websites#software`,
      name: "BizTrackBD Restaurant & Dining Website Blueprint",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "Offer",
        price: "799",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
      },
    },
  ],
};

export default function RestaurantWebsitesPage() {
  return (
    <VerticalLandingLayout
      eyebrow="Restaurant & Dining Websites"
      title="Bring more diners to your tables with a"
      titleHighlight="digital QR menu and online reservations."
      lead="For restaurants, cafes, bistros, bakeries, and cloud kitchens. Showcase gourmet food photography, offer canonical QR menus that update instantly, and manage table reservations with direct WhatsApp confirmation."
      badge="Dhaka Bistro"
      demoId="dhaka-bistro"
      demoLabel="Try Restaurant Demo Workspace"
      templateSignupId="dhaka-bistro"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Upgrade your restaurant experience with BizTrackBD"
      ctaSub="14 days free · Custom domain included · Zero coding required"
    />
  );
}
