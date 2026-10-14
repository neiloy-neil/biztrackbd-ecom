export interface StarterProductPreset {
  title: string;
  titleBn?: string;
  slug: string;
  category: string;
  price: number;
  cost?: number;
  compareAt?: number;
  text: string;
  textBn?: string;
  featured?: boolean;
  variants: { title: string; stock: number; options?: Record<string, string> }[];
}

export interface StarterCategoryPreset {
  name: string;
  slug: string;
}

export interface StarterCatalogPreset {
  categoryKey: string;
  categories: StarterCategoryPreset[];
  products: StarterProductPreset[];
  defaultTheme: string;
  shipping: {
    insideDhaka: { name: string; rate: number; freeOver: number };
    outsideDhaka: { name: string; rate: number; freeOver: number };
  };
}

export const CATEGORY_CATALOG_PRESETS: Record<string, StarterCatalogPreset> = {
  FASHION: {
    categoryKey: "FASHION",
    defaultTheme: "kapor",
    shipping: {
      insideDhaka: { name: "Inside Dhaka city", rate: 70, freeOver: 2500 },
      outsideDhaka: { name: "Outside Dhaka", rate: 130, freeOver: 4000 },
    },
    categories: [
      { name: "Panjabi & Ethnic", slug: "panjabi" },
      { name: "Sarees & Women's Wear", slug: "sarees" },
      { name: "Footwear & Accessories", slug: "footwear" },
    ],
    products: [
      {
        title: "Premium Semi-Drop Cotton Panjabi",
        titleBn: "প্রিমিয়াম সেমি-ড্রপ কটন পাঞ্জাবি",
        slug: "premium-cotton-panjabi",
        category: "panjabi",
        price: 1850,
        cost: 950,
        compareAt: 2200,
        text: "Crafted with 100% combed cotton, breathable weave, and minimalist tonal collar embroidery. Perfect for casual wear and festive celebrations.",
        textBn: "১০০% প্রিমিয়াম সুতি সুতা দিয়ে বোনা, আরামদায়ক এবং আধুনিক ডিজাইনের কলার এমব্রয়ডারি করা পাঞ্জাবি।",
        featured: true,
        variants: [
          { title: "Size 40", stock: 15, options: { Size: "40" } },
          { title: "Size 42", stock: 20, options: { Size: "42" } },
          { title: "Size 44", stock: 12, options: { Size: "44" } },
        ],
      },
      {
        title: "Exclusive Floral Georgette Party Saree",
        titleBn: "এক্সক্লুসিভ ফ্লোরাল জর্জেট পার্টি শাড়ি",
        slug: "floral-georgette-saree",
        category: "sarees",
        price: 2450,
        cost: 1300,
        compareAt: 2950,
        text: "Lightweight premium georgette with metallic foil floral prints and matching unstitched blouse piece. Drapes effortlessly for evening occasions.",
        textBn: "হালকা এবং মসৃণ পিওর জর্জেট মেটেরিয়ালে তৈরি উৎসব ও পার্টির জন্য আকর্ষণীয় শাড়ি।",
        featured: true,
        variants: [
          { title: "Maroon", stock: 10, options: { Color: "Maroon" } },
          { title: "Midnight Navy", stock: 14, options: { Color: "Navy" } },
        ],
      },
      {
        title: "Handcrafted Genuine Leather Loafers",
        titleBn: "হস্তনির্মিত জেনুইন লেদার লোফার",
        slug: "handcrafted-leather-loafers",
        category: "footwear",
        price: 3200,
        cost: 1700,
        compareAt: 3800,
        text: "Full-grain supple cow leather upper with cushioned arch support memory insole and durable anti-skid rubber outsole.",
        textBn: "১০০% খাঁটি চামড়ার আরামদায়ক হ্যান্ডক্রাফটেড লোফার জুতো।",
        featured: false,
        variants: [
          { title: "Size 40", stock: 8, options: { Size: "40" } },
          { title: "Size 41", stock: 10, options: { Size: "41" } },
          { title: "Size 42", stock: 12, options: { Size: "42" } },
        ],
      },
    ],
  },

  BEAUTY: {
    categoryKey: "BEAUTY",
    defaultTheme: "shorir",
    shipping: {
      insideDhaka: { name: "Inside Dhaka city", rate: 60, freeOver: 1500 },
      outsideDhaka: { name: "Outside Dhaka", rate: 120, freeOver: 3000 },
    },
    categories: [
      { name: "Skincare", slug: "skincare" },
      { name: "Makeup", slug: "makeup" },
      { name: "Hair Care", slug: "haircare" },
    ],
    products: [
      {
        title: "10% Pure Vitamin C Radiance Serum (30ml)",
        titleBn: "১০% পিওর ভিটামিন সি রেডিয়েন্স সিরাম (৩০ মি.লি.)",
        slug: "vitamin-c-radiance-serum",
        category: "skincare",
        price: 850,
        cost: 380,
        compareAt: 1100,
        text: "Formulated with stabilized L-Ascorbic acid and Hyaluronic acid to fade dark spots, even out skin tone, and restore natural glow.",
        textBn: "দাগহীন উজ্জ্বল ত্বকের জন্য কার্যকরী ও প্রাকৃতিক ভিটামিন সি সিরাম।",
        featured: true,
        variants: [{ title: "30ml Dropper Bottle", stock: 35 }],
      },
      {
        title: "Tea Tree & Organic Neem Purifying Face Wash (150ml)",
        titleBn: "টি ট্রি ও অর্গানিক নিম ফেসওয়াশ (১৫০ মি.লি.)",
        slug: "tea-tree-neem-facewash",
        category: "skincare",
        price: 350,
        cost: 150,
        compareAt: 450,
        text: "Gentle soap-free clarifying gel cleanser that prevents breakouts and controls excess facial sebum without drying.",
        textBn: "ব্রণ ও অতিরিক্ত তেল দূর করতে প্রাকৃতিক নিম ও টি ট্রি নির্যাসের ফেসওয়াশ।",
        featured: true,
        variants: [{ title: "150ml Tube", stock: 50 }],
      },
      {
        title: "Velvet Matte Weightless Liquid Lipstick",
        titleBn: "ভেলভেট ম্যাট লিকুইড লিপস্টিক",
        slug: "velvet-matte-liquid-lipstick",
        category: "makeup",
        price: 490,
        cost: 210,
        compareAt: 650,
        text: "12-hour transfer-proof smudge-resistant formula enriched with Vitamin E and Jojoba oil for soft, hydrated lips.",
        textBn: "দীর্ঘস্থায়ী ওয়াটারপ্রুফ ভেলভেট ম্যাট লিপস্টিক।",
        featured: false,
        variants: [
          { title: "Berry Plum", stock: 25, options: { Shade: "Berry Plum" } },
          { title: "Terracotta Nude", stock: 30, options: { Shade: "Terracotta Nude" } },
        ],
      },
    ],
  },

  ELECTRONICS: {
    categoryKey: "ELECTRONICS",
    defaultTheme: "gadgetstudio",
    shipping: {
      insideDhaka: { name: "Inside Dhaka Express", rate: 80, freeOver: 3500 },
      outsideDhaka: { name: "Outside Dhaka Express", rate: 140, freeOver: 5000 },
    },
    categories: [
      { name: "Audio & Earbuds", slug: "audio" },
      { name: "Power & Chargers", slug: "power" },
      { name: "Wearables", slug: "wearables" },
    ],
    products: [
      {
        title: "Pro Hybrid ANC True Wireless Earbuds",
        titleBn: "প্রো হাইব্রিড এএনসি ট্রু ওয়্যারলেস এয়ারবাডস",
        slug: "pro-hybrid-anc-earbuds",
        category: "audio",
        price: 1650,
        cost: 880,
        compareAt: 2100,
        text: "35dB Active Noise Cancellation, Bluetooth 5.3 with ultra-low 45ms gaming latency, IPX5 sweat resistance, and 30-hour playback case.",
        textBn: "অ্যাক্টিভ নয়েজ ক্যান্সেলেশন ও ক্লিয়ার বেস সাউন্ড সহ দীর্ঘস্থায়ী ব্যাটারি ব্যাকআপ এয়ারবাডস।",
        featured: true,
        variants: [
          { title: "Matte Black", stock: 20, options: { Color: "Black" } },
          { title: "Glossy White", stock: 15, options: { Color: "White" } },
        ],
      },
      {
        title: "20,000mAh 22.5W Fast Charging MagSafe Power Bank",
        titleBn: "২০,০০০ মিলিঅ্যাম্পিয়ার ফাস্ট চার্জিং পাওয়ার ব্যাংক",
        slug: "20000mah-fast-charging-powerbank",
        category: "power",
        price: 2250,
        cost: 1250,
        compareAt: 2750,
        text: "Dual PD 3.0 Type-C ports with digital battery percentage display, strong magnetic wireless snap, and multi-protocol fast charging.",
        textBn: "একসাথে ৩টি ডিভাইস দ্রুত চার্জ করার সুবিধাসহ এলইডি ডিসপ্লে পাওয়ার ব্যাংক।",
        featured: true,
        variants: [{ title: "Titanium Gray", stock: 25 }],
      },
      {
        title: "AMOLED IP68 Bluetooth Calling Smart Fitness Watch",
        titleBn: "এমোলেড আইপি৬৮ ব্লুটুথ কলিং স্মার্টওয়াচ",
        slug: "amoled-calling-smartwatch",
        category: "wearables",
        price: 2850,
        cost: 1500,
        compareAt: 3500,
        text: "1.43-inch Always-on vibrant AMOLED display, SpO2 blood oxygen tracking, heart rate monitor, 100+ sports modes, and crystal-clear HD calling mic.",
        textBn: "এইচডি ব্লুটুথ কলিং ও হেলথ ট্র্যাকিং সমৃদ্ধ প্রিমিয়াম স্মার্টওয়াচ।",
        featured: false,
        variants: [
          { title: "Silicone Black Strap", stock: 18, options: { Strap: "Black Silicone" } },
          { title: "Stainless Silver Mesh", stock: 12, options: { Strap: "Silver Mesh" } },
        ],
      },
    ],
  },

  GROCERY: {
    categoryKey: "GROCERY",
    defaultTheme: "shodai",
    shipping: {
      insideDhaka: { name: "Home Delivery Dhaka", rate: 60, freeOver: 2000 },
      outsideDhaka: { name: "Courier Delivery Outside Dhaka", rate: 120, freeOver: 3500 },
    },
    categories: [
      { name: "Oils & Ghee", slug: "oils" },
      { name: "Natural Honey", slug: "honey" },
      { name: "Dry Fruits & Nuts", slug: "dry-fruits" },
    ],
    products: [
      {
        title: "Cold-Pressed Pure Ghani Mustard Oil (1 Litre)",
        titleBn: "কাঠের ঘানিতে ভাঙানো খাঁটি সরিষার তেল (১ লিটার)",
        slug: "pure-ghani-mustard-oil-1l",
        category: "oils",
        price: 280,
        cost: 190,
        compareAt: 320,
        text: "Traditionally stone-cold-pressed from freshly harvested domestic Maghi mustard seeds. Unadulterated, pungent natural aroma and zero chemical additives.",
        textBn: "দেশি মাঘী সরিষা থেকে কাঠের ঘানিতে ভাঙানো শতভাগ খাঁটি ও ঝাঁঝালো সরিষার তেল।",
        featured: true,
        variants: [{ title: "1 Litre Bottle", stock: 40 }],
      },
      {
        title: "Sundarban 100% Pure Raw Wild Forest Honey (500g)",
        titleBn: "সুন্দরবনের ১০০% খাঁটি প্রাকৃতিক খলিশা মধু (৫০০ গ্রাম)",
        slug: "sundarban-raw-wild-honey-500g",
        category: "honey",
        price: 650,
        cost: 390,
        compareAt: 800,
        text: "Collected directly by traditional Mowals from deep Sundarban mangrove forests. Unfiltered, unheated, and packed with natural enzymes and pollen.",
        textBn: "সুন্দরবনের খলিশা ফুলের খাঁটি প্রাকৃতিক প্রাকৃতিক অপরিশোধিত মধু।",
        featured: true,
        variants: [{ title: "500g Glass Jar", stock: 30 }],
      },
      {
        title: "Premium Jumbo Medjool Dates (500g Box)",
        titleBn: "প্রিমিয়াম জাম্বো মেদজুল খেজুর (৫০০ গ্রাম)",
        slug: "premium-medjool-dates-500g",
        category: "dry-fruits",
        price: 850,
        cost: 550,
        compareAt: 1050,
        text: "Freshly imported super soft, caramel-sweet natural Medjool dates. Rich in dietary fiber, potassium, and essential energy minerals.",
        textBn: "নরম ও মিষ্টি স্বাদের প্রিমিয়াম কোয়ালিটির মেদজুল খেজুর।",
        featured: false,
        variants: [{ title: "500g Sealed Box", stock: 25 }],
      },
    ],
  },

  GENERAL: {
    categoryKey: "GENERAL",
    defaultTheme: "kapor",
    shipping: {
      insideDhaka: { name: "Inside Dhaka city", rate: 70, freeOver: 2500 },
      outsideDhaka: { name: "Outside Dhaka", rate: 130, freeOver: 4000 },
    },
    categories: [
      { name: "Home & Lifestyle", slug: "lifestyle" },
      { name: "Eco Accessories", slug: "eco" },
      { name: "Kitchen & Dining", slug: "kitchen" },
    ],
    products: [
      {
        title: "Artisanal Matte Ceramic Coffee Mug Set (Pack of 2)",
        titleBn: "হ্যান্ডক্রাফটেড সিরামিক কফি মগ সেট (২ পিস)",
        slug: "ceramic-coffee-mug-set",
        category: "kitchen",
        price: 750,
        cost: 350,
        compareAt: 950,
        text: "Hand-thrown stoneware ceramic mugs with tactile matte speckle glaze. Dishwasher and microwave safe.",
        textBn: "আধুনিক ডিজাইনের টেকসই সিরামিক কফি মগ সেট।",
        featured: true,
        variants: [{ title: "Nordic Gray", stock: 20 }],
      },
      {
        title: "Handwoven Eco Jute Tote Shoulder Bag",
        titleBn: "হাতে বোনা পরিবেশবান্ধব পাটের টোট ব্যাগ",
        slug: "handwoven-jute-tote-bag",
        category: "eco",
        price: 650,
        cost: 300,
        compareAt: 850,
        text: "100% biodegradable golden natural jute with cotton canvas lining, inner zipper pocket, and sturdy reinforced handles.",
        textBn: "পরিবেশবান্ধব ও ফ্যাশনেবল ১০০% খাঁটি সোনালী পাটের শোল্ডার ব্যাগ।",
        featured: true,
        variants: [{ title: "Natural Tan", stock: 25 }],
      },
      {
        title: "Aromatherapy French Lavender Soy Wax Candle (200g)",
        titleBn: "অ্যারোমাথেরাপি ফ্রেঞ্চ ল্যাভেন্ডার সয় ক্যান্ডেল (২০০ গ্রাম)",
        slug: "french-lavender-soy-candle",
        category: "lifestyle",
        price: 450,
        cost: 200,
        compareAt: 600,
        text: "Hand-poured clean-burning natural soy candle with calming French lavender essential oils and wooden crackling wick.",
        textBn: "প্রাকৃতিক সুগন্ধিযুক্ত ১০০% পিওর সয় ওয়াক্স ক্যান্ডেল।",
        featured: false,
        variants: [{ title: "Amber Glass 200g", stock: 30 }],
      },
    ],
  },
};

/**
 * Returns the starter catalog configuration matching a category key, falling back to GENERAL.
 */
export function getCategoryStarterPreset(category = "GENERAL"): StarterCatalogPreset {
  const norm = (category || "").toUpperCase();
  return CATEGORY_CATALOG_PRESETS[norm] ?? CATEGORY_CATALOG_PRESETS.GENERAL!;
}
