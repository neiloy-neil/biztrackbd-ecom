import type { WebhookEventKey } from "./webhook";

export type WebhookAdapterType = "generic" | "discord" | "slack" | "telegram";

export interface ChatAdapterResult {
  url: string;
  body: string | Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Detects the target webhook adapter type based on the destination URL or hash hint.
 * Supports explicit hash tags (e.g. #adapter=discord) as well as automatic domain pattern recognition.
 */
export function detectWebhookAdapter(urlStr: string): WebhookAdapterType {
  if (!urlStr || typeof urlStr !== "string") return "generic";

  const lower = urlStr.toLowerCase();

  // 1. Explicit hash override
  if (lower.includes("#adapter=discord")) return "discord";
  if (lower.includes("#adapter=slack")) return "slack";
  if (lower.includes("#adapter=telegram")) return "telegram";
  if (lower.includes("#adapter=generic") || lower.includes("#adapter=zapier") || lower.includes("#adapter=make")) {
    return "generic";
  }

  // 2. Automatic domain patterns
  if (lower.includes("discord.com/api/webhooks") || lower.includes("discordapp.com/api/webhooks")) {
    return "discord";
  }

  if (lower.includes("hooks.slack.com/services") || lower.includes("slack.com/api/")) {
    return "slack";
  }

  if (lower.includes("api.telegram.org/bot") || lower.includes("telegram.org/bot") || lower.startsWith("tg://")) {
    return "telegram";
  }

  return "generic";
}

/**
 * Returns realistic sample data for any supported webhook event, used for in-admin live previews
 * and interactive test pings.
 */
export function getSampleEventData(event: WebhookEventKey | "ping"): Record<string, unknown> {
  switch (event) {
    case "order.created":
      return {
        orderNumber: "BT-10482",
        orderId: "ord_sample_10482",
        customerName: "Sadia Islam",
        phone: "01712345678",
        district: "Dhanmondi, Dhaka",
        address: "House 14, Road 7, Block C",
        total: 2500,
        subtotal: 2420,
        shippingFee: 80,
        currency: "BDT",
        paymentMethod: "COD",
        items: [
          { title: "Premium Cotton Panjabi", quantity: 1, price: 1850, variant: "Size: L" },
          { title: "White Cotton Pajama", quantity: 1, price: 650, variant: "Size: XL" },
        ],
        adminPath: "/orders",
      };

    case "order.delivered":
      return {
        orderNumber: "BT-10482",
        orderId: "ord_sample_10482",
        customerName: "Sadia Islam",
        phone: "01712345678",
        district: "Dhanmondi, Dhaka",
        courier: "Steadfast Courier",
        trackingCode: "ST-8921034",
        collectedAmount: 2500,
        deliveredAt: new Date().toISOString(),
        adminPath: "/orders",
      };

    case "lead.created":
      return {
        leadId: "lead_sample_881",
        leadType: "Table Reservation",
        name: "Tanvir Hasan",
        phone: "01819876543",
        email: "tanvir.hasan@example.com",
        message: "Table for 4 persons this Friday at 8:00 PM for anniversary dinner.",
        district: "Gulshan-2, Dhaka",
        createdAt: new Date().toISOString(),
        adminPath: "/leads",
      };

    case "booking.created":
      return {
        bookingId: "bk_sample_902",
        serviceTitle: "Specialist Doctor Consultation",
        patientName: "Farhana Ahmed",
        phone: "01911223344",
        date: "2026-10-24",
        timeSlot: "05:30 PM - 06:00 PM",
        chamber: "Modern Health Clinic, Uttara",
        consultationFee: 1200,
        adminPath: "/bookings",
      };

    case "customer.registered":
      return {
        customerId: "cust_sample_401",
        name: "Arif Chowdhury",
        phone: "01610002233",
        email: "arif.chowdhury@example.com",
        registeredAt: new Date().toISOString(),
        source: "Storefront Checkout",
        adminPath: "/customers",
      };

    case "cod.settlement_received":
      return {
        settlementId: "stl_sample_301",
        courier: "STEADFAST",
        invoiceNumber: "INV-SF-98210",
        disbursedAmount: 48500,
        totalCodCollected: 52000,
        deliveryFeesTotal: 3000,
        codServiceFee: 500,
        returnCharges: 0,
        parcelsCount: 42,
        matchedCount: 40,
        shortPaidCount: 2,
        returnedCount: 0,
        shortfall: 140,
        paymentMethod: "BEFTN_BANK",
        disbursedAt: "2026-10-20",
        adminPath: "/finance/cod",
      };

    case "cod.discrepancy_flagged":
      return {
        settlementId: "stl_sample_301",
        courier: "STEADFAST",
        invoiceNumber: "INV-SF-98210",
        shortfall: 140,
        shortPaidParcels: 2,
        adminPath: "/finance/cod?filter=attention",
      };

    case "ping":
    default:
      return {
        message: "Test Ping from BizTrack Commerce! Your webhook connection is active and operational.",
        timestamp: Date.now(),
        service: "BizTrack Outbound Webhook Service",
        status: "healthy",
      };
  }
}

function defaultAdminOrigin(): string {
  const envAdmin = process.env.ADMIN_ORIGIN || process.env.NEXT_PUBLIC_ADMIN_URL;
  if (envAdmin) return envAdmin.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "biztrack.bd").replace(/:\d+$/, "");
    return `https://admin.${root}`;
  }
  return "http://localhost:3001";
}

/**
 * Formats a Discord rich embed payload matching Discord Webhook API specifications.
 * Uses color-coded status strips, inline fields, and direct admin action links.
 */
export function formatDiscordWebhookPayload(
  event: WebhookEventKey | "ping",
  data: Record<string, unknown>,
  adminOrigin: string = defaultAdminOrigin()
): { content: string; embeds: object[] } {
  const baseAdmin = adminOrigin.replace(/\/+$/, "");

  if (event === "order.created") {
    const orderNum = String(data.orderNumber || "New Order");
    const total = Number(data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");
    const district = String(data.district || "Bangladesh");
    const phone = String(data.phone || "");
    const payment = String(data.paymentMethod || "COD");
    const items = Array.isArray(data.items)
      ? data.items.map((it: any) => `• **${it.title || "Item"}** (x${it.quantity || 1}) - ৳${(it.price || 0).toLocaleString("en-BD")}`).join("\n")
      : "• Standard Item Order";

    return {
      content: `🛍️ **New Order Placed: #${orderNum}**`,
      embeds: [
        {
          title: `Order #${orderNum} — ৳${total}`,
          url: `${baseAdmin}/orders`,
          color: 0x2ecc71, // Green #2ECC71
          fields: [
            { name: "Customer", value: `${customer} (${district})`, inline: true },
            { name: "Phone", value: phone ? `\`${phone}\`` : "N/A", inline: true },
            { name: "Payment", value: payment, inline: true },
            { name: "Ordered Items", value: items || "No items listed", inline: false },
          ],
          footer: { text: "BizTrack Commerce Alerts • Instant Notification" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "order.delivered") {
    const orderNum = String(data.orderNumber || "");
    const courier = String(data.courier || "Courier");
    const tracking = String(data.trackingCode || "N/A");
    const amount = Number(data.collectedAmount || data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");
    const district = String(data.district || "Bangladesh");

    return {
      content: `🚚 **Parcel Delivered: #${orderNum}**`,
      embeds: [
        {
          title: `Delivery Confirmed — #${orderNum}`,
          url: `${baseAdmin}/orders`,
          color: 0x3498db, // Blue #3498DB
          fields: [
            { name: "Customer", value: `${customer} (${district})`, inline: true },
            { name: "Courier & Tracking", value: `${courier}: \`${tracking}\``, inline: true },
            { name: "Collected COD", value: `৳${amount}`, inline: true },
          ],
          footer: { text: "BizTrack Logistics Sync" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "lead.created") {
    const leadType = String(data.leadType || "Inquiry / Lead");
    const name = String(data.name || "Prospective Client");
    const phone = String(data.phone || "N/A");
    const message = String(data.message || "No message provided");
    const district = String(data.district || "Bangladesh");

    return {
      content: `📩 **New Lead Captured: ${leadType}**`,
      embeds: [
        {
          title: `New Inquiry from ${name}`,
          url: `${baseAdmin}/leads`,
          color: 0x9b59b6, // Purple #9B59B6
          fields: [
            { name: "Contact Phone", value: `\`${phone}\``, inline: true },
            { name: "Location", value: district, inline: true },
            { name: "Message / Requirements", value: message, inline: false },
          ],
          footer: { text: "BizTrack Leads & CRM" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "booking.created") {
    const service = String(data.serviceTitle || "Appointment");
    const patient = String(data.patientName || data.name || "Client");
    const phone = String(data.phone || "N/A");
    const date = String(data.date || "Upcoming");
    const slot = String(data.timeSlot || "Scheduled");
    const chamber = String(data.chamber || "Clinic / Office");

    return {
      content: `📅 **New Appointment Booked: ${service}**`,
      embeds: [
        {
          title: `${service} — ${patient}`,
          url: `${baseAdmin}/bookings`,
          color: 0xf39c12, // Amber #F39C12
          fields: [
            { name: "Date & Time", value: `${date} at ${slot}`, inline: true },
            { name: "Phone", value: `\`${phone}\``, inline: true },
            { name: "Location", value: chamber, inline: false },
          ],
          footer: { text: "BizTrack Appointment Booking" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "customer.registered") {
    const name = String(data.name || "New Customer");
    const phone = String(data.phone || "N/A");
    const email = String(data.email || "N/A");

    return {
      content: `👤 **New Customer Account Created**`,
      embeds: [
        {
          title: name,
          url: `${baseAdmin}/customers`,
          color: 0x1abc9c, // Turquoise #1ABC9C
          fields: [
            { name: "Mobile Phone", value: `\`${phone}\``, inline: true },
            { name: "Email Address", value: email, inline: true },
          ],
          footer: { text: "BizTrack Customer Directory" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "cod.settlement_received") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const disbursed = Number(data.disbursedAmount || 0).toLocaleString("en-BD");
    const collected = Number(data.totalCodCollected || 0).toLocaleString("en-BD");
    const count = Number(data.parcelsCount || 0);
    const short = Number(data.shortfall || 0);

    return {
      content: `💰 **COD Remittance Received: ${courier} (${inv})**`,
      embeds: [
        {
          title: `${courier} Payout ৳${disbursed} Disbursed`,
          url: `${baseAdmin}/finance/cod`,
          color: 0x27ae60, // Emerald Green
          fields: [
            { name: "Net Disbursed", value: `৳${disbursed}`, inline: true },
            { name: "COD Collected", value: `৳${collected}`, inline: true },
            { name: "Total Parcels", value: `${count} parcels`, inline: true },
            { name: "Variance / Short", value: short > 0 ? `৳${short.toLocaleString("en-BD")} short` : "Fully Matched ✅", inline: true },
          ],
          footer: { text: "BizTrack Treasury & COD Reconciliation" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (event === "cod.discrepancy_flagged") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const short = Number(data.shortfall || 0).toLocaleString("en-BD");
    const count = Number(data.shortPaidParcels || 0);

    return {
      content: `⚠️ **COD Discrepancy Flagged: ${courier}**`,
      embeds: [
        {
          title: `Courier Deduction Mismatch — ৳${short} Shortfall`,
          url: `${baseAdmin}/finance/cod?filter=attention`,
          color: 0xe74c3c, // Red #E74C3C
          fields: [
            { name: "Courier & Payout", value: `${courier} (${inv})`, inline: true },
            { name: "Discrepancy Amount", value: `৳${short}`, inline: true },
            { name: "Flagged Parcels", value: `${count} orders require dispute/acceptance`, inline: false },
          ],
          footer: { text: "BizTrack COD Reconciliation Alert" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Generic Test Ping
  return {
    content: `🔔 **BizTrack Webhook Connection Test**`,
    embeds: [
      {
        title: "Test Ping Succeeded! 🚀",
        description: "Your Discord webhook endpoint is properly configured to receive real-time sales and business alerts.",
        color: 0x5865f2, // Discord Blurple
        fields: [
          { name: "Status", value: "Active & Healthy", inline: true },
          { name: "Origin", value: baseAdmin, inline: true },
        ],
        footer: { text: "BizTrack Outbound Webhook Worker" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Formats a Slack Block Kit payload matching Slack Incoming Webhook specifications.
 */
export function formatSlackWebhookPayload(
  event: WebhookEventKey | "ping",
  data: Record<string, unknown>,
  adminOrigin: string = defaultAdminOrigin()
): { text: string; blocks: object[] } {
  const baseAdmin = adminOrigin.replace(/\/+$/, "");

  if (event === "order.created") {
    const orderNum = String(data.orderNumber || "New Order");
    const total = Number(data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");
    const district = String(data.district || "Bangladesh");
    const phone = String(data.phone || "");
    const payment = String(data.paymentMethod || "COD");
    const items = Array.isArray(data.items)
      ? data.items.map((it: any) => `• *${it.title || "Item"}* (x${it.quantity || 1}) - ৳${(it.price || 0).toLocaleString("en-BD")}`).join("\n")
      : "• Standard Item Order";

    return {
      text: `🛍️ New Order #${orderNum} (৳${total}) from ${customer}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🛍️ New Order #${orderNum} Placed!`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Customer:*\n${customer} (${district})` },
            { type: "mrkdwn", text: `*Total Amount:*\n৳${total} (${payment})` },
            { type: "mrkdwn", text: `*Phone:*\n\`${phone}\`` },
            { type: "mrkdwn", text: `*Payment Method:*\n${payment}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Items:*\n${items}` },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `⚡ <${baseAdmin}/orders|View Order in BizTrack Admin> • ${new Date().toLocaleTimeString("en-GB")}` },
          ],
        },
      ],
    };
  }

  if (event === "order.delivered") {
    const orderNum = String(data.orderNumber || "");
    const courier = String(data.courier || "Courier");
    const tracking = String(data.trackingCode || "N/A");
    const amount = Number(data.collectedAmount || data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");

    return {
      text: `🚚 Parcel Delivered: #${orderNum} via ${courier}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🚚 Parcel Delivered: #${orderNum}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Customer:*\n${customer}` },
            { type: "mrkdwn", text: `*Collected COD:*\n৳${amount}` },
            { type: "mrkdwn", text: `*Courier:*\n${courier}` },
            { type: "mrkdwn", text: `*Tracking Code:*\n\`${tracking}\`` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `📦 <${baseAdmin}/orders|Open Order in Admin>` },
          ],
        },
      ],
    };
  }

  if (event === "lead.created") {
    const leadType = String(data.leadType || "Inquiry");
    const name = String(data.name || "Client");
    const phone = String(data.phone || "N/A");
    const message = String(data.message || "");

    return {
      text: `📩 New Lead: ${leadType} from ${name}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📩 New Lead Captured: ${leadType}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Contact Name:*\n${name}` },
            { type: "mrkdwn", text: `*Phone Number:*\n\`${phone}\`` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Requirements / Message:*\n${message}` },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `🎯 <${baseAdmin}/leads|View Leads Workspace>` },
          ],
        },
      ],
    };
  }

  if (event === "booking.created") {
    const service = String(data.serviceTitle || "Appointment");
    const patient = String(data.patientName || data.name || "Client");
    const phone = String(data.phone || "N/A");
    const date = String(data.date || "Upcoming");
    const slot = String(data.timeSlot || "Scheduled");

    return {
      text: `📅 New Booking Scheduled: ${service} for ${patient}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📅 New Booking Scheduled: ${service}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Client:*\n${patient}` },
            { type: "mrkdwn", text: `*Date & Time:*\n${date} at ${slot}` },
            { type: "mrkdwn", text: `*Phone:*\n\`${phone}\`` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `👉 <${baseAdmin}/bookings|Open Bookings Workspace>` },
          ],
        },
      ],
    };
  }

  if (event === "customer.registered") {
    const name = String(data.name || "Customer");
    const phone = String(data.phone || "N/A");
    const email = String(data.email || "N/A");

    return {
      text: `👤 New Customer Registered: ${name}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `👤 New Customer Registered`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Name:*\n${name}` },
            { type: "mrkdwn", text: `*Phone:*\n\`${phone}\`` },
            { type: "mrkdwn", text: `*Email:*\n${email}` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `👉 <${baseAdmin}/customers|Open Customers Directory>` },
          ],
        },
      ],
    };
  }

  if (event === "cod.settlement_received") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const disbursed = Number(data.disbursedAmount || 0).toLocaleString("en-BD");
    const collected = Number(data.totalCodCollected || 0).toLocaleString("en-BD");
    const count = Number(data.parcelsCount || 0);
    const short = Number(data.shortfall || 0);

    return {
      text: `💰 COD Remittance Received: ${courier} (${inv}) - ৳${disbursed}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `💰 COD Remittance Received: ${courier}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Invoice No:*\n${inv}` },
            { type: "mrkdwn", text: `*Net Disbursed:*\n৳${disbursed}` },
            { type: "mrkdwn", text: `*COD Collected:*\n৳${collected}` },
            { type: "mrkdwn", text: `*Parcels:*\n${count} parcels` },
            { type: "mrkdwn", text: `*Status:*\n${short > 0 ? `⚠️ ৳${short.toLocaleString("en-BD")} short` : "Fully Matched ✅"}` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `📊 <${baseAdmin}/finance/cod|Open COD Reconciliation Workspace>` },
          ],
        },
      ],
    };
  }

  if (event === "cod.discrepancy_flagged") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const short = Number(data.shortfall || 0).toLocaleString("en-BD");
    const count = Number(data.shortPaidParcels || 0);

    return {
      text: `⚠️ COD Discrepancy Flagged: ${courier} ৳${short} short`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `⚠️ COD Discrepancy Flagged: ${courier}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Payout Invoice:*\n${inv}` },
            { type: "mrkdwn", text: `*Shortfall Amount:*\n৳${short}` },
            { type: "mrkdwn", text: `*Affected Parcels:*\n${count} orders` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `👉 <${baseAdmin}/finance/cod?filter=attention|Review & Export Dispute Sheet>` },
          ],
        },
      ],
    };
  }

  // Ping & fallback
  return {
    text: `🔔 BizTrack Webhook Connection Test Succeeded!`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🔔 BizTrack Webhook Connection Test", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "Your Slack incoming webhook is active and ready to stream real-time sales alerts." },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Verified by BizTrack Outbound Worker • ${new Date().toLocaleTimeString("en-GB")}` },
        ],
      },
    ],
  };
}

/**
 * Formats a Telegram Markdown message payload matching Telegram Bot API specifications.
 * Extracts chat_id from query parameter if present, and returns the target URL and message payload.
 */
export function formatTelegramWebhookPayload(
  targetUrl: string,
  event: WebhookEventKey | "ping",
  data: Record<string, unknown>,
  adminOrigin: string = defaultAdminOrigin()
): { url: string; body: { chat_id: string; text: string; parse_mode: "Markdown" } } {
  const baseAdmin = adminOrigin.replace(/\/+$/, "");

  // Extract chat_id from query parameter if present (e.g. ?chat_id=-100123456789)
  let chatId = "0";
  let cleanUrl = targetUrl;

  try {
    const parsed = new URL(targetUrl);
    const qChatId = parsed.searchParams.get("chat_id");
    if (qChatId) {
      chatId = qChatId;
      parsed.searchParams.delete("chat_id");
    }
    cleanUrl = parsed.origin + parsed.pathname + (parsed.search ? parsed.search : "");
  } catch {
    // If not a standard URL, fallback
  }

  let text = "";

  if (event === "order.created") {
    const orderNum = String(data.orderNumber || "New Order");
    const total = Number(data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");
    const district = String(data.district || "Bangladesh");
    const phone = String(data.phone || "");
    const payment = String(data.paymentMethod || "COD");
    const items = Array.isArray(data.items)
      ? data.items.map((it: any) => `• ${it.title || "Item"} (x${it.quantity || 1}) - ৳${(it.price || 0).toLocaleString("en-BD")}`).join("\n")
      : "• Standard Item Order";

    text = [
      `🛍️ *New Order #${orderNum} Placed!*`,
      ``,
      `*Total:* ৳${total} (${payment})`,
      `*Customer:* ${customer} (${district})`,
      `*Phone:* \`${phone}\``,
      ``,
      `*Items:*`,
      items,
      ``,
      `👉 [Open Order in Admin](${baseAdmin}/orders)`,
    ].join("\n");
  } else if (event === "order.delivered") {
    const orderNum = String(data.orderNumber || "");
    const courier = String(data.courier || "Courier");
    const tracking = String(data.trackingCode || "N/A");
    const amount = Number(data.collectedAmount || data.total || 0).toLocaleString("en-BD");
    const customer = String(data.customerName || "Customer");

    text = [
      `🚚 *Parcel Delivered: #${orderNum}*`,
      ``,
      `*Customer:* ${customer}`,
      `*Courier:* ${courier}`,
      `*Tracking Code:* \`${tracking}\``,
      `*Collected COD:* ৳${amount}`,
      ``,
      `👉 [Open Order in Admin](${baseAdmin}/orders)`,
    ].join("\n");
  } else if (event === "lead.created") {
    const leadType = String(data.leadType || "Inquiry");
    const name = String(data.name || "Client");
    const phone = String(data.phone || "N/A");
    const message = String(data.message || "");

    text = [
      `📩 *New Lead Captured: ${leadType}*`,
      ``,
      `*Contact:* ${name}`,
      `*Phone:* \`${phone}\``,
      `*Details:* ${message}`,
      ``,
      `👉 [Open Leads Workspace](${baseAdmin}/leads)`,
    ].join("\n");
  } else if (event === "booking.created") {
    const service = String(data.serviceTitle || "Appointment");
    const patient = String(data.patientName || "Client");
    const phone = String(data.phone || "N/A");
    const date = String(data.date || "");
    const slot = String(data.timeSlot || "");

    text = [
      `📅 *New Booking: ${service}*`,
      ``,
      `*Client:* ${patient}`,
      `*Date & Time:* ${date} at ${slot}`,
      `*Phone:* \`${phone}\``,
      ``,
      `👉 [Open Bookings Workspace](${baseAdmin}/bookings)`,
    ].join("\n");
  } else if (event === "cod.settlement_received") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const disbursed = Number(data.disbursedAmount || 0).toLocaleString("en-BD");
    const count = Number(data.parcelsCount || 0);
    const short = Number(data.shortfall || 0);

    text = [
      `💰 *COD Remittance Received: ${courier}*`,
      ``,
      `*Payout Invoice:* ${inv}`,
      `*Net Disbursed:* ৳${disbursed}`,
      `*Parcels:* ${count} orders`,
      `*Status:* ${short > 0 ? `⚠️ ৳${short.toLocaleString("en-BD")} short` : "Fully Matched ✅"}`,
      ``,
      `👉 [Open COD Reconciliation](${baseAdmin}/finance/cod)`,
    ].join("\n");
  } else if (event === "cod.discrepancy_flagged") {
    const courier = String(data.courier || "Courier");
    const inv = String(data.invoiceNumber || "Payout");
    const short = Number(data.shortfall || 0).toLocaleString("en-BD");
    const count = Number(data.shortPaidParcels || 0);

    text = [
      `⚠️ *COD Discrepancy Flagged: ${courier}*`,
      ``,
      `*Payout Invoice:* ${inv}`,
      `*Shortfall Amount:* ৳${short}`,
      `*Flagged Parcels:* ${count} orders`,
      ``,
      `👉 [Review & Export Dispute Sheet](${baseAdmin}/finance/cod?filter=attention)`,
    ].join("\n");
  } else {
    text = [
      `🔔 *BizTrack Webhook Connection Test*`,
      ``,
      `Your Telegram bot notification webhook is verified and active!`,
      `*Time:* ${new Date().toLocaleTimeString("en-GB")}`,
      `*Origin:* ${baseAdmin}`,
    ].join("\n");
  }

  return {
    url: cleanUrl,
    body: {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    },
  };
}

/**
 * Transforms any outbound webhook payload into the proper structure depending on the adapter.
 */
export function adaptWebhookPayload(
  targetUrl: string,
  event: WebhookEventKey | "ping",
  rawPayload: Record<string, unknown>,
  adminOrigin: string = defaultAdminOrigin(),
  forcedAdapter?: WebhookAdapterType
): ChatAdapterResult {
  const adapter = forcedAdapter && forcedAdapter !== "generic" ? forcedAdapter : detectWebhookAdapter(targetUrl);
  const data =
    rawPayload.data && typeof rawPayload.data === "object"
      ? (rawPayload.data as Record<string, unknown>)
      : rawPayload;

  if (adapter === "discord") {
    const discordBody = formatDiscordWebhookPayload(event, data, adminOrigin);
    return {
      url: targetUrl.split("#")[0]!,
      body: discordBody,
      headers: { "Content-Type": "application/json" },
    };
  }

  if (adapter === "slack") {
    const slackBody = formatSlackWebhookPayload(event, data, adminOrigin);
    return {
      url: targetUrl.split("#")[0]!,
      body: slackBody,
      headers: { "Content-Type": "application/json" },
    };
  }

  if (adapter === "telegram") {
    const telegramResult = formatTelegramWebhookPayload(targetUrl, event, data, adminOrigin);
    return {
      url: telegramResult.url.split("#")[0]!,
      body: telegramResult.body,
      headers: { "Content-Type": "application/json" },
    };
  }

  // Generic / Zapier / Make (Standard JSON envelope)
  return {
    url: targetUrl.split("#")[0]!,
    body: rawPayload,
  };
}
