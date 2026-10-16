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

  const contextData = await withTenant(tenantId, async (tx) => {
    // 1. Fetch store settings, tenant vertical, and full business grounding data
    const [settings, tenant, topProducts, menuCategories, contentItems, downloads] = await Promise.all([
      tx.storeSettings.findFirst(),
      tx.tenant.findFirstOrThrow({ select: { name: true, siteMode: true, businessVertical: true } }),
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
      tx.menuCategory.findMany({
        where: { isActive: true },
        include: {
          items: {
            where: { isAvailable: true },
            select: { name: true, nameBn: true, price: true, dietaryLabels: true },
            take: 6,
          },
        },
        take: 4,
        orderBy: { sortOrder: "asc" },
      }),
      tx.siteContentItem.findMany({
        where: { isPublished: true },
        select: { kind: true, title: true, titleBn: true, summary: true, data: true },
        take: 12,
        orderBy: { sortOrder: "asc" },
      }),
      tx.siteDownload.findMany({
        where: { isPublic: true },
        select: { label: true, labelBn: true, fileName: true, fileUrl: true },
        take: 4,
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const chatbotEnabled = settings?.aiChatbotEnabled ?? true;
    const botName = settings?.aiChatbotName || "শপ অ্যাসিস্ট্যান্ট";
    const supportPhone = settings?.aiChatbotEscalatePhone || settings?.whatsappNumber || settings?.contactPhone;
    const whatsappUrl = supportPhone
      ? `https://wa.me/${supportPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent("হ্যালো, আমি ওয়েবসাইট অ্যাসিস্ট্যান্ট থেকে এসেছি।")}`
      : null;

    if (!chatbotEnabled) {
      return {
        chatbotEnabled: false,
        disabledReply: `আমাদের চ্যাট অ্যাসিস্ট্যান্ট বর্তমানে অফলাইনে রয়েছে। যেকোনো প্রয়োজনে সরাসরি আমাদের সাথে যোগাযোগ করুন: ${supportPhone || "আমাদের কন্টাক্ট পেইজে"}।`,
        whatsappUrl,
        supportPhone,
        storeContext: "",
        suggestedQuestions: [] as string[],
        orderTrackingInfo: null,
        topProductsList: [] as Array<{ title: string; price: number; slug: string }>,
        settingsWelcome: null as string | null,
        vertical: "RETAIL",
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
[ORDER FOUND FOR THIS CUSTOMER PHONE ${cleanPhone}]:
Order Number: #${recentOrder.orderNumber}
Order Status: ${recentOrder.status}
Order Total: ৳ ${recentOrder.totalAmount}
Courier: ${recentOrder.courierProvider || "Under processing"}
Tracking Code: ${recentOrder.trackingCode || "Pending"}
Tracking Link: ${recentOrder.courierTrackingUrl || "Not yet available"}
Explain this order status clearly and politely to the customer.
`;
        }
      } catch {
        // Ignore invalid phone parse
      }
    }

    // 3. Format Vertical Grounding Sections
    const mode = tenant.siteMode || "ECOMMERCE";
    const vertical = tenant.businessVertical || "RETAIL";

    const menuText = menuCategories.length > 0
      ? menuCategories.map((cat) => {
          const itemsStr = cat.items.map((i) => `  * ${i.name} (${i.nameBn || ""}): ৳${i.price}`).join("\n");
          return `Menu Category: ${cat.name} (${cat.nameBn || ""})\n${itemsStr}`;
        }).join("\n")
      : "";

    const servicesText = contentItems
      .filter((c) => c.kind === "SERVICE")
      .map((c) => `- ${c.title} (${c.titleBn || ""}): ${c.summary || ""}`)
      .join("\n");

    const teamText = contentItems
      .filter((c) => c.kind === "TEAM")
      .map((c) => `- ${c.title} (${c.titleBn || ""}): ${c.summary || ""}`)
      .join("\n");

    const credentialsText = contentItems
      .filter((c) => c.kind === "CREDENTIAL")
      .map((c) => `- ${c.title}: ${c.summary || ""}`)
      .join("\n");

    const portfolioText = contentItems
      .filter((c) => c.kind === "PORTFOLIO")
      .map((c) => `- Project: ${c.title} - ${c.summary || ""}`)
      .join("\n");

    const downloadsText = downloads
      .map((d) => `- Download: ${d.label} (${d.fileName || "File"}) -> ${d.fileUrl}`)
      .join("\n");

    const productsCatalogText = topProducts
      .map((p) => `- ${p.title}: ৳ ${Number(p.variants[0]?.price ?? 0)} (/products/${p.slug})`)
      .join("\n");

    const storeContext = `
BUSINESS NAME: ${settings?.storeName || tenant.name}
BOT NAME: ${botName}
SITE MODE: ${mode}
VERTICAL: ${vertical}
ABOUT / TAGLINE: ${settings?.description || settings?.tagline || ""}
ADDRESS: ${settings?.addressLine || "Dhaka, Bangladesh"}
WHATSAPP / HUMAN SUPPORT: ${supportPhone || "Available on store contact page"}

DELIVERY & PAYMENT (If applicable):
- Inside Dhaka: ৳ ${settings?.courierFeeInsideDhaka ?? 70}, Outside Dhaka: ৳ ${settings?.courierFeeOutsideDhaka ?? 130}
- Cash on Delivery (COD): ${settings?.codEnabled ? "Available" : "Not available"}
- bKash: ${settings?.bkashNumber || "Available at checkout"}

${settings?.aiChatbotInstructions ? `MERCHANT CUSTOM INSTRUCTIONS & FAQS:\n${settings.aiChatbotInstructions}\n` : ""}

${menuText ? `RESTAURANT DISHES & MENU:\n${menuText}\n` : ""}
${servicesText ? `SERVICES & SOLUTIONS:\n${servicesText}\n` : ""}
${teamText ? `DOCTORS / TEAM MEMBERS:\n${teamText}\n` : ""}
${credentialsText ? `CREDENTIALS & CERTIFICATIONS:\n${credentialsText}\n` : ""}
${portfolioText ? `PORTFOLIO & CASE STUDIES:\n${portfolioText}\n` : ""}
${downloadsText ? `AVAILABLE BROCHURES & DOWNLOADS:\n${downloadsText}\n` : ""}
${productsCatalogText ? `AVAILABLE PRODUCTS:\n${productsCatalogText}\n` : ""}

${matchingOrderText}
`;

    // Tailor Suggested Questions
    let suggestedQuestions = [
      "আমার পার্সেল কখন পৌঁছাবে?",
      "ডেলিভারি চার্জ কত?",
      "হোয়াটসঅ্যাপে কথা বলুন",
    ];

    if (vertical === "RESTAURANT") {
      suggestedQuestions = [
        "জনপ্রিয় খাবার কী কী আছে?",
        "টেবিল বুকিং বা QR মেনু অর্ডার",
        "ডেলিভারি ও টেকঅ্যাওয়ে তথ্য",
        "সরাসরি কথা বলুন",
      ];
    } else if (vertical === "DOCTOR_CLINIC") {
      suggestedQuestions = [
        "ডাক্তারের চেম্বার ও সময়সূচী",
        "সিরিয়াল কীভাবে বুক করব?",
        "পরামর্শ ফি ও সেবা সমূহ",
        "জরুরি সিরিয়াল সহায়তা",
      ];
    } else if (vertical === "SERVICE_PROVIDER") {
      suggestedQuestions = [
        "সার্ভিস প্যাকেজ ও মূল্যতালিকা",
        "বাসায় এসে সার্ভিস দেন কি?",
        "জরুরি সার্ভিস রিকোয়েস্ট",
        "হোয়াটসঅ্যাপে বিস্তারিত জানুন",
      ];
    } else if (vertical === "BUSINESS_COMPANY") {
      suggestedQuestions = [
        "আপনাদের মূল সার্ভিসসমূহ কী?",
        "কর্পোরেট প্রোফাইল ডাউনলোড",
        "প্রজেক্ট কনসালটেশন বুক করুন",
        "অফিসের সাথে যোগাযোগ",
      ];
    } else if (vertical === "PERSONAL_PORTFOLIO") {
      suggestedQuestions = [
        "কাজের পোর্টফোলিও দেখুন",
        "সিভি / রেজুমি ডাউনলোড",
        "নতুন প্রজেক্ট বা ফ্রিল্যান্স আলোচনা",
        "সরাসরি মেসেজ দিন",
      ];
    }

    return {
      chatbotEnabled: true,
      disabledReply: "",
      whatsappUrl,
      supportPhone,
      storeContext,
      suggestedQuestions,
      orderTrackingInfo,
      topProductsList: topProducts.slice(0, 3).map((p) => ({
        title: p.title,
        price: Number(p.variants[0]?.price ?? 0),
        slug: p.slug,
      })),
      settingsWelcome: settings?.aiChatbotWelcome || null,
      vertical,
    };
  });

  if (!contextData.chatbotEnabled) {
    return {
      reply: contextData.disabledReply,
      whatsappUrl: contextData.whatsappUrl,
    };
  }

  const {
    whatsappUrl,
    supportPhone,
    storeContext,
    suggestedQuestions,
    orderTrackingInfo,
    topProductsList,
    settingsWelcome,
    vertical,
  } = contextData;

  // 4. Resolve API key and call Gemini OUTSIDE transaction
  try {
    const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);

    const conversationHistory = (input.history || [])
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`)
      .join("\n");

    const prompt = `
BUSINESS INFORMATION CONTEXT:
${storeContext}

CONVERSATION HISTORY:
${conversationHistory}

CUSTOMER MESSAGE:
"${userText}"

Reply naturally, warmly, and concisely in Bengali (চলিত বাংলা) or English matching the customer. If they asked about an order or booking and matching details exist in context, provide clear reassurance and next steps.
`;

    const aiReply = await callGemini({
      apiKey,
      model,
      prompt,
      systemInstruction: SYSTEM_PROMPT_STOREFRONT_CHATBOT,
      temperature: 0.6,
      maxOutputTokens: 350,
      fetchImpl: input.fetchImpl,
    });

    await recordAiGeneration(tenantId, isCustom);

    return {
      reply: aiReply.trim(),
      suggestedQuestions,
      orderTracking: orderTrackingInfo,
      suggestedProducts: topProductsList,
      whatsappUrl,
    };
  } catch (err) {
    console.warn("[storefront chatbot] Gemini call failed, returning resilient fallback", err);

    let fallbackText = `ধন্যবাদ আপনার বার্তার জন্য! যেকোনো জরুরি প্রয়োজনে সরাসরি আমাদের সাথে যোগাযোগ করুন: ${supportPhone || "আমাদের কন্টাক্ট পেইজে"}`;
    if (orderTrackingInfo) {
      fallbackText = `আপনার অর্ডার #${orderTrackingInfo.orderNumber} এর স্ট্যাটাস: ${orderTrackingInfo.status} (বিল: ৳ ${orderTrackingInfo.total})। বিস্তারিত তথ্যের জন্য আমাদের হোয়াটসঅ্যাপে সরাসরি মেসেজ দিন: ${supportPhone || ""}`;
    } else if (settingsWelcome) {
      fallbackText = settingsWelcome;
    } else if (vertical === "DOCTOR_CLINIC") {
      fallbackText = `ধন্যবাদ আপনার বার্তার জন্য! ডাক্তারের চেম্বার ও সিরিয়াল বুকিংয়ের জন্য আমাদের চেম্বার সহকারীর সাথে যোগাযোগ করুন: ${supportPhone || ""}`;
    } else if (vertical === "RESTAURANT") {
      fallbackText = `ধন্যবাদ আপনার বার্তার জন্য! আমাদের মেনু ও ডাইনিং বুকিং সংক্রান্ত তথ্যের জন্য সরাসরি যোগাযোগ করুন: ${supportPhone || ""}`;
    }

    return {
      reply: fallbackText,
      whatsappUrl,
      orderTracking: orderTrackingInfo,
      suggestedQuestions,
    };
  }
}
