# Design Canvas Implementation Guide & Living Code System

Status: COMPLETE SPECIFICATION  
Scope: `design/canvas/project/`, `packages/ui`, `apps/marketing`, `apps/storefront`, `apps/admin`, `apps/platform`

---

## 1. Why HTML Design Canvas (`.dc.html`) is Superior to Static Figma/Images

The 88 `.dc.html` files located in `design/canvas/project/` represent a **Living Code Design System**. Unlike static Figma mockups or rasterized PDF/image files:
- **100% Precise CSS Values**: Colors, border radii, font sizes, line heights, box shadows, and flex/grid gaps are written directly in CSS.
- **True DOM Hierarchy**: Exact semantic HTML layout (divs, headings, tables, responsive containers) is already authored.
- **Native Typography & Tabular Numerics**: Google Fonts (`Plus Jakarta Sans`, `Hind Siliguri`) and `font-variant-numeric: tabular-nums` for BDT currency alignment are pre-configured.
- **Built-in Mock Data Logic**: Each `.dc.html` includes `<script type="text/x-dc">` containing state dictionaries for all tabs, status badges, rows, and interactive states.
- **Zero Ambiguity for AI & Developers**: No guessing pixel measurements, padding, or color hex values from screenshots.

---

## 2. Design Tokens Extraction (`packages/ui/src/tokens.ts`)

Extracted directly from `Main.dc.html` and `UiKit.dc.html`:

```typescript
export const tokens = {
  colors: {
    // Brand & Primary
    brandPrimary: "#5B4FE8",       // Primary Indigo (CTA buttons, active links)
    brandPrimaryHover: "#4A3FD1",
    brandPrimaryLight: "#F4F3FF",  // Lavender tint for active states & highlights
    brandPrimaryMuted: "#E9E7FD",  // Badge background
    brandNavy: "#1A1A4E",          // Dark navy (header, dark surfaces, high contrast)
    
    // Backgrounds & Surfaces
    canvasBg: "#FAFAFC",           // App background
    surfaceCard: "#FFFFFF",        // Card & table background
    surfaceHeader: "#FAFAFC",       // Table header background
    surfaceBorder: "#E7E7F0",       // Primary card border
    surfaceBorderLight: "#F0F0F6",  // Table row divider
    inputBorder: "#D5D5E4",         // Form input border
    
    // Inks & Typography
    inkHeading: "#1A1A4E",         // Primary dark text (titles, values)
    inkBody: "#4B4B73",            // Secondary body text
    inkMuted: "#6B6B8D",           // Captions, timestamps, table column headers
    inkPlaceholder: "#9A9AB5",
    
    // Status Badges & Accents
    successGreen: "#15803D",
    successGreenBg: "#E8F6EE",
    warningAmber: "#B45309",
    warningAmberBg: "#FDF3E3",
    dangerRed: "#DC2626",
    dangerRedBg: "#FCEBEB",
    dangerRedBorder: "#F1C0C0",
    infoBlue: "#0369A1",
    infoBlueBg: "#E6F5FD",
    
    // Bangladesh Local Payment Brand Colors
    bkashPink: "#E2136E",
    bkashBg: "#FFF5FA",
    nagadOrange: "#F6921E",
    nagadBg: "#FFF8F0",
    steadfastGreen: "#1E6B3A",
    pathaoRed: "#E5252A",
    redxRed: "#D62E2E",
  },
  typography: {
    fontFamilyEn: "'Plus Jakarta Sans', sans-serif",
    fontFamilyBn: "'Hind Siliguri', sans-serif",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  radii: {
    badge: "11px",
    tag: "14px",
    input: "8px",
    button: "8px",
    pill: "9999px",
    card: "12px",
    modal: "16px",
  },
  shadows: {
    card: "0 1px 3px rgba(26, 26, 78, 0.04)",
    modal: "0 16px 48px rgba(26, 26, 78, 0.28)",
    floatingDrawer: "0 8px 24px rgba(26, 26, 78, 0.10)",
  },
};
```

---

## 3. UI Primitive Component Mapping (`packages/ui`)

| Canvas Source Artboard | React Component in `packages/ui` | Target Props / Variants |
|---|---|---|
| `UiKit.dc.html` | `<Button />` | `variant: "primary" \| "secondary" \| "danger" \| "ghost"`, `size: "sm" \| "md" \| "lg"` |
| `UiKit.dc.html` | `<Badge />` | `status: "success" \| "warning" \| "danger" \| "info" \| "brand" \| "neutral"` |
| `UiKit.dc.html` | `<StatCard />` | `title`, `value`, `delta`, `deltaType: "positive" \| "warning" \| "neutral"`, `subtext` |
| `UiKit.dc.html` | `<DataTable />` | `columns`, `data`, `pagination`, `bulkActions`, `emptyState` |
| `UiKit.dc.html` | `<Input />`, `<Select />` | `label`, `error`, `helperText`, `prefix`, `suffix`, `bilingualToggle` |
| `Sidebar.dc.html` | `<AdminSidebar />` | `activeRoute`, `tenantName`, `unreadOrdersCount`, `planBadge` |
| `Topbar.dc.html` | `<AdminTopbar />` | `storeSwitcher`, `searchBar`, `notificationsPopover`, `userMenu` |
| `SettingsNav.dc.html` | `<SettingsNav />` | `activeSection: "general" \| "integrations" \| "shipping" \| "billing" ...` |
| `MobileTabs.dc.html` | `<MobileBottomNav />` | `activeTab: "home" \| "orders" \| "products" \| "customers" \| "more"` |
| `SaSidebar.dc.html` | `<SuperAdminSidebar />` | `activeSection: "overview" \| "tenants" \| "payments" \| "tickets" ...` |

---

## 4. Screen-by-Screen Implementation Matrix

### A. Admin Screens (`apps/admin`)

| Canvas File | Target Route | Core Subcomponents |
|---|---|---|
| `AdmDashboard.dc.html` | `/dashboard` | `<GreetingHeader>`, `<RevenueChart>`, `<RecentOrdersTable>`, `<SetupChecklist>`, `<LowStockRadar>` |
| `AdmOrders.dc.html` | `/orders` | `<OrderTabs>`, `<OrderSearchFilters>`, `<OrderBulkBar>`, `<OrdersTable>` |
| `AdmOrderDetail.dc.html` | `/orders/[id]` | `<OrderHeader>`, `<LineItemsCard>`, `<ManualMfsCheckCard>`, `<CourierDrawer>`, `<AuditTimeline>` |
| `AdmProductEditor.dc.html` | `/products/[id]/edit` | `<BilingualTitleDesc>`, `<ImageGalleryGrid>`, `<PricingCalculator>`, `<VariantMatrixEditor>` |
| `AdmAbandoned.dc.html` | `/orders/abandoned` | `<AbandonedKpis>`, `<AbandonedTable>`, `<TelemarketingCallDrawer>`, `<BanglaCallScript>` |
| `AdmFraud.dc.html` | `/orders/fraud` | `<FraudKpiRadar>`, `<RiskyOrdersList>`, `<PhoneDeliveryBar>`, `<RiskRulesSettings>`, `<BlocklistCard>` |
| `AdmReturns.dc.html` | `/orders/returns` | `<ReturnTabs>`, `<ReturnsTable>`, `<ExchangeResolutionDrawer>`, `<ReturnPickupBooking>` |
| `AdmInventory.dc.html` | `/products/inventory` | `<InventoryKpis>`, `<LocationStockTable>`, `<InlineStockEdit>`, `<StockSheetExport>` |
| `AdmCoupons.dc.html` | `/marketing/discounts` | `<CouponsTable>`, `<CreateCouponModal>`, `<DiscountRuleSummary>` |
| `AdmCustomerDetail.dc.html` | `/customers/[id]` | `<CustomerHeader>`, `<OrderHistoryTable>`, `<VipTagEditor>`, `<DeliveryTrustScore>` |
| `AdmIntegrations.dc.html` | `/settings/integrations` | `<CourierCards>`, `<PaymentGatewayCards>`, `<SslCommerzModal>`, `<AesKeyVaultNotice>` |
| `AdmPixels.dc.html` | `/marketing/pixels` | `<FacebookCapiCard>`, `<EventStreamDeduplicationTable>`, `<GtmGa4Card>` |
| `AdmInvoice.dc.html` | `/orders/[id]/print` | `<InvoiceA4View>`, `<PackingSlipView>`, `<Thermal80mmView>`, `<QrTrackSticker>` |
| `AdmBilling.dc.html` | `/settings/billing` | `<CurrentPlanCard>`, `<UsageMeters>`, `<ManualMfsUpgradeModal>`, `<InvoicesTable>` |
| `AdmLimit.dc.html` | Modal / Interceptor | `<PlanLimitWarningModal>`, `<UpgradeProCtaCard>` |
| `AdmReadOnly.dc.html` | Store Suspension State | `<SuspensionBanner>`, `<DataExportBackupButton>`, `<ReactivationPaymentModal>` |

---

### B. Theme Builder & Storefront (`apps/storefront` & `packages/builder`)

| Canvas File | Target Route | Core Subcomponents |
|---|---|---|
| `BldEditor.dc.html` | `/settings/theme-editor` | `<EditorSidebarTree>`, `<SettingsFormControls>`, `<PostMessagePreviewFrame>`, `<ViewportSwitcher>` |
| `BldLanding.dc.html` | `/marketing/landing-pages` | `<LandingPageList>`, `<1ProductFunnels>`, `<EmbeddedCodCheckoutBlock>` |
| `StrHome.dc.html` | `[tenant].domain/` | `<ThemeHeader>`, `<HeroSlider>`, `<CategoryGrid>`, `<FeaturedProducts>`, `<TrustFooter>` |
| `StrProduct.dc.html` | `[tenant].domain/products/[slug]` | `<ImageZoomGallery>`, `<VariantPicker>`, `<SizeChartModal>`, `<StickyBuyNowBar>` |
| `StrCheckout.dc.html` | `[tenant].domain/checkout` | `<OrderSummaryToggle>`, `<PhoneFormatter>`, `<DistrictThanaSelector>`, `<BkashSendMoneyTrxBox>`, `<PlaceOrderButton>` |
| `StrSuccess.dc.html` | `[tenant].domain/order-placed/[id]` | `<OrderSuccessBadge>`, `<LiveCourierTrackLink>`, `<WhatsAppStoreButton>` |
| `StrAccount.dc.html` | `[tenant].domain/account` | `<OtpLogin>`, `<CustomerOrderTimeline>`, `<ReturnRequestModal>` |

---

### C. Super Admin Control Panel (`apps/platform`)

| Canvas File | Target Route | Core Subcomponents |
|---|---|---|
| `SaOverview.dc.html` | `/super-admin` | `<PlatformMrrChart>`, `<TenantFunnelAnalytics>`, `<UrgentActionQueue>` |
| `SaTenants.dc.html` | `/super-admin/tenants` | `<TenantSearchFilterTable>`, `<ImpersonateAction>`, `<SuspendModal>` |
| `SaTenant.dc.html` | `/super-admin/tenants/[id]` | `<TenantOverviewTabs>`, `<PlanUsageMeters>`, `<AuditTrailLog>`, `<InternalNotesEditor>` |
| `SaPayments.dc.html` | `/super-admin/payments` | `<ApprovalQueue>`, `<ScreenshotViewer>`, `<1ClickApprovePlan>`, `<RejectModal>` |
| `SaTickets.dc.html` | `/super-admin/tickets` | `<SupportTicketDesk>`, `<CustomerHistorySidebar>`, `<TicketReplyComposer>` |

---

### D. Screens added after the first matrix (10 Oct 2026)

Admin (`apps/admin`):

| Canvas File | Target Route | Notes |
|---|---|---|
| `AdmProducts` | `/products` | List with status tabs, stock, price, sold |
| `AdmCustomers` | `/customers` | List, filters, VIP tag |
| `AdmReports` | `/reports` | Sales, products, customers, payments, couriers |
| `AdmProfit` | `/reports/profit` | Doc 28 section 7 |
| `AdmCodRecon` | `/finance/cod-settlement` | Doc 28 section 2 (route in doc 28 is `/admin/finance/cod-reconciliation`; use this one) |
| `AdmQuickOrder` | `/orders/quick` | Doc 28 section 4 |
| `AdmReviews` | `/products/reviews` | Approve, reply, hide |
| `AdmLanding` | `/marketing/landing-pages` | List; editor is `BldLanding` |
| `AdmLoyalty` | `/marketing/loyalty` | Doc 26 |
| `AdmPagesBlog` | `/online-store/pages` | Pages, blog, menus |
| `AdmStoreDetails` | `/settings/general` | Brand, contact, language, order prefix |
| `AdmPayments` | `/settings/payments` | COD, bKash, Nagad, gateway |
| `AdmShipping` | `/settings/shipping` | Courier accounts and zones |
| `AdmNotifications` | `/settings/notifications` | SMS and email templates |
| `AdmDomains` | `/settings/domains` | DNS assistant, doc 13 |
| `AdmStaff` | `/settings/staff` | Roles and invites |
| `AdmApps` | `/apps` | Industry modules |

Mobile (same routes at 768px and below, with mobile-specific layouts): `MobDashboard` `/dashboard`, `MobOrders` `/orders`, `MobOrderBn` `/orders/[id]` in Bangla, `MobAddProduct` `/products/new`, `MobCourier` courier booking sheet, `MobBkash` `/orders/[id]/verify-payment`, `MobMore` `/more`, `MobFraud` `/orders/fraud`, `MobAbandoned` `/orders/abandoned`, `MobPixels` `/marketing/pixels`, `MobLanding` `/marketing/landing-pages`, `MobQuickOrder` `/orders/quick`, `MobCodRecon` `/finance/cod-settlement`.

Marketing and onboarding (`apps/marketing`): `MktHome` `/`, `MktHomeMobile` (responsive `/`), `MktTemplates` `/templates`, `MktPricing` `/pricing`, `MktHeader` and `MktFooter` shared layout, `OnbSignup` `/signup`, `OnbStore` `/onboarding/store`, `OnbSubdomain` `/onboarding/address`, `OnbTemplate` `/onboarding/template`, `OnbBrand` `/onboarding/brand`, `OnbMobile` (responsive wizard), `WizardPreview` live preview component.

Builder and storefront: `BldTheme` `/settings/theme-editor` (Theme tab), `BldLibrary` `/online-store/themes`, `BldLanding` landing page editor, `StrHomeMobile` (responsive storefront home), `StrOffline` shown when `Tenant.status` is suspended.

Platform (`apps/platform`): `SaPlans` `/super-admin/plans`, `SaAnnouncements` `/super-admin/announcements`, `SaDomains` `/super-admin/domains`, `SaThemes` `/super-admin/themes`, `SaAudit` `/super-admin/team`.

Tokens: `DarkDashboard` defines the dark token set (`data-theme="dark"`): canvas `#0F0F2A`, surface `#171738`, line `#2A2A5A`, text `#ECECFA`, brand `#8B83F5`. Dark mode is built in Phase 8 for the admin shell only.

---

## 5. Local Canvas Viewer Tooling & Visual QA

To view and interact with the canvas artboards locally during development:

1. **Local Preview Command**:
   ```bash
   pnpm run canvas:preview
   ```
   *Launches a lightweight static server hosting `design/canvas/project/` allowing interactive navigation across all 88 screens. (Script is added to the root `package.json` in Phase 0 of doc 16, together with `canvas:measure`.)*

2. **Visual Regression with Playwright**:
   - Automated visual regression tests take screenshots of actual Next.js rendered pages at standard viewports (Desktop `1440x900`, Mobile `390x844`) and compare them against the canvas baseline artboards.
