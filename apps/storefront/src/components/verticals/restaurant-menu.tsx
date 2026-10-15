import React, { useState } from "react";
import Image from "next/image";
import type { Lang } from "@/lib/i18n-core";

export interface MenuItemData {
  id: string;
  name: string;
  nameBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  price: number;
  comparePrice?: number | null;
  imageUrl?: string | null;
  dietaryTags?: string[]; // e.g. ["HALAL", "SPICY", "CHEF_SPECIAL", "VEGETARIAN"]
  isAvailable?: boolean;
}

export interface MenuCategoryData {
  id: string;
  name: string;
  nameBn?: string | null;
  items: MenuItemData[];
}

const DEFAULT_SAMPLE_CATEGORIES: MenuCategoryData[] = [
  {
    id: "starters",
    name: "Appetizers & Starters",
    nameBn: "শুরুতেই / স্টার্টার",
    items: [
      {
        id: "s1",
        name: "Dhaka Shami Kebab (2 pcs)",
        nameBn: "স্পেশাল শামি কাবাব (২ পিস)",
        description: "Finely minced spiced mutton patties pan-fried in pure ghee with mint chutney.",
        descriptionBn: "ঘিয়ে ভাজা খাঁটি খাসির মাংসের শামি কাবাব ও পুদিনা চাটনি।",
        price: 260,
        dietaryTags: ["HALAL", "CHEF_SPECIAL"],
        isAvailable: true,
      },
      {
        id: "s2",
        name: "Crispy Garlic Butter Prawns",
        nameBn: "ক্রিসপি বাটার গার্লিক প্রন",
        description: "Fresh Bay of Bengal prawns tossed in roasted garlic butter and scallions.",
        descriptionBn: "তাজা বাগদা চিংড়ি, গোলমরিচ ও রসুন বাটারের ক্রিসপি টস।",
        price: 480,
        dietaryTags: ["HALAL"],
        isAvailable: true,
      },
    ],
  },
  {
    id: "mains",
    name: "Traditional Biryani & Platters",
    nameBn: "বিরিয়ানি ও ঐতিহ্যবাহী থালি",
    items: [
      {
        id: "m1",
        name: "Kacchi Biryani Special",
        nameBn: "পুরান ঢাকা খাসির কাচ্চি বিরিয়ানি",
        description: "Aromatic chinigura rice slow-cooked with tender mutton shank, saffron, alu and boiled egg.",
        descriptionBn: "খাঁটি চিনিগুঁড়া চাল, রসালো খাসির মাংস, জাফরান ও আলুবোখারা সহযোগে স্পেশাল কাচ্চি।",
        price: 520,
        dietaryTags: ["HALAL", "CHEF_SPECIAL"],
        isAvailable: true,
      },
      {
        id: "m2",
        name: "Beef Morog Polao Platter",
        nameBn: "মোরগ পোলাও সাথে রোস্ট",
        description: "Rich deshi chicken roast served over buttery fragrant polao with boiled egg and borhani.",
        descriptionBn: "দেশি মুরগির সুস্বাদু রোস্ট ও ঘিয়ের সুবাসিত পোলাও সাথে বোরহানি।",
        price: 440,
        dietaryTags: ["HALAL"],
        isAvailable: true,
      },
      {
        id: "m3",
        name: "Smoked Mustard Ilish Khichuri",
        nameBn: "সরিষা ইলিশ ভুনা খিচুড়ি",
        description: "Seasonal Padma Hilsa cooked in cold-pressed mustard gravy with roasted moong dal khichuri.",
        descriptionBn: "পদ্মার তাজা ইলিশ ও ভুনা খিচুড়ি সরিষার তেলের খাঁটি ঘ্রাণে।",
        price: 680,
        dietaryTags: ["HALAL"],
        isAvailable: true,
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts & Beverages",
    nameBn: "মিষ্টান্ন ও পানীয়",
    items: [
      {
        id: "d1",
        name: "Shahi Pistachio Firni",
        nameBn: "জাফরানি পেস্তা ফিরনি",
        description: "Slow-reduced creamy milk pudding infused with cardamom, saffron and crushed pistachios.",
        descriptionBn: "মাটির পাত্রে পরিবেশিত জাফরান ও পেস্তা বাদামের শাহী ফিরনি।",
        price: 150,
        dietaryTags: ["HALAL", "VEGETARIAN"],
        isAvailable: true,
      },
      {
        id: "d2",
        name: "Traditional Borhani",
        nameBn: "স্পেশাল বোরহানি",
        description: "Spiced chilled yogurt digestive beverage with fresh mint, coriander and roasted cumin.",
        descriptionBn: "টকদই, পুদিনা ও বিট লবণের সুস্বাদু ঐতিহ্যবাহী বোরহানি।",
        price: 90,
        dietaryTags: ["HALAL", "VEGETARIAN"],
        isAvailable: true,
      },
    ],
  },
];

export function RestaurantMenuSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  categories = DEFAULT_SAMPLE_CATEGORIES,
  lang,
  showDietary = true,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  categories?: MenuCategoryData[];
  lang: Lang;
  showDietary?: boolean;
}) {
  const activeCategories = categories.length > 0 ? categories : DEFAULT_SAMPLE_CATEGORIES;
  const [selectedCatId, setSelectedCatId] = useState(activeCategories[0]?.id ?? "");

  const activeCategory = activeCategories.find((c) => c.id === selectedCatId) ?? activeCategories[0];
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "আমাদের মেন্যু" : "Our Menu");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "প্রতিদিন তাজা উপাদানে তৈরি খাঁটি খাবার" : "Freshly prepared daily with 100% authentic ingredients");

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 32, maxWidth: 640, margin: "0 auto 36px" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{heading}</h2>
        {sub && <p style={{ fontSize: "1rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>}
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 36,
          padding: "4px",
          background: "var(--tint-1, #f1f5f9)",
          borderRadius: 9999,
          maxWidth: "fit-content",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {activeCategories.map((c) => {
          const isSelected = c.id === (activeCategory?.id ?? "");
          const label = lang === "bn" && c.nameBn ? c.nameBn : c.name;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCatId(c.id)}
              style={{
                border: "none",
                background: isSelected ? "var(--btn-bg, #0f172a)" : "transparent",
                color: isSelected ? "var(--btn-fg, #ffffff)" : "var(--fg, #334155)",
                padding: "8px 20px",
                borderRadius: 9999,
                fontWeight: isSelected ? 700 : 500,
                fontSize: "0.92rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Menu Items Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {activeCategory?.items.map((item) => {
          const itemName = lang === "bn" && item.nameBn ? item.nameBn : item.name;
          const itemDesc = lang === "bn" && item.descriptionBn ? item.descriptionBn : item.description;
          return (
            <div
              key={item.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius, 12px)",
                padding: 16,
                background: "var(--bg, #ffffff)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                  <h3 style={{ fontSize: "1.08rem", fontWeight: 700, margin: 0 }}>{itemName}</h3>
                  <div style={{ fontWeight: 800, color: "var(--accent, #d97706)", fontSize: "1.05rem", whiteSpace: "nowrap" }}>
                    ৳{item.price.toLocaleString("en-BD")}
                  </div>
                </div>
                {itemDesc && (
                  <p style={{ fontSize: "0.88rem", color: "var(--muted, #64748b)", margin: "0 0 10px", lineHeight: 1.5 }}>
                    {itemDesc}
                  </p>
                )}
              </div>

              {showDietary && item.dietaryTags && item.dietaryTags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {item.dietaryTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                        letterSpacing: "0.03em",
                        background: tag === "CHEF_SPECIAL" ? "rgba(217, 119, 6, 0.12)" : "rgba(34, 197, 94, 0.12)",
                        color: tag === "CHEF_SPECIAL" ? "#b45309" : "#15803d",
                      }}
                    >
                      {tag === "CHEF_SPECIAL" ? (lang === "bn" ? "শেফ স্পেশাল" : "Chef's Special") : tag === "HALAL" ? (lang === "bn" ? "১০০% হালাল" : "Halal") : tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
