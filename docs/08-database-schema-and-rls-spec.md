# Complete Database Schema, Multi-Tenancy & Row-Level Security (RLS) Specification

Status: COMPLETE REMEDIATED SPECIFICATION  
Scope: `packages/db`, `packages/core`, PostgreSQL 16+ / Supabase  
Audit Remediation: P0 Multi-tenant database isolation, compound tenant-safe relations & missing entity synchronization.

Revision 10 Oct 2026 (canvas alignment, see `docs/30-docs-vs-canvas-review-and-kickoff.md`): this is the ONLY schema source. Added the models the 88-artboard canvas needs (plans, usage, modules, tickets, announcements, expenses, collections, blocklist, theme versions, message templates, COD settlement from doc 28, rollups from doc 18, industry modules). Fixed three tables with no `tenantId`, global idempotency keys, and the RLS table list. `TenantIntegration` now matches doc 04. Docs 18 and 28 reference this file instead of redefining models.

---

## 1. Multi-Tenancy Defense-in-Depth Architecture

BizTrackBD utilizes a **3-Tier Hardened Isolation Model** guaranteeing that no query, bulk operation, relation traverse, or raw SQL execution can cross tenant boundaries:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Application Layer (Next.js / Edge Middleware)                           │
│  - Hostname resolved to verified tenantId from Edge Config                      │
│  - Staff / Customer session tokens cryptographically verified with tenantId     │
└──────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Prisma Query Extension & Transaction Session Context                     │
│  - Wraps queries in transactions executing:                                      │
│    SET LOCAL app.current_tenant_id = 'tenant_cuid_123';                         │
│  - Injects tenantId into where, data, include, and select objects                │
└──────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Tier 3: PostgreSQL Database Row-Level Security (RLS) & Foreign Key Constraints    │
│  - Application DB User (biztrack_app) has NOBYPASSRLS                            │
│  - Permissive + Restrictive RLS policies on ALL tenant tables                    │
│  - USING and WITH CHECK clauses enforce tenant match on SELECT/INSERT/UPDATE/DEL │
│  - Cross-Tenant Foreign Key Triggers prevent linking child rows across tenants   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Synchronized Prisma Schema (`packages/db/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  // Prisma 7: connection URLs live in packages/db/prisma.config.ts, not here
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["relationJoins"] // one SQL query for nested includes; avoids overlapping queries on a transaction's single connection
}

// ==========================================
// 1. PLATFORM & TENANT MANAGEMENT
// ==========================================

enum TenantStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELLED
}

enum PlanTier {
  STARTER
  PRO
  BUSINESS
  ENTERPRISE
}

enum BillingInterval {
  MONTHLY
  YEARLY
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  UNPAID
  CANCELLED
}

enum PaymentProofStatus {
  PENDING
  APPROVED
  REJECTED
}

enum MfsProvider {
  BKASH
  NAGAD
  ROCKET
  UPAY
}

model Tenant {
  id               String       @id @default(cuid())
  name             String
  subdomain        String       @unique
  customDomain     String?      @unique
  status           TenantStatus @default(TRIAL)
  planTier         PlanTier     @default(STARTER)
  themeId          String       @default("kapor")
  locale           String       @default("bn-BD")
  currency         String       @default("BDT")
  timezone         String       @default("Asia/Dhaka")
  
  // Storage & Limits Usage Counters
  productCount     Int          @default(0)
  orderCountMonth  Int          @default(0)
  nextOrderNumber  Int          @default(10001)   // atomic per-tenant counter; never derive order numbers from count()
  orderPrefix      String       @default("BT-")    // shown on invoices and SMS, editable in store details
  storageBytesUsed BigInt       @default(0)
  
  trialStartsAt    DateTime     @default(now())
  trialEndsAt      DateTime
  
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  // Platform Relations
  subscription     Subscription?
  paymentProofs    PaymentProof[]
  auditLogs        AuditLog[]
  
  // Tenant Scoped Relations
  users            TenantUser[]
  products         Product[]
  categories       Category[]
  orders           Order[]
  customers        Customer[]
  coupons          Coupon[]
  themeInstalls    ThemeInstall[]
  domains          Domain[]
  integrations     TenantIntegration[]
  abandonedCarts   AbandonedCheckout[]
  returnRequests   ReturnRequest[]
  reviews          Review[]
  shippingZones    ShippingZone[]
  pages            Page[]
  blogPosts        BlogPost[]
  dailyMetrics     DailyStoreMetrics[]
  aiUsage          TenantAiUsage[]
  cartShortLinks   CartShortLink[]
  loyaltyAccounts  CustomerLoyaltyAccount[]
  referrals        CustomerReferral[]
  smsOptOuts       SmsOptOut[]
  apiKeys          ApiKeyCredential[]
  webhookSubs      WebhookSubscription[]
  landingPages     LandingPage[]
  collections      Collection[]
  expenses         Expense[]
  blockedContacts  BlockedContact[]
  themeVersions    ThemeVersion[]
  messageTemplates MessageTemplate[]
  staffInvites     StaffInvite[]
  modules          TenantModule[]
  usageCounters    UsageCounter[]
  trackingEvents   TrackingEvent[]
  tickets          SupportTicket[]
  settlements      CourierSettlementInvoice[]

  @@index([subdomain])
  @@index([customDomain])
  @@index([status])
}

model Subscription {
  id                   String             @id @default(cuid())
  tenantId             String             @unique
  planTier             PlanTier
  interval             BillingInterval    @default(MONTHLY)
  status               SubscriptionStatus @default(TRIALING)
  amount               Decimal            @db.Decimal(12, 2)
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)
  canceledAt           DateTime?
  
  gateway              String?            // "SSLCOMMERZ" | "STRIPE" | "MANUAL_MFS"
  gatewaySubscriptionId String?
  
  tenant               Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@index([status])
}

model PaymentProof {
  id             String             @id @default(cuid())
  tenantId       String
  planTier       PlanTier
  billingPeriod  BillingInterval
  amount         Decimal            @db.Decimal(12, 2)
  mfsProvider    MfsProvider
  senderNumber   String             // 01XXXXXXXXX
  trxId          String             @unique
  screenshotUrl  String?
  status         PaymentProofStatus @default(PENDING)
  
  approvedBy     String?            // Platform Super Admin User ID
  approvedAt     DateTime?
  rejectionReason String?
  
  tenant         Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([trxId])
}

// ==========================================
// 2. STAFF, ROLES & PERMISSIONS
// ==========================================

enum StaffRole {
  STORE_OWNER
  STORE_MANAGER
  ORDER_PACKER
  TELEMARKETER
  CONTENT_EDITOR
}

model TenantUser {
  id           String    @id @default(cuid())
  tenantId     String
  email        String
  passwordHash String
  name         String
  phone        String?
  role         StaffRole @default(STORE_MANAGER)
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  
  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([tenantId, email])
  @@index([tenantId, role])
}

// ==========================================
// 3. PRODUCTS, CATEGORIES & INVENTORY
// ==========================================

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model Category {
  id          String    @id @default(cuid())
  tenantId    String
  name        String
  slug        String
  description String?   @db.Text
  imageUrl    String?
  parentId    String?
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent      Category? @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Category[] @relation("CategoryHierarchy")
  products    Product[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId, parentId])
}

model Product {
  id              String         @id @default(cuid())
  tenantId        String
  title           String
  titleBn         String?
  slug            String
  descriptionHtml String         @db.Text
  shortExcerpt    String?        @db.Text
  status          ProductStatus  @default(DRAFT)
  
  basePrice       Decimal        @db.Decimal(12, 2)
  compareAtPrice  Decimal?       @db.Decimal(12, 2)
  costPrice       Decimal?       @db.Decimal(12, 2)
  
  sku             String?
  barcode         String?
  isFeatured      Boolean        @default(false)
  tags            String[]       @default([])
  
  categoryId      String?
  category        Category?      @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  
  images          ProductImage[]
  variants        ProductVariant[]
  reviews         Review[]
  orderItems      OrderItem[]
  collections     CollectionProduct[]
  
  // SEO Fields
  seoTitle        String?
  seoDescription  String?
  
  tenant          Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  deletedAt       DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId, status])
  @@index([tenantId, categoryId])
  @@index([tenantId, isFeatured])
}

model ProductImage {
  id        String   @id @default(cuid())
  tenantId  String
  productId String
  url       String
  altText   String?
  sortOrder Int      @default(0)
  
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([tenantId, productId, sortOrder])
}

model ProductVariant {
  id             String      @id @default(cuid())
  tenantId       String
  productId      String
  title          String      // e.g. "L / Black"
  sku            String?
  barcode        String?
  price          Decimal     @db.Decimal(12, 2)
  compareAtPrice Decimal?    @db.Decimal(12, 2)
  stockQuantity  Int         @default(0)   // single central warehouse per store (docs/05); no per-location stock
  reorderLevel   Int         @default(5)
  shelfCode      String?     // optional bin or shelf label
  
  options        Json        // { "Size": "L", "Color": "Black" }
  imageUrl       String?
  
  product        Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems     OrderItem[]
  
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@index([tenantId, productId])
  @@index([tenantId, sku])
}

// ==========================================
// 4. ORDERS, PAYMENTS, COURIERS & FRAUD
// ==========================================

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
  REFUNDED
}

enum PaymentStatus {
  UNPAID
  PENDING_VERIFICATION
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
}

enum PaymentMethodType {
  COD
  MANUAL_BKASH
  MANUAL_NAGAD
  MANUAL_ROCKET
  GATEWAY_SSLCOMMERZ
  GATEWAY_STRIPE
}

enum CourierProvider {
  STEADFAST
  PATHAO
  REDX
  PAPERFLY
  MANUAL
}

enum FraudRiskLevel {
  LOW
  MEDIUM
  HIGH
}

model Order {
  id                  String            @id @default(cuid())
  tenantId            String
  orderNumber         String            // e.g. "ORD-10024"
  idempotencyKey      String?
  
  customerId          String?
  customerName        String
  customerPhone       String            // 01XXXXXXXXX
  customerEmail       String?
  
  shippingAddress     String
  shippingCity        String
  shippingDistrict    String
  shippingDivision    String
  shippingPostalCode  String?
  deliveryZone        String            // "INSIDE_DHAKA" | "OUTSIDE_DHAKA"
  
  status              OrderStatus       @default(PENDING)
  paymentStatus       PaymentStatus     @default(UNPAID)
  paymentMethod       PaymentMethodType @default(COD)
  
  // Financial Calculations
  subtotalAmount      Decimal           @db.Decimal(12, 2)
  deliveryCharge      Decimal           @db.Decimal(12, 2)
  discountAmount      Decimal           @default(0.00) @db.Decimal(12, 2)
  loyaltyPointsUsed   Int               @default(0)
  loyaltyDiscountBdt  Decimal           @default(0.00) @db.Decimal(12, 2)
  totalAmount         Decimal           @db.Decimal(12, 2)
  
  couponId            String?
  couponCode          String?
  
  // Manual MFS Verification Details
  mfsSenderNumber     String?
  mfsTrxId            String?
  mfsVerifiedAt       DateTime?
  mfsVerifiedBy       String?
  
  // Courier & Consignment Details
  courierProvider     CourierProvider?
  consignmentId       String?
  trackingCode        String?
  courierTrackingUrl  String?
  courierBookingFee   Decimal?          @db.Decimal(12, 2)
  settlementStatus    SettlementStatus  @default(PENDING_DELIVERY)  // doc 28 COD reconciliation
  
  // Fraud Engine Delivery Trust Score
  fraudRiskLevel      FraudRiskLevel    @default(LOW)
  fraudTrustScore     Int               @default(85) // 0-100
  fraudFlags          String[]          @default([])
  
  // Source Attribution
  channel             String            @default("STOREFRONT") // "STOREFRONT" | "LANDING_PAGE" | "WHATSAPP_BOT" | "MESSENGER_BOT" | "TELEMARKETING" | "QUICK_MESSENGER" | "QUICK_WHATSAPP" | "QUICK_PHONE" | "QUICK_INSTAGRAM"
  createdByUserId     String?           // staff who keyed in a quick order
  utmSource           String?
  utmCampaign         String?
  
  notes               String?           @db.Text
  staffNotes          String?           @db.Text
  
  tenant              Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer            Customer?         @relation(fields: [customerId], references: [id], onDelete: SetNull)
  coupon              Coupon?           @relation(fields: [couponId], references: [id], onDelete: SetNull)
  items               OrderItem[]
  stateLogs           OrderStateLog[]
  refunds             RefundLedger[]
  settledLines        CourierSettledOrder[]
  
  deletedAt           DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@unique([tenantId, orderNumber])
  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, status])
  @@index([tenantId, paymentStatus])
  @@index([tenantId, customerPhone])
  @@index([tenantId, createdAt])
  @@index([tenantId, consignmentId])
}

model OrderItem {
  id             String          @id @default(cuid())
  tenantId       String
  orderId        String
  productId      String
  variantId      String?
  
  productTitle   String
  variantTitle   String?
  sku            String?
  unitPrice      Decimal         @db.Decimal(12, 2)
  quantity       Int
  totalPrice     Decimal         @db.Decimal(12, 2)
  
  order          Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product        Product         @relation(fields: [productId], references: [id], onDelete: Restrict)
  variant        ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  
  createdAt      DateTime        @default(now())

  @@index([tenantId, orderId])
  @@index([productId])
  @@index([variantId])
}

model OrderStateLog {
  id          String      @id @default(cuid())
  tenantId    String
  orderId     String
  fromStatus  OrderStatus
  toStatus    OrderStatus
  actorType   String      // "MERCHANT" | "CUSTOMER" | "COURIER_WEBHOOK" | "SYSTEM_CRON"
  actorId     String?
  reason      String?
  createdAt   DateTime    @default(now())

  order       Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([tenantId, orderId])
  @@index([createdAt])
}

model RefundLedger {
  id          String   @id @default(cuid())
  tenantId    String
  orderId     String
  amount      Decimal  @db.Decimal(12, 2)
  reason      String
  method      String   // "BKASH_SEND_MONEY" | "GATEWAY_REVERSAL" | "STORE_CREDIT"
  trxId       String?
  processedBy String
  createdAt   DateTime @default(now())

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([tenantId, orderId])
}

// ==========================================
// 5. CUSTOMERS, CRM & LOYALTY
// ==========================================

enum VipTierLevel {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

enum LoyaltyTxType {
  EARN_PURCHASE
  REDEEM_PURCHASE
  REFERRAL_BONUS
  TIER_BONUS
  MANUAL_ADJUSTMENT
  EXPIRED
}

enum LoyaltyTxStatus {
  PENDING
  CONFIRMED
  VOIDED
}

model Customer {
  id               String                 @id @default(cuid())
  tenantId         String
  name             String
  phone            String                 // 01XXXXXXXXX
  email            String?
  totalOrders      Int                    @default(0)
  totalSpent       Decimal                @default(0.00) @db.Decimal(12, 2)
  deliveryScore    Int                    @default(90) // 0-100
  isBlacklisted    Boolean                @default(false)
  blacklistReason  String?
  tags             String[]               @default([])
  smsConsent       Boolean                @default(false)
  emailConsent     Boolean                @default(false)
  
  addresses        CustomerAddress[]
  orders           Order[]
  reviews          Review[]
  loyaltyAccount   CustomerLoyaltyAccount?
  
  tenant           Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  @@unique([tenantId, phone])
  @@index([tenantId, totalSpent])
  @@index([tenantId, isBlacklisted])
}

model CustomerAddress {
  id         String   @id @default(cuid())
  tenantId   String
  customerId String
  label      String   @default("Home") // "Home" | "Office"
  address    String
  district   String
  division   String
  isDefault  Boolean  @default(false)
  
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@index([tenantId, customerId])
}

model CustomerLoyaltyAccount {
  id              String         @id @default(cuid())
  tenantId        String
  customerId      String         @unique
  availablePoints Int            @default(0)
  pendingPoints   Int            @default(0)
  lifetimePoints  Int            @default(0)
  currentTier     VipTierLevel   @default(BRONZE)
  rollingSpend12m Decimal        @default(0.00) @db.Decimal(12, 2)
  referralCode    String         @unique
  
  tenant          Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer        Customer       @relation(fields: [customerId], references: [id], onDelete: Cascade)
  transactions    LoyaltyTransaction[]
  referralsMade   CustomerReferral[] @relation("Referrer")

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([tenantId, customerId])
  @@index([referralCode])
}

model LoyaltyTransaction {
  id          String          @id @default(cuid())
  tenantId    String
  accountId   String
  orderId     String?
  points      Int
  amountBdt   Decimal?        @db.Decimal(12, 2)
  type        LoyaltyTxType
  status      LoyaltyTxStatus @default(PENDING)
  description String
  expiresAt   DateTime?
  
  account     CustomerLoyaltyAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdAt   DateTime        @default(now())

  @@index([tenantId, accountId])
  @@index([orderId])
  @@index([expiresAt])
}

model CustomerReferral {
  id              String   @id @default(cuid())
  tenantId        String
  referrerId      String
  refereePhone    String
  firstOrderId    String?  @unique
  bonusPoints     Int      @default(100)
  isDelivered     Boolean  @default(false)
  rewardClaimedAt DateTime?
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  referrerAccount CustomerLoyaltyAccount @relation("Referrer", fields: [referrerId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@index([tenantId, referrerId])
  @@index([refereePhone])
}

// ==========================================
// 6. TELEMARKETING, CHAT & ABANDONED CARTS
// ==========================================

enum AbandonedStatus {
  CAPTURED
  CALL_SCHEDULED
  CALL_CONNECTED
  RECOVERED
  LOST
}

model AbandonedCheckout {
  id             String          @id @default(cuid())
  tenantId       String
  phone          String          // 01XXXXXXXXX
  customerName   String?
  cartItems      Json            // Array of variantId, quantity, price
  cartTotal      Decimal         @db.Decimal(12, 2)
  status         AbandonedStatus @default(CAPTURED)
  
  callAttempts   Int             @default(0)
  lastCallAt     DateTime?
  callAgentNotes String?         @db.Text
  recoveryUrl    String
  
  recoveredOrderId String?
  
  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([tenantId, status])
  @@index([tenantId, phone])
  @@index([tenantId, createdAt])
}

model CartShortLink {
  id          String   @id @default(cuid())
  tenantId    String
  shortCode   String   @unique
  payloadJson Json     // Items, customer info, coupon, channel attribution
  source      String   // "WHATSAPP_BOT" | "MESSENGER_BOT" | "TELEMARKETING"
  clicksCount Int      @default(0)
  isConverted Boolean  @default(false)
  orderId     String?
  expiresAt   DateTime
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@index([tenantId, shortCode])
  @@index([expiresAt])
}

model SmsOptOut {
  id        String   @id @default(cuid())
  tenantId  String
  phone     String   // 01XXXXXXXXX
  reason    String?  // "USER_STOP_REQUEST" | "BOUNCED"
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([tenantId, phone])
  @@index([tenantId])
}

// ==========================================
// 7. AI ENGINE & USAGE QUOTAS
// ==========================================

model TenantAiUsage {
  id              String   @id @default(cuid())
  tenantId        String
  periodMonth     String   // "YYYY-MM"
  generationCount Int      @default(0)
  tokenCount      Int      @default(0)
  customApiKey    String?  // AES-256 encrypted BYO Gemini Key
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, periodMonth])
  @@index([tenantId])
}

// ==========================================
// 8. API CREDENTIALS & OUTBOUND WEBHOOKS
// ==========================================

model ApiKeyCredential {
  id          String    @id @default(cuid())
  tenantId    String
  name        String    // e.g. "ManyChat Production Bot"
  keyPrefix   String    // "bzk_live_..."
  hashedToken String    // bcrypt hash of full secret
  scopes      String[]  // ["orders:read", "orders:write", "products:read"]
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  isActive    Boolean   @default(true)
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@index([tenantId, keyPrefix])
}

model WebhookSubscription {
  id            String               @id @default(cuid())
  tenantId      String
  targetUrl     String
  events        String[]             // ["order.created", "order.delivered", "inventory.low"]
  secretToken   String               // AES-256 encrypted signing secret
  isActive      Boolean              @default(true)
  
  tenant        Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  deliveryLogs  WebhookDeliveryLog[]
  createdAt     DateTime             @default(now())

  @@index([tenantId, isActive])
}

model WebhookDeliveryLog {
  id             String              @id @default(cuid())
  tenantId       String
  subscriptionId String
  eventId        String
  eventType      String
  payload        Json
  responseStatus Int?
  responseBody   String?
  attempt        Int                 @default(1)
  isSuccess      Boolean             @default(false)
  
  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  createdAt      DateTime            @default(now())

  @@index([tenantId, subscriptionId, createdAt])
}

model IdempotencyRecord {
  id          String   @id @default(cuid())
  tenantId    String
  idempotencyKey String
  responseJson Json
  statusCode  Int
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@unique([tenantId, idempotencyKey])
  @@index([expiresAt])
}

// ==========================================
// 9. THEMES, MARKETING & CMS
// ==========================================

model ThemeInstall {
  id          String   @id @default(cuid())
  tenantId    String
  themeId     String   // "kapor" | "gadgetstudio" | "mini-bunny" | "axionwear" | "bindu", see docs/06 for display names
  isActive    Boolean  @default(false)
  settings    Json     // Custom color/font/banner tokens
  pagesJson   Json     // Sections & block trees per route
  version     Int      @default(1)
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, themeId])
  @@index([tenantId, isActive])
}

model LandingPage {
  id              String   @id @default(cuid())
  tenantId        String
  title           String
  slug            String
  targetProductId String
  sectionsJson    Json     // Page builder block layout
  isPublished     Boolean  @default(true)
  pixelId         String?
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Coupon {
  id              String       @id @default(cuid())
  tenantId        String
  code            String
  type            String       // "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING"
  value           Decimal      @db.Decimal(12, 2)
  minOrderValue   Decimal?     @db.Decimal(12, 2)
  usageLimit      Int?
  usageCount      Int          @default(0)
  perCustomerLimit Int         @default(1)
  startsAt        DateTime     @default(now())
  expiresAt       DateTime?
  isActive        Boolean      @default(true)
  
  tenant          Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  orders          Order[]
  
  createdAt       DateTime     @default(now())

  @@unique([tenantId, code])
  @@index([tenantId, isActive])
}

model Review {
  id            String   @id @default(cuid())
  tenantId      String
  productId     String
  customerId    String
  rating        Int      @default(5)
  title         String?
  body          String   @db.Text
  photos        String[] @default([])
  isVerified    Boolean  @default(true)
  isPublished   Boolean  @default(true)
  merchantReply String?  @db.Text
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  customer      Customer @relation(fields: [customerId], references: [id])
  createdAt     DateTime @default(now())

  @@index([tenantId, productId])
}

model ShippingZone {
  id             String   @id @default(cuid())
  tenantId       String
  name           String
  districts      String[]
  rate           Decimal  @db.Decimal(12, 2)
  freeOverAmount Decimal? @db.Decimal(12, 2)
  
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())

  @@index([tenantId])
}

model Page {
  id          String   @id @default(cuid())
  tenantId    String
  title       String
  slug        String
  contentHtml String   @db.Text
  isPublished Boolean  @default(true)
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model BlogPost {
  id          String   @id @default(cuid())
  tenantId    String
  title       String
  slug        String
  summary     String?
  contentHtml String   @db.Text
  coverImage  String?
  authorName  String?
  tags        String[] @default([])
  isPublished Boolean  @default(true)
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Domain {
  id          String   @id @default(cuid())
  tenantId    String
  domain      String   @unique
  verified    Boolean  @default(false)
  isPrimary   Boolean  @default(false)
  redirectWww Boolean  @default(true)   // 308 canonical redirect, docs/13
  dnsStatus   String   @default("waiting")   // "waiting" | "wrong_record" | "found" | "verified"
  dnsNote     String?  // plain-language reason shown to the owner
  sslStatus   String   @default("pending")   // "pending" | "issued" | "renewal_failed" | "expiring"
  lastCheckedAt DateTime?
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@index([tenantId])
}

enum IntegrationMode {
  TEST
  LIVE
}

enum IntegrationStatus {
  CONNECTED
  NEEDS_ATTENTION
  DISABLED
}

model TenantIntegration {
  id             String            @id @default(cuid())
  tenantId       String
  provider       String            // "STEADFAST" | "PATHAO" | "REDX" | "SSLCOMMERZ" | "META_CAPI" | "GA4" | "BREVO_BYO" | "SMS_BYO"
  mode           IntegrationMode   @default(TEST)
  config         Json              @default("{}")   // NON-secret: store name, pickup id, pixel id, sender name
  secretCipher   String            // AES-256-GCM encrypted secrets JSON (base64), write-only from the UI (docs/04, docs/17)
  secretKeyId    String            // which data key encrypted it; supports rotation
  integrationToken String          @unique          // random token in the webhook URL, identifies the tenant without exposing ids
  status         IntegrationStatus @default(CONNECTED)
  lastVerifiedAt DateTime?
  lastError      String?

  tenant         Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([tenantId, provider, mode])
  @@index([tenantId])
}

model ReturnRequest {
  id            String   @id @default(cuid())
  tenantId      String
  orderId       String
  code          String   // "RT-0412"
  reason        String
  customerNote  String?  @db.Text
  type          String   @default("REFUND")   // "EXCHANGE" | "REFUND" | "STORE_CREDIT"
  items         Json     @default("[]")       // [{ orderItemId, qty }]
  refundAmount  Decimal? @db.Decimal(12, 2)
  exchangeVariantId String?
  returnConsignmentId String?                 // courier pickup for the returning parcel
  status        String   @default("PENDING")  // "PENDING" | "APPROVED" | "PICKUP_BOOKED" | "RECEIVED" | "REFUNDED" | "DECLINED"
  photos        String[] @default([])
  decidedBy     String?
  decidedAt     DateTime?

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt     DateTime @default(now())

  @@unique([tenantId, code])
  @@index([tenantId, orderId])
  @@index([tenantId, status])
}

model DailyStoreMetrics {
  id               String   @id @default(cuid())
  tenantId         String
  date             DateTime @db.Date // 2026-10-10

  // Financials
  grossSalesBDT    Decimal  @default(0.00) @db.Decimal(12, 2)
  netSalesBDT      Decimal  @default(0.00) @db.Decimal(12, 2)
  discountsTotalBDT Decimal @default(0.00) @db.Decimal(12, 2)
  shippingTotalBDT Decimal  @default(0.00) @db.Decimal(12, 2)
  refundsTotalBDT  Decimal  @default(0.00) @db.Decimal(12, 2)

  // Volume & conversions
  totalOrders      Int      @default(0)
  paidOrders       Int      @default(0)
  codOrders        Int      @default(0)
  cancelledOrders  Int      @default(0)
  returnedOrders   Int      @default(0)

  // AOV & customers
  averageOrderValue Decimal @default(0.00) @db.Decimal(12, 2)
  newCustomersCount Int     @default(0)
  repeatOrdersCount Int     @default(0)

  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([tenantId, date])
  @@index([tenantId, date])
}

model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  action      String
  actorId     String
  actorEmail  String
  details     Json     @default("{}")
  ipAddress   String?
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
}

// ==========================================
// 11. PLANS, USAGE & MODULES (added 10 Oct 2026)
// ==========================================

// PLATFORM-LEVEL (no tenantId). Limits live here, never in code (docs/05: prices and limits are hypotheses).
model Plan {
  tier            PlanTier @id
  name            String
  priceMonthlyBdt Decimal  @db.Decimal(12, 2)
  priceYearlyBdt  Decimal  @db.Decimal(12, 2)
  trialDays       Int      @default(14)
  isPublic        Boolean  @default(true)
  sortOrder       Int      @default(0)
  // { "products": 300, "ordersPerMonth": 500, "staff": 2, "storageGb": 5, "smsCredits": 200, "landingPages": 3, "aiCredits": 50 }  (null = unlimited)
  limits          Json
  // { "customDomain": false, "courierBooking": "manual", "fraud": "basic", "sectionBuilder": "settings", "modules": 0, "paymentGateway": false, "capi": true }
  features        Json
  // products: hard limit. ordersPerMonth: soft, +10% grace with warning, checkout never blocked (docs/05)
  overagePolicy   Json     @default("{\"products\":\"hard\",\"ordersPerMonth\":\"soft_10pct\"}")
  updatedAt       DateTime @updatedAt
}

model UsageCounter {
  id          String   @id @default(cuid())
  tenantId    String
  metric      String   // "products" | "orders" | "sms" | "storage_bytes" | "ai_credits" | "emails"
  periodStart DateTime @db.Date   // first day of the month, or epoch for non-periodic metrics
  value       BigInt   @default(0)

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, metric, periodStart])
  @@index([tenantId, metric])
}

model TenantModule {
  id         String   @id @default(cuid())
  tenantId   String
  moduleKey  String   // "bespoke" | "drops" | "baby_profiles" | "loyalty" | "booking" | "wholesale"
  isEnabled  Boolean  @default(true)
  settings   Json     @default("{}")

  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  enabledAt  DateTime @default(now())

  @@unique([tenantId, moduleKey])
}

// ==========================================
// 12. CATALOG ORGANISATION, FINANCE, RISK, MESSAGING
// ==========================================

model Collection {
  id          String   @id @default(cuid())
  tenantId    String
  title       String
  titleBn     String?
  slug        String
  isAutomatic Boolean  @default(false)   // rule-based collection
  rules       Json?
  isPublished Boolean  @default(true)
  sortOrder   Int      @default(0)

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products    CollectionProduct[]
  createdAt   DateTime @default(now())

  @@unique([tenantId, slug])
}

model CollectionProduct {
  id           String     @id @default(cuid())
  tenantId     String
  collectionId String
  productId    String
  sortOrder    Int        @default(0)

  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  product      Product    @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([collectionId, productId])
  @@index([tenantId, productId])
}

// Costs the platform cannot see, entered by the owner for the P&L screen (docs/28 section 7)
model Expense {
  id        String   @id @default(cuid())
  tenantId  String
  category  String   // "ADS" | "PACKAGING" | "RENT_SALARY" | "OTHER"
  note      String?
  amount    Decimal  @db.Decimal(12, 2)
  incurredOn DateTime @db.Date
  createdBy String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([tenantId, incurredOn])
}

// Per-store blocklist (docs/12). The cross-store trust score lives in PhoneTrustStat (platform level).
model BlockedContact {
  id        String   @id @default(cuid())
  tenantId  String
  phone     String
  reason    String
  source    String   @default("MANUAL")   // "MANUAL" | "FRAUD_REVIEW" | "REFUSED_PARCELS"
  createdBy String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([tenantId, phone])
}

// Draft and published page JSON for the section builder and landing page builder (docs/06)
model ThemeVersion {
  id          String   @id @default(cuid())
  tenantId    String
  themeId     String
  pageKey     String   // "home" | "product" | "collection" | "landing:<slug>"
  state       String   // "DRAFT" | "PUBLISHED"
  settings    Json
  sectionsJson Json
  version     Int
  label       String?
  createdBy   String?

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([tenantId, themeId, pageKey, state, version])
  @@index([tenantId, themeId, pageKey, state])
}

model MessageTemplate {
  id        String   @id @default(cuid())
  tenantId  String
  event     String   // "ORDER_RECEIVED" | "PAYMENT_CONFIRMED" | "ORDER_SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "ORDER_CANCELLED" | "ABANDONED_RECOVERY"
  channel   String   // "SMS" | "EMAIL" | "WHATSAPP"
  locale    String   // "en" | "bn"
  body      String   @db.Text   // placeholders: {customer_name} {order_number} {tracking_link} {store_name}
  isEnabled Boolean  @default(true)

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  updatedAt DateTime @updatedAt

  @@unique([tenantId, event, channel, locale])
}

model StaffInvite {
  id         String    @id @default(cuid())
  tenantId   String
  email      String
  role       StaffRole
  tokenHash  String    @unique
  invitedBy  String
  expiresAt  DateTime
  acceptedAt DateTime?

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())

  @@index([tenantId, email])
}

// Pixel and Conversions API event log, used for browser vs server dedup and the match table (docs/11)
model TrackingEvent {
  id        String   @id @default(cuid())
  tenantId  String
  provider  String   // "META" | "GA4"
  name      String   // "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase"
  eventId   String   // shared id used for deduplication
  origin    String   // "BROWSER" | "SERVER"
  status    String   @default("SENT")   // "SENT" | "FAILED" | "DEDUPED"
  orderId   String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([tenantId, eventId])
}

// ==========================================
// 13. COD SETTLEMENT (moved here from docs/28)
// ==========================================

enum SettlementStatus {
  PENDING_DELIVERY     // Parcel in transit
  COLLECTED_UNSETTLED  // Delivered, courier holding cash
  SETTLED              // Payout disbursed to merchant bank/bKash
  DISCREPANCY_FLAGGED  // Deductions mismatch or missing payment
}

model CourierSettlementInvoice {
  id                String            @id @default(cuid())
  tenantId          String
  courierProvider   CourierProvider   // STEADFAST | PATHAO | REDX
  invoiceNumber     String            // Courier's payout invoice ID
  disbursedAmount   Decimal           @db.Decimal(12, 2)
  totalCodCollected Decimal           @db.Decimal(12, 2)
  deliveryFeesTotal Decimal           @db.Decimal(12, 2)
  codServiceFee     Decimal           @db.Decimal(12, 2) // 1% + VAT
  returnCharges     Decimal           @db.Decimal(12, 2)
  paymentMethod     String            // "BEFTN_BANK" | "BKASH_COMMERCIAL"
  bankAccountLast4  String?
  disbursedAt       DateTime

  tenant            Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  settledOrders     CourierSettledOrder[]
  createdAt         DateTime          @default(now())

  @@unique([tenantId, courierProvider, invoiceNumber])
  @@index([tenantId, disbursedAt])
}

model CourierSettledOrder {
  id              String                   @id @default(cuid())
  tenantId        String
  settlementId    String
  orderId         String
  consignmentId   String
  codCollected    Decimal                  @db.Decimal(12, 2)
  deliveryCharge  Decimal                  @db.Decimal(12, 2)
  codFeeDeduction Decimal                  @db.Decimal(12, 2)
  netPaidToStore  Decimal                  @db.Decimal(12, 2)
  expectedNet     Decimal                  @db.Decimal(12, 2)   // what we calculated; difference drives the "Short paid" status on the canvas
  result          String                   @default("MATCHED")  // "MATCHED" | "SHORT_PAID" | "MISSING" | "RETURNED"

  settlement      CourierSettlementInvoice @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  order           Order                    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([tenantId, orderId])
  @@index([settlementId])
}

// ==========================================
// 14. SUPPORT (tenant side)
// ==========================================

enum TicketStatus {
  OPEN
  WAITING_ON_TENANT
  SOLVED
}

model SupportTicket {
  id          String       @id @default(cuid())
  tenantId    String
  code        String       // "T-2051"
  subject     String
  status      TicketStatus @default(OPEN)
  priority    String       @default("NORMAL")   // "LOW" | "NORMAL" | "HIGH"
  assigneeId  String?      // PlatformUser id
  openedBy    String       // TenantUser id

  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  messages    TicketMessage[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([tenantId, code])
  @@index([status, priority])
}

model TicketMessage {
  id         String        @id @default(cuid())
  tenantId   String
  ticketId   String
  authorType String        // "TENANT" | "PLATFORM" | "SYSTEM"
  authorId   String?
  body       String        @db.Text
  isInternal Boolean       @default(false)

  ticket     SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  createdAt  DateTime      @default(now())

  @@index([ticketId, createdAt])
}

// ==========================================
// 15. INDUSTRY MODULES (enabled through TenantModule)
// ==========================================

model MeasurementProfile {      // bespoke module
  id         String   @id @default(cuid())
  tenantId   String
  customerId String
  label      String   @default("Default")
  values     Json     // { "chest": 40, "waist": 34, "length": 42, ... } in inches
  notes      String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([tenantId, customerId])
}

model BabyProfile {             // kids module
  id         String   @id @default(cuid())
  tenantId   String
  customerId String
  name       String
  birthMonth DateTime @db.Date
  gender     String?

  createdAt  DateTime @default(now())

  @@index([tenantId, customerId])
}

model DropLaunch {              // drops module
  id           String   @id @default(cuid())
  tenantId     String
  title        String
  productIds   String[]
  launchesAt   DateTime
  perCustomerLimit Int  @default(1)
  isLive       Boolean  @default(false)

  createdAt    DateTime @default(now())

  @@index([tenantId, launchesAt])
}

model DropNotify {
  id        String   @id @default(cuid())
  tenantId  String
  dropId    String
  phone     String
  notifiedAt DateTime?

  createdAt DateTime @default(now())

  @@unique([dropId, phone])
}

// ==========================================
// 16. PLATFORM-LEVEL TABLES (no tenantId, not in the RLS array, see section 3.4)
// ==========================================

model PlatformUser {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  role        String   // "OWNER" | "SUPPORT_LEAD" | "SUPPORT" | "FINANCE"
  isActive    Boolean  @default(true)
  lastLoginAt DateTime?
  createdAt   DateTime @default(now())
}

model PlatformAuditLog {
  id          String   @id @default(cuid())
  actorId     String   // PlatformUser id, or "SYSTEM"
  action      String   // "PAYMENT_APPROVED" | "IMPERSONATE" | "PLAN_CHANGED" | "TENANT_SUSPENDED" | "THEME_RELEASED" ...
  tenantId    String?  // target tenant, if any
  details     Json     @default("{}")
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([actorId, createdAt])
}

model Announcement {
  id         String    @id @default(cuid())
  title      String
  titleBn    String?
  body       String    @db.Text
  bodyBn     String?   @db.Text
  audience   Json      // { "type": "ALL" | "PLAN" | "INTEGRATION" | "TENANT", "value": "..." }
  channels   String[]  // "BANNER" | "EMAIL" | "SMS"
  startsAt   DateTime  @default(now())
  endsAt     DateTime?
  createdBy  String
  createdAt  DateTime  @default(now())
}

model PlatformDailyMetrics {
  id               String   @id @default(cuid())
  date             DateTime @unique @db.Date

  totalTenants     Int
  activePaying     Int
  activeTrials     Int
  churnedCount     Int
  mrrBDT           Decimal  @db.Decimal(12, 2)
  platformGmvBDT   Decimal  @db.Decimal(12, 2)
  totalParcelsBooked Int

  createdAt        DateTime @default(now())
}

// Cross-store delivery trust, keyed by a salted hash of the phone number (docs/12). No names or addresses are stored.
model PhoneTrustStat {
  phoneHash   String   @id
  delivered   Int      @default(0)
  returned    Int      @default(0)
  refused     Int      @default(0)
  storesSeen  Int      @default(0)
  lastEventAt DateTime
  updatedAt   DateTime @updatedAt
}

```

---

### Phase 4 additions (migration 9)

The schema file above is the Phase 0 baseline; `packages/db/prisma/schema.prisma` is the source of truth. Migration `20261010000009_couriers_fraud_returns_profit` adds:

- `Order`: `courierBookedAt`, `courierStatus` (normalised word), `courierStatusAt`, `courierSyncedAt`, `courierBookingLock`, `deliveredAt`, `returnedAt`, `refusedAtDoor`, `trustRecorded`, `fraudReview` (`HELD` | `CLEARED`); index `(tenantId, status, courierSyncedAt)` for the sync.
- `OrderItem.unitCost` (product cost at the time of the order). `Customer.storeCredit`.
- `ReturnRequest`: `adminNote`, `returnTrackingCode`, `exchangeReserved`, `receivedAt`, `restocked`, `refundMethod`, `refundTrxId`, `refundedAt`, `updatedAt`. Statuses now also include `EXCHANGED`.
- `StoreSettings`: `courierFeeInsideDhaka`, `courierFeeOutsideDhaka`, `courierCodFeePercent`, `defaultCourier`.
- `CourierEvent` (tenant table, RLS, append-only for the app role): one row per courier message acted on, unique on `(tenantId, provider, dedupeKey)`.
- `PhoneTrustEvent` (platform table, no `tenantId`, no access for the app role): one outcome per order, keyed by salted phone hash and order hash.
- Functions: `phone_trust_record`, `phone_trust_lookup` (both `SECURITY DEFINER`, hashes in, counts out) and `tenants_with_open_parcels()` (store ids with parcels out, for the sync job).

---

### Phase 5 additions (migration 10)

Migration `20261010000010_signup_and_billing` adds:

- `Tenant`: `ownerName`, `ownerEmail`, `ownerPhone` (the platform's search and support fields), `suspendedReason`, `suspendedAt` (set when the platform, not an unpaid bill, switched the store off), `quarantined`, `quarantineReason` (brand review). Index on `lower(ownerEmail)`.
- `PaymentProof`: `note`, `appliedFrom`, `appliedTo` (the period a payment bought).
- Functions: `signup_subdomain_taken(text)` and `signup_create_tenant(...)` (`SECURITY DEFINER`; the only way a stranger's new `Tenant` row can be inserted, because the app role's policy is "my own id"; enforces the address and at most 3 live stores per owner email; writes UTC).
- Privileges: the app role can no longer `UPDATE` `PaymentProof` or `UPDATE`/`DELETE` `Subscription`. A store can ask to be billed and read what it owes; only the platform role approves a payment or changes a plan.

---

### Phase 6 additions (migration 11)

Migration `20261010000011_growth_tools` adds:

- `AbandonedCheckout`: `recoveryToken` (unique, the secret in the SMS link), `district`, `outcome`, `lastEventAt` (the 30 minutes count from here), `smsClaimedAt`, `smsSentAt`, `smsStatus`. A partial unique index allows one live row per phone per store (`CAPTURED`, `CALL_SCHEDULED`, `CALL_CONNECTED`).
- `TrackingEvent`: `payload`, `detail`, `httpStatus`, and a unique index on `(tenantId, provider, eventId, origin)` so a repeated event is recorded once.
- `Review`: `repliedAt`, `decidedAt` (null while it waits for the owner), `orderId`, and a unique index on `(tenantId, productId, customerId)`: one review per customer per product.
- `StoreSettings`: `reviewsAutoPublish`, `abandonedSmsEnabled`, `metaPixelId`.
- Function `tenants_with_pending_recovery()` (`SECURITY DEFINER`, returns store ids only) for the recovery sweep.

### Phase 7 additions (migration 12)

Migration `20261010000012_builder_and_domains` adds:

- `LandingPage.isPublished` now defaults to false: a page is hidden until its layout is published from the editor.
- Function `domains_to_check()` (`SECURITY DEFINER`, returns store ids and host names only) for the domain sweep: domains claimed in the last 7 days that are not verified, and verified domains whose certificate is not issued, not checked in the last 2 minutes.
- `ThemeVersion` rows hold drafts and history: the draft is version 0 (one per page key), published versions count from 1. Page keys are `home` and `landing:<LandingPage id>`.

### Phase 9 additions (migration 13)

Migration `20261011000013_loyalty_and_referrals` adds:

- `StoreSettings`: `loyaltyEnabled`, `loyaltySpendPerPoint`, `loyaltyPointsPerBlock`, `loyaltyBdtPerBlock`, `loyaltyMaxCartPercent`, `referralEnabled`, `refereeDiscountBdt`, `refereeMinCartBdt`, `referrerRewardPoints`, with a CHECK on their ranges. Both programs default to off.
- `Order`: `tierDiscountBdt`, `referralDiscountBdt`, `referralCode` (beside the existing `loyaltyPointsUsed` and `loyaltyDiscountBdt`). The total is subtotal, minus the coupon, VIP, friend and points discounts, plus delivery and the cash on delivery fee.
- Unique indexes: `CustomerReferral(tenantId, refereePhone)` (a friend is referred once) and `LoyaltyTransaction(accountId, orderId, type)` (one earn, one redeem and one bonus per order).
- The points ledger: `DELETE` is revoked from the app role on `LoyaltyTransaction`, and the trigger `loyalty_tx_immutable` refuses to change points, kind, account, order or store on an existing row (only the status and the note may change).

---

## 3. Production PostgreSQL Row-Level Security (RLS) Setup

### 3.1 Restricted Application Database Role Setup

```sql
-- Step 1: Create application user role without BYPASSRLS
CREATE ROLE biztrack_app WITH LOGIN PASSWORD 'secure_app_password_here' NOBYPASSRLS;

-- Step 2: Grant standard CRUD privileges on schema
GRANT USAGE ON SCHEMA public TO biztrack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO biztrack_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO biztrack_app;
```

### 3.2 Tenant Isolation RLS Policies Across All Tables

Every tenant-owned table receives both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`:

```sql
-- Function to get current verified tenant session setting
CREATE OR REPLACE FUNCTION current_tenant() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Master list of tenant-scoped tables:
-- "Product", "ProductVariant", "Category", "Order", "OrderItem", "Customer", 
-- (full list is the array below; every table with a "tenantId" column MUST be in it)
-- "CustomerAddress", "Coupon", "AbandonedCheckout", "CartShortLink", "CustomerLoyaltyAccount",
-- "LoyaltyTransaction", "CustomerReferral", "SmsOptOut", "TenantAiUsage", "ApiKeyCredential",
-- "WebhookSubscription", "LandingPage", "ThemeInstall", "TenantIntegration", "Review", 
-- "ShippingZone", "Page", "BlogPost", "Domain", "ReturnRequest", "DailyStoreMetrics", "AuditLog"

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'Product', 'Category', 'Order', 'OrderItem', 'Customer', 'CustomerAddress',
    'Coupon', 'AbandonedCheckout', 'CartShortLink', 'CustomerLoyaltyAccount',
    'LoyaltyTransaction', 'CustomerReferral', 'SmsOptOut', 'TenantAiUsage',
    'ApiKeyCredential', 'WebhookSubscription', 'LandingPage', 'ThemeInstall',
    'TenantIntegration', 'Review', 'ShippingZone', 'Page', 'BlogPost',
    'Domain', 'ReturnRequest', 'DailyStoreMetrics', 'AuditLog',
    -- added 10 Oct 2026: every table that holds a tenantId
    'TenantUser', 'Subscription', 'PaymentProof', 'ProductImage', 'ProductVariant',
    'OrderStateLog', 'RefundLedger', 'WebhookDeliveryLog', 'IdempotencyRecord',
    'Collection', 'CollectionProduct', 'Expense', 'BlockedContact', 'ThemeVersion',
    'MessageTemplate', 'StaffInvite', 'TenantModule', 'UsageCounter', 'TrackingEvent',
    'SupportTicket', 'TicketMessage', 'CourierSettlementInvoice', 'CourierSettledOrder',
    'MeasurementProfile', 'BabyProfile', 'DropLaunch', 'DropNotify'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    
    -- Drop existing policy if present
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    
    -- Create strict RESTRICTIVE policy for all operations
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I 
       FOR ALL 
       TO biztrack_app 
       USING ("tenantId" = current_tenant()) 
       WITH CHECK ("tenantId" = current_tenant());',
      tbl
    );
  END LOOP;
END $$;
```

### 3.3 Cross-Tenant Foreign Key Integrity Trigger

To prevent accidental cross-tenant child association (e.g. associating an `OrderItem` with a `Product` owned by another store):

```sql
CREATE OR REPLACE FUNCTION verify_tenant_fk_integrity() RETURNS trigger AS $$
BEGIN
  -- For OrderItem: verify product belongs to same tenant
  IF (TG_TABLE_NAME = 'OrderItem') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Product" 
      WHERE id = NEW."productId" AND "tenantId" = NEW."tenantId"
    ) THEN
      RAISE EXCEPTION 'Cross-tenant foreign key violation: Product % does not belong to tenant %', NEW."productId", NEW."tenantId";
    END IF;
  END IF;

  -- For Order: verify customer belongs to same tenant
  IF (TG_TABLE_NAME = 'Order' AND NEW."customerId" IS NOT NULL) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Customer" 
      WHERE id = NEW."customerId" AND "tenantId" = NEW."tenantId"
    ) THEN
      RAISE EXCEPTION 'Cross-tenant foreign key violation: Customer % does not belong to tenant %', NEW."customerId", NEW."tenantId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verify_order_item_tenant
  BEFORE INSERT OR UPDATE ON "OrderItem"
  FOR EACH ROW EXECUTE FUNCTION verify_tenant_fk_integrity();

CREATE TRIGGER trg_verify_order_customer_tenant
  BEFORE INSERT OR UPDATE ON "Order"
  FOR EACH ROW EXECUTE FUNCTION verify_tenant_fk_integrity();
```

### 3.4 Platform-Level Tables and the Platform Role

Some tables belong to the platform, not a tenant, and have NO `tenantId`: `Plan`, `Announcement`, `PlatformUser`, `PlatformAuditLog`, `PlatformDailyMetrics`, `PhoneTrustStat`. They are not in the RLS array.

- Tenant apps (`admin`, `storefront`) connect as `biztrack_app` and are given `SELECT` only on `Plan` and `Announcement`, and NO access to `PlatformUser`, `PlatformAuditLog`, `PlatformDailyMetrics` or `PhoneTrustStat`.
- `apps/platform` and platform Inngest jobs connect as a separate role `biztrack_platform` with `BYPASSRLS`, because the super admin must read across tenants. Its connection string (`PLATFORM_DATABASE_URL`) exists only in the platform app's environment. Every cross-tenant action by this role is written to `PlatformAuditLog`.
- `PhoneTrustStat` is read by tenant apps only through a `SECURITY DEFINER` function that returns a score for one hashed phone number, never raw rows.

```sql
CREATE ROLE biztrack_platform WITH LOGIN PASSWORD '...' BYPASSRLS;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO biztrack_platform;
REVOKE ALL ON "PlatformUser", "PlatformAuditLog", "PlatformDailyMetrics", "PhoneTrustStat" FROM biztrack_app;
GRANT SELECT ON "Plan", "Announcement" TO biztrack_app;
```

---

## 4. Production Prisma Client with Transactional Session Context

```typescript
// packages/db/src/client.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const basePrisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

/**
 * Creates a hardened, tenant-scoped Prisma client.
 * Sets the PostgreSQL session variable `app.current_tenant_id` inside every transaction.
 */
export function createTenantPrismaClient(tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Invalid tenantId passed to createTenantPrismaClient");
  }

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Global platform models bypass tenant filter
          const globalModels = ["Tenant", "Subscription", "PaymentProof", "PlatformUser"];
          if (globalModels.includes(model)) {
            return query(args);
          }

          // Execute query within a transactional block setting PostgreSQL session tenant context
          return basePrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
            
            // Auto-inject tenantId into where conditions
            if ("where" in args && args.where) {
              args.where = { ...args.where, tenantId };
            }
            
            // Auto-inject tenantId into create data
            if ("data" in args && args.data) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((item) => ({ ...item, tenantId }));
              } else {
                args.data = { ...args.data, tenantId };
              }
            }

            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
}
```

### Phase 2 additions (storefront)

```prisma
// ShippingZone gains: etaMinDays Int @default(1), etaMaxDays Int @default(3)
// CustomerAddress gains: upazila String?
// Tenant gains relations: storeSettings StoreSettings?, customerOtps CustomerOtp[]

model StoreSettings {
  id             String   @id @default(cuid())
  tenantId       String   @unique
  storeName      String
  tagline        String?
  contactPhone   String?
  whatsappNumber String?
  facebookUrl    String?
  instagramUrl   String?
  addressLine    String?
  logoUrl        String?
  announcement   String?
  announcementBn String?
  bkashNumber    String?
  bkashKind      String   @default("PERSONAL")   // "PERSONAL" | "AGENT" | "MERCHANT"
  nagadNumber    String?
  nagadKind      String   @default("PERSONAL")
  paymentNote    String?
  offlineMessage String?
  // tenant relation, createdAt, updatedAt
}

model CustomerOtp {
  id         String    @id @default(cuid())
  tenantId   String
  phone      String
  codeHash   String    // keyed hash, never the code
  expiresAt  DateTime
  attempts   Int       @default(0)
  consumedAt DateTime?
  ipAddress  String?
  // tenant relation, createdAt; @@index([tenantId, phone, createdAt])
}
```

Both new tables have the standard tenant RLS policy (migration 6). `StoreSettings` holds the manual bKash and Nagad numbers customers pay to; they are shown at checkout and are not secrets.

### Phase 3 additions (merchant admin; migrations 7 and 8)

```prisma
// StoreSettings gains: storeNameBn, description, email, pickupAddress, ordersPaused Boolean @default(false),
//   codEnabled Boolean @default(true), codFee Decimal @default(0), codMaxAmount Decimal?,
//   bkashEnabled, nagadEnabled Boolean @default(true), bkashInstruction, nagadInstruction,
//   invoiceFooter, invoiceOptions Json
// Customer gains: notes String?
// Order gains: codFee Decimal @default(0)   // included in totalAmount; shown on invoices

model OrderEvent {          // append-only for the app role (UPDATE and DELETE revoked)
  id        String   @id @default(cuid())
  tenantId  String
  orderId   String
  type      String         // created, payment_confirmed, payment_rejected, packed, shipped, note, printed, address_changed, ...
  message   String
  actorId   String?        // staff user, null for the customer or system
  actorName String?
  meta      Json?
  createdAt DateTime @default(now())
  // RLS on tenantId; @@index([orderId, createdAt])
}

model StockAdjustment {     // append-only for the app role
  id         String   @id @default(cuid())
  tenantId   String
  variantId  String
  delta      Int
  stockAfter Int
  reason     String        // received, damaged, recount, returned, other
  note       String?
  actorId    String?
  createdAt  DateTime @default(now())
  // RLS on tenantId; @@index([variantId, createdAt])
}
```



### Phase 10 additions (migrations 14 and 15)
- **14 `real_sign_in`:** `TenantUser.authUserId` (unique per store) and `PlatformUser.authUserId` (unique) tie a staff row to a Supabase account. The `SECURITY DEFINER` function `staff_memberships(auth_id, email)` finds the rows for a confirmed email, ties the unbound ones, and returns store, role and status; `staff_email_known(email)` answers whether any store has that email. Both are granted to `biztrack_app` only.
- **15 `loyalty_gaps_scheduling_conflicts`:** `StoreSettings` gets `loyaltyExpiryMonths`, `vipSilverMin`, `vipGoldMin`, `vipPlatinumMin`, `vipGoldDiscount`, `vipPlatinumDiscount`, `birthdayVoucherBdt` (a CHECK keeps the levels rising); `Customer.birthMonth/birthDay` (CHECK on the date); `CustomerLoyaltyAccount.birthdayVoucherYear`; `Order.priorityPacking`, `clientHash` (indexed with the store) and `deliveryWaived`; `Page.publishAt` and `BlogPost.publishAt`; `ThemeVersion.updatedAt` (the draft's stamp); the function `tenants_with_loyalty_sweeps()` for the daily job.
