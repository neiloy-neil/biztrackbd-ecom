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

### A. Steadfast Courier Adapter

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

- **Base URL**: `https://portal.steadfast.com.bd/api/v1`
- **Endpoints**:
  - Create Order: `POST /create_order` (Headers: `Api-Key`, `Secret-Key`)
  - Delivery Status: `GET /status_by_cid/{consignment_id}` or `GET /status_by_invoice/{invoice}`
- **Webhook Endpoint**: `POST /api/webhooks/steadfast/{tenantId}` *(Superseded: the built address is `POST /api/webhooks/courier/<integration token>` on the admin app, see section 11.)*
- **Status Mapping**:
  - `pending` / `in_review` -> `OrderStatus.PACKED`
  - `delivered` -> `OrderStatus.DELIVERED`, `PaymentStatus.PAID`
  - `cancelled` / `returned` -> `OrderStatus.RETURNED`

---

### B. Pathao Courier Adapter

```typescript
export interface PathaoCredentials {
  clientId: string;
  clientSecret: string;
  username: string;            // Merchant login email
  password: string;            // Merchant login password
  storeId: number;             // Pathao pickup store ID
}

export interface PathaoCreateOrderPayload {
  store_id: number;
  merchant_order_id: string;   // Order number "BT-10482"
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: number;      // Pathao City ID
  recipient_zone: number;      // Pathao Zone ID
  recipient_area?: number;     // Pathao Area ID
  delivery_type: 48;           // 48 (Normal) or 12 (On Demand)
  item_type: 1;                // 1 (Document) or 2 (Parcel)
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;         // in KG (e.g. 0.5)
  amount_to_collect: number;   // COD Amount in BDT
}
```

- **Base URL**: `https://api-hermes.pathao.com`
- **Token Exchange**: `POST /aladdin/api/v1/issue-token` (`grant_type: password`)
- **Token Cache**: Access tokens are cached in Redis / KV with a 7-day TTL and automatically refreshed on expiry.
- **Webhook Endpoint**: `POST /api/webhooks/pathao/{tenantId}` (Signature verified via `X-PATHAO-SIGNATURE`).

---

### C. RedX Courier Adapter

```typescript
export interface RedXCredentials {
  apiToken: string;
}

export interface RedXCreateParcelPayload {
  customer_name: string;
  customer_phone: string;
  delivery_area: string;       // RedX location string
  delivery_area_id: number;
  customer_address: string;
  merchant_invoice_id: string; // Order number
  cash_collection_amount: number;
  parcel_weight: number;       // in grams (e.g. 500)
  instruction?: string;
}
```

- **Base URL**: `https://openapi.redx.com.bd/v1.0.0-sandbox` (Test) / `https://openapi.redx.com.bd/v1.0.0` (Live)
- **Header**: `Authorization: Bearer {apiToken}`

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
  ipn_url: string;             // https://app.biztrackbd.com/api/webhooks/sslcommerz/{tenantId}
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
- **Steadfast:** `Api-Key` and `Secret-Key` headers; `get_balance` is the cheapest proof the keys work. Its single `cancelled` status is how a parcel comes back, so it is treated as a return. `tracking_update` messages carry no status and are ignored.
- **Pathao:** logs in with the password grant and caches the token per process until it expires (shared storage is Phase 7). The booking sends the address text and lets Pathao work out city, zone and area; `recipient_city` and `recipient_zone` are not sent. Status words come in several spellings (`Pickup Requested`, `order.pickup-requested`) and are normalised first. A signed webhook is checked with an HMAC-SHA256 of the raw body keyed with the client secret, constant time; the exact signing scheme should be confirmed on the first live webhook (the 30-minute sync covers a mismatch). Pathao's registration handshake message is ignored, not answered.
- **RedX:** sends the token in both `API-ACCESS-TOKEN` and `Authorization`; looks up the delivery area by district and upazila before booking; status comes from `parcel/info`. No webhook: the 30-minute sync follows its parcels.
- **Test and live:** each integration row has a mode; test uses the sandbox hosts where one exists. If a store has both, live wins. `COURIER_BASE_URL_<PROVIDER>` points an adapter at a local fake outside production.
- **Webhook address:** `POST /api/webhooks/courier/<integrationToken>` on the admin app, not `/api/webhooks/steadfast/{tenantId}`: the random token (rotatable, `rotateWebhookToken`) replaces the tenant id so the address reveals nothing. Repeats are answered `200 {duplicate:true}`; an unknown parcel `200`; a bad signature `401`; a malformed body `400`; a failure on our side `500` so the courier retries (safe: applying a message twice changes nothing).
- **Audit:** the doc says webhook payloads go to `AuditLog`. They go to `CourierEvent` instead (append-only, one row per message, with the result), which carries the de-duplication key; `AuditLog` records the owner's actions (booking, connection changes).
