# BizTrack Merchant Webhooks & Third-Party Integration Guide (Zapier, Make, n8n)

> **Document ID:** `docs/60`  
> **Status:** APPROVED & PRODUCTION-READY  
> **Date:** October 18, 2026  
> **Target Audience:** Merchants, Developers, Integration Specialists, Automation Engineers  

---

## 1. Executive Summary

BizTrack's Merchant Webhook Engine provides a reliable, secure, and real-time mechanism to stream business events from a merchant's store into external systems, automation platforms (such as Zapier, Make, n8n), and internal ERPs/CRMs.

Built on top of BizTrack's **Transactional Event Outbox & Durable Notification Queue (`NOTIFY-001`)**, outbound webhooks guarantee:
1. **Zero Event Loss:** Events are durably persisted to PostgreSQL before transmission.
2. **Cryptographic Authenticity:** Every request is signed with HMAC-SHA256 (`X-BizTrack-Signature: t=<timestamp>,v1=<signature>`).
3. **Resilient Delivery & Backoff:** Automatic exponential backoff (+1 min, +5 min, +15 min) for transient network timeouts or 5xx server errors, failing fast on permanent client errors (4xx).
4. **Self-Service Merchant Control:** Dedicated UI at `/settings/webhooks` with one-click secret rotation, live ping dispatcher, and full delivery audit trail.

---

## 2. Webhook Event Catalog & JSON Payloads

All webhook requests are sent via **HTTP POST** with header `Content-Type: application/json`.

### Event Envelope Structure
Every event envelope shares a consistent structure:
```json
{
  "event": "order.created",
  "id": "evt_1792275660863_81c7p",
  "timestamp": 1792275660864,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": { ... }
}
```

---

### 1. `order.created`
*Triggered when a customer completes storefront checkout or a quick order is submitted.*
```json
{
  "event": "order.created",
  "id": "evt_ord_98712345",
  "timestamp": 1792275660000,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": {
    "orderId": "ord_cmvcyk890",
    "orderNumber": "BT-10492",
    "customer": {
      "name": "Tanvir Hasan",
      "phone": "01711000000",
      "address": "House 12, Road 4, Dhanmondi, Dhaka"
    },
    "subtotal": 2400.00,
    "deliveryFee": 80.00,
    "total": 2480.00,
    "paymentMethod": "COD",
    "items": [
      {
        "sku": "PANJABI-COT-OFFW-L",
        "title": "Cotton Panjabi, Off-white (L)",
        "quantity": 2,
        "unitPrice": 1200.00
      }
    ]
  }
}
```

---

### 2. `order.delivered`
*Triggered when a courier (Steadfast, Pathao, RedX) confirms parcel delivery or merchant updates order state.*
```json
{
  "event": "order.delivered",
  "id": "evt_dlv_87234612",
  "timestamp": 1792275660000,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": {
    "orderId": "ord_cmvcyk890",
    "orderNumber": "BT-10492",
    "courier": "STEADFAST",
    "consignmentId": "SF-9871241",
    "deliveredAt": "2026-10-18T04:15:00.000Z",
    "totalCollected": 2480.00,
    "settlementStatus": "COLLECTED_UNSETTLED"
  }
}
```

---

### 3. `lead.created`
*Triggered when a visitor submits an inquiry, quotation, or contact form on a BizTrack Business site.*
```json
{
  "event": "lead.created",
  "id": "evt_lead_76123456",
  "timestamp": 1792275660000,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": {
    "leadId": "lead_cmvcyk123",
    "type": "QUOTATION",
    "name": "Sarah Ahmed",
    "phone": "01819000000",
    "email": "sarah@designstudio.bd",
    "vertical": "CORPORATE",
    "message": "Interested in corporate consulting package for Q1",
    "sourceUrl": "https://rongdhonu.biztrack.bd/contact"
  }
}
```

---

### 4. `booking.created`
*Triggered when an appointment, table reservation, or consultation is booked.*
```json
{
  "event": "booking.created",
  "id": "evt_bk_55123478",
  "timestamp": 1792275660000,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": {
    "bookingId": "bk_cmvcyk456",
    "scheduledAt": "2026-10-20T14:30:00.000Z",
    "guestName": "Dr. Rafiqul Islam",
    "phone": "01912000000",
    "partySize": 4,
    "notes": "Table near window preferred",
    "status": "PENDING"
  }
}
```

---

### 5. `customer.registered`
*Triggered when a customer completes their account creation or first verified purchase.*
```json
{
  "event": "customer.registered",
  "id": "evt_cust_99182341",
  "timestamp": 1792275660000,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "data": {
    "customerId": "cust_cmvcyk789",
    "name": "Farhana Karim",
    "phone": "01611000000",
    "vipTier": "BRONZE",
    "registeredAt": "2026-10-18T04:00:00.000Z"
  }
}
```

---

### 6. `ping`
*Triggered when testing endpoint connectivity via the 'Send Test Ping' button.*
```json
{
  "event": "ping",
  "id": "ping_1792275660863_81c7p",
  "timestamp": 1792275660864,
  "tenantId": "cmvcxikmx0004vsknpmgxvsr7",
  "test": true,
  "message": "BizTrack Webhooks: Connectivity & Signature Verification Ping"
}
```

---

## 3. Cryptographic Signature Verification (HMAC-SHA256)

Every outbound webhook includes headers:
- `X-BizTrack-Timestamp`: Unix epoch milliseconds when the request was initiated.
- `X-BizTrack-Signature`: `t=<timestamp>,v1=<hmac_hex>`
- `User-Agent`: `BizTrackBD-Webhook-Worker/1.0`

### Computation Formula
```
signature = HMAC_SHA256(secret, `${timestamp}.${rawBodyString}`)
```

### Verification Implementations

#### Node.js / TypeScript
```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyBizTrackWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  maxAgeMs = 300_000 // 5 minutes tolerance against replay attacks
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("="))
  );

  const timestamp = parseInt(parts.t, 10);
  const receivedSig = parts.v1;

  if (isNaN(timestamp) || !receivedSig) return false;

  // Protect against replay attacks
  if (Math.abs(Date.now() - timestamp) > maxAgeMs) return false;

  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  const expectedSig = hmac.digest("hex");

  return timingSafeEqual(
    Buffer.from(receivedSig, "hex"),
    Buffer.from(expectedSig, "hex")
  );
}
```

#### Python
```python
import hmac
import hashlib
import time

def verify_biztrack_webhook(raw_body: bytes, signature_header: str, secret: str, max_age_sec=300) -> bool:
    pairs = dict(item.split("=") for item in signature_header.split(","))
    timestamp = int(pairs.get("t", 0))
    received_sig = pairs.get("v1", "")

    if abs(time.time() - (timestamp / 1000.0)) > max_age_sec:
        return False

    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
    expected_sig = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()

    return hmac.compare_digest(received_sig, expected_sig)
```

#### PHP
```php
function verifyBizTrackWebhook($rawBody, $signatureHeader, $secret, $maxAgeSec = 300) {
    parse_str(str_replace(',', '&', $signatureHeader), $parts);
    $timestamp = intval($parts['t'] ?? 0);
    $receivedSig = $parts['v1'] ?? '';

    if (abs(time() - ($timestamp / 1000)) > $maxAgeSec) {
        return false;
    }

    $payload = "{$timestamp}.{$rawBody}";
    $expectedSig = hash_hmac('sha256', $payload, $secret);

    return hash_equals($expectedSig, $receivedSig);
}
```

---

## 4. Connecting to Zapier Step-by-Step

Zapier lets merchants trigger actions in 6,000+ apps (Google Sheets, Slack, QuickBooks, HubSpot, SMS gateways) without writing code.

### Step 1: Create a "Webhooks by Zapier" Trigger in Zapier
1. Go to [Zapier.com](https://zapier.com) and click **Create Zap**.
2. For Trigger, search and select **Webhooks by Zapier**.
3. Choose the Event: **Catch Hook**.
4. Click **Continue**. Zapier will display your unique webhook URL:
   `https://hooks.zapier.com/hooks/catch/1234567/abcdef/`

### Step 2: Configure in BizTrack Admin
1. Open your BizTrack Admin portal and navigate to **Settings** → **Webhooks** (`/settings/webhooks`).
2. Paste your Zapier Catch Hook URL into the **Webhook Target URL** field.
3. Select your desired events (e.g. `Order Created`, `Lead Captured`).
4. Click **Save Webhook Settings**.
5. Once saved, click **Send Test Ping**. BizTrack will immediately dispatch a sample payload.

### Step 3: Test and Build Actions in Zapier
1. In Zapier, click **Test trigger**. You will see the incoming `ping` or `order.created` event with parsed fields (`data.orderNumber`, `data.customer.phone`, etc.).
2. Add your action steps:
   - **Google Sheets:** Add row to "Online Orders 2026" sheet.
   - **Slack / Telegram:** Send notification to `#sales-alerts`.
   - **HubSpot / Zoho CRM:** Create Deal or Lead.
3. Turn on the Zap!

---

## 5. Connecting to Make.com (Integromat)

1. In Make.com, create a new scenario and add a **Custom Webhook** module.
2. Click **Add** and copy the generated webhook address.
3. In BizTrack Admin (`/settings/webhooks`), paste the URL and click **Save Webhook Settings**.
4. Click **Send Test Ping** to send the initial schema to Make.
5. Make will display **"Successfully determined"** and lock the data structure for downstream modules.

---

## 6. Connecting to n8n (Self-Hosted Automations)

1. In n8n, create a workflow and drag a **Webhook** node.
2. Set HTTP Method to `POST`.
3. Set Path (e.g. `biztrack-events`).
4. Copy the Test/Production Webhook URL into BizTrack Admin.
5. In n8n, add a **Crypto** or **Code** node to verify `X-BizTrack-Signature` using your secret token.

---

## 7. Reliability, Retry Policy & Best Practices

1. **Fast Response (HTTP 2xx):** Receiver endpoints must respond within **5,000 ms** with HTTP `200` or `204`. If your processing takes longer, respond with `200` immediately and process asynchronously.
2. **Idempotency:** Webhook requests may be retried in case of network timeouts. Use the envelope's `id` field (e.g. `evt_...`) as an idempotency key to prevent double-processing.
3. **Secret Rotation:** If a secret is compromised, click **Rotate Secret** in `/settings/webhooks`. Update your receiver with the new secret immediately.
4. **Delivery Inspection:** In case of errors, inspect recent deliveries directly from the **Recent Delivery Logs** table in `/settings/webhooks` to view error codes and raw payloads.
