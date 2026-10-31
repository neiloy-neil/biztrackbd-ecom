export * from "./errors";
export * from "./phone";
export { createOrder, transitionOrder, markPaid, type PlacedOrder, type Actor } from "./orders/service";
export { CreateOrderInput } from "./orders/schema";
export { TRANSITIONS, assertTransition } from "./orders/state-machine";
export { setEventPublisher, publishEvent, type DomainEvents, type EventPublisher } from "./events";
export { encryptSecrets, decryptSecrets, loadKeyRing, VaultError, type KeyRing, type SecretContext } from "./vault/crypto";
export { PROVIDERS, PROVIDER_KEYS, type ProviderKey } from "./vault/providers";
export {
  saveIntegration, listIntegrations, loadCredentials, removeIntegration, recordVerification, rotateWebhookToken,
  resolveIntegrationByToken, reencryptTenantSecrets, type IntegrationView, type SaveIntegrationInput,
} from "./vault/integrations";
export { createProduct, archiveProduct, restoreProduct, deleteProduct, getUsage, CreateProductInput } from "./products/service";
export { claimStorage, releaseStorage, readUsage, reconcileProductCount, monthStart, productState, orderState, ORDER_THRESHOLDS, type UsageSummary, type MeterUsage, type UsageState, type PlanLimits } from "./limits/plan";
export * from "./permissions";
export { audit, listAudit, redact, type AuditQuery } from "./audit/service";
export { inviteStaff, revokeInvite, previewInvite, acceptInvite, changeStaffRole, setStaffActive, listTeam, type InviteResult, type TeamView } from "./staff/service";
export { RESERVED_SUBDOMAINS, DEMO_SUBDOMAINS, normalizeHost, classifyHost, validateSubdomain, validateCustomDomain, type HostClass } from "./routing/host";
export { decideRoute, HEADERS, TRUSTED_HEADER_PREFIX, type HostEntry, type RouteDecision, type DecideInput } from "./routing/decide";
export { CachedDirectory, chainDirectories, dbDirectory, edgeConfigDirectory, edgeKey, HostEntrySchema, type HostDirectory } from "./routing/directory";
export { pushRoutes, buildTenantRoutes, syncTenantRouting, EdgeSyncError, type RouteChanges } from "./routing/edge-config";
export { addDomain, confirmDomainVerified, setPrimaryDomain, removeDomain, listDomains, setRoutingSync } from "./domains/service";
export { BD_GEO, divisionNames, districtsOf, upazilasOf, divisionOfDistrict, isValidAddress, type Division, type District } from "./geo/bd-geo";
export { quoteOrder, QuoteInput, type Quote, type QuoteLine, type QuoteProblem } from "./orders/quote";
export { pickZone, deliveryFor, discountFor, money } from "./orders/pricing";
export {
  getStoreInfo, getKaporSettings, getStorefrontSettings, KAPOR_DEFAULTS, listCategories, listProducts, getProductBySlug, listProductSlugs, listCategorySlugs,
  type StoreInfo, type KaporSettings, type StorefrontSettings, type CategoryCard, type ProductCard, type ProductDetail, type ProductSort,
} from "./storefront/catalog";
export { requestOtp, verifyOtp, setSmsSender, signCustomerSession, readCustomerSession, signOrderAccess, verifyOrderAccess, getAccount, RateLimitError, SESSION_TTL_SECONDS, type SmsSender, type CustomerSession, type AccountOrder } from "./customers/auth";
export { sanitizeProductHtml } from "./storefront/html";
export { createDraftOrder, listDraftOrders, cancelDraftOrder, draftLink, viewDraftOrder, placeDraftOrder, type DraftInput, type DraftRow, type DraftStatus, type DraftView } from "./admin/draft-orders";
export { messageCustomer, ORDER_MESSAGE_MAX } from "./admin/order-messages";
export { getEditableOrder, editOrderItems, type EditableOrder, type WantedLine } from "./admin/order-items";
export { listOrders, orderTabCounts, setOrderTags, listOrderTags, setCallNote, bulkChangeStatus, ordersCsv, cleanTag, getOrderDetail, verifyPayment, rejectPayment, recordAdvancePayment, addOrderNote, updateShippingAddress, markPacked, shipManually, recordPrinted, type OrderTab, type OrderFilters, type OrderRow, type OrderDetail, type AddressEdit } from "./admin/orders";
export { recordOrderEvent, type OrderEventType } from "./admin/order-events";
export { DEMO_TEMPLATES, demoTemplate, type DemoTemplate, type DemoProduct, type DemoVariant } from "./demo/templates";
export { resetDemoStore, DEMO_TEMPLATE_IDS, type DemoDeps, type DemoResult } from "./demo/seed";
export { isDemoStore, assertNotDemo } from "./demo/guard";
export { productSvg, bannerSvg, ART_KINDS, type ArtKind, type Palette } from "./demo/art";
export { adminSearch, shellCounts, type SearchHit, type ShellCounts } from "./admin/shell";
export {
  getDashboard, DASHBOARD_RANGES, type DashboardRange, dhakaDate, addDays, STORE_TZ, type Dashboard, type SetupStep,
  type FunnelStage, type FulfillmentFunnel, type CodCashflowLedger, type CourierHealth, type CourierShareItem,
  type DashboardTelemetry, type DashboardActivityEvent, type DashboardFraudRadarItem, type DashboardDispatchQueueItem,
} from "./admin/dashboard";
export { listInventory, adjustStock, updateStockSettings, listStockHistory, STOCK_REASONS, type InventoryRow, type InventorySummary, type StockFilter, type AdjustInput } from "./admin/inventory";
export {
  listCustomers, getCustomerDetail, updateCustomer, createCustomer, setCustomerBlocked, customersCsv,
  adjustCustomerStoreCredit, sendCustomerDirectSms, saveCustomerAddress, deleteCustomerAddress,
  VIP_SPENT, VIP_ORDERS,
  type CustomerRow, type CustomerSegment, type CustomerActivityItem, type CustomerAddressView,
  type CustomerDetailView, type CreateCustomerInput, type UpdateCustomerInput,
} from "./admin/customers";
export { listCoupons, saveCoupon, setCouponActive, deleteCoupon, couponStatus, CouponInput, type CouponStatus } from "./admin/coupons";
export { submitContactMessage, listContactMessages, markContactRead, replyToContact, closeContact, ContactRateLimitError, CONTACT_MESSAGE_MAX, CONTACT_REPLY_MAX, type ContactInput, type ContactRow, type ContactStatus, type ContactTab } from "./admin/contact-inbox";
export { requestStockAlert, listStockAlerts, notifyRestocked, sweepStockAlerts, removeStockAlerts, type StockAlertRow, type RestockSummary } from "./admin/stock-alerts";
export { storeOriginFor } from "./storefront/origin";
export { importCustomersCsv, CUSTOMER_IMPORT_MAX_ROWS, CUSTOMER_IMPORT_TEMPLATE, type CustomerImportResult } from "./admin/customer-import";
export { type CategoryAdminRow, type CategoryInput, listAdminProducts, bulkProductAction, importProductsCsv, IMPORT_TEMPLATE, IMPORT_MAX_ROWS, type ProductImportResult, saveProduct, getProductForEdit, setProductStatus, listCategoriesAdmin, saveCategory, deleteCategory, slugify, SaveProductInput, type AdminProductRow, type ProductTab } from "./admin/products";
export { getSalesReport, salesReportCsv, lastDays, changePercent, REPORT_PRESETS, resolveReportRange, createCsvDocument, escapeCsvCell, takaNum, type SalesReport, type PeriodTotals, type ResolvedReportRange } from "./admin/reports";
export { getProductReport, productReportCsv, type ProductReport, type ProductPerformanceItem, type CategorySalesSummary, type StockRunwayItem } from "./admin/product-reports";
export { getCourierReport, courierReportCsv, type CourierReport, type CourierComparisonRow, type DistrictDeliveryRow, type ReturnReasonSummary } from "./admin/courier-reports";
export { getCustomerReport, customerReportCsv, type CustomerReport, type BuyerSegmentSummary, type VipCustomerRow, type RfmCohortSummary } from "./admin/customer-reports";
export { getStoreSettings, getPrintSettings, saveStoreDetails, saveInvoiceSettings, INVOICE_PAPERS, type InvoicePaper, type InvoiceSettingsInput, setOrdersPaused, savePaymentSettings, listZones, saveZone, deleteZone, ALL_OTHER_DISTRICTS, getBannerSettings, saveBannerSettings, type StoreSettingsView, type StoreDetailsInput, type PaymentSettingsInput, type ZoneInput, type BannerSettingsView } from "./admin/settings";
export { getMarketingOverview, type MarketingOverview, type MarketingKpiSummary, type MarketingRecentEvent } from "./admin/marketing";
export { estimateAudience, sendBroadcastCampaign, listCampaigns, cancelCampaign, interpolateVariables, calculateSmsParts, type CampaignChannel, type CampaignSegment, type CreateCampaignInput, type CampaignRow } from "./admin/campaigns";
export { parseOrderMessage, findCustomerForOrder, searchVariantsForOrder, createQuickOrder, QUICK_SOURCES, QuickOrderInput, type ParsedMessage, type CatalogVariant, type QuickSource } from "./admin/quick-order";
export * from "./couriers/types";
export { setAdapterFactory, defaultAdapterFactory, type AdapterFactory } from "./couriers/factory";
export { mapSteadfastStatus, createSteadfast, checkSteadfastFraud, getSteadfastPoliceStations, getSteadfastBalance, type SteadfastFraudReport } from "./couriers/steadfast";
export { mapPathaoStatus, createPathao, clearPathaoTokens, listPathaoStores, getPathaoCities, calculatePathaoPrice, type PathaoStoreInfo } from "./couriers/pathao";
export { mapRedxStatus, createRedx, listRedxPickupStores, calculateRedxCharge, type RedxPickupStoreInfo } from "./couriers/redx";
export {
  listConnectedCouriers, testCourierConnection, bookCourier, bookCouriers, applyCourierUpdate, markParcelReturned, handleCourierWebhook,
  syncCourierStatuses, refreshCourierStatus, syncAllStores, type ConnectedCourier, type Booked, type BookOptions, type SyncSummary, type WebhookResponse,
} from "./couriers/service";
export { computeTrust, phoneHash, lookupTrust, recordOutcome, TRUST_LABELS, type TrustScore, type TrustCounts, type TrustLevel, type TrustKind } from "./fraud/trust";
export {
  assessOrderRisk, computeUnifiedFraudScore, addressLooksIncomplete, FLAG_LABELS, HIGH_VALUE_COD, RISK_LEVEL_LABELS,
  type RiskAssessment, type RiskLevel, type CourierFraudStats, type UnifiedFraudReport,
} from "./fraud/assess";
export {
  getFraudOverview, listFlaggedOrders, releaseHold, holdOrder, listBlocked, blockPhone, unblockPhone, lookupPhone, lookupInTx,
  refreshOrderFraudReport, fetchSteadfastFraudStats,
  type FlaggedOrder, type FraudOverview, type BlockedRow, type PhoneLookup,
} from "./fraud/service";
export {
  fetchUnifiedCourierFraud, toCourierFraudStats, clearFraudCheckerCache, getFraudCheckerApiKey, getFraudCheckerConfig, DEFAULT_FRAUD_CHECKER_ENDPOINT,
  type ExternalCourierFraudData, type CourierNetworkStats,
} from "./fraud/courier-api";
export {
  signDeviceToken, verifyDeviceToken, resolveClientIp, hashClientIp, getDhakaDayBucket,
  checkPublicToolQuota, incrementPublicToolQuota, clearPublicQuotaMemoryCache,
  MAX_DEVICE_DAILY_CHECKS, MAX_IP_DAILY_CHECKS, MAX_BURST_CHECKS_PER_MIN, PUBLIC_TOOL_COURIER_FRAUD,
  type QuotaCheckResult, type QuotaIncrementResult,
} from "./fraud/quota";
export {
  getOrderTrackingTimeline, buildCourierTrackingUrl,
  type OrderTrackingTimeline, type MilestoneStage, type TrackingCheckpoint,
} from "./orders/tracking";
export {
  createReturn, approveReturn, declineReturn, markPickupBooked, receiveReturn, refundReturn, listReturns, returnTabCounts, getReturnMetrics, returnableItems, exchangeOptions,
  customerReturnableItems, customerExchangeVariants, customerRequestReturn, getCustomerOrderReturns,
  CreateReturnInput, CustomerReturnInput, RETURN_REASONS,
  type ReturnRow, type ReturnTab, type ReturnStatus, type ReturnType, type ReturnMetrics, type ApproveInput, type RefundInput,
  type CustomerReturnableInfo,
} from "./returns/service";
export {
  importStatement, readStatement, getCourierRates, saveCourierRates, getCodDashboard, listReconciliation, listSettlements, acceptShortPayment, raiseDispute, expectedFor, loadRates, StatementInput, OVERDUE_DAYS, DEFAULT_RATES,
  batchAcceptDiscrepancies, exportDisputeSheet, verifySettlementDeposit, exportAccountingJournal, saveToleranceSettings,
  type ImportResult, type CodDashboard, type ReconRow, type ReconFilter, type SettlementRow, type FeeRates, type CourierRates, type RowState,
} from "./finance/cod";
export { parseCsv, parseMoney } from "./finance/csv";
export {
  getProfitReport, addExpense, deleteExpense, listExpenses, ExpenseInput, EXPENSE_CATEGORIES, EXPENSE_LABELS,
  type ProfitReport, type ProfitLine, type ProfitDay, type ExpenseRow, type ExpenseCategory,
} from "./finance/profit";
export { accessState, statusFor, addPeriod, ACCESS_LABELS, GRACE_DAYS, READ_ONLY_UNTIL_DAY, type AccessState, type Access, type AccessInput } from "./platform/lifecycle";
export { scanBrandRisk } from "./platform/brand";
export * from "./platform/templates";
export * from "./platform/template-bundle";
export * from "./platform/template-studio";
export * from "./platform/template-previews";
export { installTemplatePages } from "./builder/versions";
export { createEmailProof, emailProofValid, sendSignupCode, confirmSignupEmail, verificationRequired, type ConfirmedEmail } from "./platform/signup-verify";
export { signupStore, checkSubdomain, SignupInput, THEMES, SUBDOMAIN_MESSAGES, type SignedUp, type SubdomainCheck } from "./platform/signup";
export { createAutoLoginToken, verifyAutoLoginToken, createAutoLoginSessionCookie, verifyAutoLoginSessionCookie, AUTO_LOGIN_COOKIE, type AutoLoginPayload } from "./auth/auto-login";
export { CATEGORY_CATALOG_PRESETS, getCategoryStarterPreset, type StarterCatalogPreset, type StarterProductPreset } from "./demo/catalog-presets";
export {
  listPublicPlans, listPublicPortfolioPlans, listPublicPlansForSiteMode, FALLBACK_PORTFOLIO_PLANS, getBillingOverview, getStoreAccess, submitPaymentProof, cancelPendingProof, paymentTargets, toPlanView, ProofInput,
  type PlanView, type BillingOverview, type ProofView, type PayTo,
} from "./platform/billing";
export {
  getOverview, listTenants, getTenantDetail, addTenantNote, listTenantNotes, listPayments, approveSubscriptionPayment, rejectSubscriptionPayment, suspendTenant, reactivateTenant, extendTrial, changePlan, reviewQuarantine,
  listPlans, updatePlan, listPlatformAudit, runBillingLifecycle, assertPlatformCan, canPlatform, PLATFORM_PERMISSIONS,
  type PlatformActor, type PlatformRole, type PlatformArea, type PlatformOverview, type TenantRow, type TenantCounts, type TenantDetail, type TenantNoteRow, type TenantFilter, type PaymentRow, type Approved, type PlanPatch, type LifecycleResult,
} from "./platform/admin";
export {
  listAnnouncements, createAnnouncement, getActiveAnnouncementsForTenant, countAudienceReach,
  type AnnouncementAudience, type AnnouncementAudienceType, type CreateAnnouncementInput, type AnnouncementView,
} from "./platform/announcements";
export {
  NOTIFY_KINDS, NOTIFY_LABELS, notifyPlatform, listNotifyRecipients, listNotifications, saveNotifyRecipient, removeNotifyRecipient, sendNotifyTest,
  type NotifyKind, type NotifyInput, type NotifyRecipientView, type NotificationView,
} from "./platform/notify";
export {
  listBlogPosts, getBlogPostForEdit, saveBlogPost, deleteBlogPost, listPublishedBlogPosts, getPublishedBlogPost,
  type BlogPostView, type BlogPostInput, type BlogPostStatus, type PublicBlogPost,
} from "./platform/blog";
export { STARTER_BLOG_POSTS, type StarterBlogPost } from "./platform/blog-starters";
export {
  createImpersonationTicket, verifyImpersonationTicket, createImpersonationSessionCookie, verifyImpersonationSessionCookie,
  createOnboardingPassTicket, verifyOnboardingPassTicket,
  type ImpersonationTicketPayload, type ImpersonationSessionPayload, type OnboardingPassPayload,
} from "./platform/impersonation";
export {
  listPlatformTickets, getPlatformTicketDetail, replyPlatformTicket, updateTicketStatus,
  listTenantTickets, createTenantTicket, replyTenantTicket, getTenantTicketDetail,
  type TicketStatusType, type TicketPriority, type TicketSummaryView, type TicketMessageView, type TicketDetailView,
} from "./platform/tickets";
export {
  captureCheckout, markRecoveredByOrder, resolveRecovery, listAbandoned, getAbandoned, abandonedTabCounts, getAbandonedMetrics, logCallOutcome, recoveryText,
  consumeSmsCredit, sendRecoveryMessages, sweepRecoveryMessages, RECOVERY_WAIT_MINUTES,
  type AbandonedRow, type AbandonedTab, type AbandonedMetrics, type CallOutcome, type RecoverySummary, type CartSnapshotLine,
} from "./growth/abandoned";
export {
  getPixelId, getStorefrontTracking, getTrackingConfig, savePixelId, saveTrackingConfig, trackBrowserEvent, sendServerPurchase, sendServerCancellation, recordBrowserPurchase, getTrackingOverview, sendTestEvent, setPixelFetchForTests, getPixelFetch, purchaseEventId, EVENT_NAMES,
  trackServerLead, trackServerBooking, normalizeMetaPhone, hashPhone, hashEmail, capiBody, splitName,
  buildMetaOAuthUrl, exchangeMetaOAuthCode, fetchMetaPixels, sendGa4ServerEvent,
  getSeoSuiteConfig, saveSeoSuiteConfig, type SeoSuiteConfig,
  type TrackingConfig, type StorefrontTracking, type TrackingOverview, type EventStat, type UserContext, type EventName, type SendResult, type MetaAdAccountPixel, type ServerEvent,
} from "./growth/tracking";
export {
  getReviewSummary, listPublicReviews, reviewableItems, submitReview, listReviews, reviewTabCounts, setReviewPublished, replyToReview, setReviewsAutoPublish, reviewsAutoPublish, displayName, cleanText,
  type PublicReview, type ReviewSummary, type ReviewableItem, type AdminReview, type ReviewTab,
} from "./growth/reviews";
export {
  createGreenwebSender,
  createSmsNetBdSender,
  createBulkSmsBdSender,
  getBulkSmsBdBalance,
  BULKSMSBD_ERRORS,
  smsSenderFromEnv,
} from "./growth/sms";
export { createBrevoSender, emailSenderFromEnv, type EmailSender } from "./growth/email";
export { currentSmsSender } from "./customers/auth";
export {
  createUddoktaPayCharge, verifyUddoktaPayPayment, getStoreUddoktaPayConfig, processUddoktaPayOrderSuccess, processUddoktaPaySubscriptionSuccess,
  DEFAULT_UDDOKTAPAY_BASE_URL, DEFAULT_UDDOKTAPAY_API_KEY, setUddoktaPayFetchForTests, normalizeUddoktaPayBaseUrl, uddoktaPayUrls, uddoktaPayPlanUrls, platformOriginFor, checkUddoktaPayPlanInvoice, getPlatformUddoktaPayCredentials,
  type UddoktaPayChargeRequest, type UddoktaPayChargeResponse, type UddoktaPayVerifyResponse,
} from "./payments/uddoktapay";
export {
  createSslCommerzSession, verifySslCommerzPayment, processSslCommerzOrderSuccess, getStoreSslCommerzConfig,
  DEFAULT_SSLCOMMERZ_SANDBOX_URL, DEFAULT_SSLCOMMERZ_LIVE_URL, setSslCommerzFetchForTests,
  type SslCommerzConfig, type SslCommerzSessionInput, type SslCommerzSessionResponse, type SslCommerzValidationResponse,
} from "./payments/sslcommerz";
export {
  createBkashPayment, executeBkashPayment, queryBkashPayment, processBkashOrderSuccess, getStoreBkashConfig, grantBkashToken,
  DEFAULT_BKASH_SANDBOX_URL, DEFAULT_BKASH_LIVE_URL, setBkashFetchForTests,
  type BkashConfig, type BkashCreatePaymentInput, type BkashCreatePaymentResponse, type BkashExecuteResponse,
} from "./payments/bkash";

// Phase 7: store design builder, landing pages, domain connection
export * from "./builder/registry";
export * from "./builder/patterns";
export * from "./builder/theme";
export * from "./builder/versions";
export * from "./builder/preview";
export * from "./builder/data";
export * from "./landing/service";
export * from "./builder/chrome";
export * from "./builder/custom-pages";
export * from "./orders/expire-unpaid";
export * from "./builder/chrome-store";
export * from "./builder/fomo-service";
export { templateChrome, BUILT_IN_CHROMES } from "./builder/template-chromes";
export * from "./landing/offers";
export * from "./landing/templates";
export * from "./landing/stats";
export { checkDomain, recheckDomain, sweepDomains, dnsInstruction, setDnsResolver, setVercelClient, vercelFromEnv, type DnsResolver, type VercelDomainClient, type DnsInstruction, type DnsRecordItem, type CheckOutcome, type SweepSummary } from "./domains/verify";
export { listPlatformDomains, checkPlatformDomain, type PlatformDomainRow, type DomainFilter } from "./platform/domains";

// Phase 9: loyalty points, VIP tiers and referrals
export { TIERS, tiersOf, tierFor, tierOf, nextTier, pointsFor, pointsValue, priceLoyalty, hashClient, REFERRAL_CODE, type LoyaltySettings, type LoyaltyPricing, type Tier, type TierLevel } from "./loyalty/engine";
export { expireInactivePoints, sendBirthdayVouchers, sweepLoyalty, type LoyaltySweepSummary } from "./loyalty/engine";
export { setBirthday, clearBirthday } from "./loyalty/service";
export { getLoyaltySettings, saveLoyaltySettings, getLoyaltyOverview, adjustPoints, getAccountView, getReferralOffer, getPointsSummary, getLoyaltyPublic, type LoyaltyOverview, type AccountView } from "./loyalty/service";
export { saveContent, deleteContent, listContent, getContent, bodyToHtml, slugOf, parsePublishAt, getPublishedPage, getPublishedPost, listPublishedPosts, listFooterPages, listContentSlugs, type ContentKind, type ContentInput, type PostRow, type ContentDetail, type PublicPage, type PublicPost } from "./content/service";

// Phase 10: real sign-in (Supabase Auth)
export * from "./auth/supabase";
export * from "./auth/membership";
export {
  MODULES, isModuleOn, isModuleActive, getModuleStatus, getTenantActiveModules, listModules, setModule, listAppStoreCatalog,
  APP_CATALOG, getAppCatalogItem, CATEGORY_LABELS,
  type ModuleDef, type ModuleView, type AppCatalogItem, type AppCategory, type AppTier, type AppStoreItemView, type AppStoreOverview,
} from "./modules/service";

export {
  MESSAGE_EVENTS, MESSAGE_LOCALES, DEFAULT_MESSAGES, VAR_HELP, MESSAGE_MAX_LENGTH, renderMessage, sampleVars, smsParts, validateMessage,
  listMessageTemplates, saveMessageTemplate, resetMessageTemplate, notifyOrder,
  type MessageEvent, type MessageLocale, type MessageVar, type MessageTemplateView, type NotifyResult,
} from "./messaging/templates";

export {
  DEMO_SESSION_HOURS, DEMO_MAX_ACTIVE, DemoBusyError, DemoLimitError, createDemoCookie, verifyDemoCookie, demoCreatorKey, createDemoSession, maybeDropDemoOrder, sweepDemoSessions, loadDemoTenant,
  type DemoCookiePayload,
} from "./demo/session";
export { isDemoSessionId, assertNotInDemo } from "./demo/guard";
export { DemoLockedError } from "./errors";
export { parseKeepCode, readKeptStore, KEEP_MAX_PRODUCTS, type KeptStore } from "./demo/keep";

export {
  submitPlatformInquiry,
  listPlatformInquiries,
  updateInquiryStatus,
  type InquiryStatus,
  type InquiryInput,
  type InquiryView,
} from "./platform/inquiry";

export * from "./catalog/import-parser";


export { notifyOwner, emailStaffInvite, sendSignInCode, setCodeHooks, setMailSender, formatMailDate, type MailSendResult, type OwnerMailExtra } from "./mail/send";
export { buildMail, buildAuthMail, authMailsForTests as AUTH_MAILS_FOR_TESTS, MAIL_KIND_LIST, URGENT_KINDS, type MailKind, type MailVars } from "./mail/templates";
export { esc as escapeMailText, type MailLang } from "./mail/layout";

// AI Suite & Copilot
export {
  PLAN_AI_QUOTAS,
  resolveGeminiApiKey,
  recordAiGeneration,
  getAiSettings,
  saveAiSettings,
  testGeminiApiKey,
  callGemini,
  type ResolvedAiKey,
  type AiSettingsView,
  type SaveAiSettingsInput,
  type CallGeminiParams,
} from "./ai/gateway";
export {
  TONE_LABELS,
  SYSTEM_PROMPT_PRODUCT_WRITER,
  SYSTEM_PROMPT_COPYWRITER,
  SYSTEM_PROMPT_CUSTOMER_PARSER,
  SYSTEM_PROMPT_STOREFRONT_CHATBOT,
  SYSTEM_PROMPT_IMAGE_ALTS,
  SYSTEM_PROMPT_WHATSAPP_BROADCAST,
  type AiTonePreset,
} from "./ai/prompts";
export {
  generateProductListing,
  generateImageAltTags,
  GeneratedProductSchema,
  GeneratedImageAltItemSchema,
  GeneratedImageAltListSchema,
  type GeneratedProductListing,
  type GeneratedImageAltItem,
  type GeneratedImageAltList,
  type ProductGenerateOptions,
  type GenerateImageAltOptions,
} from "./ai/product-generator";
export {
  generateSocialPost,
  generateSmsCampaignCopy,
  generateBannerCopy,
  generateWhatsAppBroadcast,
  SocialPostSchema,
  SmsCampaignSchema,
  BannerCopySchema,
  WhatsAppBroadcastSchema,
  type GeneratedSocialPost,
  type GeneratedSmsCampaign,
  type GeneratedBannerCopy,
  type GeneratedWhatsAppBroadcast,
  type CopywriterOptions,
} from "./ai/copywriter";
export {
  parseCustomerDetailsWithAi,
  ParsedCustomerDetailsSchema,
  type ParsedCustomerDetails,
} from "./ai/customer-parser";
export {
  handleStorefrontChat,
  type ChatMessage,
  type ChatInput,
  type ChatResponse,
} from "./ai/chatbot";
export {
  handleAdminCopilotChat,
  type AdminCopilotMessage,
  type AdminCopilotInput,
  type AdminCopilotResponse,
  type AdminCopilotActionLink,
} from "./ai/admin-copilot";
export {
  renderCode128Svg,
  calculateCheckDigit,
  generateBarcodeValue,
  assignVariantBarcode,
  assignMissingBarcodes,
  findVariantByBarcode,
  type BarcodeRenderOptions,
} from "./admin/barcode";
export {
  getOrCreateDefaultRegister,
  listPosRegisters,
  getActivePosSession,
  openPosSession,
  recordPosCashMovement,
  closePosSession,
  searchProductsForPos,
  createPosOrder,
  type PosPaymentSplit,
  type PosCheckoutItem,
  type PosCheckoutInput,
  type PosReceiptData,
} from "./admin/pos";



export {
  getPlatformAiConfig,
  savePlatformAiConfig,
  testPlatformGeminiApiKey,
  getPlatformSmsConfig,
  savePlatformSmsConfig,
  testPlatformSms,
  getPlatformSmsBalance,
  getPlatformCourierConfig,
  savePlatformCourierConfig,
  testPlatformCouriers,
  getPlatformUddoktaPayConfig,
  savePlatformUddoktaPayConfig,
  testPlatformUddoktaPay,
  getPlatformMailConfig,
  savePlatformMailConfig,
  getPlatformHealthMatrix,
  getPlatformFraudConfig,
  savePlatformFraudConfig,
  testPlatformFraudChecker,
  getPlatformGoogleConfig,
  savePlatformGoogleConfig,
  testPlatformGoogleConnection,
  cleanGoogleSiteVerification,
  getPlatformSiteVerificationCode,
  getPlatformSeoConfig,
  savePlatformSeoConfig,
  getPlatformContactConfig,
  savePlatformContactConfig,
  PLATFORM_CONTACT_DEFAULTS,
  type PlatformContactConfigView,
  type PlatformSeoConfigView,
  type PlatformGoogleConfigView,
  type PlatformFraudConfigView,
  type PlatformAiConfigView,
  type PlatformSmsConfigView,
  type PlatformSmsBalanceView,
  type PlatformCourierConfigView,
  type PlatformUddoktaPayConfigView,
  type PlatformMailConfigView,
  type PlatformHealthMatrixView,
} from "./platform/config";

export {
  listSubscriptionPromos,
  createSubscriptionPromo,
  toggleSubscriptionPromo,
  deleteSubscriptionPromo,
  validateSubscriptionPromo,
  type SubscriptionPromoView,
  type CreateSubscriptionPromoInput,
  type PromoValidationResult,
} from "./platform/promos";

export {
  listPlatformUsers,
  invitePlatformUser,
  updatePlatformUserRole,
  togglePlatformUserActive,
  type PlatformUserView,
} from "./platform/team";

export {
  listTenantQuotaAdjustments,
  addTenantQuotaAdjustment,
  getTenantBonusQuota,
  type QuotaAdjustmentView,
  type AddQuotaAdjustmentInput,
} from "./platform/quota";

export {
  getAppCatalogWithTelemetry,
  toggleGlobalModuleMaintenance,
  setModulePlanOverride,
  type ManagedAppCatalogItem,
} from "./platform/modules-control";

// Product Bundles & 1-Click Checkout Order Bumps
export {
  BundleDiscountTypeSchema,
  BundleStatusSchema,
  BumpTriggerTypeSchema,
  BumpStatusSchema,
  CreateBundleInput,
  UpdateBundleInput,
  CreateOrderBumpInput,
  UpdateOrderBumpInput,
  listBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
  listOrderBumps,
  getOrderBump,
  createOrderBump,
  updateOrderBump,
  deleteOrderBump,
  getBundleAnalytics,
  getActiveBundlesForProduct,
  getCheckoutOrderBumps,
  type BundleDiscountType,
  type BundleStatus,
  type BumpTriggerType,
  type BumpStatus,
  type StorefrontBundle,
  type StorefrontOrderBump,
} from "./bundles/service";

// WhatsApp Commerce & Order Notifications
export * from "./whatsapp/types";
export * from "./whatsapp/deep-links";
export * from "./whatsapp/session";
export * from "./whatsapp/service";
export * from "./whatsapp/bot";
export * from "./whatsapp/quick-replies";
export * from "./whatsapp/order-actions";

// Wholesale & B2B Pricing Suite
export * from "./wholesale";

// Affiliate & Influencer Commission Hub
export * from "./affiliate/service";

// Limited Drops & Pre-Orders Suite
export * from "./drops";

// BizTrack Business — Site Mode, Capabilities, Leads, Bookings, Content Items, Downloads & Templates
export * from "./site/mode";
export * from "./site/capabilities";
export * from "./site/leads";
export * from "./site/bookings";
export * from "./site/menu";
export * from "./site/qr";
export * from "./site/table-orders";
export * from "./site/content-items";
export * from "./site/downloads";
export * from "./site/abuse-protection";
export * from "./site/templates/manifests";
export * from "./demo/business-templates";
export * from "./demo/business-seed";
export * from "./site/provisioning";

// Marketing Attribution & Multi-Touch Tracking
export * from "./growth/attribution";
export * from "./platform/tracking";

// Messaging & Notifications Queue (NOTIFY-001)
export * from "./messaging/queue";
export * from "./messaging/templates";
export * from "./messaging/webhook";
export * from "./messaging/chat-adapters";

// Public Developer REST API & Keys (DEV-API-001)
export * from "./api-keys";

// Analytics & Real-Time Performance Studio (ANALYTICS-001)
export * from "./analytics";
export * from "./platform/notify";
export * from "./platform/native-analytics";
export * from "./notifications/push-service";
export { sealField, openField, isSealed } from "./vault/field-secret";
