# Public REST API, Authentication & Webhook Delivery Specification

Status: COMPLETE REMEDIATED SPECIFICATION (P1 AUDIT REMEDIATION)  
Scope: `apps/storefront/app/api/v1`, Public Integration API, OpenAPI 3.0

---

## 1. Overview & Architectural Standards

The BizTrackBD Public REST API enables merchants, ERP connectors, accounting software, and mobile apps to interact with store resources programmatically.

### Core Standards:
- **Base URL**: `https://api.biztrackbd.com/v1`
- **Protocol**: HTTPS only, JSON request/response payloads (`Content-Type: application/json`).
- **Idempotency**: All `POST` / `PATCH` requests accept an `X-Idempotency-Key` header (UUID v4) for replay prevention.
- **Rate Limiting**: **120 requests/minute** per tenant enforced via Redis sliding window counter.
  - Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **RFC 7807 Standard Error Format**:
  ```json
  {
    "type": "https://api.biztrackbd.com/errors/invalid_parameters",
    "title": "Invalid Request Parameters",
    "status": 422,
    "detail": "Field 'customer.phone' must be a valid 11-digit Bangladesh mobile number starting with 01.",
    "invalidParams": [
      { "name": "customer.phone", "reason": "Must match regex ^01[3-9]\\d{8}$" }
    ]
  }
  ```

---

## 2. API Key Authentication & Scopes (`ApiKeyCredential`)

### 2.1 Key Format & Storage Security
- **Key Prefix**: `bzk_live_` (Production) or `bzk_test_` (Sandbox).
- **Plaintext Secret**: Displayed **only once** upon creation (e.g. `bzk_live_9f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c`).
- **Database Storage**: The secret is hashed using `SHA-256` before storing in `ApiKeyCredential.hashedToken`. The database only stores `keyPrefix` (`bzk_live_9f8a...`) and `hashedToken`.

### 2.2 Granular Permission Scopes

| Scope Identifier | Permitted Operations |
|---|---|
| `products:read` | List and view products, variants, and categories |
| `products:write` | Create, update, archive products and upload media |
| `orders:read` | List and view orders, customer shipping info, and payment statuses |
| `orders:write` | Create orders, update statuses, book couriers, verify MFS payments |
| `inventory:update`| Adjust stock quantities across variants (ERP stock sync) |
| `customers:read` | View customer order history and loyalty points |
| `webhooks:manage` | Register, update, and inspect outbound webhook endpoints |

---

## 3. Core REST Endpoints Reference

### 3.1 Products & Inventory

#### List Products (`GET /v1/products`)
- **Headers**: `Authorization: Bearer bzk_live_...`
- **Scope Required**: `products:read`
- **Query Params**: `limit` (default: 20, max: 100), `page` (default: 1), `status` (`ACTIVE` | `DRAFT`)
- **Response `200 OK`**:
```json
{
  "data": [
    {
      "id": "cuid_prod_101",
      "title": "Cotton Panjabi, Off-white",
      "titleBn": "কটন পাঞ্জাবি, অফ-হোয়াইট",
      "slug": "cotton-panjabi-off-white",
      "basePrice": "1150.00",
      "compareAtPrice": "1450.00",
      "status": "ACTIVE",
      "variants": [
        {
          "id": "cuid_var_201",
          "title": "Size L",
          "sku": "KP-OW-L",
          "price": "1150.00",
          "stockQuantity": 12
        }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

#### Adjust Inventory (`PATCH /v1/inventory/adjust`)
- **Scope Required**: `inventory:update`
- **Payload**:
```json
{
  "adjustments": [
    { "variantId": "cuid_var_201", "newQuantity": 25, "reason": "Warehouse Stock In" }
  ]
}
```

---

### 3.2 Orders & Checkout

#### Create Order (`POST /v1/orders`)
- **Scope Required**: `orders:write`
- **Headers**: `X-Idempotency-Key: 7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e`
- **Payload**:
```json
{
  "customer": {
    "name": "Rahat Rahman",
    "phone": "01711223344",
    "address": "House 12, Road 5, Dhanmondi",
    "district": "Dhaka",
    "division": "Dhaka"
  },
  "items": [
    { "variantId": "cuid_var_201", "quantity": 1 }
  ],
  "paymentMethod": "COD",
  "couponCode": "SUMMER10"
}
```
- **Response `201 Created`**:
```json
{
  "id": "cuid_ord_890",
  "orderNumber": "ORD-10045",
  "status": "PENDING",
  "paymentStatus": "UNPAID",
  "subtotalAmount": "1150.00",
  "deliveryCharge": "70.00",
  "discountAmount": "115.00",
  "totalAmount": "1105.00",
  "fraudTrustScore": 88,
  "createdAt": "2026-10-10T03:45:00.000Z"
}
```

---

## 4. Outbound Webhook Delivery & Replay Prevention

### 4.1 Supported Outbound Events
- `order.created`: Triggered immediately upon new order placement.
- `order.confirmed`: Triggered when order is marked confirmed.
- `order.shipped`: Triggered when courier tracking consignment is booked.
- `order.delivered`: Triggered when courier marks parcel delivered.
- `order.returned`: Triggered on doorstep return / cancellation.
- `inventory.low_stock`: Triggered when variant stock drops below 5 units.

### 4.2 Webhook Signature Verification (`X-BizTrack-Signature`)
Every webhook payload sent to the merchant's endpoint includes an HMAC-SHA256 signature generated with their secret token:

```typescript
// Signature Generation Example
import crypto from "crypto";

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
```

The receiver validates:
```typescript
const expectedSignature = generateWebhookSignature(rawBody, webhookSecret);
if (req.headers["x-biztrack-signature"] !== expectedSignature) {
  return res.status(401).send("Invalid signature");
}
```

### 4.3 Delivery Retries & Exponential Backoff
If the merchant's endpoint returns non-`2xx` or times out (> 5s), Inngest retries the delivery:
- **Attempt 1**: Immediate
- **Attempt 2**: After 5 minutes
- **Attempt 3**: After 30 minutes
- **Attempt 4**: After 2 hours (Final attempt, logged into `WebhookDeliveryLog`)
