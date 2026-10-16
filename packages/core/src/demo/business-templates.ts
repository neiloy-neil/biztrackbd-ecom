import type { ThemeId } from "../builder/theme";
import type { Palette } from "./art";
import type { BusinessVertical } from "../site/mode";
import type { SiteContentKind } from "@biztrackbd/db";

export interface BusinessDemoMenuItem {
  name: string;
  nameBn: string;
  description: string;
  price: number;
  compareAt?: number;
  dietary: string[];
}

export interface BusinessDemoMenuCategory {
  name: string;
  nameBn: string;
  description: string;
  items: BusinessDemoMenuItem[];
}

export interface BusinessDemoContentItem {
  kind: SiteContentKind;
  slug: string;
  title: string;
  titleBn: string;
  summary: string;
  summaryBn: string;
  data: Record<string, unknown>;
}

export interface BusinessDemoDownload {
  label: string;
  labelBn: string;
  kind: string;
  fileName: string;
  fileUrl: string;
  isPublic: boolean;
}

export interface BusinessDemoTemplate {
  id: string;
  host: string;
  vertical: BusinessVertical;
  name: string;
  nameBn: string;
  tagline: string;
  taglineBn: string;
  description: string;
  palette: Palette;
  phone: string;
  whatsapp: string;
  address: string;
  addressBn: string;
  baseLook: ThemeId;
  menuCategories?: BusinessDemoMenuCategory[];
  contentItems?: BusinessDemoContentItem[];
  downloads?: BusinessDemoDownload[];
}

export const BUSINESS_DEMO_TEMPLATES: BusinessDemoTemplate[] = [
  // 1. Restaurant — Dhaka Bistro
  {
    id: "dhaka-bistro",
    host: "dhakabistro",
    vertical: "RESTAURANT",
    name: "Dhaka Bistro",
    nameBn: "ঢাকা বিস্ট্রো",
    tagline: "Authentic Flavors, Handcrafted Daily",
    taglineBn: "খাঁটি স্বাদ ও আতিথেয়তার অনন্য ঠিকানা",
    description: "Experience Dhaka's finest culinary traditions prepared with fresh local ingredients and passionate craftsmanship.",
    palette: { bg: "#FFFDF8", main: "#1C1917", accent: "#D97706", ink: "#1C1917" },
    baseLook: "berber",
    phone: "+8801700000000",
    whatsapp: "+8801700000000",
    address: "Road 11, Block D, Banani, Dhaka 1213",
    addressBn: "রোড ১১, ব্লক ডি, বনানী, ঢাকা ১২১৩",
    menuCategories: [
      {
        name: "Starters & Kebabs",
        nameBn: "স্টার্টার ও কাবাব",
        description: "Freshly prepared sizzling kebabs and crispy appetizers",
        items: [
          {
            name: "Shahi Reshmi Kebab",
            nameBn: "শাহী রেশমি কাবাব",
            description: "Tender chicken breasts marinated in cashew cream, green chilies, and saffron herbs, chargrilled to perfection.",
            price: 350,
            compareAt: 400,
            dietary: ["halal", "chef_special"],
          },
          {
            name: "Special Chicken Dahi Fuchka",
            nameBn: "চিকেন দই ফুচকা",
            description: "Crispy hollow shells filled with spiced potato-chicken blend, sweet yogurt, and tamarind chutney.",
            price: 220,
            dietary: ["popular", "halal"],
          },
          {
            name: "Crispy Fried Calamari Rings",
            nameBn: "ক্রিস্পি কালামারি রিংস",
            description: "Fresh calamari rings tossed in spiced batter and served with homemade garlic-herb tartar dip.",
            price: 380,
            dietary: ["chef_special"],
          },
        ],
      },
      {
        name: "Signature Mains & Biryani",
        nameBn: "সিগনেচার মেইন ডিশ ও বিরিয়ানি",
        description: "Slow-cooked authentic rice specialties prepared daily in small batches",
        items: [
          {
            name: "Traditional Shahi Kacchi Biryani",
            nameBn: "ঐতিহ্যবাহী শাহী কাচ্চি বিরিয়ানি",
            description: "Basmati rice layered with prime tender mutton, baby potatoes, alubokhara, and rich ghee-infused aromatics.",
            price: 480,
            compareAt: 550,
            dietary: ["halal", "chef_special", "popular"],
          },
          {
            name: "Old Dhaka Special Beef Tehari",
            nameBn: "পুরান ঢাকার স্পেশাল বিফ তেহারি",
            description: "Aromatic chinigura rice cooked in cold-pressed mustard oil with succulent beef cubes and fiery green chilies.",
            price: 340,
            dietary: ["halal", "spicy"],
          },
          {
            name: "Mutton Bhuna Khichuri Platter",
            nameBn: "খাসির ভুনা খিচুড়ি প্ল্যাটার",
            description: "Moong dal khichuri served with slow-roasted mutton bhuna, boiled egg, and tangy mango pickle.",
            price: 450,
            dietary: ["halal", "popular"],
          },
        ],
      },
      {
        name: "Beverages & Desserts",
        nameBn: "পানীয় ও মিষ্টান্ন",
        description: "Refreshing traditional drinks and artisanal desserts",
        items: [
          {
            name: "Traditional Shahi Borhani",
            nameBn: "ঐতিহ্যবাহী শাহী বোরহানি",
            description: "Thick curd blended with roasted cumin, black pepper, fresh mint, and mustard seeds.",
            price: 80,
            dietary: ["halal", "beverage", "vegetarian"],
          },
          {
            name: "Nawabganj Badam Sharbat",
            nameBn: "নবাবগঞ্জ বাদাম শরবত",
            description: "Chilled full-cream milk steeped with crushed almonds, pistachios, saffron, and cardamom.",
            price: 120,
            dietary: ["halal", "beverage", "vegetarian"],
          },
          {
            name: "Zafrani Matka Firni",
            nameBn: "জাফরানি মটকা ফিরনি",
            description: "Creamy ground rice pudding chilled in authentic earthen clay pots with pistachios and pure saffron.",
            price: 140,
            dietary: ["halal", "vegetarian"],
          },
        ],
      },
    ],
  },

  // 2. Doctor/Clinic — Modern Clinic
  {
    id: "modern-clinic",
    host: "modernclinic",
    vertical: "DOCTOR_CLINIC",
    name: "Modern Clinic & Chambers",
    nameBn: "মডার্ন ক্লিনিক ও চেম্বার",
    tagline: "Specialist Care & Evidence-Based Medicine",
    taglineBn: "আধুনিক ও নির্ভরযোগ্য চিকিৎসা সেবা",
    description: "Senior consultant practice with multi-chamber schedules across Dhaka city.",
    palette: { bg: "#F8FAFC", main: "#0F172A", accent: "#0284C7", ink: "#0F172A" },
    baseLook: "gadgetstudio",
    phone: "+8801700000000",
    whatsapp: "+8801700000000",
    address: "Dhanmondi & Mirpur, Dhaka",
    addressBn: "ধানমন্ডি ও মিরপুর, ঢাকা",
    contentItems: [
      {
        kind: "SERVICE",
        slug: "diabetes-metabolic-care",
        title: "Diabetes & Metabolic Disorders",
        titleBn: "ডায়াবেটিস ও মেটাবলিক রোগ চিকিৎসা",
        summary: "Comprehensive glycemic control, continuous glucose monitoring, and personalized dietary management plans.",
        summaryBn: "ডায়াবেটিস ও রক্তের সুগার নিয়ন্ত্রণের জন্য উন্নত চিকিৎসা ও কাউন্সেলিং।",
        data: {
          priceStartingAt: 1500,
          priceStartingAtBn: "৳১,৫০০",
          duration: "30-45 minutes",
          durationBn: "৩০-৪৫ মিনিট",
          features: [
            "Continuous Glucose Monitoring Assessment",
            "Insulin Regimen Optimization",
            "Diabetic Neuropathy & Foot Screening",
          ],
          featuresBn: [
            "গ্লুকোজ মনিটরিং ও মূল্যায়ন",
            "ইনসুলিন ডোজ সমন্বয়",
            "ডায়াবেটিক ফুট ও স্নায়ু পরীক্ষা",
          ],
          ctaLabel: "Book Consultation",
          ctaLabelBn: "সিরিয়াল বুক করুন",
          ctaUrl: "/appointment",
        },
      },
      {
        kind: "SERVICE",
        slug: "cardiovascular-hypertension",
        title: "Hypertension & Cardiovascular Health",
        titleBn: "উচ্চ রক্তচাপ ও হৃদরোগ পরামর্শ",
        summary: "Evidence-based blood pressure management, ECG interpretation, and cardiovascular risk stratification.",
        summaryBn: "উচ্চ রক্তচাপ ও হৃদরোগের ঝুঁকি কমাতে সঠিক ওষুধ ও জীবনধারা পরামর্শ।",
        data: {
          priceStartingAt: 1500,
          priceStartingAtBn: "৳১,৫০০",
          duration: "30 minutes",
          durationBn: "৩০ মিনিট",
          features: [
            "24-Hour Ambulatory Blood Pressure Evaluation",
            "Lipid Profile Assessment",
            "Cardiovascular Lifestyle Counseling",
          ],
          featuresBn: [
            "রক্তচাপ ও লিপিড প্রোফাইল মূল্যায়ন",
            "হৃদরোগের ঝুঁকি কমানোর সঠিক দিকনির্দেশনা",
          ],
          ctaLabel: "Book Consultation",
          ctaLabelBn: "সিরিয়াল বুক করুন",
          ctaUrl: "/appointment",
        },
      },
      {
        kind: "SERVICE",
        slug: "executive-health-checkup",
        title: "Executive Health Screening",
        titleBn: "এক্সিকিউটিভ হেলথ স্ক্রিনিং",
        summary: "Annual preventive physical examination, biomarker diagnostics, and systemic health audit.",
        summaryBn: "বার্ষিক সামগ্রিক স্বাস্থ্য পরীক্ষা ও বিশেষজ্ঞ চিকিৎসকের পরামর্শ।",
        data: {
          priceStartingAt: 3000,
          priceStartingAtBn: "৳৩,০০০",
          duration: "60 minutes",
          durationBn: "১ ঘণ্টা",
          features: [
            "Comprehensive Organ Function Audit",
            "Thyroid & Hormone Analysis Review",
            "Detailed Health Strategy Report",
          ],
          featuresBn: [
            "সকল গুরুত্বপূর্ণ অঙ্গের কার্যকারিতা পরীক্ষা",
            "থাইরয়েড ও হরমোন টেস্ট মূল্যায়ন",
          ],
          ctaLabel: "Schedule Screening",
          ctaLabelBn: "স্ক্রিনিং শিডিউল করুন",
          ctaUrl: "/appointment",
        },
      },
      {
        kind: "CREDENTIAL",
        slug: "bmdc-registration-a24810",
        title: "BMDC Registration: A-24810",
        titleBn: "বিএমডিসি রেজিস্ট্রেশন: এ-২৪৮১০",
        summary: "Licensed Senior Medical Consultant registered with the Bangladesh Medical & Dental Council.",
        summaryBn: "বাংলাদেশ মেডিকেল অ্যান্ড ডেন্টাল কাউন্সিল কর্তৃক নিবন্ধিত সিনিয়র কনসালট্যান্ট।",
        data: {
          issuer: "Bangladesh Medical & Dental Council (BMDC)",
          issuerBn: "বাংলাদেশ মেডিকেল অ্যান্ড ডেন্টাল কাউন্সিল",
          issueDate: "2004",
          credentialId: "A-24810",
          credentialType: "Medical License",
        },
      },
      {
        kind: "CREDENTIAL",
        slug: "fellow-american-college-physicians",
        title: "Fellow of the American College of Physicians (FACP)",
        titleBn: "ফেলো — আমেরিকান কলেজ অব ফিজিশিয়ানস (এফএসিপি)",
        summary: "International fellowship recognition awarded for excellence and leadership in Internal Medicine.",
        summaryBn: "ইন্টারনাল মেডিসিন ও চিকিৎসা ক্ষেত্রে অনন্য অবদানের জন্য আন্তর্জাতিক ফেলোশিপ।",
        data: {
          issuer: "American College of Physicians (USA)",
          issuerBn: "আমেরিকান কলেজ অব ফিজিশিয়ানস (যুক্তরাষ্ট্র)",
          issueDate: "2016",
          credentialType: "Honorary Fellowship",
        },
      },
    ],
  },

  // 3. Corporate — Apex Corporate
  {
    id: "apex-corporate",
    host: "apexcorp",
    vertical: "BUSINESS_COMPANY",
    name: "Apex Corporate Advisory",
    nameBn: "অ্যাপেক্স কর্পোরেট এডভাইজরি",
    tagline: "Strategic Solutions. Measurable Growth.",
    taglineBn: "ব্যবসায়িক প্রবৃদ্ধি ও কৌশলগত সমাধানের বিশ্বস্ত অংশীদার",
    description: "We partner with ambitious enterprises and institutions across Bangladesh to deliver world-class advisory, technology, and operations.",
    palette: { bg: "#FFFFFF", main: "#111827", accent: "#1E40AF", ink: "#111827" },
    baseLook: "kapor",
    phone: "+8801800000000",
    whatsapp: "+8801800000000",
    address: "Gulshan-1, Dhaka 1212",
    addressBn: "গুলশান-১, ঢাকা ১২১২",
    contentItems: [
      {
        kind: "SERVICE",
        slug: "enterprise-strategy-advisory",
        title: "Enterprise Strategy & Management Advisory",
        titleBn: "কৌশলগত ব্যবসায়িক পরামর্শ",
        summary: "Market entry strategies, organizational restructuring, and corporate governance for high-growth firms.",
        summaryBn: "কোম্পানির পরিচালনা ও প্রবৃদ্ধির জন্য আন্তর্জাতিক মানের স্ট্র্যাটেজিক পরামর্শ।",
        data: {
          features: [
            "Corporate Governance & Compliance",
            "M&A and Due Diligence Support",
            "Market Expansion Roadmaps",
          ],
          featuresBn: [
            "কর্পোরেট গভর্নেন্স ও কমপ্লায়েন্স",
            "মার্কেট এক্সপানশন ও প্রবৃদ্ধি কৌশল",
          ],
          ctaLabel: "Inquire Now",
          ctaLabelBn: "আলোচনা করুন",
          ctaUrl: "/contact",
        },
      },
      {
        kind: "SERVICE",
        slug: "cloud-technology-architecture",
        title: "Cloud & Enterprise Software Architecture",
        titleBn: "এন্টারপ্রাইজ সফটওয়্যার ও ক্লাউড সমাধান",
        summary: "Modernizing legacy ERPs, building resilient cloud infrastructure, and automating core operational pipelines.",
        summaryBn: "আধুনিক ক্লাউড প্রযুক্তি ও অটোমেশনের মাধ্যমে প্রতিষ্ঠানের কার্যক্ষমতা বৃদ্ধি।",
        data: {
          features: [
            "Enterprise ERP & CRM Integration",
            "Cloud Security & Disaster Recovery",
            "DevOps & Microservice Architecture",
          ],
          featuresBn: [
            "ইআরপি ও সিআরএম ইন্টিগ্রেশন",
            "ক্লাউড সিকিউরিটি ও ব্যাকআপ সিস্টেম",
          ],
          ctaLabel: "Schedule Technical Audit",
          ctaLabelBn: "অডিট শিডিউল করুন",
          ctaUrl: "/contact",
        },
      },
      {
        kind: "TEAM",
        slug: "tareq-mahmud-ceo",
        title: "Tareq Mahmud",
        titleBn: "তারেক মাহমুদ",
        summary: "Managing Director & Senior Partner with 18+ years leading enterprise transformations in Southeast Asia.",
        summaryBn: "ম্যানেজিং ডিরেক্টর ও পার্টনার, ব্যবসায়িক রূপান্তরের অভিজ্ঞ কৌশলবিদ।",
        data: {
          role: "Managing Director & CEO",
          roleBn: "ম্যানেজিং ডিরেক্টর ও প্রধান নির্বাহী",
          email: "tareq@apexcorp.biztrack.me",
          bio: "Former McKinsey engagement manager and IBA graduate with deep experience in banking and supply chain infrastructure.",
          bioBn: "১৮ বছরেরও বেশি অভিজ্ঞতাসম্পন্ন অভিজ্ঞ কর্পোরেট উপদেষ্টা।",
        },
      },
      {
        kind: "TEAM",
        slug: "nusrat-jahan-cfa",
        title: "Nusrat Jahan, CFA",
        titleBn: "নুসরাত জাহান, সিএফএ",
        summary: "Head of Financial Advisory and Capital Markets with expertise in structured debt and valuation.",
        summaryBn: "হেড অব ফাইন্যান্সিয়াল এডভাইজরি ও ক্যাপিটাল মার্কেটস।",
        data: {
          role: "Head of Financial Advisory",
          roleBn: "হেড অব ফাইন্যান্সিয়াল এডভাইজরি",
          email: "nusrat@apexcorp.biztrack.me",
          bio: "Chartered Financial Analyst leading corporate restructuring, valuations, and venture fundraising mandates.",
          bioBn: "করপোরেট অর্থায়ন ও ঝুঁকি ব্যবস্থাপনায় অভিজ্ঞ বিশেষজ্ঞ।",
        },
      },
      {
        kind: "CREDENTIAL",
        slug: "iso-9001-certification",
        title: "ISO 9001:2015 Quality Management Certified",
        titleBn: "আইএসও ৯০০১:২০১৫ মানসনদ প্রাপ্ত",
        summary: "Certified compliance with international quality management standards for advisory services.",
        summaryBn: "আন্তর্জাতিক মান নিয়ন্ত্রণ সনদপ্রাপ্ত ব্যবস্থাপনা ও সেবা।",
        data: {
          issuer: "International Organization for Standardization (ISO)",
          issueDate: "2023",
          credentialType: "ISO Certification",
        },
      },
    ],
    downloads: [
      {
        label: "Download Apex Corporate Profile (PDF, 4.2 MB)",
        labelBn: "কোম্পানি প্রোফাইল ডাউনলোড করুন (পিডিএফ)",
        kind: "PROFILE",
        fileName: "Apex-Corporate-Profile-2026.pdf",
        fileUrl: "#",
        isPublic: true,
      },
    ],
  },

  // 4. Service Provider — Local Service Pro
  {
    id: "local-service-pro",
    host: "localservice",
    vertical: "SERVICE_PROVIDER",
    name: "Local Service Pro",
    nameBn: "লোকাল সার্ভিস প্রো",
    tagline: "Fast, Reliable Home & Tech Services Across Dhaka",
    taglineBn: "ঢাকা শহরের বিশ্বস্ত হোম ও টেকনিক্যাল সার্ভিস",
    description: "Verified background-checked technicians, fixed transparent rates, and a 30-day warranty on all repairs.",
    palette: { bg: "#F0FDFA", main: "#134E4A", accent: "#0D9488", ink: "#134E4A" },
    baseLook: "kapor",
    phone: "+8801900000000",
    whatsapp: "+8801900000000",
    address: "House 42, Road 7, Dhanmondi, Dhaka",
    addressBn: "বাড়ি ৪২, রোড ৭, ধানমন্ডি, ঢাকা",
    contentItems: [
      {
        kind: "SERVICE",
        slug: "ac-deep-master-wash",
        title: "Inverter AC Deep Jet Wash & Gas Top-up",
        titleBn: "এসি মাস্টার সার্ভিস ও ওয়াশ",
        summary: "High-pressure jet cleaning of indoor blower and outdoor condenser unit with eco-friendly sanitizing foam.",
        summaryBn: "হাই-প্রেসার ওয়াশ ও গ্যাস প্রেশার পরীক্ষার মাধ্যমে এসিকে দিন নতুন কার্যক্ষমতা।",
        data: {
          priceStartingAt: 1200,
          priceStartingAtBn: "৳১,২০০",
          duration: "90 minutes",
          durationBn: "৯০ মিনিট",
          features: [
            "Indoor & Outdoor Coil Jet Cleaning",
            "Refrigerant Gas Leakage Inspection",
            "30-Day Cooling Performance Warranty",
          ],
          featuresBn: [
            "ইনডোর ও আউটডোর কয়েল পরিষ্কার",
            "গ্যাস লিকেজ ও ইলেকট্রিক সেফটি চেক",
            "৩০ দিনের ফ্রি সার্ভিস ওয়ারেন্টি",
          ],
          ctaLabel: "Book AC Service",
          ctaLabelBn: "সার্ভিস বুক করুন",
          ctaUrl: "/quote",
        },
      },
      {
        kind: "SERVICE",
        slug: "electrical-circuit-diagnostics",
        title: "Electrical Safety & Short-Circuit Repair",
        titleBn: "ইলেকট্রিক্যাল শর্ট-সার্কিট মেরামত",
        summary: "Rapid diagnostic service for circuit breaker trips, load balancing, DB box rewiring, and appliance hookups.",
        summaryBn: "নিরাপদ ওয়্যারিং ও দ্রুত শর্ট-সার্কিট সমাধানের জন্য অভিজ্ঞ ইলেক্ট্রিশিয়ান।",
        data: {
          priceStartingAt: 800,
          priceStartingAtBn: "৳৮০০",
          duration: "60 minutes",
          durationBn: "৬০ মিনিট",
          features: [
            "Thermal Sensor Diagnostics",
            "Load Calculation & Circuit Breaker Replacement",
            "Certified Expert Electricians",
          ],
          featuresBn: [
            "সার্কিট ব্রেকার ও লোড পরীক্ষা",
            "সার্টিফাইড ইলেকট্রিশিয়ান দ্বারা কাজ",
          ],
          ctaLabel: "Request Electrician",
          ctaLabelBn: "ইলেকট্রিশিয়ান ডাকুন",
          ctaUrl: "/quote",
        },
      },
      {
        kind: "CREDENTIAL",
        slug: "verified-technician-guarantee",
        title: "100% Police-Verified Technicians",
        titleBn: "১০০% ভেরিফাইড টেকনিশিয়ান গ্যারান্টি",
        summary: "Every technician undergoes national NID verification and safety background clearance before assignment.",
        summaryBn: "জাতীয় পরিচয়পত্র যাচাইকৃত ও দক্ষ টেকনিশিয়ানদের নিরাপত্তা নিশ্চয়তা।",
        data: {
          issuer: "Service Pro Safety Bureau",
          credentialType: "Safety Standard",
        },
      },
    ],
  },

  // 5. Personal Portfolio — Portfolio Focus
  {
    id: "portfolio-focus",
    host: "creativefolio",
    vertical: "PERSONAL_PORTFOLIO",
    name: "Tanvir Hasan — Product Designer",
    nameBn: "তানভীর হাসান — প্রোডাক্ট ডিজাইনার",
    tagline: "Designing Scalable Digital Products & Design Systems",
    taglineBn: "আধুনিক ডিজিটাল প্রোডাক্ট ও ডিজাইন সিস্টেম আর্কিটেকচার",
    description: "Senior Product Designer & Engineer with 8+ years building enterprise web apps, fintech platforms, and scalable design systems.",
    palette: { bg: "#FAFAFA", main: "#18181B", accent: "#4F46E5", ink: "#18181B" },
    baseLook: "axionwear",
    phone: "+8801711111111",
    whatsapp: "+8801711111111",
    address: "Dhaka, Bangladesh",
    addressBn: "ঢাকা, বাংলাদেশ",
    contentItems: [
      {
        kind: "PORTFOLIO",
        slug: "paybangla-fintech-app",
        title: "PayBangla — Merchant Fintech Experience",
        titleBn: "পেবাংলা — মার্চেন্ট ফিনটেক মোবাইল অ্যাপ",
        summary: "End-to-end UX architecture for 200,000+ MSME merchants across Bangladesh with simplified QR payouts and microloans.",
        summaryBn: "বাংলাদেশের ক্ষুদ্র ব্যবসায়ীদের জন্য সহজ ও দ্রুত কিউআর পেমেন্ট অ্যাপ ডিজাইন।",
        data: {
          clientName: "PayBangla Digital Ltd",
          clientNameBn: "পেবাংলা ডিজিটাল লিমিটেড",
          completionDate: "2025",
          projectUrl: "https://paybangla.example.com",
          tags: ["Fintech", "Mobile App", "Figma", "Design System"],
          testimonialAuthor: "Zahirul Islam",
          testimonialRole: "VP of Product, PayBangla",
          testimonialQuote: "Tanvir redesigned our merchant onboarding funnel, cutting registration drop-off by 38% in the first quarter.",
        },
      },
      {
        kind: "PORTFOLIO",
        slug: "trackflow-logistics-erp",
        title: "TrackFlow — Courier & Freight Design System",
        titleBn: "ট্র্যাকফ্লো — কুরিয়ার ও লজিস্টিকস ইআরপি ডিজাইন",
        summary: "A unified high-density design system and operations dashboard for multi-city parcel dispatch and live tracking.",
        summaryBn: "পার্সেল ট্র্যাকিং ও দ্রুত ডেলিভারি ব্যবস্থাপনার জন্য সমন্বিত ড্যাশবোর্ড ডিজাইন।",
        data: {
          clientName: "TrackFlow Logistics",
          completionDate: "2025",
          tags: ["Logistics", "SaaS Dashboard", "React", "Design Tokens"],
        },
      },
      {
        kind: "CREDENTIAL",
        slug: "senior-ux-leadership",
        title: "Google UX Design Professional Certification",
        titleBn: "গুগল ইউএক্স ডিজাইন প্রফেশনাল সার্টিফিকেট",
        summary: "Specialized in user research, accessible interface prototyping, and empirical usability auditing.",
        summaryBn: "ইউজার রিসার্চ ও ইউজেবিলিটি টেস্টিংয়ে আন্তর্জাতিক মানসনদ।",
        data: {
          issuer: "Google / Coursera",
          issueDate: "2022",
          credentialType: "Professional Certification",
        },
      },
    ],
    downloads: [
      {
        label: "Download Curriculum Vitae (PDF, 1.2 MB)",
        labelBn: "সিভি / রেজ্যুমে ডাউনলোড করুন (পিডিএফ)",
        kind: "CV",
        fileName: "Tanvir-Hasan-Senior-Product-Designer-CV.pdf",
        fileUrl: "#",
        isPublic: true,
      },
    ],
  },
];

export function findBusinessDemoTemplate(idOrHost: string): BusinessDemoTemplate | undefined {
  const clean = idOrHost.toLowerCase().trim();
  const cleanNoDash = clean.replace(/-/g, "");
  return BUSINESS_DEMO_TEMPLATES.find((t) => {
    return (
      t.id.toLowerCase() === clean ||
      t.host.toLowerCase() === clean ||
      t.id.replace(/-/g, "").toLowerCase() === cleanNoDash ||
      t.host.replace(/-/g, "").toLowerCase() === cleanNoDash ||
      (t.id === "apex-corporate" && (clean === "corporate-trust" || cleanNoDash === "corporatetrust"))
    );
  });
}

export function isBusinessDemoHost(host: string): boolean {
  const clean = host.toLowerCase().trim();
  return BUSINESS_DEMO_TEMPLATES.some((t) => t.host.toLowerCase() === clean || t.id.toLowerCase() === clean);
}
