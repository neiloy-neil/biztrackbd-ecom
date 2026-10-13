# Courier & Payment Gateway Integration Protocol

Status: COMPLETE SPECIFICATION  
Scope: `packages/integrations`, `apps/storefront/api/webhooks`, `apps/admin/api`

---

## 1. Architecture & Security Overview

All third-party integrations (Couriers, Payment Gateways, SMS Aggregators, and Marketing Pixels) follow a **Unified TypeScript Adapter Pattern**.

### Security & Secret Vault Rules:
1. **Per-Tenant Isolation**: Credentials are stored in `TenantIntegration.encryptedCredentials` using **AES-256-GCM**.
2. **Write-Only in UI**: The admin interface allows merchants to enter or replace credentials. The system never sends unmasked keys back to the client.
3. **Decryption at Runtime**: Credentials are only decrypted in server-side API handlers or Inngest background worker steps.
4. **Idempotent Webhooks**: All webhook handlers verify signature/tokens, record the raw payload in `AuditLog`, and ignore duplicate delivery attempts.

---

## 2. Courier Integration Specifications

### A. Steadfast Courier Adapter (Packzy)

```typescript
export interface SteadfastCredentials {
  apiKey: string;
  secretKey: string;
}

export interface SteadfastCreateOrderPayload {
  invoice: string;             // Order number e.g. "BT-10482"
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;          // Total BDT to collect (0 if prepaid)
  note?: string;
}

export interface SteadfastCreateOrderResponse {
  status: number;              // 200
  consignment: {
    consignment_id: number;
    invoice: string;
    tracking_code: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    cod_amount: number;
    status: "in_review" | "pending" | "delivered" | "cancelled";
  };
}
```

- **Base URLs**: `https://portal.steadfast.com.bd/api/v1` or `https://portal.packzy.com/api/v1`
- **Authentication**: `Api-Key` and `Secret-Key` headers on every request. No token refresh needed.
- **Key Endpoints**:
  - Service Check: `GET /ping` (No auth required)
  - Create Order: `POST /create_order`
  - Bulk Orders: `POST /create_order/bulk-order` (Up to 500 parcels)
  - Status Check: `GET /status_by_cid/{consignment_id}`, `GET /status_by_invoice/{invoice}`, `GET /status_by_trackingcode/{tracking_code}`
  - Tracking History: `GET /trackings_by_invoice/{invoice}`
  - Account Balance: `GET /get_balance` (COD balance owed to merchant)
  - Thana/District Directory: `GET /police_stations`
  - Customer Delivery History / Fraud Score: `GET /fraud_check/score/{phone}` (Total, delivered, cancelled parcels & success rate)
- **Status Mapping**:
  - `pending` / `in_review` -> `OrderStatus.PACKED` / `COURIER_STATUS.BOOKED`
  - `delivered` / `delivered_approval_pending` -> `OrderStatus.DELIVERED`, `PaymentStatus.PAID`
  - `cancelled` / `cancelled_approval_pending` -> `OrderStatus.RETURNED`
  - `hold` -> `COURIER_STATUS.HOLD`
- **Webhook Endpoint**: `POST /api/webhooks/courier/<integrationToken>` (Receives `delivery_status` updates).

---

### B. Pathao Courier Adapter

```typescript
export interface PathaoCredentials {
  clientId: string;
  clientSecret: string;
  username: string;            // Merchant login email
  password: string;            // Merchant login password
  storeId?: number;            // Pathao pickup store ID
}

export interface PathaoCreateOrderPayload {
  store_id: number;
  merchant_order_id: string;   // Order number "BT-10482"
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city?: number;     // Pathao City ID (auto-populated by address if omitted)
  recipient_zone?: number;     // Pathao Zone ID
  recipient_area?: number;     // Pathao Area ID
  delivery_type: 48;           // 48 (Normal) or 12 (On Demand)
  item_type: 1 | 2;            // 1 (Document) or 2 (Parcel)
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;         // in KG (0.5 to 10.0 kg)
  amount_to_collect: number;   // COD Amount in BDT (0 for non-COD)
}
```

- **Base URLs**:
  - Live/Production: `https://api-hermes.pathao.com`
  - Test/Sandbox: `https://courier-api-sandbox.pathao.com`
- **Authentication**: OAuth 2.0 Password Grant (`POST /aladdin/api/v1/issue-token`) with `client_id`, `client_secret`, `username`, `password`, `grant_type: "password"`.
- **Token Cache**: Tokens are cached in-memory with expiration safety margins (Pathao token TTL is ~5 days / 432,000s).
- **Key Endpoints**:
  - Issue Token: `POST /aladdin/api/v1/issue-token`
  - List Pickup Stores: `GET /aladdin/api/v1/stores`
  - Create Store: `POST /aladdin/api/v1/stores`
  - Create Order: `POST /aladdin/api/v1/orders`
  - Create Bulk Orders: `POST /aladdin/api/v1/orders/bulk`
  - Order Summary: `GET /aladdin/api/v1/orders/{consignment_id}/info`
  - City / Zone / Area Directories:
    - `GET /aladdin/api/v1/city-list`
    - `GET /aladdin/api/v1/cities/{city_id}/zone-list`
    - `GET /aladdin/api/v1/zones/{zone_id}/area-list`
  - Price Calculator: `POST /aladdin/api/v1/merchant/price-plan`
- **Webhook Endpoint**: `POST /api/webhooks/courier/<integrationToken>` (Signature verified via `X-PATHAO-SIGNATURE`).

---

### C. RedX Courier Adapter

```typescript
export interface RedXCredentials {
  apiToken: string;            // Bearer JWT Token
  pickupStoreId?: number;      // Pickup store ID
}

export interface RedXCreateParcelPayload {
  customer_name: string;
  customer_phone: string;
  delivery_area: string;       // RedX location string
  delivery_area_id: number;
  customer_address: string;
  merchant_invoice_id: string; // Order number
  cash_collection_amount: string;
  parcel_weight: number;       // in grams (e.g. 500)
  instruction?: string;
  value: number;
  pickup_store_id?: number;
}
```

- **Base URLs**:
  - Live/Production: `https://openapi.redx.com.bd/v1.0.0-beta`
  - Test/Sandbox: `https://sandbox.redx.com.bd/v1.0.0-beta` (or `v1.0.0-sandbox`)
- **Headers**: `API-ACCESS-TOKEN: Bearer {token}` and `Authorization: Bearer {token}`.
- **Key Endpoints**:
  - Create Parcel: `POST /parcel`
  - Track Parcel: `GET /parcel/track/{tracking_id}`
  - Parcel Info: `GET /parcel/info/{tracking_id}`
  - Update Parcel: `PATCH /parcels`
  - Areas Directory: `GET /areas`, `GET /areas?district_name={district}`, `GET /areas?post_code={post_code}`
  - Pickup Stores: `GET /pickup/stores`, `POST /pickup/store`, `GET /pickup/store/info/{pickup_store_id}`
  - Charge Calculator: `GET /charge/charge_calculator?delivery_area_id={id}&pickup_area_id={id}&cash_collection_amount={amount}&weight={grams}`
- **Webhook Callback Payload**:
  RedX sends POST callbacks to the configured callback URL:
  ```json
  {
    "tracking_number": "20A312THJDJ8",
    "timestamp": "2026-10-13T12:00:00Z",
    "status": "delivered",
    "invoice_number": "BT-10482",
    "delivery_type": "regular"
  }
  ```
  Status values: `ready-for-delivery`, `delivery-in-progress`, `delivered`, `paid`, `agent-hold`, `agent-returning`, `returned`.
- **Webhook Endpoint**: `POST /api/webhooks/courier/<integrationToken>`

---

## 3. Payment Gateway & Manual MFS Protocol

### A. Manual bKash / Nagad TrxID Flow (Zero-Gateway Fees)

For cardless and commission-free transactions:
1. **Checkout UI Display**: Storefront displays merchant personal or merchant-agent wallet number and dynamic Send Money amount.
2. **Customer Submission**: Customer sends money via their mobile app, copies the 10-character `TrxID`, and submits the order.
3. **Admin Verification Panel**:
   - Order enters `PaymentStatus.PENDING_CHECK`.
   - Store manager verifies TrxID in their bKash/Nagad app.
   - 1-click `Mark as Paid` updates order to `PaymentStatus.PAID` and triggers confirmation SMS.

---

### B. SSLCommerz Payment Adapter

```typescript
export interface SslCommerzCredentials {
  storeId: string;
  storePassword: string;
  isLive: boolean;
}

export interface SslCommerzSessionPayload {
  store_id: string;
  store_passwd: string;
  total_amount: number;
  currency: "BDT";
  tran_id: string;             // Unique transaction ID e.g. "TXN_BT10482_..."
  success_url: string;         // https://{domain}/api/payments/sslcommerz/success
  fail_url: string;            // https://{domain}/api/payments/sslcommerz/fail
  cancel_url: string;          // https://{domain}/api/payments/sslcommerz/cancel
  ipn_url: string;             // https://app.biztrack.bd/api/webhooks/sslcommerz/{tenantId}
  cus_name: string;
  cus_email: string;
  cus_phone: string;
  cus_add1: string;
  cus_city: string;
  shipping_method: "NO";
  product_name: string;
  product_category: string;
  product_profile: "general";
}
```

- **IPN Validation Protocol**:
  1. Receive IPN `POST` request with `val_id`.
  2. Perform server-to-server validation query:
     `GET https://securepay.sslcommerz.com/validator/api/validationserverAPI.php?val_id={val_id}&store_id={store_id}&store_passwd={store_passwd}&v=1&format=json`
  3. Validate that `status === "VALID"` and `amount === order.total`.
  4. Update order to `PaymentStatus.PAID` atomically.

---

## 4. SMS Aggregator Protocol (Greenweb / Reve / Elitbuzz)

```typescript
export interface SmsPayload {
  recipientPhone: string;     // "+8801712345678"
  messageText: string;
  senderId?: string;          // Approved Masking ID or default non-masking
}

export async function sendPlatformSms({ recipientPhone, messageText, senderId }: SmsPayload) {
  const cleanPhone = recipientPhone.replace(/[^0-9]/g, "").replace(/^880/, "0");
  
  const response = await fetch("https://api.greenweb.com.bd/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: process.env.GREENWEB_SMS_TOKEN!,
      to: cleanPhone,
      message: messageText,
      ...(senderId ? { senderid: senderId } : {}),
    }),
  });

  return response.text();
}
```

---

## 5. As built (Phase 4)

Code: `packages/core/src/couriers/` (`steadfast.ts`, `pathao.ts`, `redx.ts`, `factory.ts`, `service.ts`). Where this differs from the sketches above:

- **One interface, not one function per courier:** `verify()`, `book()`, `status()`, `parseWebhook()`. Secrets are read from the vault only inside the service, and an adapter error becomes a `CourierError` whose message never contains a key (the courier's own message, shortened, or a fixed sentence).
- **Steadfast (Packzy):** `Api-Key` and `Secret-Key` headers; `get_balance` is the cheapest proof the keys work. Its single `cancelled` status is how a parcel comes back, so it is treated as a return. Extended capabilities:
  - `checkSteadfastFraud(ctx, phone)`: Queries `GET /fraud_check/score/{phone}` for cross-merchant parcel success rate.
  - `getSteadfastBalance(ctx)`: Queries `GET /get_balance` for current unpaid COD payout balance.
  - `getSteadfastPoliceStations(ctx)`: Queries `GET /police_stations` for coverage directory.
- **Pathao:** logs in with the password grant and caches the token per process until it expires (~5-day lifespan). The booking sends the address text and lets Pathao work out city, zone and area, with fallback to manual selection. Extended capabilities:
  - `listPathaoStores(ctx)`: Queries `GET /aladdin/api/v1/stores` for pickup hub IDs.
  - `getPathaoCities(ctx)`: Queries `GET /aladdin/api/v1/city-list` for supported city options.
  - `calculatePathaoPrice(ctx, params)`: Queries `POST /aladdin/api/v1/merchant/price-plan` for delivery cost estimation.
  - Status words are normalised across various slug variants. Webhooks are verified with HMAC-SHA256 signature when secret is provided.
- **RedX:** sends token in both `API-ACCESS-TOKEN` and `Authorization`; looks up delivery area by district and upazila before booking; status comes from `parcel/info/{id}`. Extended capabilities:
  - `listRedxPickupStores(ctx)`: Queries `GET /pickup/stores` for merchant pickup addresses.
  - `calculateRedxCharge(ctx, params)`: Queries `GET /charge/charge_calculator` with weight and area IDs.
  - `parseWebhook(headers, body)`: Parses RedX POST status callbacks (`tracking_number`, `invoice_number`, `status`), routing updates directly to the unified event ledger.
- **Test and live:** each integration row has a mode; test uses the sandbox hosts where one exists. If a store has both, live wins. `COURIER_BASE_URL_<PROVIDER>` points an adapter at a local fake outside production.
- **Webhook address:** `POST /api/webhooks/courier/<integrationToken>` on the admin app, not `/api/webhooks/steadfast/{tenantId}`: the random token (rotatable, `rotateWebhookToken`) replaces the tenant id so the address reveals nothing. Repeats are answered `200 {duplicate:true}`; an unknown parcel `200`; a bad signature `401`; a malformed body `400`; a failure on our side `500` so the courier retries (safe: applying a message twice changes nothing).
- **Audit:** webhook payloads go to `CourierEvent` (append-only, one row per message, with the result), which carries the de-duplication key; `AuditLog` records the owner's actions (booking, connection changes).
