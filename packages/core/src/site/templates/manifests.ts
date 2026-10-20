import type { ThemeId, ThemeSettings } from "../../builder/theme";
import type { Chrome } from "../../builder/chrome";
import type { PageJson, PageKind } from "../../builder/registry";
import type { BusinessVertical, SiteMode } from "../mode";

export interface CustomPageManifest {
  slug: string;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  layout: PageJson;
}

export interface BusinessTemplateManifest {
  id: string;
  aliases?: string[];
  name: string;
  blurb: string;
  audience: string;
  baseLook: ThemeId;
  category: "other" | "fashion" | "electronics" | "kids" | "streetwear" | "beauty";
  tags: string[];
  siteMode: SiteMode;
  vertical: BusinessVertical;
  settings: ThemeSettings;
  pages: Partial<Record<PageKind, PageJson>>;
  customPages: CustomPageManifest[];
  chrome: Chrome;
}

export const BUSINESS_TEMPLATES: BusinessTemplateManifest[] = [
  // 1. Restaurant — Dhaka Bistro
  {
    id: "dhaka-bistro",
    name: "Dhaka Bistro",
    blurb: "Warm, atmospheric restaurant theme with digital menu, table reservation request, and location showcase.",
    audience: "Restaurants, cafes, bistros, bakeries, and cloud kitchens",
    baseLook: "berber",
    category: "other",
    tags: ["restaurant", "food", "cafe", "bistro", "menu"],
    siteMode: "PORTFOLIO",
    vertical: "RESTAURANT",
    settings: {
      accent: "#D97706",
      background: "#FFFDF8",
      text: "#1C1917",
      radius: "soft",
      font: "serif",
      button: "filled",
      buttonShape: "rounded",
      buttonSize: "medium",
      cardRatio: "square",
      cardHover: "lift",
      spacing: "airy",
      width: "wide",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "hero_1",
            type: "hero",
            settings: {
              eyebrow: "",
              eyebrowBn: "",
              title: "Authentic Flavors, Handcrafted Daily",
              titleBn: "খাঁটি স্বাদ ও আতিথেয়তার অনন্য ঠিকানা",
              text: "Experience Dhaka's finest culinary traditions prepared with fresh local ingredients and passionate craftsmanship.",
              textBn: "প্রতিদিন তাজা ও খাঁটি উপাদানে তৈরি মুখরোচক খাবার নিয়ে আমরা প্রস্তুত আপনাকে স্বাগত জানাতে।",
              ctaText: "View Our Menu",
              ctaTextBn: "মেন্যু দেখুন",
              ctaLink: "/menu",
              secondCtaText: "Book a Table",
              secondCtaTextBn: "টেবিল বুক করুন",
              secondCtaLink: "/reservations",
            },
          },
          {
            id: "menu_1",
            type: "restaurant-menu",
            settings: {
              title: "Signature Specialties",
              titleBn: "আমাদের স্পেশাল মেন্যু",
              subtitle: "Freshly prepared daily with 100% authentic Halal ingredients",
              subtitleBn: "প্রতিদিন খাঁটি উপাদানে প্রস্তুতকৃত ১০০% হালাল খাবার",
              showDietary: true,
            },
          },
          {
            id: "hours_1",
            type: "restaurant-hours-location",
            settings: {
              title: "Opening Hours & Location",
              titleBn: "খোলার সময়সূচী ও ঠিকানা",
              hoursWeekday: "Sat – Thu: 12:00 PM – 11:00 PM",
              hoursWeekdayBn: "শনি – বৃহঃ দুপুর ১২টা – রাত ১১টা",
              hoursWeekend: "Friday: 1:30 PM – 11:30 PM",
              hoursWeekendBn: "শুক্রবারঃ দুপুর ১:৩০ – রাত ১১:৩০",
              address: "Road 11, Block D, Banani, Dhaka 1213",
              addressBn: "রোড ১১, ব্লক ডি, বনানী, ঢাকা ১২১৩",
              phone: "+8801700000000",
              mapLink: "https://maps.google.com",
            },
          },
          {
            id: "reserve_1",
            type: "reservation-cta",
            settings: {
              title: "Reserve Your Table",
              titleBn: "টেবিল অগ্রিম বুক করুন",
              subtitle: "Planning a dinner or special event? Reserve your table in seconds.",
              subtitleBn: "পারিবারিক নৈশভোজ বা বন্ধুদের সাথে আড্ডার জন্য এখনই বুকিং দিন।",
              buttonText: "Request Reservation",
              buttonTextBn: "বুকিং রিকোয়েস্ট পাঠান",
              whatsapp: "+8801700000000",
              disclaimer: "No upfront payment required. We will confirm your reservation via WhatsApp or call within 30 minutes.",
              disclaimerBn: "কোন অগ্রিম ফি নেই। রিকোয়েস্ট পাঠানোর ৩০ মিনিটের মধ্যে কল বা হোয়াটসঅ্যাপে কনফার্মেশন পাবেন।",
            },
          },
          {
            id: "float_1",
            type: "floating-contact",
            settings: {
              phone: "01700000000",
              whatsapp: "01700000000",
              position: "bottom-right",
              message: "Hello! I would like to reserve a table at Dhaka Bistro.",
              messageBn: "আসসালামু আলাইকুম! আমি ঢাকা বিস্ট্রোতে একটি টেবিল বুক করতে চাই।",
              label: "Chat or Reserve",
              labelBn: "বুকিং বা জিজ্ঞাসা",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "menu",
        title: "Our Full Menu",
        titleBn: "আমাদের সম্পূর্ণ মেন্যু",
        description: "Explore our complete food and beverage menu.",
        descriptionBn: "আমাদের সম্পূর্ণ সুস্বাদু মেন্যু তালিকা দেখুন।",
        layout: {
          version: 1,
          sections: [
            {
              id: "menu_full_1",
              type: "restaurant-menu",
              settings: {
                title: "Complete Dining Menu",
                titleBn: "সম্পূর্ণ ডাইনিং মেন্যু",
                subtitle: "Made fresh to order with authentic seasonal ingredients",
                subtitleBn: "অর্ডার অনুযায়ী তাজা ও স্বাস্থ্যকর উপায়ে প্রস্তুত",
                showDietary: true,
              },
            },
            {
              id: "reserve_cta_1",
              type: "reservation-cta",
              settings: {
                title: "Craving Something Delicious?",
                titleBn: "মুখরোচক খাবারের স্বাদ নিতে চান?",
                subtitle: "Book your table now or order via WhatsApp.",
                subtitleBn: "টেবিল বুক করুন অথবা হোয়াটসঅ্যাপে যোগাযোগ করুন।",
                buttonText: "Reserve a Table",
                buttonTextBn: "টেবিল বুক করুন",
                whatsapp: "+8801700000000",
              },
            },
          ],
        },
      },
      {
        slug: "reservations",
        title: "Table Reservations",
        titleBn: "টেবিল বুকিং",
        description: "Book your dining table online with instant WhatsApp confirmation.",
        descriptionBn: "সহজে অনলাইনে টেবিল বুকিং করুন।",
        layout: {
          version: 1,
          sections: [
            {
              id: "reserve_main_1",
              type: "reservation-cta",
              settings: {
                title: "Reserve Your Table",
                titleBn: "টেবিল বুকিং রিকোয়েস্ট",
                subtitle: "We look forward to serving you an unforgettable culinary experience.",
                subtitleBn: "আমরা আপনাকে সেরা আতিথেয়তা দিতে প্রস্তুত।",
                buttonText: "Submit Reservation Request",
                buttonTextBn: "বুকিং রিকোয়েস্ট পাঠান",
                whatsapp: "+8801700000000",
              },
            },
            {
              id: "hours_loc_1",
              type: "restaurant-hours-location",
              settings: {
                title: "Location & Dining Hours",
                titleBn: "লোকেশন ও রেস্টুরেন্ট খোলা থাকার সময়",
                hoursWeekday: "Sat – Thu: 12:00 PM – 11:00 PM",
                hoursWeekdayBn: "শনি – বৃহঃ দুপুর ১২টা – রাত ১১টা",
                hoursWeekend: "Friday: 1:30 PM – 11:30 PM",
                hoursWeekendBn: "শুক্রবারঃ দুপুর ১:৩০ – রাত ১১:৩০",
                address: "Road 11, Block D, Banani, Dhaka 1213",
                addressBn: "রোড ১১, ব্লক ডি, বনানী, ঢাকা ১২১৩",
                phone: "+8801700000000",
              },
            },
          ],
        },
      },
      {
        slug: "contact",
        title: "Location & Contact",
        titleBn: "যোগাযোগ ও ঠিকানা",
        description: "Find Dhaka Bistro's location, contact phone, and operating hours.",
        descriptionBn: "ঢাকা বিস্ট্রোর ঠিকানা ও যোগাযোগের বিবরণ।",
        layout: {
          version: 1,
          sections: [
            {
              id: "hours_contact_1",
              type: "restaurant-hours-location",
              settings: {
                title: "Find Us",
                titleBn: "আমাদের ঠিকানা",
                hoursWeekday: "Sat – Thu: 12:00 PM – 11:00 PM",
                hoursWeekdayBn: "শনি – বৃহঃ দুপুর ১২টা – রাত ১১টা",
                hoursWeekend: "Friday: 1:30 PM – 11:30 PM",
                hoursWeekendBn: "শুক্রবারঃ দুপুর ১:৩০ – রাত ১১:৩০",
                address: "Road 11, Block D, Banani, Dhaka 1213",
                addressBn: "রোড ১১, ব্লক ডি, বনানী, ঢাকা ১২১৩",
                phone: "+8801700000000",
              },
            },
            {
              id: "contact_form_1",
              type: "contact-form",
              settings: {
                heading: "Get in Touch",
                headingBn: "যোগাযোগ করুন",
                subhead: "For catering inquiries, private dining events, or feedback.",
                subheadBn: "ক্যাটারিং, প্রাইভেট ডাইনিং বা যেকোন মতামতের জন্য বার্তা পাঠান।",
                buttonText: "Send Message",
                buttonTextBn: "বার্তা পাঠান",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "custom",
          text: "✨ Authentic Dining Experience — Call 01700000000 for reservations",
          textBn: "✨ ঐতিহ্যবাহী খাবারের স্বাদ নিতে বুকিং করুন ০১৭০০০০০০০০ নম্বরে",
          link: "/reservations",
          bgColor: "#D97706",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "menu-1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "menu-2", type: "link", label: "Menu", labelBn: "মেন্যু", ref: "menu", url: "/menu" },
          { id: "menu-3", type: "link", label: "Reservations", labelBn: "বুকিং", ref: "reservations", url: "/reservations" },
          { id: "menu-4", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
        ],
      },
      footer: {
        columns: [
          {
            id: "foot-1",
            type: "text",
            title: "Dhaka Bistro",
            titleBn: "ঢাকা বিস্ট্রো",
            body: "Celebrating Bangladesh's rich culinary traditions with modern gourmet touches.",
            bodyBn: "খাঁটি স্বাদ ও স্বাস্থ্যকর খাবারের বিশ্বস্ত ঠিকানা।",
            links: [],
          },
          {
            id: "foot-2",
            type: "links",
            title: "Quick Links",
            titleBn: "প্রয়োজনীয় লিঙ্ক",
            body: "",
            bodyBn: "",
            links: [
              { id: "fl1", type: "link", label: "Our Menu", labelBn: "মেন্যু", ref: "menu", url: "/menu" },
              { id: "fl2", type: "link", label: "Book a Table", labelBn: "বুকিং", ref: "reservations", url: "/reservations" },
              { id: "fl3", type: "link", label: "Find Location", labelBn: "ঠিকানা", ref: "contact", url: "/contact" },
            ],
          },
          {
            id: "foot-3",
            type: "contact",
            title: "Contact",
            titleBn: "যোগাযোগ",
            body: "Road 11, Banani, Dhaka\nPhone: +8801700000000",
            bodyBn: "রোড ১১, বনানী, ঢাকা\nফোনঃ ০১৭০০০০০০০০",
            links: [],
          },
        ],
        copyright: "Dhaka Bistro. All rights reserved.",
        copyrightBn: "ঢাকা বিস্ট্রো। সর্বস্বত্ব সংরক্ষিত।",
      },
    },
  },

  // 2. Doctor/Clinic — Modern Clinic
  {
    id: "modern-clinic",
    name: "Modern Clinic",
    blurb: "Clean, trustworthy medical clinic and doctor profile theme with multi-chamber schedules and appointment requests.",
    audience: "Specialist doctors, diagnostic centers, dental clinics, and healthcare practices",
    baseLook: "gadgetstudio",
    category: "other",
    tags: ["doctor", "clinic", "health", "medical", "appointment"],
    siteMode: "PORTFOLIO",
    vertical: "DOCTOR_CLINIC",
    settings: {
      accent: "#0369A1",
      background: "#F8FAFC",
      text: "#0F172A",
      radius: "soft",
      font: "sans",
      button: "filled",
      buttonShape: "rounded",
      buttonSize: "medium",
      cardRatio: "square",
      cardHover: "lift",
      spacing: "airy",
      width: "wide",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "doc_hero_1",
            type: "doctor-hero",
            settings: {
              name: "Dr. Your Name",
              nameBn: "ডাঃ আপনার নাম",
              degrees: "Your degrees, e.g. MBBS, FCPS",
              degreesBn: "আপনার ডিগ্রি, যেমন এমবিবিএস, এফসিপিএস",
              specialty: "Your specialty",
              specialtyBn: "আপনার বিশেষত্ব",
              bmdcReg: "BMDC Reg No: add your number",
              ctaText: "Request Appointment",
              ctaTextBn: "সিরিয়াল নিতে আবেদন করুন",
              ctaLink: "/appointment",
            },
          },
          {
            id: "services_1",
            type: "service-cards",
            settings: {
              title: "Specialties & Clinical Services",
              titleBn: "চিকিৎসা ও পরামর্শ সেবাসমূহ",
              subtitle: "Evidence-based, compassionate care for complex and chronic medical conditions",
              subtitleBn: "আধুনিক ও নির্ভরযোগ্য চিকিৎসা সেবা",
              columns: "3",
            },
          },
          {
            id: "chambers_1",
            type: "clinic-chambers",
            settings: {
              title: "Chambers & Visiting Hours",
              titleBn: "চেম্বার ও রোগী দেখার সময়সূচী",
              subtitle: "Appointments are required prior to visit. Emergency cases please visit hospital ER.",
              subtitleBn: "চেম্বারে আসার পূর্বে সিরিয়াল কনফার্ম করে নিন।",
              disclaimer: "Appointment requests are subject to confirmation by the clinic staff.",
              disclaimerBn: "সিরিয়াল রিকোয়েস্ট পাঠানোর পর চেম্বার সহকারী আপনাকে কল করে সময় নিশ্চিত করবেন।",
            },
          },
          {
            id: "reserve_doc_1",
            type: "reservation-cta",
            settings: {
              title: "Book a Chamber Consultation",
              titleBn: "চেম্বারে সিরিয়ালের জন্য আবেদন করুন",
              subtitle: "Choose your preferred chamber and submit your contact information.",
              subtitleBn: "আপনার সুবিধাজনক চেম্বার নির্বাচন করে সিরিয়াল বুক করুন।",
              buttonText: "Request Appointment",
              buttonTextBn: "সিরিয়ালের জন্য রিকোয়েস্ট পাঠান",
              whatsapp: "+8801700000000",
              disclaimer: "Non-emergency inquiries only. No clinical data or medical records are requested here.",
              disclaimerBn: "জরুরি চিকিৎসার জন্য সরাসরি নিকটস্থ হাসপাতালে যোগাযোগ করুন।",
            },
          },
          {
            id: "float_doc_1",
            type: "floating-contact",
            settings: {
              phone: "01700000000",
              whatsapp: "01700000000",
              position: "bottom-right",
              message: "Hello Doctor's Assistant, I would like to book an appointment with Dr. Rahman.",
              messageBn: "আসসালামু আলাইকুম, ডাঃ রহমানের চেম্বারের সিরিয়ালের বিষয়ে জানতে চাচ্ছিলাম।",
              label: "Chamber Hotline",
              labelBn: "চেম্বার হটলাইন",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "chambers",
        title: "Chamber Schedules",
        titleBn: "চেম্বার ও সময়সূচী",
        description: "Weekly consulting days, hours, and chamber addresses.",
        descriptionBn: "চেম্বারের ঠিকানা এবং রোগী দেখার দিন ও সময়সূচী।",
        layout: {
          version: 1,
          sections: [
            {
              id: "chambers_main_1",
              type: "clinic-chambers",
              settings: {
                title: "Chamber Locations & Weekly Schedules",
                titleBn: "চেম্বার ও রোগী দেখার সময়সূচী",
                subtitle: "Please verify room numbers and serial timings before arrival.",
                subtitleBn: "আসার পূর্বে চেম্বার সহকারীর সাথে কথা বলে সময় নিশ্চিত হোন।",
              },
            },
          ],
        },
      },
      {
        slug: "services",
        title: "Specialties & Services",
        titleBn: "চিকিৎসা সেবাসমূহ",
        description: "Clinical expertise, patient consultations, and health management programs.",
        descriptionBn: "বিশেষজ্ঞ পরামর্শ ও চিকিৎসা সেবাসমূহ।",
        layout: {
          version: 1,
          sections: [
            {
              id: "services_main_1",
              type: "service-cards",
              settings: {
                title: "Clinical Areas of Expertise",
                titleBn: "চিকিৎসা সেবাসমূহ",
                subtitle: "Comprehensive consultations for adult medicine, metabolic disorders, and chronic disease care.",
                subtitleBn: "আধুনিক ও সমন্বিত স্বাস্থ্য পরামর্শ।",
              },
            },
          ],
        },
      },
      {
        slug: "appointment",
        title: "Book an Appointment",
        titleBn: "সিরিয়াল বুকিং",
        description: "Submit an appointment request for doctor consultation.",
        descriptionBn: "সহজে চেম্বারের সিরিয়ালের জন্য রিকোয়েস্ট পাঠান।",
        layout: {
          version: 1,
          sections: [
            {
              id: "appointment_cta_1",
              type: "reservation-cta",
              settings: {
                title: "Appointment Request Form",
                titleBn: "সিরিয়াল বুকিং ফর্ম",
                subtitle: "Please select your preferred chamber and provide your contact number. Our serial assistant will call to confirm your serial number.",
                subtitleBn: "আপনার সুবিধাজনক চেম্বার নির্বাচন করে সিরিয়ালের আবেদন করুন। সহকারী ফোন করে সিরিয়াল নম্বর কনফার্ম করবেন।",
                buttonText: "Submit Request",
                buttonTextBn: "আবেদন জমা দিন",
                whatsapp: "+8801700000000",
              },
            },
            {
              id: "chambers_ref_1",
              type: "clinic-chambers",
              settings: {
                title: "Weekly Chamber Times Reference",
                titleBn: "সাপ্তাহিক চেম্বার সূচি",
              },
            },
          ],
        },
      },
      {
        slug: "contact",
        title: "Contact & Assistance",
        titleBn: "যোগাযোগ ও তথ্য",
        description: "Chamber assistance hotline and location map.",
        descriptionBn: "চেম্বারের যোগাযোগ নম্বর ও দিকনির্দেশনা।",
        layout: {
          version: 1,
          sections: [
            {
              id: "contact_doc_1",
              type: "clinic-chambers",
              settings: {
                title: "Chamber Locations",
                titleBn: "চেম্বার অবস্থান",
              },
            },
            {
              id: "contact_doc_form_1",
              type: "contact-form",
              settings: {
                heading: "Inquiries & Assistance",
                headingBn: "জিজ্ঞাসা বা তথ্য",
                subhead: "For report follow-up inquiries or serial coordination.",
                subheadBn: "রিপোর্ট দেখানো বা সিরিয়াল সংক্রান্ত তথ্যের জন্য বার্তা পাঠান।",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "custom",
          text: "🩺 Chamber Serials Open — Call 01700000000 or submit an online request",
          textBn: "🩺 চেম্বারের সিরিয়াল চলছে — কল করুন ০১৭০০০০০০০০ অথবা অনলাইনে আবেদন করুন",
          link: "/appointment",
          bgColor: "#0369A1",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "cm1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "cm2", type: "link", label: "Specialties", labelBn: "সেবাসমূহ", ref: "services", url: "/services" },
          { id: "cm3", type: "link", label: "Chambers", labelBn: "চেম্বার", ref: "chambers", url: "/chambers" },
          { id: "cm4", type: "link", label: "Book Appointment", labelBn: "সিরিয়াল", ref: "appointment", url: "/appointment" },
          { id: "cm5", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
        ],
      },
      footer: {
        columns: [
          {
            id: "cf1",
            type: "text",
            title: "Dr. Mohammad Rahman",
            titleBn: "ডাঃ মোহাম্মদ রহমান",
            body: "Senior Consultant in Internal Medicine & Chronic Care. BMDC Reg: A-24810.",
            bodyBn: "সিনিয়র কনসালট্যান্ট, ইন্টারনাল মেডিসিন। বিএমডিসি রেজিঃ এ-২৪৮১০।",
            links: [],
          },
          {
            id: "cf2",
            type: "links",
            title: "Quick Links",
            titleBn: "প্রয়োজনীয় লিংক",
            body: "",
            bodyBn: "",
            links: [
              { id: "cfl1", type: "link", label: "Chambers & Hours", labelBn: "চেম্বার সূচি", ref: "chambers", url: "/chambers" },
              { id: "cfl2", type: "link", label: "Book Serial", labelBn: "সিরিয়াল বুকিং", ref: "appointment", url: "/appointment" },
              { id: "cfl3", type: "link", label: "Specialties", labelBn: "চিকিৎসা সেবা", ref: "services", url: "/services" },
            ],
          },
          {
            id: "cf3",
            type: "contact",
            title: "Chamber Helpline",
            titleBn: "চেম্বার হেল্পলাইন",
            body: "Serial Phone: +8801700000000\nWhatsApp: +8801700000000",
            bodyBn: "সিরিয়াল ফোনঃ ০১৭০০০০০০০০\nহোয়াটসঅ্যাপঃ ০১৭০০০০০০০০",
            links: [],
          },
        ],
        copyright: "Prof. Dr. Mohammad Rahman. Medical Marketing Site.",
        copyrightBn: "অধ্যাপক ডাঃ মোহাম্মদ রহমান। সর্বস্বত্ব সংরক্ষিত।",
      },
    },
  },

  // 3. Business / Company — Apex Corporate Advisory
  {
    id: "apex-corporate",
    aliases: ["corporate-trust"],
    name: "Apex Corporate Advisory",
    blurb: "Authoritative, modern corporate presence for enterprises, consultancies, agencies, and institutions.",
    audience: "Corporate firms, holding companies, B2B agencies, consultancies, and ventures",
    baseLook: "kapor",
    category: "other",
    tags: ["business", "corporate", "company", "consulting", "b2b"],
    siteMode: "PORTFOLIO",
    vertical: "BUSINESS_COMPANY",
    settings: {
      accent: "#1E40AF",
      background: "#FFFFFF",
      text: "#111827",
      radius: "sharp",
      font: "sans",
      button: "filled",
      buttonShape: "square",
      buttonSize: "medium",
      cardRatio: "portrait",
      cardHover: "lift",
      spacing: "airy",
      width: "wide",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "corp_hero_1",
            type: "hero",
            settings: {
              eyebrow: "",
              eyebrowBn: "",
              title: "Strategic Solutions. Measurable Growth.",
              titleBn: "ব্যবসায়িক প্রবৃদ্ধি ও কৌশলগত সমাধানের বিশ্বস্ত অংশীদার",
              text: "We partner with ambitious enterprises and institutions across Bangladesh to deliver world-class advisory, technology, and operations.",
              textBn: "আধুনিক প্রযুক্তি ও সঠিক নির্দেশনায় আপনার ব্যবসাকে এগিয়ে নিয়ে যেতে আমরা সর্বদা অঙ্গীকারবদ্ধ।",
              ctaText: "Explore Our Solutions",
              ctaTextBn: "আমাদের সেবাসমূহ",
              ctaLink: "/services",
              secondCtaText: "Contact Us",
              secondCtaTextBn: "যোগাযোগ করুন",
              secondCtaLink: "/contact",
            },
          },
          {
            id: "corp_services_1",
            type: "service-cards",
            settings: {
              title: "Enterprise Solutions & Practice Areas",
              titleBn: "আমাদের মূল সেবাসমূহ",
              subtitle: "End-to-end expertise designed to scale organizations efficiently.",
              subtitleBn: "প্রতিষ্ঠানকে সাফল্যের শীর্ষে পৌঁছাতে কার্যকরী সমাধান।",
            },
          },
          {
            id: "corp_team_1",
            type: "team-grid",
            settings: {
              title: "Leadership & Advisory Board",
              titleBn: "আমাদের পরিচালনা পর্ষদ ও টিম",
              subtitle: "Industry veterans with deep regional and global expertise.",
              subtitleBn: "অভিজ্ঞ বিশেষজ্ঞদের সমন্বয়ে গঠিত নিবেদিত টিম।",
            },
          },
          {
            id: "corp_download_1",
            type: "download-card",
            settings: {
              title: "Corporate Profile & Credentials",
              titleBn: "কোম্পানি প্রোফাইল ডাউনলোড করুন",
              description: "Download our comprehensive company credentials, capability statement, and case studies (PDF).",
              descriptionBn: "আমাদের প্রতিষ্ঠানের বিস্তারিত প্রোফাইল এবং কাজের বিবরণী ডাউনলোড করুন।",
              fileLabel: "Download Company Profile (PDF, 4.2 MB)",
              fileLabelBn: "কোম্পানি প্রোফাইল ডাউনলোড (পিডিএফ)",
              fileUrl: "#",
            },
          },
          {
            id: "corp_contact_1",
            type: "contact-form",
            settings: {
              heading: "Partner With Us",
              headingBn: "আপনার প্রজেক্ট নিয়ে আলোচনা করুন",
              subhead: "Schedule a consultation with our senior advisory team.",
              subheadBn: "আমাদের অভিজ্ঞ টিমের সাথে মিটিংয়ের সময় নির্ধারণ করুন।",
              buttonText: "Request Consultation",
              buttonTextBn: "বার্তা পাঠান",
            },
          },
          {
            id: "corp_float_1",
            type: "floating-contact",
            settings: {
              phone: "01800000000",
              whatsapp: "01800000000",
              position: "bottom-right",
              message: "Hello, I would like to inquire about corporate partnership.",
              messageBn: "আসসালামু আলাইকুম, আপনাদের কর্পোরেট সেবা সম্পর্কে জানতে চাচ্ছিলাম।",
              label: "Corporate Inquiries",
              labelBn: "ইনকোয়ারি",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "about",
        title: "About Our Firm",
        titleBn: "আমাদের সম্পর্কে",
        description: "Company history, values, leadership, and mission.",
        descriptionBn: "আমাদের লক্ষ্য, উদ্দেশ্য ও প্রতিষ্ঠানের বিবরণ।",
        layout: {
          version: 1,
          sections: [
            {
              id: "about_team_1",
              type: "team-grid",
              settings: {
                title: "Meet Our Leadership Team",
                titleBn: "আমাদের পরিচালনা পর্ষদ",
                subtitle: "Dedicated professionals guiding innovation and governance.",
                subtitleBn: "অভিজ্ঞ নেতৃত্বে এগিয়ে চলেছে আমাদের যাত্রা।",
              },
            },
            {
              id: "about_dl_1",
              type: "download-card",
              settings: {
                title: "Download Company Credentials",
                titleBn: "কোম্পানি ক্রেডেনশিয়ালস",
                fileLabel: "Download Full Profile",
                fileLabelBn: "সম্পূর্ণ প্রোফাইল ডাউনলোড",
              },
            },
          ],
        },
      },
      {
        slug: "services",
        title: "Solutions & Services",
        titleBn: "সেবাসমূহ",
        description: "Strategic solutions, operations consulting, and technological execution.",
        descriptionBn: "আমাদের সকল প্রাতিষ্ঠানিক সেবা।",
        layout: {
          version: 1,
          sections: [
            {
              id: "services_page_1",
              type: "service-cards",
              settings: {
                title: "Enterprise Services",
                titleBn: "কর্পোরেট সেবাসমূহ",
                subtitle: "Customized capabilities aligned to your industry sector.",
                subtitleBn: "আপনার প্রতিষ্ঠানের চাহিদা অনুযায়ী আধুনিক সেবা।",
              },
            },
          ],
        },
      },
      {
        slug: "contact",
        title: "Corporate Headquarters & Inquiries",
        titleBn: "যোগাযোগ ও হেড অফিস",
        description: "Head office address, direct business inquiry channels, and meeting requests.",
        descriptionBn: "হেড অফিসের ঠিকানা ও যোগাযোগের মাধ্যম।",
        layout: {
          version: 1,
          sections: [
            {
              id: "corp_contact_page_1",
              type: "contact-form",
              settings: {
                heading: "Get in Touch with Our Office",
                headingBn: "আমাদের অফিসের সাথে যোগাযোগ",
                subhead: "Dhaka Office: Gulshan Avenue, Dhaka 1212. Phone: +8801800000000.",
                subheadBn: "ঢাকা অফিসঃ গুলশান এভিনিউ, ঢাকা ১২১২। ফোনঃ ০১৮০০০০০০০০।",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "off",
          text: "",
          textBn: "",
          link: "",
          bgColor: "#1E40AF",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "cm_1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "cm_2", type: "link", label: "About", labelBn: "আমাদের কথা", ref: "about", url: "/about" },
          { id: "cm_3", type: "link", label: "Solutions", labelBn: "সেবাসমূহ", ref: "services", url: "/services" },
          { id: "cm_4", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
        ],
      },
      footer: {
        columns: [
          {
            id: "corp_f1",
            type: "text",
            title: "Corporate Trust",
            titleBn: "কর্পোরেট ট্রাস্ট",
            body: "Enterprise solutions, advisory, and execution across Bangladesh and regional markets.",
            bodyBn: "আধুনিক প্রাতিষ্ঠানিক সমাধান ও পরামর্শের নির্ভরযোগ্য প্ল্যাটফর্ম।",
            links: [],
          },
          {
            id: "corp_f2",
            type: "links",
            title: "Navigation",
            titleBn: "প্রয়োজনীয় পৃষ্ঠা",
            body: "",
            bodyBn: "",
            links: [
              { id: "cl1", type: "link", label: "About Us", labelBn: "আমাদের কথা", ref: "about", url: "/about" },
              { id: "cl2", type: "link", label: "Solutions", labelBn: "সেবাসমূহ", ref: "services", url: "/services" },
              { id: "cl3", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
            ],
          },
          {
            id: "corp_f3",
            type: "contact",
            title: "Headquarters",
            titleBn: "হেড অফিস",
            body: "Gulshan-1, Dhaka 1212\nPhone: +8801800000000\nEmail: contact@corporatetrust.com",
            bodyBn: "গুলশান-১, ঢাকা ১২১২\nফোনঃ ০১৮০০০০০০০০",
            links: [],
          },
        ],
        copyright: "Corporate Trust Ltd. All rights reserved.",
        copyrightBn: "কর্পোরেট ট্রাস্ট লিমিটেড। সর্বস্বত্ব সংরক্ষিত।",
      },
    },
  },

  // 4. Service Provider — Local Service Pro
  {
    id: "local-service-pro",
    name: "Local Service Pro",
    blurb: "High-converting service business website with service tiers, coverage map, reviews, and instant quote requests.",
    audience: "Home repair, cleaning, IT support, photographers, catering, and local contractors",
    baseLook: "kapor",
    category: "other",
    tags: ["service", "contractor", "repair", "agency", "quote"],
    siteMode: "PORTFOLIO",
    vertical: "SERVICE_PROVIDER",
    settings: {
      accent: "#0F766E",
      background: "#F0FDFA",
      text: "#134E4A",
      radius: "soft",
      font: "friendly",
      button: "filled",
      buttonShape: "pill",
      buttonSize: "medium",
      cardRatio: "square",
      cardHover: "lift",
      spacing: "airy",
      width: "wide",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "serv_hero_1",
            type: "hero",
            settings: {
              eyebrow: "",
              eyebrowBn: "",
              title: "Expert Local Services. Fast, Reliable & Guaranteed.",
              titleBn: "নির্ভরযোগ্য ও দ্রুত প্রফেশনাল সার্ভিস আপনার দোরগোড়ায়",
              text: "Certified technicians, transparent pricing with no hidden charges, and same-day support across the city.",
              textBn: "দক্ষ কর্মী, ন্যায্য মূল্য ও শতভাগ সন্তুষ্টির গ্যারান্টি সহ আধুনিক সেবা।",
              ctaText: "Get a Free Quote",
              ctaTextBn: "কোটেশন নিন",
              ctaLink: "/quote",
              secondCtaText: "Our Services",
              secondCtaTextBn: "সকল সার্ভিস",
              secondCtaLink: "/services",
            },
          },
          {
            id: "serv_cards_1",
            type: "service-cards",
            settings: {
              title: "Popular Service Packages",
              titleBn: "আমাদের জনপ্রিয় সেবাসমূহ",
              subtitle: "Select the service you need or request a customized solution.",
              subtitleBn: "আপনার প্রয়োজনীয় সার্ভিস বেছে নিন এবং ঘরে বসেই অর্ডার করুন।",
            },
          },
          {
            id: "serv_quote_1",
            type: "contact-form",
            settings: {
              heading: "Request a Free Instant Quote",
              headingBn: "বিনামূল্যে কোটেশনের জন্য মেসেজ দিন",
              subhead: "Tell us about your requirements and our team will get back to you within 15 minutes.",
              subheadBn: "আপনার কাজের বিবরণ জানান, আমাদের প্রতিনিধি ১৫ মিনিটের মধ্যে যোগাযোগ করবেন।",
              buttonText: "Submit Quote Request",
              buttonTextBn: "কোটেশন পাঠান",
            },
          },
          {
            id: "serv_float_1",
            type: "floating-contact",
            settings: {
              phone: "01900000000",
              whatsapp: "01900000000",
              position: "bottom-right",
              message: "Hello, I would like to get a quote for your service.",
              messageBn: "আসসালামু আলাইকুম, আপনাদের সার্ভিস সম্পর্কে জানতে চাচ্ছিলাম।",
              label: "Quick Helpline",
              labelBn: "হটলাইন হেল্প",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "services",
        title: "Services & Pricing",
        titleBn: "সেবা ও মূল্য তালিকা",
        description: "Complete list of professional services, packages, and transparent pricing.",
        descriptionBn: "আমাদের সকল সার্ভিসের বিস্তারিত তালিকা ও মূল্য।",
        layout: {
          version: 1,
          sections: [
            {
              id: "services_page_grid_1",
              type: "service-cards",
              settings: {
                title: "All Available Services",
                titleBn: "সকল সেবাসমূহ",
                subtitle: "Fixed pricing, verified background-checked experts, and warranty on all work.",
                subtitleBn: "নিরাপদ, দক্ষ ও দ্রুত সার্ভিস।",
              },
            },
          ],
        },
      },
      {
        slug: "coverage",
        title: "Coverage Areas",
        titleBn: "সার্ভিস এরিয়া",
        description: "Check our active city zones, dispatch times, and service coverage.",
        descriptionBn: "আমরা যেসব এলাকায় সেবা প্রদান করি।",
        layout: {
          version: 1,
          sections: [
            {
              id: "cov_contact_1",
              type: "contact-form",
              settings: {
                heading: "Check Service Availability in Your Area",
                headingBn: "আপনার এলাকায় সার্ভিস উপলব্ধ কিনা জানুন",
                subhead: "Currently serving Dhanmondi, Gulshan, Banani, Uttara, Mirpur, and surrounding Dhaka areas.",
                subheadBn: "সমগ্র ঢাকা শহরে দ্রুত সার্ভিস প্রদান করা হয়।",
              },
            },
          ],
        },
      },
      {
        slug: "quote",
        title: "Request a Free Quote",
        titleBn: "কোটেশন রিকোয়েস্ট",
        description: "Get an upfront quote with estimated cost and time frame.",
        descriptionBn: "কাজের খরচের ধারণা ও কোটেশন পান।",
        layout: {
          version: 1,
          sections: [
            {
              id: "quote_form_1",
              type: "contact-form",
              settings: {
                heading: "Describe Your Service Need",
                headingBn: "আপনার সার্ভিসের বিবরণ লিখুন",
                subhead: "We provide upfront estimates before initiating any work.",
                subheadBn: "কাজ শুরুর আগেই সঠিক খরচের ধারণা দেওয়া হয়।",
                buttonText: "Request Quote",
                buttonTextBn: "কোটেশন পাঠান",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "custom",
          text: "⚡ 100% Satisfaction Guarantee — Fast Service Dispatch: 01900000000",
          textBn: "⚡ দ্রুত সার্ভিসের জন্য কল করুনঃ ০১৯০০০০০০০০",
          link: "/quote",
          bgColor: "#0F766E",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "sm_1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "sm_2", type: "link", label: "Services", labelBn: "সেবাসমূহ", ref: "services", url: "/services" },
          { id: "sm_3", type: "link", label: "Coverage", labelBn: "সার্ভিস এরিয়া", ref: "coverage", url: "/coverage" },
          { id: "sm_4", type: "link", label: "Get Quote", labelBn: "কোটেশন", ref: "quote", url: "/quote" },
        ],
      },
      footer: {
        columns: [
          {
            id: "sf_1",
            type: "text",
            title: "Local Service Pro",
            titleBn: "লোকাল সার্ভিস প্রো",
            body: "Your trusted neighborhood partner for fast, dependable, certified service.",
            bodyBn: "আপনার বিশ্বস্ত ও অভিজ্ঞ সার্ভিস পার্টনার।",
            links: [],
          },
          {
            id: "sf_2",
            type: "links",
            title: "Quick Navigation",
            titleBn: "লিঙ্কসমূহ",
            body: "",
            bodyBn: "",
            links: [
              { id: "sl1", type: "link", label: "Services", labelBn: "সেবাসমূহ", ref: "services", url: "/services" },
              { id: "sl2", type: "link", label: "Coverage Areas", labelBn: "সার্ভিস এরিয়া", ref: "coverage", url: "/coverage" },
              { id: "sl3", type: "link", label: "Free Quote", labelBn: "কোটেশন", ref: "quote", url: "/quote" },
            ],
          },
          {
            id: "sf_3",
            type: "contact",
            title: "Hotline Support",
            titleBn: "হেল্পলাইন",
            body: "Direct Phone: +8801900000000\nWhatsApp: +8801900000000",
            bodyBn: "ফোনঃ ০১৯০০০০০০০০\nহোয়াটসঅ্যাপঃ ০১৯০০০০০০০০",
            links: [],
          },
        ],
        copyright: "Local Service Pro. All rights reserved.",
        copyrightBn: "লোকাল সার্ভিস প্রো। সর্বস্বত্ব সংরক্ষিত।",
      },
    },
  },

  // 5. Personal Portfolio — Portfolio Focus
  {
    id: "portfolio-focus",
    name: "Portfolio Focus",
    blurb: "Minimalist, striking personal portfolio showcasing project case studies, skills timeline, and CV download.",
    audience: "Designers, software developers, writers, architects, consultants, and creators",
    baseLook: "axionwear",
    category: "other",
    tags: ["portfolio", "resume", "cv", "developer", "designer", "creator"],
    siteMode: "PORTFOLIO",
    vertical: "PERSONAL_PORTFOLIO",
    settings: {
      accent: "#4F46E5",
      background: "#FAFAFA",
      text: "#18181B",
      radius: "soft",
      font: "editorial",
      button: "filled",
      buttonShape: "rounded",
      buttonSize: "medium",
      cardRatio: "square",
      cardHover: "lift",
      spacing: "airy",
      width: "narrow",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "port_hero_1",
            type: "hero",
            settings: {
              eyebrow: "",
              eyebrowBn: "",
              title: "Crafting High-Impact Digital Products & Experiences",
              titleBn: "ডিজিটাল প্রোডাক্ট ডিজাইন ও আধুনিক সফটওয়্যার আর্কিটেকচার",
              text: "Senior Product Designer & Engineer with 8+ years building enterprise web apps, SaaS interfaces, and scalable design systems.",
              textBn: "৮ বছরেরও বেশি অভিজ্ঞতা সহ আধুনিক ওয়েব প্ল্যাটফর্ম ও সফটওয়্যার তৈরির কাজ করছি।",
              ctaText: "View Selected Work",
              ctaTextBn: "প্রজেক্টসমূহ দেখুন",
              ctaLink: "/work",
              secondCtaText: "Download CV",
              secondCtaTextBn: "সিভি ডাউনলোড",
              secondCtaLink: "/about",
            },
          },
          {
            id: "port_grid_1",
            type: "portfolio-grid",
            settings: {
              title: "Selected Projects & Case Studies",
              titleBn: "নির্বাচিত প্রজেক্ট ও কাজ",
              subtitle: "A showcase of recent mobile apps, design systems, and web platforms.",
              subtitleBn: "সম্প্রতি সম্পন্ন করা কিছু বিশেষ প্রজেক্টের তালিকা।",
              columns: "2",
            },
          },
          {
            id: "port_cv_1",
            type: "download-card",
            settings: {
              title: "Curriculum Vitae / Resume",
              titleBn: "সিভি / রেজ্যুমে ডাউনলোড",
              description: "Review comprehensive career history, technical stack proficiency, and educational credentials.",
              descriptionBn: "আমার শিক্ষাগত যোগ্যতা, প্রযুক্তিগত দক্ষতা ও কাজের অভিজ্ঞতা দেখুন।",
              fileLabel: "Download Resume (PDF, 1.2 MB)",
              fileLabelBn: "সিভি ডাউনলোড (পিডিএফ)",
              fileUrl: "#",
            },
          },
          {
            id: "port_contact_1",
            type: "contact-form",
            settings: {
              heading: "Let's Collaborate",
              headingBn: "যোগাযোগ করুন",
              subhead: "Have an exciting project, consulting opportunity, or speaking invitation? Send a message.",
              subheadBn: "নতুন প্রজেক্ট বা ফ্রিল্যান্স কাজের জন্য ইনবক্স করুন।",
              buttonText: "Send Message",
              buttonTextBn: "বার্তা পাঠান",
            },
          },
          {
            id: "port_float_1",
            type: "floating-contact",
            settings: {
              phone: "01711111111",
              whatsapp: "01711111111",
              position: "bottom-right",
              message: "Hi! I visited your portfolio and would love to connect.",
              messageBn: "আসসালামু আলাইকুম! আপনার পোর্টফোলিও দেখে নক করলাম।",
              label: "Get in Touch",
              labelBn: "মেসেজ দিন",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "work",
        title: "Selected Work & Case Studies",
        titleBn: "প্রজেক্ট ও কাজের বিবরণী",
        description: "Case studies of client projects, web applications, and UI/UX design systems.",
        descriptionBn: "প্রজেক্ট কেস স্টাডি ও ডিজাইন সিস্টেমের বিবরণ।",
        layout: {
          version: 1,
          sections: [
            {
              id: "work_grid_1",
              type: "portfolio-grid",
              settings: {
                title: "Complete Works Archive",
                titleBn: "সকল কাজের সংগ্রহ",
                subtitle: "Detailed case studies and engineering breakdowns.",
                subtitleBn: "কাজের বিস্তারিত বিবরণ ও ডিজাইন প্রসেস।",
              },
            },
          ],
        },
      },
      {
        slug: "about",
        title: "About Me & CV",
        titleBn: "আমার পরিচয় ও সিভি",
        description: "Background, design philosophy, technical stack, and downloadable resume.",
        descriptionBn: "ক্যারিয়ার ব্যাকগ্রাউন্ড ও রেজ্যুমে ডাউনলোড।",
        layout: {
          version: 1,
          sections: [
            {
              id: "about_cv_card_1",
              type: "download-card",
              settings: {
                title: "Download Resume & Credentials",
                titleBn: "সিভি ও সনদপত্র",
                description: "Available in PDF format for offline review.",
                descriptionBn: "পিডিএফ ফরম্যাটে সম্পূর্ণ রেজ্যুমে ডাউনলোড করুন।",
                fileLabel: "Download Resume (PDF)",
                fileLabelBn: "সিভি ডাউনলোড",
              },
            },
          ],
        },
      },
      {
        slug: "contact",
        title: "Get in Touch",
        titleBn: "যোগাযোগ",
        description: "Direct email and WhatsApp message form for freelance or full-time engagements.",
        descriptionBn: "যোগাযোগ ও প্রজেক্ট ইনকোয়ারি ফর্ম।",
        layout: {
          version: 1,
          sections: [
            {
              id: "contact_me_1",
              type: "contact-form",
              settings: {
                heading: "Start a Conversation",
                headingBn: "কথা বলুন সরাসরি",
                subhead: "I typically respond within 24 hours.",
                subheadBn: "সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর দেওয়া হয়।",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "off",
          text: "",
          textBn: "",
          link: "",
          bgColor: "#4F46E5",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "pm_1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "pm_2", type: "link", label: "Work", labelBn: "কাজ", ref: "work", url: "/work" },
          { id: "pm_3", type: "link", label: "About / CV", labelBn: "সিভি", ref: "about", url: "/about" },
          { id: "pm_4", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
        ],
      },
      footer: {
        columns: [
          {
            id: "pf_1",
            type: "text",
            title: "Portfolio",
            titleBn: "পোর্টফোলিও",
            body: "Digital design and engineering with a focus on simplicity, craft, and business results.",
            bodyBn: "আধুনিক ওয়েব ডিজাইন ও সফটওয়্যার ডেভেলপমেন্ট।",
            links: [],
          },
          {
            id: "pf_2",
            type: "links",
            title: "Pages",
            titleBn: "পৃষ্ঠাসমূহ",
            body: "",
            bodyBn: "",
            links: [
              { id: "pl1", type: "link", label: "Selected Work", labelBn: "কাজসমূহ", ref: "work", url: "/work" },
              { id: "pl2", type: "link", label: "About & CV", labelBn: "আমার কথা", ref: "about", url: "/about" },
              { id: "pl3", type: "link", label: "Contact", labelBn: "যোগাযোগ", ref: "contact", url: "/contact" },
            ],
          },
          {
            id: "pf_3",
            type: "contact",
            title: "Direct Connect",
            titleBn: "সরাসরি যোগাযোগ",
            body: "WhatsApp: +8801711111111\nEmail: hello@creator.me",
            bodyBn: "হোয়াটসঅ্যাপঃ ০১৭১১১১১১১১",
            links: [],
          },
        ],
        copyright: "All rights reserved. Designed & built on BizTrack Business.",
        copyrightBn: "সর্বস্বত্ব সংরক্ষিত। বিসট্র্যাক বিজনেস-এ নির্মিত।",
      },
    },
  },

  // 6. Public Figure & Thought Leader — Public Profile
  {
    id: "public-profile",
    aliases: ["public-figure", "creator-profile"],
    name: "Public Profile & Leader",
    blurb: "Distinguished personal profile for authors, public figures, speakers, consultants, and leaders with media kit, op-eds, and speaking booking requests.",
    audience: "Authors, journalists, public figures, consultants, researchers, thought leaders, and executives",
    baseLook: "kapor",
    category: "other",
    tags: ["public-figure", "speaker", "leader", "author", "consultant", "media"],
    siteMode: "PORTFOLIO",
    vertical: "PUBLIC_FIGURE",
    settings: {
      accent: "#4338CA",
      background: "#FAFAFA",
      text: "#1E1B4B",
      radius: "soft",
      font: "editorial",
      button: "filled",
      buttonShape: "rounded",
      buttonSize: "medium",
      cardRatio: "portrait",
      cardHover: "lift",
      spacing: "airy",
      width: "wide",
    },
    pages: {
      home: {
        version: 1,
        sections: [
          {
            id: "pf_hero_1",
            type: "hero",
            settings: {
              eyebrow: "",
              eyebrowBn: "",
              title: "Ideas, Insights & Public Engagement",
              titleBn: "চিন্তা, বিশ্লেষণ ও সামাজিক নেতৃত্ব",
              text: "Author, Keynote Speaker, and Policy Analyst shaping economic reform and digital strategy in Bangladesh.",
              textBn: "লেখক, বক্তা ও অর্থনৈতিক বিশ্লেষক হিসেবে বাংলাদেশের উন্নয়ন রূপরেখায় সক্রিয় অবদান।",
              ctaText: "Speaking Inquiries",
              ctaTextBn: "বক্তব্য ও আমন্ত্রণ",
              ctaLink: "/contact",
              secondCtaText: "Media Kit & Bio",
              secondCtaTextBn: "মিডিয়া কিট ও পরিচিতি",
              secondCtaLink: "/media-kit",
            },
          },
          {
            id: "pf_articles_1",
            type: "portfolio-grid",
            settings: {
              title: "Featured Op-Eds & Publications",
              titleBn: "নির্বাচিত লেখা ও প্রবন্ধ",
              subtitle: "Read recent columns published across leading national dailies and international journals.",
              subtitleBn: "জাতীয় ও আন্তর্জাতিক পত্রিকায় প্রকাশিত সাম্প্রতিক কলামসমূহ।",
              columns: "2",
            },
          },
          {
            id: "pf_contact_1",
            type: "contact-form",
            settings: {
              heading: "Media & Speaking Inquiries",
              headingBn: "বক্তব্য ও সাক্ষাৎকার সংক্রান্ত যোগাযোগ",
              subhead: "For keynote speaking, panel participation, media interviews, or advisory roles.",
              subheadBn: "কী-নোট বক্তব্য, প্যানেল আলোচনা বা মিডিয়া সাক্ষাৎকারের জন্য বার্তা পাঠান।",
              buttonText: "Submit Invitation",
              buttonTextBn: "বার্তা পাঠান",
            },
          },
        ],
      },
    },
    customPages: [
      {
        slug: "media-kit",
        title: "Media Kit & Biography",
        titleBn: "মিডিয়া কিট ও জীবনবৃত্তান্ত",
        description: "Official biography, high-resolution portrait photographs, and press kit guidelines.",
        descriptionBn: "অফিসিয়াল জীবনবৃত্তান্ত ও মিডিয়া প্রেস কিট।",
        layout: {
          version: 1,
          sections: [
            {
              id: "media_bio_1",
              type: "rich-text",
              settings: {
                title: "Official Biography",
                titleBn: "অফিসিয়াল পরিচিতি",
                body: "Regular contributor to national economic forums and international research publications. Available for keynotes, advisory, and academic lectures.",
                bodyBn: "জাতীয় অর্থনীতি ও আধুনিক প্রযুক্তি বিষয়ক নিয়মিত কলামিস্ট ও বক্তা।",
              },
            },
          ],
        },
      },
      {
        slug: "contact",
        title: "Speaking & Advisory Inquiries",
        titleBn: "আমন্ত্রণ ও যোগাযোগ",
        description: "Submit invitations for conferences, keynotes, media commentary, and institutional consulting.",
        descriptionBn: "কনফারেন্স ও সেমিনারে আমন্ত্রণের জন্য যোগাযোগ।",
        layout: {
          version: 1,
          sections: [
            {
              id: "contact_section_1",
              type: "contact-form",
              settings: {
                heading: "Send an Official Invitation",
                headingBn: "অফিসিয়াল আমন্ত্রণ বার্তা পাঠান",
                subhead: "Please provide event dates, format (virtual or in-person), and topic focus.",
                subheadBn: "অনুষ্ঠানের তারিখ ও বিষয়ের বিবরণ উল্লেখ করুন।",
                buttonText: "Submit Official Request",
                buttonTextBn: "রিকোয়েস্ট পাঠান",
              },
            },
          ],
        },
      },
    ],
    chrome: {
      version: 1,
      header: {
        logo: "left",
        sticky: true,
        search: "none",
        showLanguage: true,
        showAccount: false,
        announcement: {
          mode: "custom",
          text: "🎙️ Open for Speaking Engagements & Advisory Roles for 2026/27",
          textBn: "🎙️ ২০২৬/২৭ এর জন্য কিনোট ও উপদেষ্টা হিসেবে আমন্ত্রণের আবেদন খোলা",
          link: "/contact",
          bgColor: "#4338CA",
          textColor: "#FFFFFF",
        },
      },
      menu: {
        auto: false,
        items: [
          { id: "pf_m1", type: "link", label: "Home", labelBn: "হোম", ref: "", url: "/" },
          { id: "pf_m2", type: "link", label: "Media Kit", labelBn: "মিডিয়া কিট", ref: "media-kit", url: "/media-kit" },
          { id: "pf_m3", type: "link", label: "Speaking", labelBn: "আমন্ত্রণ", ref: "contact", url: "/contact" },
        ],
      },
      footer: {
        columns: [
          {
            id: "pff_1",
            type: "text",
            title: "Public Engagements",
            titleBn: "পাবলিক ফোরাম",
            body: "Engaging in dialogue, research, and public leadership.",
            bodyBn: "সমাজ ও জাতীয় রূপরেখায় সক্রিয় অংশগ্রহণ।",
            links: [],
          },
          {
            id: "pff_2",
            type: "contact",
            title: "Executive Secretariat",
            titleBn: "অফিস ও যোগাযোগ",
            body: "Email: secretariat@leader.org.bd\nDhaka, Bangladesh",
            bodyBn: "ইমেইলঃ secretariat@leader.org.bd",
            links: [],
          },
        ],
        copyright: "All rights reserved. Built with BizTrack Business.",
        copyrightBn: "সর্বস্বত্ব সংরক্ষিত। বিসট্র্যাক বিজনেস-এ নির্মিত।",
      },
    },
  },
];

export function getBusinessTemplate(id: string): BusinessTemplateManifest | undefined {
  const clean = id.toLowerCase().trim();
  return BUSINESS_TEMPLATES.find(
    (t) => t.id === clean || t.aliases?.includes(clean)
  );
}

export function getBusinessTemplateByVertical(
  vertical?: BusinessVertical | null
): BusinessTemplateManifest | undefined {
  if (!vertical) return BUSINESS_TEMPLATES[0];
  return (
    BUSINESS_TEMPLATES.find((t) => t.vertical === vertical) ||
    BUSINESS_TEMPLATES[0]
  );
}

