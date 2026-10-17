import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Service Business Website Builder for Bangladesh",
  description:
    "Build a high-converting website for your service business, home repair, cleaning, IT support, or local contracting firm. Transparent pricing packages, WhatsApp leads, and coverage maps.",
  keywords: [
    "service business website bangladesh",
    "website for local service business",
    "contractor website dhaka",
    "repair service website builder",
    "সার্ভিস ওয়েবসাইট তৈরি",
  ],
  alternates: {
    canonical: `${siteUrl}/business/service-websites`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/service-websites`,
    siteName: "BizTrackBD",
    title: "Service Business Website Builder for Bangladesh",
    description: "Publish service packages, coverage areas, and 1-tap WhatsApp lead actions.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Service Business Website" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Service Business Website Builder for Bangladesh",
    description: "Capture quote requests and inquiries for contractors and local service firms.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "pricing-tiers",
    label: "01. Service Packages",
    customerHeading: "Transparent Service Pricing Tiers",
    customerSub: "Customer views exact starting prices, included tasks, and labor warranties without calling back and forth.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Master Split AC Servicing &middot; Starting ৳ 1,200
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Includes jet pump wash, gas pressure check, electrical safety test, and 30-day service warranty.
        </div>
      </div>
    ),
    ownerHeading: "Lead Captured: Package Selected",
    ownerStatus: { text: "SERVICE BRIEF", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Selected:</strong> Master AC Servicing (2 Units)</div>
        <div><strong>Location:</strong> House 28, Road 11, Banani, Dhaka</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Preferred Time: Tomorrow 11:00 AM</div>
      </div>
    ),
  },
  {
    id: "coverage",
    label: "02. Service Coverage Map",
    customerHeading: "Service Area & Target Response Time",
    customerSub: "Visitor verifies that their neighborhood is covered and sees realistic same-day arrival windows.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Active Coverage: Banani, Gulshan, Baridhara, Uttara, Dhanmondi &middot; 30-Min Arrival Window
        </div>
        <div style={{ fontSize: 12.5, color: "#15803D", marginTop: 4 }}>
          ✓ Verified technicians currently stationed in North Dhaka
        </div>
      </div>
    ),
    ownerHeading: "Technician Dispatch Queue",
    ownerStatus: { text: "DISPATCH READY", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Assigned Tech:</strong> Rafiqul Islam (Team Lead North)</div>
        <div><strong>Status:</strong> Assigned from mobile admin desk</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Customer notified via WhatsApp &amp; confirmation link</div>
      </div>
    ),
  },
  {
    id: "whatsapp",
    label: "03. 1-Tap WhatsApp Lead",
    customerHeading: "Direct WhatsApp Conversation Starter",
    customerSub: "Customer initiates a WhatsApp chat with pre-filled service package details, avoiding typing on mobile.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#15803D" }}>
          WhatsApp Pre-filled: &ldquo;Hello, I need Master AC Servicing for 2 units in Banani.&rdquo;
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Zero friction for mobile shoppers visiting from Facebook or Instagram.
        </div>
      </div>
    ),
    ownerHeading: "Lead Record Logged in Desk",
    ownerStatus: { text: "WHATSAPP INQUIRY", stampClass: "stamp-review" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Channel:</strong> WhatsApp Direct Button</div>
        <div><strong>Lead Status:</strong> New &rarr; Quote Sent</div>
        <div style={{ marginTop: 6, color: "#0F766E", fontWeight: 700 }}>Conversation history retained in owner CRM log</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  { icon: "🛠️", title: "Transparent Pricing Cards", desc: "List fixed prices or 'starting from' ranges so customers understand costs before calling." },
  { icon: "🗺️", title: "Neighborhood Coverage Maps", desc: "Highlight active zones in Dhaka, Chittagong, or Sylhet with estimated arrival times." },
  { icon: "💬", title: "Floating WhatsApp Button", desc: "Persistent mobile WhatsApp contact widget with customized pre-filled inquiry text." },
  { icon: "⚡", title: "Instant Quote Forms", desc: "Collect customer addresses, problem descriptions, and photo attachments in your lead inbox." },
  { icon: "👥", title: "Staff & Technician Accounts", desc: "Assign customer inquiries to specific field technicians or office dispatch coordinators." },
  { icon: "📍", title: "LocalBusiness Schema", desc: "Built-in structured data targeting local service searches and Google Maps rankings." },
];

const BILINGUAL_PROOF = {
  title: "Bilingual Service Commitments",
  badge: "LOCAL SERVICE CLARITY",
  enExcerpt: "Certified technicians, transparent pricing with no hidden charges, and same-day support across the city.",
  bnExcerpt: "দক্ষ কর্মী, ন্যায্য মূল্য ও শতভাগ সন্তুষ্টির গ্যারান্টি সহ নির্ভরযোগ্য প্রফেশনাল সার্ভিস আপনার দোরগোড়ায়।",
  note: "Customers can read service guarantees, pricing terms, and booking forms in clear, fluent Bangla or English.",
};

const FAQ: [string, string][] = [
  [
    "Can we change our service prices and coverage zones from a smartphone?",
    "Yes. Our mobile admin allows you to update package prices, add seasonal offers, or expand coverage areas in seconds without a computer.",
  ],
  [
    "What happens when a customer taps the WhatsApp button?",
    "It opens WhatsApp on their phone with a message pre-filled with the exact service and neighborhood they were viewing, making it effortless for them to hit send.",
  ],
  [
    "Can we take online booking deposits via bKash?",
    "Yes. You can instruct customers to submit a booking advance via bKash TrxID or collect payment on-site after service completion.",
  ],
  [
    "How does local SEO work for service companies?",
    "BizTrackBD automatically includes LocalBusiness and Service schema JSON-LD, address formatting, and fast mobile loading to help you rank on Google local searches.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD Local Service Business Blueprint",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "799",
    priceCurrency: "BDT",
  },
};

export default function ServiceWebsitesPage() {
  return (
    <VerticalLandingLayout
      eyebrow="Local Service Business Websites"
      title="Help the right customer understand, trust and"
      titleHighlight="contact you immediately."
      lead="For repair technicians, cleaning agencies, contractors, and local service providers. Present transparent pricing, showcase service coverage areas, and turn clicks into real WhatsApp conversations and quote requests."
      badge="Local Service Pro"
      demoId="corporate-trust"
      demoLabel="Try Service Demo Workspace"
      templateSignupId="corporate-trust"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Grow your local service business with BizTrackBD"
      ctaSub="14 days free · Custom domain included · Zero coding required"
    />
  );
}
