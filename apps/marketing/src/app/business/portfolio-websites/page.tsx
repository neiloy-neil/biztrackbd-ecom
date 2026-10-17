import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Personal & Creator Portfolio Website Builder for Bangladesh",
  description:
    "Build a stunning, memorable portfolio website for your design, software engineering, photography, or consulting career. Showcase case studies, track CV downloads, and get hired.",
  keywords: [
    "portfolio website builder bangladesh",
    "personal portfolio website dhaka",
    "designer portfolio bangladesh",
    "freelance portfolio website",
    "পোর্টফোলিও ওয়েবসাইট তৈরি",
  ],
  alternates: {
    canonical: `${siteUrl}/business/portfolio-websites`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/portfolio-websites`,
    siteName: "BizTrackBD",
    title: "Personal & Creator Portfolio Website Builder for Bangladesh",
    description: "Showcase creative case studies, career milestones, and direct client inquiries.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Portfolio Website Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal & Creator Portfolio Website Builder for Bangladesh",
    description: "Personal and creator portfolio website builder with trackable CV downloads.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "case-studies",
    label: "01. Structured Case Studies",
    customerHeading: "In-Depth Case Studies & Measurable Outcomes",
    customerSub: "Clients evaluate your role, problem statement, technology stack, and verified business outcomes.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          FinTech Mobile App Redesign &middot; Lead Product Designer
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Role: Design System &middot; Outcome: 42% increase in bill payment checkout completion rate.
        </div>
      </div>
    ),
    ownerHeading: "Analytics: Case Study Read Time",
    ownerStatus: { text: "HIGH-INTENT PROSPECT", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Prospect:</strong> International Product Studio (London / Dhaka)</div>
        <div><strong>Time on Page:</strong> 5.4 minutes &middot; Read full engineering architecture</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Visitor clicked &ldquo;Download CV&rdquo; next</div>
      </div>
    ),
  },
  {
    id: "resume",
    label: "02. Tracked CV Download",
    customerHeading: "Tracked Curriculum Vitae (PDF) Download",
    customerSub: "Hiring managers and recruiters download your official verified resume in one clean click.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--business)" }}>
          Curriculum Vitae (PDF, 1.2 MB) &middot; Updated October 2026
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Includes comprehensive career timeline, educational credentials, and stack proficiencies.
        </div>
      </div>
    ),
    ownerHeading: "Lead Notification: CV Downloaded",
    ownerStatus: { text: "RESUME DOWNLOADED", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Action:</strong> Verified PDF Download</div>
        <div><strong>Source:</strong> LinkedIn Direct Referral</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Logged in smartphone admin lead history</div>
      </div>
    ),
  },
  {
    id: "collaboration",
    label: "03. Collaboration Brief",
    customerHeading: "Direct Project Briefing Form",
    customerSub: "Prospective clients submit project scope, expected timeline, and budget estimate without spam.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Project Brief: Enterprise Design System Audit (6 Weeks Timeline)
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Client provided contact details, Figma link, and company requirements.
        </div>
      </div>
    ),
    ownerHeading: "Freelance / Consulting Lead Inbox",
    ownerStatus: { text: "BRIEF RECEIVED", stampClass: "stamp-review" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Client:</strong> Vertex Innovations Ltd</div>
        <div><strong>Status:</strong> New Lead &rarr; Awaiting Discovery Call</div>
        <div style={{ marginTop: 6, color: "#15803D", fontWeight: 700 }}>One-tap WhatsApp response sent directly to client</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  { icon: "🎨", title: "Rich Case Study Layouts", desc: "Showcase mockups, engineering diagrams, and quantified metrics with editorial typography." },
  { icon: "📄", title: "Trackable Resume Downloads", desc: "Upload your CV/resume PDF and track recruiter downloads right from your phone." },
  { icon: "💻", title: "Technical Stack Badges", desc: "Highlight TypeScript, Next.js, Figma, React Native, or Python proficiencies elegantly." },
  { icon: "📨", title: "Project Inquiry Inbox", desc: "Keep freelance briefs and speaking invitations organized in one professional panel." },
  { icon: "🔗", title: "Professional Social Links", desc: "Connect GitHub, Dribbble, LinkedIn, and personal blogs with clean Open Graph cards." },
  { icon: "👤", title: "Person Schema JSON-LD", desc: "Structured data ensuring search engines associate your name with your professional portfolio." },
];

const BILINGUAL_PROOF = {
  title: "Bilingual Professional Identity",
  badge: "CREATOR BRANDING",
  enExcerpt: "Senior Product Designer & Engineer with 8+ years building enterprise web apps, SaaS interfaces, and scalable design systems.",
  bnExcerpt: "৮ বছরেরও বেশি অভিজ্ঞতা সহ আধুনিক ওয়েব প্ল্যাটফর্ম ও সফটওয়্যার তৈরির কাজ করছি। দেশীয় ও আন্তর্জাতিক গ্রাহকদের জন্য নির্ভরযোগ্য প্রযুক্তি সমাধান।",
  note: "Showcase your work to international remote clients and local Bangladeshi enterprises with seamless dual-language support.",
};

const FAQ: [string, string][] = [
  [
    "Can I connect my personal domain (e.g. yourname.com or yourname.dev)?",
    "Yes. All paid plans include custom domain connection with automated free SSL certificates.",
  ],
  [
    "Can I upload high-resolution design images without slowing down the site?",
    "Yes. BizTrackBD automatically compresses and converts uploaded imagery into next-gen WebP/AVIF formats with responsive dimensions, keeping pages fast and responsive on mobile networks.",
  ],
  [
    "What if I want to sell digital templates, icons, or photography prints later?",
    "You can upgrade to a Hybrid store with 1 click to sell digital downloads or physical art prints with direct bKash/Nagad checkout.",
  ],
  [
    "How does the trackable CV download work?",
    "When a recruiter or client clicks to download your resume, an event is logged in your admin panel showing the download time and referral source.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfilePage",
      "@id": `${siteUrl}/business/portfolio-websites#webpage`,
      url: `${siteUrl}/business/portfolio-websites`,
      name: "Portfolio & Creator Website Builder for Bangladesh",
      description: "Structured case studies, CV downloads, and freelance consultation briefs for creators and consultants.",
      about: {
        "@type": "Person",
        name: "Creator & Consultant Blueprint",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/business/portfolio-websites#software`,
      name: "BizTrackBD Personal & Creator Portfolio Blueprint",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "Offer",
        price: "399",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
      },
    },
  ],
};

export default function PortfolioWebsitesPage() {
  return (
    <VerticalLandingLayout
      eyebrow="Personal & Creator Portfolios"
      title="Your work should be easier to remember—"
      titleHighlight="and much easier to hire."
      lead="For product designers, software engineers, photographers, consultants, and creators. Showcase in-depth case studies with measured outcomes, offer CV/resume downloads, and capture high-value freelance and consulting briefs."
      badge="Portfolio Focus"
      demoId="corporate-trust"
      demoLabel="Try Portfolio Demo Workspace"
      templateSignupId="corporate-trust"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Build a portfolio that gets you remembered and hired"
      ctaSub="14 days free · Custom domain included · Zero coding required"
    />
  );
}
