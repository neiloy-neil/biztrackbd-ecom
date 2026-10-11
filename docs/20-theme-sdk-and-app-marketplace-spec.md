# Third-Party Developer SDK & App Extension Marketplace Specification

> **Post-v1 reference spec.** The marketplace is deferred (docs/05). Do not build any of it before the pilot is complete.

Status: COMPLETE SPECIFICATION  
Scope: Developer Ecosystem, `packages/themes`, `apps/admin/app/(admin)/apps`, `@biztrackbd/app-bridge`

---

## 1. Overview & Ecosystem Vision

To scale the platform beyond internal development, BizTrackBD provides a structured SDK and marketplace framework for external Bangladeshi agencies, theme designers, and software vendors:
1. **Themes Marketplace**: Agencies build and monetize high-converting, niche storefront themes (e.g. Traditional Handloom, Luxury Saree Boutiques, Organic Groceries).
2. **App Extensions Marketplace**: Developers build embedded apps (e.g. WhatsApp Chat Automation, Accounting Software Sync, Print-on-Demand Fulfillment, Custom Inventory Barcode Scanners).

---

## 2. Theme Development SDK & Validation CLI

Third-party theme authors build themes adhering to the standard TypeScript manifest contract from [Doc 06](file:///d:/AI/biztrackbd%20ecom/docs/06-theme-builder-and-manifest-spec.md).

### A. Theme CLI Tooling (`@biztrackbd/theme-cli`)

```bash
# Validate theme manifest, section schemas, and token compatibility
pnpm theme validate ./my-custom-theme

# Test theme locally with mock catalog data in dev server
pnpm theme dev ./my-custom-theme --store demo

# Bundle theme into an installable archive
pnpm theme package ./my-custom-theme --out ./my-theme-v1.0.0.tar.gz
```

### B. Automated Linter & Quality Rules:
- ✅ All section schemas must use valid **Zod** definitions.
- ✅ All CSS must reference standard tokens (`--primary`, `--radius`, `--font-heading`) without hardcoded absolute units.
- ✅ Total uncompressed JS bundle per theme must remain under **150KB** to preserve Core Web Vitals (< 2.2s LCP).
- ✅ Must include 3 preview images (Desktop Home `1440x900`, Mobile Home `390x844`, Product Detail).

---

## 3. Sandboxed Embedded App Architecture (`@biztrackbd/app-bridge`)

Third-party apps run in secure, isolated iframes within the merchant admin dashboard (`apps/admin/app/(admin)/apps/[slug]/page.tsx`):

```
+-------------------------------------------------------------------------------+
| Merchant Admin Shell (Parent Host: admin.biztrackbd.com)                      |
|  - Topbar: App Title, Save State Indicator                                    |
|  - Native Toast Notifications, Modals & Resource Pickers                      |
+-------------------------------------------------------------------------------+
                                        ^
                                        | Typed PostMessage Events (Bidirectional)
                                        v
+-------------------------------------------------------------------------------+
| Sandboxed Iframe (Child App: https://partner-app.vercel.app)                  |
|  - Imports @biztrackbd/app-bridge npm package                                 |
|  - Sends: { type: "SHOW_TOAST", message: "Settings saved!", status: "success"}|
|  - Receives: { type: "THEME_CHANGED", isDark: false }                         |
|  - Calls Core REST API with Bearer JWT App Token                              |
+-------------------------------------------------------------------------------+
```

### App Bridge Protocol Implementation:

```typescript
// @biztrackbd/app-bridge (Client SDK used by App Developers)
export interface AppBridge {
  showToast: (options: { message: string; type?: "success" | "error" | "info" }) => void;
  openModal: (options: { title: string; url: string; size?: "sm" | "md" | "lg" }) => void;
  closeModal: () => void;
  setBarTitle: (title: string) => void;
  redirect: (path: string) => void;
}

export function createAppBridge(): AppBridge {
  function postToHost(msg: Record<string, any>) {
    window.parent.postMessage({ source: "BIZTRACK_APP_BRIDGE", ...msg }, "*");
  }

  return {
    showToast: ({ message, type = "success" }) => {
      postToHost({ action: "SHOW_TOAST", payload: { message, type } });
    },
    openModal: ({ title, url, size = "md" }) => {
      postToHost({ action: "OPEN_MODAL", payload: { title, url, size } });
    },
    closeModal: () => {
      postToHost({ action: "CLOSE_MODAL" });
    },
    setBarTitle: (title) => {
      postToHost({ action: "SET_TITLE", payload: { title } });
    },
    redirect: (path) => {
      postToHost({ action: "REDIRECT", payload: { path } });
    },
  };
}
```

---

## 4. Scoped OAuth2 App Permissions & API Tokens

When a merchant installs an app from `AdmApps.dc.html`, the system issues a scoped JWT access token:

```
+-------------------+-----------------------------------------------------------+
| Scope Name        | Permitted Actions                                         |
+-------------------+-----------------------------------------------------------+
| read_products     | Query products, variants, collections, inventory levels   |
| write_products    | Create, update, archive products and adjust stock counts  |
| read_orders       | View customer orders, fulfillment state, line items       |
| write_orders      | Update order status, book custom couriers, add notes      |
| read_customers    | View customer names, phones, delivery trust scores        |
| read_analytics    | Access daily aggregate GMV and sales reports              |
+-------------------+-----------------------------------------------------------+
```

### API Endpoint Format:
```http
GET https://api.biztrackbd.com/v1/orders
Authorization: Bearer <app_scoped_jwt_token>
X-BizTrack-Tenant-Id: k7Qx92mTa
```

---

## 5. Security Audit, Review & Revenue Share

### A. Security & Privacy Audit:
1. **Zero Raw Token Exposure**: Apps never receive the merchant's underlying Supabase Auth credentials or courier API keys.
2. **Strict Origin Checking**: Host admin verifies `event.origin` matches the registered app domain before accepting postMessage commands.
3. **Data Residency**: Customer data synced to external apps must comply with Bangladesh privacy and merchant terms.

### B. Monetization & Payout Model:
- **Revenue Split**: **80% to Developer / 20% to BizTrackBD**.
- **Billing Methods**: One-time theme purchase or monthly recurring app subscription billed through BizTrackBD unified merchant billing.
- **Developer Payouts**: Monthly bank / bKash merchant disbursements processed via Super Admin finance desk (`SaPayments.dc.html`).
