import { withTenant } from "@biztrackbd/db";
import { normalizeBdPhone } from "../phone";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_STOREFRONT_CHATBOT } from "./prompts";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatInput {
  message: string;
  history?: ChatMessage[];
  customerPhone?: string;
  fetchImpl?: typeof fetch;
}

export interface ChatResponse {
  reply: string;
  suggestedQuestions?: string[];
  orderTracking?: {
    orderNumber: string;
    status: string;
    total: number;
    courierName?: string | null;
    trackingUrl?: string | null;
  } | null;
  suggestedProducts?: Array<{
    title: string;
    price: number;
    slug: string;
  }>;
  whatsappUrl?: string | null;
}

/**
 * Handles incoming customer messages on the storefront AI Shopping Assistant.
 */
export async function handleStorefrontChat(
  tenantId: string,
  input: ChatInput
): Promise<ChatResponse> {
  const userText = input.message.trim();
  if (!userText) {
    return {
      reply: "আসসালামু আলাইকুম! আমি কীভাবে আপনাকে সাহায্য করতে পারি?",
      suggestedQuestions: [
        "আমার অর্ডার ট্র্যাক করুন",
        "ডেলিভারি চার্জ কত?",
        "সেরা অফার কী কী আছে?",
        "সরাসরি কথা বলুন",
      ],
    };
  }

  return withTenant(tenantId, async (tx) => {
    // 1. Fetch store settings and catalog grounding data
    const [settings, tenant, topProducts] = await Promise.all([
      tx.storeSettings.findFirst(),
      tx.tenant.findFirstOrThrow({ select: { name: true } }),
      tx.product.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          slug: true,
          variants: { select: { price: true }, take: 1 },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const chatbotEnabled = settings?.aiChatbotEnabled ?? true;
    const botName = settings?.aiChatbotName || "শপ অ্যাসিস্ট্যান্ট";
    const supportPhone = settings?.aiChatbotEscalatePhone || settings?.whatsappNumber || settings?.contactPhone;
    const whatsappUrl = supportPhone
      ? `https://wa.me/${supportPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent("হ্যালো, আমি শপ অ্যাসিস্ট্যান্ট থেকে এসেছি।")}`
      : null;

    if (!chatbotEnabled) {
      return {
        reply: `আমাদের চ্যাট অ্যাসিস্ট্যান্ট বর্তমানে অফলাইনে রয়েছে। যেকোনো প্রয়োজনে সরাসরি আমাদের সাথে যোগাযোগ করুন: ${supportPhone || "আমাদের কন্টাক্ট পেইজে"}।`,
        whatsappUrl,
      };
    }

    // 2. Check for order tracking intent / phone number
    let orderTrackingInfo: ChatResponse["orderTracking"] = null;
    const phoneCandidate = input.customerPhone || userText.match(/(?:\+?88)?0?1[3-9]\d{8}/)?.[0];
    let matchingOrderText = "";

    if (phoneCandidate) {
      try {
        const cleanPhone = normalizeBdPhone(phoneCandidate);
        const recentOrder = await tx.order.findFirst({
          where: { customerPhone: cleanPhone },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            courierProvider: true,
            trackingCode: true,
            courierTrackingUrl: true,
            createdAt: true,
          },
        });

        if (recentOrder) {
          orderTrackingInfo = {
            orderNumber: recentOrder.orderNumber,
            status: recentOrder.status,
            total: Number(recentOrder.totalAmount),
            courierName: recentOrder.courierProvider,
            trackingUrl: recentOrder.courierTrackingUrl,
          };

          matchingOrderText = `
[ORDER FOUND FOR THIS CUSTOMER]:
Order Number: #${recentOrder.orderNumber}
Order Status: ${recentOrder.status}
Order Total: ৳ ${recentOrder.totalAmount}
Courier: ${recentOrder.courierProvider || "Under processing"}
Tracking Code: ${recentOrder.trackingCode || "Pending"}
Tracking Link: ${recentOrder.courierTrackingUrl || "Not yet available"}
Explain this order status politely to the customer.
`;
        }
      } catch {
        // Ignore invalid phone parse
      }
    }

    // 3. Prepare grounding context
    const productsCatalogText = topProducts
      .map((p) => `- ${p.title}: ৳ ${Number(p.variants[0]?.price ?? 0)} (/products/${p.slug})`)
      .join("\n");

    const storeContext = `
STORE NAME: ${settings?.storeName || tenant.name}
BOT NAME: ${botName}
DELIVERY CHARGES: Inside Dhaka ৳ ${settings?.courierFeeInsideDhaka ?? 70}, Outside Dhaka ৳ ${settings?.courierFeeOutsideDhaka ?? 130}.
PAYMENT METHODS: Cash on Delivery (COD) ${settings?.codEnabled ? "Available" : "Not available"}, bKash: ${settings?.bkashNumber || "Available at checkout"}.
WHATSAPP / HUMAN SUPPORT: ${supportPhone || "Available on store contact page"}

AVAILABLE TOP PRODUCTS:
${productsCatalogText || "Various quality items available in store"}

${matchingOrderText}
`;

    // 4. Resolve API key and call Gemini
    try {
      const { apiKey, isCustom } = await resolveGeminiApiKey(tenantId);

      const conversationHistory = (input.history || [])
        .slice(-6)
        .map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`)
        .join("\n");

      const prompt = `
STORE INFORMATION CONTEXT:
${storeContext}

CONVERSATION HISTORY:
${conversationHistory}

CUSTOMER MESSAGE:
"${userText}"

Reply naturally, warmly, and concisely in Bengali (চলিত বাংলা) or English matching the customer. If they asked about an order and an order was found in context, give them the status and reassurance.
`;

      const aiReply = await callGemini({
        apiKey,
        prompt,
        systemInstruction: SYSTEM_PROMPT_STOREFRONT_CHATBOT,
        temperature: 0.6,
        maxOutputTokens: 350,
        fetchImpl: input.fetchImpl,
      });

      await recordAiGeneration(tenantId, isCustom);

      return {
        reply: aiReply.trim(),
        suggestedQuestions: [
          "আমার পার্সেল কখন পৌঁছাবে?",
          "ডেলিভারি চার্জ কত?",
          "হোয়াটসঅ্যাপে কথা বলুন",
        ],
        orderTracking: orderTrackingInfo,
        suggestedProducts: topProducts.slice(0, 3).map((p) => ({
          title: p.title,
          price: Number(p.variants[0]?.price ?? 0),
          slug: p.slug,
        })),
        whatsappUrl,
      };
    } catch (err) {
      console.warn("[storefront chatbot] Gemini call failed, returning fallback reply", err);
      return {
        reply: `ধন্যবাদ আপনার বার্তার জন্য! আমাদের স্টোরে ক্যাশ অন ডেলিভারিতে অর্ডার করতে পারেন। যেকোনো জরুরি প্রয়োজনে আমাদের হোয়াটসঅ্যাপে সরাসরি মেসেজ দিন: ${supportPhone || ""}`,
        whatsappUrl,
        orderTracking: orderTrackingInfo,
      };
    }
  });
}
