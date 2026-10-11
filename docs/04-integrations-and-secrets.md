# Integrations, Environment and Secrets

How per-store credentials (Steadfast, Pathao, SSLCommerz, Brevo, Facebook CAPI, SMS) work when every store lives in the one BizTrackBD database. Status: DRAFT for decisions. Provider facts marked "verify" must be confirmed with each provider.

## 1. Two layers of configuration

| Layer | Examples | Where it lives | Who can change it |
|---|---|---|---|
| **Platform env** | `DATABASE_URL`, Supabase service key, `ENCRYPTION_KEK`, Vercel API token (domains), platform Brevo key, platform SMS key, Stripe and SSLCommerz keys for **your subscription billing** | Vercel environment variables (separate Preview and Production), optionally a KMS | You only |
| **Tenant secrets** | A store's Steadfast key, SSLCommerz store ID and password, Pathao credentials, Facebook CAPI token, optional own Brevo key | `TenantIntegration` table, encrypted | The store owner, in their admin |

Tenant secrets are never environment variables. Env vars are global; there is one set for the whole deployment.

## 2. Storing tenant secrets

```
TenantIntegration
  id, tenantId, provider (steadfast | pathao | redx | sslcommerz | brevo | meta_capi | sms_x ...)
  mode (test | live)
  config        JSON, non-secret (store name, pickup ID, sender name, pixel ID)
  secretCipher  bytes, AES-256-GCM encrypted JSON of secrets
  secretKeyId   which data key encrypted it
  status        connected | invalid | disabled
  lastVerifiedAt, lastError
  createdBy, updatedAt
```

- **Envelope encryption:** a master key (KEK) from env or KMS encrypts a per-tenant data key; the data key encrypts the secrets. Rotating the KEK re-wraps data keys without touching every secret.
- **Decrypt only on the server**, inside an adapter, at call time. The browser only ever receives masked values ("••••4f2a") and a status.
- **Write-only form fields:** after saving, an owner can replace a secret but not read it.
- **Verify on save:** call a harmless provider endpoint (balance, store info) and store the result. Show a clear "Connected" or the provider's error.
- **Audit:** every create, rotate, delete and every decrypt-for-use is logged with tenant, actor and purpose. Staff roles cannot view or change integrations.
- **Isolation:** the Postgres RLS policy applies to this table too. Adapters take `tenantId` from the request context, never from client input.
- **Offboarding:** on cancellation, delete secrets after the retention window.

## 3. Adapter pattern

One interface per capability, one implementation per provider, tenant picked at runtime.

```ts
interface CourierProvider  { quote(); book(); track(); cancel(); label(); parseWebhook(); }
interface PaymentGateway   { init(); verify(); refund(); parseIpn(); }
interface MessageProvider  { sendSms(); sendEmail(); }
interface MarketingEvents  { send(event); }

const courier = await getCourier(tenantId, "steadfast");   // loads + decrypts + builds client
```

Core business code (orders, inventory) never imports a provider SDK. Adding a courier means one new adapter and a UI card.

## 4. Webhooks and IPNs

- One platform endpoint per provider: `/api/webhooks/{provider}/{integrationToken}`. The token is random per integration, so the URL identifies the tenant without exposing IDs.
- Show the owner the exact URL to paste into the courier or gateway dashboard.
- Verify the signature or re-query the provider (SSLCommerz validation call) using that tenant's credentials.
- Idempotency key per event; retries safe; failures logged and visible to the owner.
- Process in background jobs, not in the request, so a slow courier cannot stall the platform.

## 5. Provider notes (verify each)

| Provider | Credentials per store | Notes |
|---|---|---|
| Steadfast | API key and secret key from the merchant's own account | COD settlement is between Steadfast and the merchant. |
| Pathao | Client ID, client secret, merchant login | Needs OAuth token refresh and store ID. |
| RedX | Merchant API token | |
| SSLCommerz | Store ID and store password from the merchant's own SSLCommerz account (separate test and live) | I found no partner or sub-merchant model in public sources. Plan for each merchant to hold their own account and KYC, and ask SSLCommerz whether a platform arrangement exists. |
| bKash and Nagad (manual) | Only the receiving number and instructions | No secrets. TrxID verified by the owner. Safe default for small shops. |
| Facebook Pixel and CAPI | Pixel ID (public), CAPI access token (secret) | Server-side events sent from our backend with the tenant's token. |
| Brevo or other email | Either platform key or the store's own key | See section 6. |

## 6. Email and SMS

Two models; recommend **platform-managed by default, bring-your-own as an upgrade**:

- **Platform-managed:** one BizTrackBD Brevo (and SMS) account. Messages go out "from {Store Name}" via our verified domain with the store's reply-to. Usage is metered per tenant against plan credits (SMS credits, email quota). Simple for non-technical owners.
- **Bring-your-own:** the store pastes its own Brevo or SMS provider key. Needed for stores that want their own sender domain, higher volume or marketing campaigns.
- Custom sender domains (SPF, DKIM) per store are a later phase; they reuse the domain-verification UI.
- Respect unsubscribe, consent and BTRC SMS sender rules; confirm local requirements before launch.

## 7. Money flow (important)

- **Subscriptions** (store pays you): your Stripe, SSLCommerz or manual bKash account. Keys live in platform env.
- **Store sales** (customer pays store): COD, manual bKash/Nagad, or the store's **own** SSLCommerz account. Funds go straight to the store, never through BizTrackBD.
- Why: holding or routing merchant funds can make us a payment service provider with licensing duties. Keep the platform out of the flow of funds unless a lawyer confirms otherwise.

## 8. Environments

| Env | Database | Tenant integrations |
|---|---|---|
| Local | Local Postgres or Supabase dev | Test tenants with sandbox credentials seeded; provider calls mocked by default |
| Preview | Shared preview DB, seeded | Sandbox only; outbound SMS and email blocked or redirected |
| Production | Production DB | Real credentials, `mode = live` only after the owner confirms a test order |

- Each tenant integration has `test` and `live` modes so an owner can try a courier or gateway first.
- A global kill switch per provider lets you pause outbound calls during a provider incident.

## 9. Reliability and abuse limits

- Per-tenant rate limits and a job queue with retries and backoff; a failing store never slows others.
- Circuit breaker per provider and tenant; after repeated failures show "Pathao needs attention" in the admin.
- Credential health check on a schedule (daily) with email and in-app alert on failure.
- Never log secrets or full provider payloads containing customer data.

## 10. Open decisions

See the question list in the planning conversation: credentials model, money flow, email model, v1 integrations, queue and hosting choice.
