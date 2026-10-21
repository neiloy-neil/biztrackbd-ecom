import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corporate & Company Website Builder for Bangladesh",
  description:
    "Build an authoritative corporate website for your consultancy, B2B agency, or enterprise. Showcase services, team credentials, case studies, and downloadable company profiles.",
  keywords: [
    "company website builder bangladesh",
    "corporate website design dhaka",
    "b2b agency website bangladesh",
    "consultancy website builder",
    "ব্যবসা ওয়েবসাইট তৈরি",
  ],
  alternates: {
    canonical: `${siteUrl}/business/company-website`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/company-website`,
    siteName: "BizTrackBD",
    title: "Corporate & Company Website Builder for Bangladesh",
    description: "Build an authoritative corporate presence with bilingual capabilities, case studies, and quote inquiries.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Company Website Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Corporate & Company Website Builder for Bangladesh",
    description: "Authoritative business presence for consultancies and B2B agencies.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "solutions",
    label: "01. Service Catalogue",
    customerHeading: "Strategic Capabilities & Practice Areas",
    customerSub: "B2B client reviews advisory, engineering, and digital transformation offerings in English and Bangla.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Enterprise Advisory &middot; Technology Architecture &middot; Financial Ops
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Includes scope definitions, deliverable timelines, and client engagement models.
        </div>
      </div>
    ),
    ownerHeading: "Lead Captured: Advisory Brief",
    ownerStatus: { text: "CORPORATE INQUIRY", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Company:</strong> Standard Logistics Ltd (Gulshan 1)</div>
        <div><strong>Requirement:</strong> ERP Implementation &amp; Process Audit</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Assigned to Partner Desk &middot; Notification sent to WhatsApp</div>
      </div>
    ),
  },
  {
    id: "case-studies",
    label: "02. Verified Case Studies",
    customerHeading: "Evidence-Based Case Histories",
    customerSub: "Visitor examines problem, scope, contribution, and verified results before scheduling an introductory call.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Case Study: Modernizing Supply Chain for a 500-Staff FMCG Manufacturer
        </div>
        <div style={{ fontSize: 12.5, color: "var(--business)", marginTop: 4 }}>
          Outcome: 34% reduction in order processing time &middot; Written client consent on file
        </div>
      </div>
    ),
    ownerHeading: "Analytics: Case Study Engagement",
    ownerStatus: { text: "HIGH-INTENT VISITOR", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Action:</strong> Company Profile PDF Downloaded</div>
        <div><strong>Referrer:</strong> LinkedIn Company Page</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Visitor spent 4.2 minutes reviewing Enterprise Solutions</div>
      </div>
    ),
  },
  {
    id: "consultation",
    label: "03. Executive Briefing",
    customerHeading: "Direct Executive Consultation Request",
    customerSub: "Client submits requirements, target timeline, and team size through a structured quote form.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Schedule an Advisory Briefing &middot; Banani Office or Google Meet
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Form enforces verified business email and telephone prefix.
        </div>
      </div>
    ),
    ownerHeading: "Admin Lead Inbox: Meeting Request",
    ownerStatus: { text: "SLOT REQUESTED", stampClass: "stamp-review" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Meeting:</strong> Thursday 3:00 PM &middot; Strategy Room</div>
        <div><strong>Status:</strong> Awaiting Partner Confirmation</div>
        <div style={{ marginTop: 6, color: "#11795A", fontWeight: 700 }}>One tap to confirm and send calendar invite</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  { icon: "🏛️", title: "Practice Area Catalogue", desc: "Organize capabilities into structured service hubs with bilingual Bangla & English descriptions." },
  { icon: "📄", title: "Trackable Profile Downloads", desc: "Upload high-res company profile PDFs and track who downloads them from your smartphone desk." },
  { icon: "👥", title: "Leadership & Team Profiles", desc: "Present directors, board members, and senior associates with credentials and LinkedIn links." },
  { icon: "📍", title: "Headquarters & Branch Maps", desc: "Interactive location maps for Banani, Gulshan, Motijheel, and Chittagong corporate offices." },
  { icon: "📥", title: "Enterprise Lead Inbox", desc: "Keep business development inquiries out of personal message threads with staff role assignment." },
  { icon: "🌐", title: "Organization Schema", desc: "Built-in structured data helping search engines verify your corporate identity and official domain." },
];

const BILINGUAL_PROOF = {
  title: "Bilingual Corporate Trust Messaging",
  badge: "BILINGUAL CORPORATE IDENTITY",
  enExcerpt: "We partner with ambitious enterprises and institutions across Bangladesh to deliver world-class advisory, technology, and operations.",
  bnExcerpt: "আধুনিক প্রযুক্তি ও সঠিক নির্দেশনায় আপনার ব্যবসাকে এগিয়ে নিয়ে যেতে আমরা সর্বদা অঙ্গীকারবদ্ধ।",
  note: "Every headline, service page, and contact form supports paired Bangla and English fields with automatic social previews.",
};

const FAQ: [string, string][] = [
  [
    "Can we connect our official corporate domain (e.g. companyname.com or companyname.com.bd)?",
    "Yes. All paid plans support connecting your custom corporate domain with automatic, zero-maintenance SSL encryption.",
  ],
  [
    "Can multiple partners or assistants access the lead inbox?",
    "Yes. The Business plan includes 3 staff accounts, and Business Plus includes up to 8 staff accounts with role-based permissions.",
  ],
  [
    "Can we add a blog or media release section?",
    "Yes. You can publish corporate updates, thought leadership articles, and press announcements without needing a separate WordPress installation.",
  ],
  [
    "What if we want to sell merchandise or event tickets later?",
    "You can upgrade to a Hybrid store in 1 click, allowing you to take bKash/Nagad payments for physical products or paid workshop tickets directly on your corporate domain.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/business/company-website#webpage`,
      url: `${siteUrl}/business/company-website`,
      name: "Corporate & Consulting Website Builder for Bangladesh",
      description: "Authoritative corporate presence, practice areas, leadership team bios, and corporate RFP inquiry capture.",
      about: {
        "@type": "Corporation",
        name: "Corporate & B2B Advisory Blueprint",
        areaServed: {
          "@type": "Country",
          name: "Bangladesh",
        },
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/business/company-website#software`,
      name: "BizTrackBD Corporate Website Blueprint",
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

export default function CompanyWebsitePage() {
  return (
    <VerticalLandingLayout
      eyebrow="Corporate & Enterprise Websites"
      title="A company website that explains the business"
      titleHighlight="before the first meeting."
      lead="Build an authoritative corporate presence for your consultancy, B2B agency, or enterprise. Showcase practice areas, leadership credentials, verified case studies, and capture corporate briefs without agency retainers."
      badge="Corporate Trust"
      demoId="corporate-trust"
      demoLabel="Try Corporate Demo Workspace"
      templateSignupId="corporate-trust"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Elevate your corporate presence with BizTrackBD"
      ctaSub="14 days free · Custom domain included · Zero coding required"
    />
  );
}
