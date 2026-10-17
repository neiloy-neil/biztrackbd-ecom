import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public Figure, Author & Thought Leader Website Builder for Bangladesh",
  description:
    "Build an authoritative personal website for your public career. Publish op-eds, share downloadable press kits and verified bios, and capture speaking engagement and media interview requests.",
  keywords: [
    "public figure website builder bangladesh",
    "author website builder dhaka",
    "speaker website bangladesh",
    "thought leader personal branding",
    "সাংবাদিক ও লেখক ওয়েবসাইট",
    "পাবলিক ফিগার ওয়েবসাইট তৈরি",
  ],
  alternates: {
    canonical: `${siteUrl}/business/public-profile-websites`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/public-profile-websites`,
    siteName: "BizTrackBD",
    title: "Public Figure, Author & Thought Leader Website Builder for Bangladesh",
    description: "Authoritative personal branding, op-ed publications, official press kits, and speaking booking requests.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Public Figure Website Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Public Figure, Author & Thought Leader Website Builder for Bangladesh",
    description: "Distinguished personal website with media kit downloads and speaking inquiry capture.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "op-eds",
    label: "01. Op-Eds & Commentary",
    customerHeading: "Featured Columns, Books & Policy Analyses",
    customerSub: "Readers, researchers, and journalists access your published writing across national dailies and international forums.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          The Future of Macroeconomic Stability &middot; Daily Column &amp; Journal Essay
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Published across The Daily Star, Prothom Alo, and policy research repositories with direct citations.
        </div>
      </div>
    ),
    ownerHeading: "Analytics: Reader Engagement",
    ownerStatus: { text: "POLICY INSIGHTS READ", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Reader Source:</strong> University Economic Forum &middot; Direct Link</div>
        <div><strong>Time on Article:</strong> 4.8 minutes &middot; Complete essay review</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Visitor navigated to &ldquo;Speaking Inquiries&rdquo; next</div>
      </div>
    ),
  },
  {
    id: "press-kit",
    label: "02. Official Press Kit",
    customerHeading: "High-Resolution Photos & Verified Biography (PDF)",
    customerSub: "Event organizers and media producers download your approved portrait photos, short bio, and introduction notes.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--business)" }}>
          Official Press Kit &amp; Media Biography (PDF, 2.4 MB) &middot; Updated October 2026
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Includes 300 DPI executive portraits, 150-word and 300-word introduction scripts, and speaker guidelines.
        </div>
      </div>
    ),
    ownerHeading: "Download Activity Log",
    ownerStatus: { text: "PRESS KIT ACCESSED", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Organization:</strong> National Television Network (Dhaka)</div>
        <div><strong>Asset:</strong> Official High-Res Media Kit &amp; Bio</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Logged in smartphone admin download history</div>
      </div>
    ),
  },
  {
    id: "speaking-inquiry",
    label: "03. Speaking Inquiries",
    customerHeading: "Conference Keynotes & Media Interview Requests",
    customerSub: "Institutions and media outlets submit official invitations with date, venue, topic, and honorarium details.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Invitation: Annual Economic Summit 2026 &middot; Keynote Address
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Event organizer provided agenda, audience demographics, and secretariat contact details.
        </div>
      </div>
    ),
    ownerHeading: "Secretariat Alert: Official Invitation",
    ownerStatus: { text: "NEW INVITATION", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Organizer:</strong> Bangladesh Economic Association</div>
        <div><strong>Proposed Date:</strong> 15 November 2026 &middot; In-Person (Dhaka)</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>1-click WhatsApp or email confirmation link generated</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  {
    icon: "📜",
    title: "Op-Ed & Essay Repository",
    desc: "Archive and categorize your articles, newspaper columns, books, and policy whitepapers with clean reading typography and social sharing.",
  },
  {
    icon: "🎙️",
    title: "Speaking & Keynote Inquiries",
    desc: "Structured booking forms designed specifically for conference keynotes, corporate panels, academic lectures, and media interviews.",
  },
  {
    icon: "💼",
    title: "Media Press Kit Downloads",
    desc: "Allow journalists, event producers, and book publishers to download your approved high-resolution portraits, bio, and press mentions.",
  },
  {
    icon: "🌐",
    title: "Custom Personal Domain",
    desc: "Connect your official personal domain (e.g. yourname.com or yourname.com.bd) with automatic free SSL and zero-maintenance edge hosting.",
  },
];

const BILINGUAL_PROOF = {
  title: "Bilingual English & Bengali Thought Leadership",
  badge: "BILINGUAL ESSAYS",
  enExcerpt:
    "Delighted to deliver the keynote address at the Bangladesh National Innovation Conclave on sustainable economic governance.",
  bnExcerpt:
    "জাতীয় উদ্ভাবন সম্মেলনে টেকসই অর্থনৈতিক সুশাসন ও আধুনিক নীতি সংস্কার বিষয়ক মূল প্রবন্ধ উপস্থাপন করতে পেরে আনন্দিত।",
  note: "Each publication, book excerpt, and speaking topic can be toggled instantly between English and Bengali without page reload.",
};

const FAQ: [string, string][] = [
  [
    "Can I connect my own personal domain (e.g. tanvirahmed.com)?",
    "Yes. All paid Business plans support your custom branded domain with free automatic SSL. Our Dhaka engineering team provides full DNS concierge setup assistance.",
  ],
  [
    "How do speaking invitations and interview requests reach me or my team?",
    "When an organizer fills out your speaking form, the invitation arrives instantly in your admin inbox with date, venue, topic, and organizer details. You also receive an instant WhatsApp alert with a prefilled confirmation reply.",
  ],
  [
    "Can I host downloadable PDFs like my full CV, book chapters, or press kit?",
    "Yes. The built-in downloads module securely hosts your high-resolution portrait photographs, media kit PDF, executive bio, and sample chapters with real-time download count tracking.",
  ],
  [
    "Do I need to hire a developer to update my articles and public schedule?",
    "No. BizTrackBD provides a visual smartphone-friendly admin dashboard. You can post new articles, update speaking dates, and manage media contacts from your phone in seconds.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD Public Profile & Thought Leader Website Platform",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "399",
    priceCurrency: "BDT",
  },
};

export default function PublicProfileWebsitesPage() {
  return (
    <VerticalLandingLayout
      eyebrow="Industry Blueprint · Public Figures & Leaders"
      title="The personal website platform for"
      titleHighlight="authors, speakers, and public leaders."
      lead="Establish an authoritative digital home for your ideas, books, columns, and public career. Distribute verified press kits, showcase op-eds, and capture speaking invitations without clutter or social media algorithm lock-in."
      badge="PUBLIC PROFILE & LEADER"
      demoId="public-profile"
      demoLabel="Public Profile Demo"
      templateSignupId="public-profile"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Build your authoritative public profile today"
      ctaSub="Join Bangladesh's leading authors, speakers, researchers, and public figures. Launch your verified personal website on your own custom domain."
    />
  );
}
