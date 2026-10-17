import type { Metadata } from "next";
import { VerticalLandingLayout } from "@/components/vertical-landing-layout";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Doctor & Medical Clinic Website Builder for Bangladesh",
  description:
    "Build a professional website for your medical practice, clinic, or specialist doctor chamber. Display verified BMDC credentials, multi-chamber schedules, and streamline appointment requests.",
  keywords: [
    "doctor website bangladesh",
    "medical clinic website builder dhaka",
    "doctor appointment website bangladesh",
    "chambers website bangladesh",
    "ডাক্তার চেম্বার ওয়েবসাইট",
  ],
  alternates: {
    canonical: `${siteUrl}/business/doctor-websites`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/doctor-websites`,
    siteName: "BizTrackBD",
    title: "Doctor & Medical Clinic Website Builder for Bangladesh",
    description: "Display verified BMDC credentials, multi-chamber schedules, and patient appointment requests.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Doctor Website Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doctor & Medical Clinic Website Builder for Bangladesh",
    description: "Professional medical chamber presence and administrative appointment requests.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BLUEPRINT_TABS = [
  {
    id: "credentials",
    label: "01. Verified Credentials",
    customerHeading: "Medical Qualifications & BMDC Verification",
    customerSub: "Patients verify professional degrees, medical registration numbers, and consulting hospital designations.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Prof. Dr. Mohammad Rahman &middot; BMDC Reg: A-24810
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          MBBS, FCPS (Medicine), MD, FACP (USA) &middot; Senior Consultant Internal Medicine &amp; Diabetes
        </div>
      </div>
    ),
    ownerHeading: "Credential Management in Admin",
    ownerStatus: { text: "BMDC VERIFIED", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Affiliations:</strong> Popular Diagnostic (Banani) &amp; Ibn Sina</div>
        <div><strong>Experience:</strong> 22+ Years Clinical Practice</div>
        <div style={{ marginTop: 6, color: "var(--business)", fontWeight: 600 }}>Ethical compliance: zero medical claims or diagnosis collecting</div>
      </div>
    ),
  },
  {
    id: "chambers",
    label: "02. Multi-Chamber Schedule",
    customerHeading: "Chamber Locations & Weekly Visiting Hours",
    customerSub: "Patient selects chamber location and checks visiting days, consultation fees, and serial reporting times.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-ledger)" }}>
          Chamber 1: Popular Diagnostic (Banani) &middot; Sat, Mon, Wed (5:00 PM – 9:00 PM)
        </div>
        <div style={{ fontSize: 12.5, color: "#15803D", marginTop: 4 }}>
          Road 11, Banani, Dhaka &middot; New Patient Fee: ৳ 1,500 &middot; Follow-up: ৳ 1,000
        </div>
      </div>
    ),
    ownerHeading: "Chamber Availability Matrix",
    ownerStatus: { text: "ACTIVE SCHEDULE", stampClass: "stamp-lead" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Max Capacity:</strong> 25 Patients / Chamber Evening</div>
        <div><strong>Assistant:</strong> Chamber Secretary Account Active</div>
        <div style={{ marginTop: 6, color: "var(--ink-ledger)", fontWeight: 600 }}>Update emergency holiday notices in 1 tap from phone</div>
      </div>
    ),
  },
  {
    id: "appointments",
    label: "03. Appointment Request",
    customerHeading: "Patient Appointment Request Form",
    customerSub: "Patient inputs name, phone number, and preferred date without disclosing sensitive medical history.",
    customerContent: (
      <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--business)" }}>
          Appointment Request: Tanzimul Haque &middot; Sat 6:30 PM &middot; Serial #14
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
          Clear confirmation that booking is awaiting chamber confirmation.
        </div>
      </div>
    ),
    ownerHeading: "Chamber Secretary Inbox",
    ownerStatus: { text: "SERIAL CONFIRMED", stampClass: "stamp-paid" },
    ownerContent: (
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        <div><strong>Status:</strong> Confirmed &middot; Serial #14 Assigned</div>
        <div><strong>Action:</strong> Instant WhatsApp serial confirmation receipt ready</div>
        <div style={{ marginTop: 6, color: "#166534", fontWeight: 700 }}>Zero crowded reception phone calls</div>
      </div>
    ),
  },
];

const CORE_MODULES = [
  { icon: "🩺", title: "BMDC Credential Showcase", desc: "Display verified medical degrees, registrations, and specializations prominently." },
  { icon: "🗓️", title: "Multi-Chamber Matrices", desc: "List schedules across multiple hospital diagnostic centers with consultation fees." },
  { icon: "📱", title: "Smart Appointment Requests", desc: "Non-clinical serial request queue manageable by your chamber assistant on mobile." },
  { icon: "📲", title: "WhatsApp & Digital Receipts", desc: "Instant serial number confirmation and arrival instructions via WhatsApp and web receipts." },
  { icon: "🗺️", title: "Chamber Map Directions", desc: "One-tap Google Maps directions to hospital branches in Banani, Dhanmondi, or Mirpur." },
  { icon: "🏥", title: "Physician & Medical Schema", desc: "Structured data ensuring search engines recognize you as a verified medical professional." },
];

const BILINGUAL_PROOF = {
  title: "Bilingual Patient Trust & Credentials",
  badge: "ETHICAL MEDICAL CLEARANCE",
  enExcerpt: "MBBS, FCPS (Medicine), MD, FACP (USA) · Senior Consultant — Internal Medicine & Diabetes Specialist · Regular chambers at Popular Diagnostic (Banani) & Ibn Sina (Mirpur)",
  bnExcerpt: "অধ্যাপক ডাঃ মোহাম্মদ রহমান · এমবিবিএস, এফসিপিএস (মেডিসিন), এমডি · সিনিয়র কনসালট্যান্ট — ইন্টারনাল মেডিসিন ও ডায়াবেটিস বিশেষজ্ঞ · নিয়মিত চেম্বারঃ পপুলার ডায়াগনস্টিক (ধানমন্ডি) ও ইবনে সিনা (মিরপুর)",
  note: "Patients can read degrees, chamber schedules, and serial instructions in natural, dignified Bangla or English.",
};

const FAQ: [string, string][] = [
  [
    "Can my chamber secretary or assistant manage the patient booking list?",
    "Yes. You can assign staff accounts with access restricted to viewing and confirming patient appointment serials, keeping your platform settings private.",
  ],
  [
    "Does the appointment form collect sensitive clinical symptoms or prescriptions?",
    "No. In compliance with medical privacy standards, the system strictly handles administrative booking (patient name, phone, preferred chamber, date, and serial number), never storing sensitive clinical diagnosis records.",
  ],
  [
    "Can patients find our chamber on Google Maps from the website?",
    "Yes. Every chamber location includes interactive Google Maps pins and direct 'Get Directions' links optimized for smartphone navigation.",
  ],
  [
    "What happens if the doctor has an emergency surgery and needs to cancel a chamber?",
    "You can mark a chamber as 'Closed Today' with 1 tap on your phone, and notify scheduled patients via 1-tap WhatsApp broadcast or direct contact.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "@id": `${siteUrl}/business/doctor-websites#webpage`,
      url: `${siteUrl}/business/doctor-websites`,
      name: "Doctor & Medical Clinic Website Builder for Bangladesh",
      description: "Build a professional website for your medical practice, clinic, or specialist doctor chamber with verified BMDC credentials.",
      about: {
        "@type": "MedicalBusiness",
        name: "Doctor & Medical Chamber Blueprint",
        areaServed: {
          "@type": "Country",
          name: "Bangladesh",
        },
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/business/doctor-websites#software`,
      name: "BizTrackBD Doctor & Clinic Website Blueprint",
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

export default function DoctorWebsitesPage() {
  return (
    <VerticalLandingLayout
      eyebrow="Healthcare & Medical Clinic Websites"
      title="A verified medical presence patients can"
      titleHighlight="trust and book with ease."
      lead="For specialist doctors, diagnostic clinics, dental practices, and healthcare chambers. Display verified BMDC credentials, manage multi-chamber weekly schedules, and streamline appointment serials without crowded reception chaos."
      badge="Modern Clinic"
      demoId="modern-clinic"
      demoLabel="Try Clinic Demo Workspace"
      templateSignupId="modern-clinic"
      blueprintTabs={BLUEPRINT_TABS}
      coreModules={CORE_MODULES}
      bilingualProof={BILINGUAL_PROOF}
      faq={FAQ}
      schemaJsonLd={schemaJsonLd}
      ctaHeading="Build a dignified digital presence for your medical practice"
      ctaSub="14 days free · Custom domain included · Zero coding required"
    />
  );
}
