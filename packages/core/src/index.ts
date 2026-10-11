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
export { createProduct, archiveProduct, restoreProduct, getUsage, CreateProductInput } from "./products/service";
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
export { listOrders, orderTabCounts, getOrderDetail, verifyPayment, rejectPayment, addOrderNote, updateShippingAddress, markPacked, shipManually, recordPrinted, type OrderTab, type OrderFilters, type OrderRow, type OrderDetail, type AddressEdit } from "./admin/orders";
export { recordOrderEvent, type OrderEventType } from "./admin/order-events";
export { DEMO_TEMPLATES, demoTemplate, type DemoTemplate, type DemoProduct, type DemoVariant } from "./demo/templates";
export { resetDemoStore, DEMO_TEMPLATE_IDS, type DemoDeps, type DemoResult } from "./demo/seed";
export { productSvg, bannerSvg, ART_KINDS, type ArtKind, type Palette } from "./demo/art";
export { adminSearch, shellCounts, type SearchHit, type ShellCounts } from "./admin/shell";
export { getDashboard, dhakaDate, addDays, STORE_TZ, type Dashboard, type SetupStep } from "./admin/dashboard";
export { listInventory, adjustStock, updateStockSettings, listStockHistory, STOCK_REASONS, type InventoryRow, type InventorySummary, type StockFilter, type AdjustInput } from "./admin/inventory";
export { listCustomers, getCustomerDetail, updateCustomer, createCustomer, setCustomerBlocked, customersCsv, VIP_SPENT, VIP_ORDERS, type CustomerRow, type CustomerSegment } from "./admin/customers";
export { listCoupons, saveCoupon, setCouponActive, deleteCoupon, couponStatus, CouponInput, type CouponStatus } from "./admin/coupons";
export { listAdminProducts, saveProduct, getProductForEdit, setProductStatus, listCategoriesAdmin, saveCategory, deleteCategory, slugify, SaveProductInput, type AdminProductRow, type ProductTab } from "./admin/products";
export { getSalesReport, salesReportCsv, lastDays, changePercent, type SalesReport, type PeriodTotals } from "./admin/reports";
export { getStoreSettings, getPrintSettings, saveStoreDetails, setOrdersPaused, savePaymentSettings, listZones, saveZone, deleteZone, ALL_OTHER_DISTRICTS, type StoreSettingsView, type StoreDetailsInput, type PaymentSettingsInput, type ZoneInput } from "./admin/settings";
export { parseOrderMessage, findCustomerForOrder, searchVariantsForOrder, createQuickOrder, QUICK_SOURCES, QuickOrderInput, type ParsedMessage, type CatalogVariant, type QuickSource } from "./admin/quick-order";
export * from "./couriers/types";
export { setAdapterFactory, defaultAdapterFactory, type AdapterFactory } from "./couriers/factory";
export { mapSteadfastStatus, createSteadfast } from "./couriers/steadfast";
export { mapPathaoStatus, createPathao, clearPathaoTokens } from "./couriers/pathao";
export { mapRedxStatus, createRedx } from "./couriers/redx";
export {
  listConnectedCouriers, testCourierConnection, bookCourier, bookCouriers, applyCourierUpdate, markParcelReturned, handleCourierWebhook,
  syncCourierStatuses, refreshCourierStatus, syncAllStores, type ConnectedCourier, type Booked, type BookOptions, type SyncSummary, type WebhookResponse,
} from "./couriers/service";
export { computeTrust, phoneHash, lookupTrust, recordOutcome, TRUST_LABELS, type TrustScore, type TrustCounts, type TrustLevel, type TrustKind } from "./fraud/trust";
export { assessOrderRisk, addressLooksIncomplete, FLAG_LABELS, HIGH_VALUE_COD, type RiskAssessment, type RiskLevel } from "./fraud/assess";
export {
  getFraudOverview, listFlaggedOrders, releaseHold, holdOrder, listBlocked, blockPhone, unblockPhone, lookupPhone, lookupInTx,
  type FlaggedOrder, type FraudOverview, type BlockedRow, type PhoneLookup,
} from "./fraud/service";
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
  type ImportResult, type CodDashboard, type ReconRow, type ReconFilter, type SettlementRow, type FeeRates, type CourierRates, type RowState,
} from "./finance/cod";
export { parseCsv, parseMoney } from "./finance/csv";
export {
  getProfitReport, addExpense, deleteExpense, listExpenses, ExpenseInput, EXPENSE_CATEGORIES, EXPENSE_LABELS,
  type ProfitReport, type ProfitLine, type ProfitDay, type ExpenseRow, type ExpenseCategory,
} from "./finance/profit";
export { accessState, statusFor, addPeriod, ACCESS_LABELS, GRACE_DAYS, READ_ONLY_UNTIL_DAY, type AccessState, type Access, type AccessInput } from "./platform/lifecycle";
export { scanBrandRisk } from "./platform/brand";
export { signupStore, checkSubdomain, SignupInput, THEMES, SUBDOMAIN_MESSAGES, type SignedUp, type SubdomainCheck } from "./platform/signup";
export {
  listPublicPlans, getBillingOverview, getStoreAccess, submitPaymentProof, cancelPendingProof, paymentTargets, toPlanView, ProofInput,
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
  createImpersonationTicket, verifyImpersonationTicket, createImpersonationSessionCookie, verifyImpersonationSessionCookie,
  type ImpersonationTicketPayload, type ImpersonationSessionPayload,
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
  getPixelId, getTrackingConfig, savePixelId, trackBrowserEvent, sendServerPurchase, recordBrowserPurchase, getTrackingOverview, sendTestEvent, setPixelFetchForTests, purchaseEventId, EVENT_NAMES,
  type TrackingConfig, type TrackingOverview, type EventStat, type UserContext, type EventName, type SendResult,
} from "./growth/tracking";
export {
  getReviewSummary, listPublicReviews, reviewableItems, submitReview, listReviews, reviewTabCounts, setReviewPublished, replyToReview, setReviewsAutoPublish, reviewsAutoPublish, displayName, cleanText,
  type PublicReview, type ReviewSummary, type ReviewableItem, type AdminReview, type ReviewTab,
} from "./growth/reviews";
export { createGreenwebSender, createSmsNetBdSender, smsSenderFromEnv } from "./growth/sms";
export { createBrevoSender, emailSenderFromEnv, type EmailSender } from "./growth/email";
export { currentSmsSender } from "./customers/auth";

// Phase 7: store design builder, landing pages, domain connection
export * from "./builder/registry";
export * from "./builder/theme";
export * from "./builder/versions";
export * from "./builder/preview";
export * from "./builder/data";
export * from "./landing/service";
export { checkDomain, recheckDomain, sweepDomains, dnsInstruction, setDnsResolver, setVercelClient, vercelFromEnv, type DnsResolver, type VercelDomainClient, type DnsInstruction, type CheckOutcome, type SweepSummary } from "./domains/verify";
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
export { MODULES, isModuleOn, listModules, setModule, type ModuleDef, type ModuleView } from "./modules/service";
