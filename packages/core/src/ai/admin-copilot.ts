import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_ADMIN_COPILOT } from "./prompts";

export interface AdminCopilotMessage {
  role: "user" | "model";
  text: string;
}

export interface AdminCopilotInput {
  message: string;
  history?: AdminCopilotMessage[];
  fetchImpl?: typeof fetch;
}

export interface AdminCopilotActionLink {
  label: string;
  href: string;
}

export interface AdminCopilotResponse {
  reply: string;
  suggestedQuestions?: string[];
  actionLinks?: AdminCopilotActionLink[];
  quotaRemaining?: number;
  isCustomKey?: boolean;
}

/**
 * Handles conversational queries from the merchant / store owner in the Admin Copilot.
 * Grounded in live orders, revenue, inventory, bookings, and business telemetry.
 */
export async function handleAdminCopilotChat(
  tenantId: string,
  actor: StaffActor,
  input: AdminCopilotInput
): Promise<AdminCopilotResponse> {
  // Ensure actor has access to admin dashboard
  assertCan(actor, "orders", "view");

  const userText = input.message.trim();
  if (!userText) {
    return {
      reply: "আসসালামু আলাইকুম! আমি আপনার বিজট্র্যাক এআই বিজনেস কো-পাইলট। আজকের সেলস, পেন্ডিং অর্ডার, বুকিং বা কাস্টমার মেসেজ ড্রাফটের বিষয়ে যেকোনো প্রশ্ন করতে পারেন।",
      suggestedQuestions: [
        "আজকের সেলস ও অর্ডার সামারি দিন",
        "পেন্ডিং বুকিং ও লিড চেক করুন",
        "লো-স্টক প্রোডাক্ট কোনগুলো?",
        "ডেলিভারি ডিলের জন্য কাস্টমার মেসেজ ড্রাফট করুন",
      ],
      actionLinks: [
        { label: "অর্ডার ম্যানেজমেন্ট", href: "/orders" },
        { label: "বুকিং ও লিডস", href: "/bookings" },
      ],
    };
  }

  return withTenant(tenantId, async (tx) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      tenant,
      settings,
      todayOrders,
      pendingOrdersCount,
      processingOrdersCount,
      deliveredOrdersCount,
      newLeadsCount,
      pendingBookingsCount,
      lowStockVariants,
      outOfStockVariants,
      topProducts,
      contentItems,
    ] = await Promise.all([
      tx.tenant.findFirstOrThrow({
        select: { name: true, planTier: true, siteMode: true, businessVertical: true },
      }),
      tx.storeSettings.findFirst({
        select: {
          storeName: true,
          contactPhone: true,
          whatsappNumber: true,
          addressLine: true,
          courierFeeInsideDhaka: true,
          courierFeeOutsideDhaka: true,
          aiChatbotInstructions: true,
        },
      }),
      tx.order.findMany({
        where: { createdAt: { gte: startOfToday } },
        select: { totalAmount: true, status: true },
      }),
      tx.order.count({ where: { status: "PENDING" } }),
      tx.order.count({ where: { status: "PROCESSING" } }),
      tx.order.count({ where: { status: "DELIVERED" } }),
      tx.siteLead.count({ where: { status: "NEW" } }),
      tx.bookingRequest.count({ where: { status: "REQUESTED" } }),
      tx.productVariant.findMany({
        where: { stockQuantity: { lte: 5, gt: 0 } },
        select: { title: true, stockQuantity: true, product: { select: { title: true } } },
        take: 5,
      }),
      tx.productVariant.findMany({
        where: { stockQuantity: { lte: 0 } },
        select: { title: true, product: { select: { title: true } } },
        take: 5,
      }),
      tx.product.findMany({
        where: { status: "ACTIVE" },
        select: { title: true, variants: { select: { price: true }, take: 1 } },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      tx.siteContentItem.findMany({
        where: { isPublished: true },
        select: { kind: true, title: true, summary: true },
        take: 8,
      }),
    ]);

    const todaySalesTotal = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    const telemetryContext = `
BUSINESS PROFILE:
- Business Name: ${settings?.storeName || tenant.name}
- Plan Tier: ${tenant.planTier}
- Site Mode: ${tenant.siteMode}
- Vertical: ${tenant.businessVertical || "RETAIL"}
- Support Phone: ${settings?.contactPhone || settings?.whatsappNumber || "Not set"}

LIVE OPERATIONS TELEMETRY (TODAY):
- Today's Order Count: ${todayOrders.length}
- Today's Gross Sales: ৳ ${todaySalesTotal}
- Pending Orders (Awaiting Confirmation): ${pendingOrdersCount}
- Processing / In-Delivery Orders: ${processingOrdersCount}
- Completed / Delivered Orders: ${deliveredOrdersCount}
- New Customer Inquiries / Leads: ${newLeadsCount}
- Pending Appointments / Bookings: ${pendingBookingsCount}

INVENTORY STATUS:
- Out of Stock Variants (${outOfStockVariants.length}): ${outOfStockVariants.map((v) => `${v.product.title} (${v.title})`).join(", ") || "None"}
- Low Stock Variants (${lowStockVariants.length}): ${lowStockVariants.map((v) => `${v.product.title} (${v.title}: ${v.stockQuantity} left)`).join(", ") || "None"}

ACTIVE PRODUCTS / SERVICES:
${topProducts.map((p) => `- Product: ${p.title} (৳ ${p.variants[0]?.price ?? 0})`).join("\n")}
${contentItems.map((c) => `- [${c.kind}] ${c.title}: ${c.summary || ""}`).join("\n")}

${settings?.aiChatbotInstructions ? `MERCHANT CUSTOM INSTRUCTIONS & FAQS:\n${settings.aiChatbotInstructions}` : ""}
`;

    const { apiKey, isCustom, remaining, model } = await resolveGeminiApiKey(tenantId);

    const conversationHistory = (input.history || [])
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Merchant" : "Copilot"}: ${h.text}`)
      .join("\n");

    const prompt = `
LIVE STORE TELEMETRY CONTEXT:
${telemetryContext}

CONVERSATION HISTORY:
${conversationHistory}

MERCHANT OPERATIONAL REQUEST:
"${userText}"

Reply with executive clarity in natural Bengali (চলিত বাংলা) or English matching the merchant.
Use formatting, bullet points, and exact figures from the telemetry.
If proposing messages to send to customers, provide ready-to-copy text with placeholders.
`;

    const aiReply = await callGemini({
      apiKey,
      model,
      prompt,
      systemInstruction: SYSTEM_PROMPT_ADMIN_COPILOT,
      temperature: 0.5,
      maxOutputTokens: 600,
      fetchImpl: input.fetchImpl,
    });

    await recordAiGeneration(tenantId, isCustom);

    // Formulate intelligent action links based on context
    const actionLinks: AdminCopilotActionLink[] = [];
    if (pendingOrdersCount > 0 || userText.includes("অর্ডার") || userText.toLowerCase().includes("order")) {
      actionLinks.push({ label: `পেন্ডিং অর্ডার (${pendingOrdersCount})`, href: "/orders" });
    }
    if (pendingBookingsCount > 0 || userText.includes("বুকিং") || userText.toLowerCase().includes("booking")) {
      actionLinks.push({ label: `বুকিং রিকোয়েস্ট (${pendingBookingsCount})`, href: "/bookings" });
    }
    if (outOfStockVariants.length > 0 || lowStockVariants.length > 0 || userText.includes("স্টক") || userText.toLowerCase().includes("stock")) {
      actionLinks.push({ label: "ইনভেন্টরি ও স্টক", href: "/products" });
    }
    if (actionLinks.length === 0) {
      actionLinks.push({ label: "অর্ডার ম্যানেজমেন্ট", href: "/orders" });
      actionLinks.push({ label: "AI সেটিংস", href: "/settings/ai" });
    }

    return {
      reply: aiReply.trim(),
      suggestedQuestions: [
        "আজকের সেলস ও অর্ডার সামারি দিন",
        "পেন্ডিং বুকিং ও লিড চেক করুন",
        "লো-স্টক প্রোডাক্ট কোনগুলো?",
        "হোয়াটসঅ্যাপে অফার মেসেজ ড্রাফট করুন",
      ],
      actionLinks,
      quotaRemaining: isCustom ? 999999 : remaining,
      isCustomKey: isCustom,
    };
  });
}
