import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Business, Service & Portfolio Websites Built for Bangladesh",
  description:
    "Turn searches and visits into real customer enquiries. Fast Bangla-and-English websites, custom domains, WhatsApp and quote requests, organized lead inbox, and zero coding required.",
  alternates: {
    canonical: `${siteUrl}/business`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business`,
    siteName: "BizTrackBD",
    title: "Business, Service & Portfolio Websites Built for Bangladesh",
    description:
      "Turn searches and visits into real customer enquiries. Fast Bangla-and-English websites, custom domains, WhatsApp and quote requests, organized lead inbox.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Business" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Business, Service & Portfolio Websites Built for Bangladesh",
    description:
      "Fast Bangla-and-English websites, custom domains, WhatsApp quote requests, and organized lead inbox.",
    images: [`${siteUrl}/opengraph-image`],
  },
  keywords: [
    "business website builder bangladesh",
    "create business website bangladesh",
    "doctor website bangladesh",
    "restaurant website bangladesh",
    "portfolio website dhaka",
    "service business website bangladesh",
    "ব্যবসা ওয়েবসাইট তৈরি",
  ],
};

const VERTICALS = [
  {
    id: "company",
    name: "Corporate & Company",
    subtitle: "Consultancies, B2B agencies & enterprises",
    badge: "Apex Corporate",
    demoId: "apex-corporate",
    href: "/business/company-website",
    highlights: ["Service catalogue & case studies", "Downloadable company profile PDF", "Client logos & team bios", "Corporate quote request form"],
    sampleLead: "Request for IT Advisory & Cloud Migration Proposal (12 staff)",
  },
  {
    id: "services",
    name: "Local Service Providers",
    subtitle: "Repairs, contractors, cleaning & maintenance",
    badge: "Local Service Pro",
    demoId: "local-service-pro",
    href: "/business/service-websites",
    highlights: ["Transparent service package pricing", "Coverage area & neighborhood map", "1-tap WhatsApp consultation", "Fast response commitment badge"],
    sampleLead: "AC Deep Servicing Package booked for Banani Road 11",
  },
  {
    id: "clinic",
    name: "Doctors & Medical Clinics",
    subtitle: "Specialist doctors, diagnostic centers & dentists",
    badge: "Modern Clinic",
    demoId: "modern-clinic",
    href: "/business/doctor-websites",
    highlights: ["Verified BMDC registration display", "Multi-chamber weekly schedules", "Appointment request queue", "Interactive map & emergency phone"],
    sampleLead: "Appointment Request: Prof. Dr. Rahman (Sat 6:30 PM, Serial #14)",
  },
  {
    id: "restaurant",
    name: "Restaurants & Cafes",
    subtitle: "Bistros, bakeries, cafes & cloud kitchens",
    badge: "Dhaka Bistro",
    demoId: "dhaka-bistro",
    href: "/business/restaurant-websites",
    highlights: ["Digital QR code dining menu", "Table reservation requests", "Atmosphere & food photography gallery", "Opening hours & location directions"],
    sampleLead: "Table Reservation: 4 guests, Friday 8:00 PM (Banani Branch)",
  },
  {
    id: "portfolio",
    name: "Personal & Creator Portfolios",
    subtitle: "Designers, developers, photographers & consultants",
    badge: "Portfolio Focus",
    demoId: "portfolio-focus",
    href: "/business/portfolio-websites",
    highlights: ["Structured project case studies", "Curriculum Vitae / Resume PDF download", "Professional social & GitHub links", "Direct collaboration brief form"],
    sampleLead: "Freelance UI/UX Mobile App Brief (FinTech Dashboard)",
  },
  {
    id: "public-profile",
    name: "Public Figures & Leaders",
    subtitle: "Authors, researchers, keynote speakers & journalists",
    badge: "Public Profile",
    demoId: "public-profile",
    href: "/business/public-profile-websites",
    highlights: ["Media kit & press kit download", "Op-ed publications archive", "Official verified biography", "Speaking invitation inquiry form"],
    sampleLead: "Invitation: Keynote Speaker for Bangladesh Tech Summit 2026",
  },
];

const BUSINESS_FAQ = [
  [
    "How is BizTrackBD Business different from global builders like Wix or Squarespace?",
    "Global builders are designed for Western credit cards and English-only workflows. BizTrackBD Business gives you native Bangla and English editing, local Taka pricing without dollar conversion fees, direct WhatsApp enquiry integration, and an organized local lead inbox editable straight from your smartphone.",
  ],
  [
    "Can I connect my own custom domain (.com, .com.bd, .net)?",
    "Yes. Every paid business plan includes custom domain connection with automated free SSL certificates. You can also start with yourname.biztrack.bd while setting up.",
  ],
  [
    "Do inquiries get lost if customers message on WhatsApp or submit forms?",
    "No. Every quote request, appointment inquiry, and contact submission enters your structured BizTrackBD Lead Inbox. You and your team can assign staff, add follow-up notes, and track statuses from 'New' to 'Confirmed'.",
  ],
  [
    "Can I start with a Business website and add an online store later?",
    "Yes. That is the core benefit of the BizTrackBD platform. You can begin with a professional company, clinic, or service site, and seamlessly upgrade to a Hybrid store later to sell merchandise or physical products without losing your pages, SEO rankings, or leads.",
  ],
  [
    "Is coding knowledge required to edit my pages?",
    "None whatsoever. Our phone-first block editor lets you update text, chamber hours, menu prices, team members, and photos in seconds from your phone.",
  ],
];

export default function BusinessPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero hero-center" style={{ background: "var(--bg-paper)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <span
            className="eyebrow"
            style={{
              color: "var(--business)",
              background: "var(--business-tint)",
              borderColor: "var(--business-border)",
              borderWidth: 1,
              borderStyle: "solid",
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              display: "inline-block",
              marginBottom: 14,
            }}
          >
            Business &amp; Service Websites Built for Bangladesh
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Turn searches, visits and shares <br className="hidden-mobile" />
            into <span style={{ color: "var(--business)" }}>real customer enquiries.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Build a fast Bangla-and-English website, connect your own domain, manage every page from your phone, and keep calls, WhatsApp chats, quote requests and bookings organized in one structured lead inbox.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=business"
              className="btn btn-primary btn-lg"
              style={{ background: "var(--business)", borderColor: "var(--business-dark)" }}
              prefetch={false}
            >
              Build my website free for 14 days
            </Link>
            <a
              href={demoAdminUrl("modern-clinic")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Try live business demo desk ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Plans from ৳ 399/mo &middot; Custom domain included &middot; No dollar card needed &middot; Phone-friendly admin
          </p>
        </div>
      </section>

      {/* Interactive Visitor-to-Lead Workflow Journey */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-lead" style={{ marginBottom: 12 }}>
              THE BUSINESS VALUE PROMISE
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)" }}>
              A website that actually does something after it looks good
            </h2>
            <p style={{ margin: "14px auto 0", fontSize: 16.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Most website builders hand you a static design and leave you to figure out how customers contact you. BizTrackBD connects visitor actions directly to your business phone and team desk.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              {
                step: "01",
                title: "Local Discovery",
                desc: "Client searches Google or clicks a Facebook link. Site loads swiftly on 4G with clean Bangla/English SEO.",
                stamp: "FAST LCP",
              },
              {
                step: "02",
                title: "Structured Proof",
                desc: "Visitor explores verified doctor credentials, menu items, service fees, or past case study outcomes.",
                stamp: "TRUSTED PROOF",
              },
              {
                step: "03",
                title: "1-Tap Action",
                desc: "Customer initiates a WhatsApp conversation, requests a table booking, or submits project specifications.",
                stamp: "DIRECT ACTION",
              },
              {
                step: "04",
                title: "Central Lead Inbox",
                desc: "Inquiry appears instantly in your merchant desk. Assign team members, track statuses, and add internal notes.",
                stamp: "LEAD CAPTURED",
              },
            ].map((st) => (
              <div key={st.step} className="card ledger-border" style={{ padding: "22px 20px", background: "#FFFFFF" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "var(--business)", opacity: 0.8 }}>{st.step}</span>
                  <span className="status-stamp stamp-lead" style={{ fontSize: 10 }}>{st.stamp}</span>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--ink-ledger)" }}>{st.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verticals & Blueprints */}
      <section id="verticals" className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
            <span className="eyebrow">Specialized Blueprints</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)" }}>
              Tailored for how Bangladeshi businesses operate
            </h2>
            <p style={{ margin: "14px auto 0", fontSize: 16.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Whether you run a medical chamber in Banani, a restaurant in Dhanmondi, or a consultancy in Gulshan, our blueprints have the exact modules you need.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {VERTICALS.map((v) => (
              <div
                key={v.id}
                className="card ledger-border"
                style={{
                  padding: "26px 24px",
                  background: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="status-stamp stamp-lead">{v.badge}</span>
                  <a
                    href={demoAdminUrl(v.demoId)}
                    style={{ fontSize: 12.5, fontWeight: 700, color: "var(--business)" }}
                  >
                    Open live demo ↗
                  </a>
                </div>

                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--ink-ledger)" }}>{v.name}</h3>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>{v.subtitle}</div>
                </div>

                <div style={{ background: "#F0FDFA", padding: "12px 14px", borderRadius: 8, border: "1px solid #CCFBF1", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#0F766E", marginBottom: 3, fontSize: 11.5, textTransform: "uppercase" }}>
                    Example Captured Lead:
                  </div>
                  <div style={{ color: "var(--ink-ledger)", fontWeight: 500 }}>&ldquo;{v.sampleLead}&rdquo;</div>
                </div>

                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.7 }}>
                  {v.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>

                <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <Link
                    href={`/start?mode=business&theme=${v.demoId}`}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                    prefetch={false}
                  >
                    Start with this blueprint &rarr;
                  </Link>
                  <Link
                    href={v.href}
                    className="link"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: "block",
                      textAlign: "center",
                      marginTop: 8,
                      color: "var(--business)",
                    }}
                  >
                    Read {v.name} Guide →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link
              href="/business/templates"
              className="btn btn-secondary btn-lg"
              style={{
                background: "#FFFFFF",
                borderColor: "var(--business)",
                color: "var(--business)",
                fontWeight: 700,
                fontSize: 15,
                padding: "12px 28px",
              }}
            >
              Browse All 6 Verified Business Templates &amp; Interactive Previews →
            </Link>
          </div>
        </div>
      </section>

      {/* The Upgrade to Hybrid Story */}
      <section id="hybrid" className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div
            className="card ledger-border"
            style={{
              padding: "clamp(20px, 4vw, 36px) clamp(16px, 4vw, 32px)",
              background: "#F8FAFC",
              border: "1.5px solid var(--line-strong)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "center" }}>
              <div>
                <span className="status-stamp stamp-review" style={{ marginBottom: 10 }}>
                  THE HYBRID ADVANTAGE
                </span>
                <h2 style={{ margin: 0, fontSize: "clamp(24px, 3.5vw, 34px)", color: "var(--ink-ledger)" }}>
                  Need to sell merchandise or take bookings from one website?
                </h2>
                <p style={{ margin: "12px 0 0", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 720 }}>
                  With BizTrackBD Hybrid, you don&apos;t need two separate websites. A medical clinic can sell health supplements, a restaurant can sell gourmet packaged sauces, or an agency can sell physical books—all with unified bKash checkout and courier automation on your primary domain.
                </p>
              </div>
              <div style={{ justifySelf: "start" }}>
                <Link
                  href="/start?mode=hybrid"
                  className="btn btn-primary btn-lg"
                  style={{ background: "var(--brand)" }}
                  prefetch={false}
                >
                  Explore Hybrid Setup &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Pilot Preview */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Business &amp; Portfolio Pricing</span>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
            Honest plans in Bangladeshi Taka
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: 640, fontSize: 16, color: "var(--ink-2)" }}>
            Every plan includes custom domain connection, phone-first editor, and 14-day free trial.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 32, textAlign: "left" }}>
            <div className="card ledger-border" style={{ padding: "26px 22px", background: "#FFFFFF" }}>
              <span className="status-stamp stamp-lead">STARTER</span>
              <h3 style={{ margin: "8px 0 4px", fontSize: 20, color: "var(--ink-ledger)" }}>৳ 399 <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-3)" }}>/ month</span></h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>For solo consultants, doctors, and personal portfolios</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
                <li>Up to 5 pages with custom domain</li>
                <li>Bilingual Bangla &amp; English fields</li>
                <li>Direct WhatsApp &amp; Contact Form</li>
                <li>Centralized Lead Inbox</li>
                <li>0% sales commission</li>
              </ul>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <Link href="/start?mode=business&plan=STARTER" className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} prefetch={false}>
                  Start 14-Day Trial
                </Link>
              </div>
            </div>

            <div className="card ledger-border" style={{ padding: "26px 22px", background: "#FFFFFF", border: "2px solid var(--business)", boxShadow: "0 8px 24px rgba(13, 148, 136, 0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="status-stamp stamp-lead" style={{ background: "var(--business)", color: "#FFFFFF" }}>POPULAR · BUSINESS</span>
                <span className="pill" style={{ fontSize: 11 }}>Most Picked</span>
              </div>
              <h3 style={{ margin: "8px 0 4px", fontSize: 20, color: "var(--ink-ledger)" }}>৳ 799 <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-3)" }}>/ month</span></h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>For active service firms, restaurants, and medical clinics</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7 }}>
                <li>Up to 20 pages with custom domain</li>
                <li>Online booking &amp; table reservations</li>
                <li>Digital QR menu (food &amp; dining)</li>
                <li>3 team / staff accounts</li>
                <li>Meta Pixel &amp; Lead Tracking ready</li>
              </ul>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <Link href="/start?mode=business&plan=PRO" className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center", background: "var(--business)" }} prefetch={false}>
                  Start 14-Day Trial
                </Link>
              </div>
            </div>

            <div className="card ledger-border" style={{ padding: "26px 22px", background: "#FFFFFF" }}>
              <span className="status-stamp stamp-lead">BUSINESS PLUS</span>
              <h3 style={{ margin: "8px 0 4px", fontSize: 20, color: "var(--ink-ledger)" }}>৳ 1,499 <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-3)" }}>/ month</span></h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>For corporate firms, multi-branch entities &amp; hybrid stores</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
                <li>Up to 50 pages with multi-branch maps</li>
                <li>Hybrid store: sell up to 50 products</li>
                <li>8 team / staff accounts</li>
                <li>Lead CSV data exports &amp; analytics</li>
                <li>Priority phone &amp; WhatsApp support</li>
              </ul>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <Link href="/start?mode=business&plan=BUSINESS" className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} prefetch={false}>
                  Start 14-Day Trial
                </Link>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link
              href="/business/pricing"
              className="btn btn-secondary"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: "var(--business)",
                borderColor: "var(--business)",
                background: "#FFFFFF",
                padding: "10px 22px",
              }}
            >
              Compare All Business Plan Features &amp; BDT Billing FAQ →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Business websites
          </h2>
          <dl className="faq-list">
            {BUSINESS_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band" style={{ background: "var(--business-dark)" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Launch your professional business website in minutes
          </h2>
          <p style={{ color: "#CCFBF1", fontSize: 17, marginTop: 10 }}>
            14 days free &middot; Custom domain included &middot; Editable from your smartphone
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start?mode=business" className="btn btn-lg btn-primary" style={{ background: "#FFFFFF", color: "var(--business-dark)" }} prefetch={false}>
              Build your website now
            </Link>
            <a
              href={demoAdminUrl("modern-clinic")}
              className="btn btn-lg btn-secondary"
              style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}
            >
              Open Live Clinic Demo Desk ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
