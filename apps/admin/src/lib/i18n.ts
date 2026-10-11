/** Admin language: English or Bangla, chosen per person in a cookie. The shell (menus, top bar) is translated now; page text follows in the dynamic-content sweep (docs/37 phase 7). */
export type Lang = "en" | "bn";
export const LANG_COOKIE = "bt_lang";
export const asLang = (v: string | undefined): Lang => (v === "bn" ? "bn" : "en");

const BN: Record<string, string> = {
  Home: "হোম", Orders: "অর্ডার", "Quick order": "দ্রুত অর্ডার", Returns: "রিটার্ন", "Abandoned checkouts": "অসম্পূর্ণ চেকআউট", "Fraud check": "প্রতারণা যাচাই",
  Products: "পণ্য", Inventory: "ইনভেন্টরি", Customers: "কাস্টমার", Reviews: "রিভিউ", "Loyalty and referrals": "লয়্যালটি ও রেফারেল",
  Marketing: "মার্কেটিং", Discounts: "ডিসকাউন্ট", Pixels: "পিক্সেল", "Online store": "অনলাইন স্টোর", "Store design": "স্টোর ডিজাইন", "Landing pages": "ল্যান্ডিং পেজ", "Pages and blog": "পেজ ও ব্লগ",
  Reports: "রিপোর্ট", "COD payouts": "ক্যাশ অন ডেলিভারি পেআউট", "Profit and loss": "লাভ-ক্ষতি", Apps: "অ্যাপস", Integrations: "ইন্টিগ্রেশন", Settings: "সেটিংস",
  "Store details": "স্টোরের তথ্য", Domains: "ডোমেইন", Payments: "পেমেন্ট", Shipping: "ডেলিভারি", Team: "টিম", "Audit log": "অডিট লগ", "Plan and usage": "প্ল্যান ও ব্যবহার",
  More: "আরও", "New order": "নতুন অর্ডার", "View store": "স্টোর দেখুন", "Search orders, products, customers": "অর্ডার, পণ্য, কাস্টমার খুঁজুন", Search: "খুঁজুন",
  Notifications: "নোটিফিকেশন", "Nothing needs your attention": "আপনার মনোযোগ দরকার এমন কিছু নেই", "Go to": "যান", "No matches": "কিছু পাওয়া যায়নি", "Type to search": "খুঁজতে লিখুন",
  Appearance: "অ্যাপিয়ারেন্স", "Sign out": "সাইন আউট", "Free trial": "ফ্রি ট্রায়াল", "Choose a plan": "প্ল্যান বেছে নিন", Orders_: "অর্ডার",
};
export const tr = (lang: Lang, s: string): string => (lang === "bn" ? BN[s] ?? s : s);
