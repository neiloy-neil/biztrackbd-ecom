import type {
  WhatsAppProviderMode,
  WhatsAppSessionStatus,
  WhatsAppEventType,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
  WhatsAppConversationStatus,
} from "@biztrackbd/db";

export type {
  WhatsAppProviderMode,
  WhatsAppSessionStatus,
  WhatsAppEventType,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
  WhatsAppConversationStatus,
};

export type WhatsAppLocale = "bn" | "en";

export type WhatsAppVar =
  | "customer_name"
  | "order_number"
  | "order_total"
  | "items_list"
  | "delivery_address"
  | "courier_name"
  | "tracking_code"
  | "tracking_url"
  | "store_name"
  | "recover_url"
  | "discount_code"
  | "cart_items";

export interface WhatsAppEventInfo {
  event: WhatsAppEventType;
  label: string;
  description: string;
  defaultEn: string;
  defaultBn: string;
  vars: WhatsAppVar[];
}

export interface WhatsAppConfigView {
  providerMode: WhatsAppProviderMode;
  status: WhatsAppSessionStatus;
  phoneNumber: string | null;
  qrCodeData: string | null;
  qrSvg?: string | null;
  pairingCode?: string | null;
  gatewayUrl: string | null;
  autoConfirmCod: boolean;
  shippingUpdatesEnabled: boolean;
  abandonedRecoveryEnabled: boolean;
  botEnabled: boolean;
  smsFallbackEnabled: boolean;
  followUpReminderHours: number;
  lastConnectedAt: Date | null;
}

export interface WhatsAppTemplateView {
  id?: string;
  event: WhatsAppEventType;
  name: string;
  bodyEn: string;
  bodyBn: string;
  isActive: boolean;
  vars: WhatsAppVar[];
}

export interface WhatsAppSendParams {
  orderId?: string;
  phone: string;
  event?: WhatsAppEventType;
  body: string;
  fallbackToSms?: boolean;
}

export interface WhatsAppSendResult {
  success: boolean;
  status: WhatsAppMessageStatus;
  externalMsgId?: string;
  error?: string;
  channelUsed: "WHATSAPP" | "SMS_FALLBACK";
}

export interface WhatsAppOrderLinkOptions {
  phone: string;
  orderNumber: string;
  customerName?: string | null;
  orderTotal: number | string;
  itemsSummary?: string;
  deliveryAddress?: string;
  courierName?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  storeName: string;
  lang?: WhatsAppLocale;
  type: "COD_CONFIRM" | "SHIPPING_UPDATE" | "CASH_REMINDER" | "REVIEW_REQUEST" | "GENERAL_SUPPORT";
}

export interface WhatsAppAbandonedLinkOptions {
  phone: string;
  customerName?: string | null;
  storeName: string;
  recoverUrl: string;
  cartTotal?: number | string;
  cartSummary?: string;
  discountCode?: string;
  lang?: WhatsAppLocale;
}
