import { normalizeBdPhone } from "../phone";
import type { WhatsAppOrderLinkOptions, WhatsAppAbandonedLinkOptions } from "./types";

/**
 * Normalizes any Bangladeshi phone number to international format without the plus sign for WhatsApp.
 * Example: "01712345678" -> "8801712345678"
 * Example: "1712345678" -> "8801712345678"
 * Example: "+8801712345678" -> "8801712345678"
 * Example: "+8808801712345678" -> "8801712345678"
 */
export function formatWhatsAppPhone(rawPhone: string): string {
  try {
    const bd = normalizeBdPhone(rawPhone);
    return `88${bd}`;
  } catch {
    // If phone cannot be validated through strict regex, strip non-digits and normalize
    let digits = rawPhone.replace(/\D/g, "");
    while (digits.startsWith("880880")) digits = digits.slice(3);
    if (digits.startsWith("880") && digits.length >= 13) return digits.slice(0, 13);
    if (digits.startsWith("01") && digits.length === 11) return `88${digits}`;
    if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
    return digits;
  }
}

/**
 * Generates a direct `https://wa.me/{phone}?text={encoded}` URL.
 */
export function buildWhatsAppCustomLink(phone: string, text: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text.trim())}`;
}

/**
 * Generates ready-to-click WhatsApp deep links for order management with Bangla / English templates.
 */
export function buildWhatsAppOrderLink(options: WhatsAppOrderLinkOptions): string {
  const {
    phone,
    orderNumber,
    customerName,
    orderTotal,
    itemsSummary,
    deliveryAddress,
    courierName,
    trackingCode,
    trackingUrl,
    storeName,
    lang = "bn",
    type,
  } = options;

  const name = customerName?.trim() ? customerName.trim().split(/\s+/)[0] : (lang === "bn" ? "প্রিয় গ্রাহক" : "Valued Customer");
  const totalFormatted = typeof orderTotal === "number" ? `৳ ${Math.round(orderTotal).toLocaleString("en-IN")}` : orderTotal;

  let text = "";

  if (type === "COD_CONFIRM") {
    if (lang === "bn") {
      text =
        `আসসালামু আলাইকুম ${name},\n\n` +
        `*${storeName}* থেকে আপনার অর্ডার *#${orderNumber}* সফলভাবে গ্রহণ করা হয়েছে।\n\n` +
        (itemsSummary ? `পণ্য: ${itemsSummary}\n` : "") +
        `মোট মূল্য (ক্যাশ অন ডেলিভারি): *${totalFormatted}*\n` +
        (deliveryAddress ? `ডেলিভারি ঠিকানা: ${deliveryAddress}\n\n` : "\n") +
        `অর্ডারটি কনফার্ম করতে দয়া করে *1* লিখে রিপ্লাই দিন।\n` +
        `বাতিল করতে চাইলে *2* লিখে রিপ্লাই দিন।\n\n` +
        `ধন্যবাদ!`;
    } else {
      text =
        `Hello ${name},\n\n` +
        `Thank you for ordering with *${storeName}*! We received your order *#${orderNumber}*.\n\n` +
        (itemsSummary ? `Items: ${itemsSummary}\n` : "") +
        `Cash on Delivery Total: *${totalFormatted}*\n` +
        (deliveryAddress ? `Delivery Address: ${deliveryAddress}\n\n` : "\n") +
        `Reply *1* to CONFIRM your order.\n` +
        `Reply *2* to CANCEL.\n\n` +
        `Thank you!`;
    }
  } else if (type === "SHIPPING_UPDATE") {
    if (lang === "bn") {
      text =
        `আসসালামু আলাইকুম ${name},\n\n` +
        `আপনার অর্ডার *#${orderNumber}* ডেলিভারির জন্য পাঠানো হয়েছে!\n\n` +
        (courierName ? `কুরিয়ার: *${courierName}*\n` : "") +
        (trackingCode ? `ট্র্যাকিং কোড: *${trackingCode}*\n` : "") +
        (trackingUrl ? `ট্র্যাকিং লিংক: ${trackingUrl}\n\n` : "\n") +
        `ডেলিভারি ম্যান কল দিলে পার্সেলটি গ্রহণ করুন।\n` +
        `ধন্যবাদ, *${storeName}*`;
    } else {
      text =
        `Hello ${name},\n\n` +
        `Your order *#${orderNumber}* has been dispatched!\n\n` +
        (courierName ? `Courier: *${courierName}*\n` : "") +
        (trackingCode ? `Tracking Code: *${trackingCode}*\n` : "") +
        (trackingUrl ? `Track Here: ${trackingUrl}\n\n` : "\n") +
        `Please stay alert for the delivery agent's call.\n` +
        `Thank you, *${storeName}*`;
    }
  } else if (type === "CASH_REMINDER") {
    if (lang === "bn") {
      text =
        `আসসালামু আলাইকুম ${name},\n\n` +
        `আপনার পার্সেলটি আজ ডেলিভারি হতে পারে!\n` +
        `অর্ডার নম্বর: *#${orderNumber}*\n` +
        `দয়া করে ক্যাশ অন ডেলিভারির জন্য সঠিক টাকা *${totalFormatted}* প্রস্তুত রাখুন।\n\n` +
        `ডেলিভারি এজেন্ট শীঘ্রই আপনার সাথে যোগাযোগ করবেন।\n` +
        `ধন্যবাদ, *${storeName}*`;
    } else {
      text =
        `Hello ${name},\n\n` +
        `Your package is out for delivery today!\n` +
        `Order: *#${orderNumber}*\n` +
        `Please keep the exact COD amount *${totalFormatted}* ready for the delivery rider.\n\n` +
        `Thank you, *${storeName}*`;
    }
  } else if (type === "REVIEW_REQUEST") {
    if (lang === "bn") {
      text =
        `আসসালামু আলাইকুম ${name},\n\n` +
        `আপনার অর্ডার *#${orderNumber}* পৌঁছে দেওয়া হয়েছে!\n` +
        `পণ্যটি আপনার কেমন লেগেছে? আপনার একটি ছোট রিভিউ আমাদের আরও ভালো সেবা দিতে সাহায্য করবে।\n\n` +
        (trackingUrl ? `রিভিউ দিতে ক্লিক করুন: ${trackingUrl}\n\n` : "") +
        `*${storeName}*-এর সাথে থাকার জন্য ধন্যবাদ!`;
    } else {
      text =
        `Hello ${name},\n\n` +
        `Your order *#${orderNumber}* has been delivered!\n` +
        `We hope you love your purchase. Please share your feedback with us.\n\n` +
        (trackingUrl ? `Review here: ${trackingUrl}\n\n` : "") +
        `Thank you for choosing *${storeName}*!`;
    }
  } else {
    // GENERAL_SUPPORT
    if (lang === "bn") {
      text =
        `আসসালামু আলাইকুম ${name},\n` +
        `*${storeName}* থেকে আপনার অর্ডার *#${orderNumber}* সংক্রান্ত যেকোনো সহায়তার জন্য আমরা এখানে আছি। আপনাকে কীভাবে সাহায্য করতে পারি?`;
    } else {
      text =
        `Hello ${name},\n` +
        `This is *${storeName}* regarding your order *#${orderNumber}*. How can we assist you today?`;
    }
  }

  return buildWhatsAppCustomLink(phone, text);
}

/**
 * Generates ready-to-click WhatsApp deep link for abandoned cart recovery.
 */
export function buildWhatsAppAbandonedLink(options: WhatsAppAbandonedLinkOptions): string {
  const {
    phone,
    customerName,
    storeName,
    recoverUrl,
    cartTotal,
    cartSummary,
    discountCode,
    lang = "bn",
  } = options;

  const name = customerName?.trim() ? customerName.trim().split(/\s+/)[0] : (lang === "bn" ? "প্রিয় গ্রাহক" : "Valued Customer");
  const totalFormatted = cartTotal ? (typeof cartTotal === "number" ? `৳ ${Math.round(cartTotal).toLocaleString("en-IN")}` : cartTotal) : "";

  let text = "";
  if (lang === "bn") {
    text =
      `আসসালামু আলাইকুম ${name},\n\n` +
      `*${storeName}*-এ আপনার পছন্দের পণ্য কার্টে রয়ে গেছে!` +
      (totalFormatted ? ` (মোট: *${totalFormatted}*)` : "") + "\n" +
      (cartSummary ? `আইটেম: ${cartSummary}\n\n` : "\n") +
      (discountCode ? `আপনার জন্য বিশেষ অফার: কুপন কোড *${discountCode}* ব্যবহার করে এখনই অর্ডার সম্পন্ন করুন!\n\n` : "") +
      `অর্ডারটি সম্পূর্ণ করতে এখানে ক্লিক করুন:\n${recoverUrl}\n\n` +
      `কোনো প্রশ্ন থাকলে সরাসরি আমাদের রিপ্লাই দিন।`;
  } else {
    text =
      `Hello ${name},\n\n` +
      `You left items in your cart at *${storeName}*!` +
      (totalFormatted ? ` (Total: *${totalFormatted}*)` : "") + "\n" +
      (cartSummary ? `Items: ${cartSummary}\n\n` : "\n") +
      (discountCode ? `Special discount for you: Use code *${discountCode}* to complete your order!\n\n` : "") +
      `Complete your order here:\n${recoverUrl}\n\n` +
      `Feel free to reply if you need any assistance!`;
  }

  return buildWhatsAppCustomLink(phone, text);
}
