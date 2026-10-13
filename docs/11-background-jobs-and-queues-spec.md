# Inngest Background Jobs, Event Catalog & Queue Specification

Status: COMPLETE SPECIFICATION  
Scope: `packages/core`, `apps/storefront/app/api/inngest`, `apps/admin/app/api/inngest`

---

## 1. Overview & Architecture

BizTrackBD uses **Inngest** as its serverless event-driven background job and workflow orchestrator.

### Why Inngest:
1. **Zero Infrastructure**: No Redis, BullMQ, or Celery servers to manage.
2. **Step-Level Idempotency & Retries**: Multi-step workflows (e.g. `order.created -> book courier -> send SMS -> trigger CAPI`) can retry failed steps independently without re-executing completed actions.
3. **Durable Sleeps**: Handles delayed actions (e.g. "wait 30 minutes after checkout abandonment before sending SMS") without keeping serverless containers alive.
4. **Rate Limiting & Concurrency**: Restricts outgoing requests to courier APIs to prevent rate-limit throttling.

---

## 2. Shared Typed Events Catalog (`packages/core/src/events.ts`)

```typescript
import { EventSchemas, Inngest } from "inngest";

export type BizTrackEvents = {
  "order/created": {
    data: {
      tenantId: string;
      orderId: string;
      orderNumber: string;
      customerPhone: string;
      customerName: string;
      totalBDT: number;
      paymentMethod: string;
      isCod: boolean;
      items: Array<{ sku: string; title: string; qty: number; price: number }>;
    };
  };

  "courier/book-consignment": {
    data: {
      tenantId: string;
      orderId: string;
      courierProvider: "steadfast" | "pathao" | "redx";
      pickupLocationId?: string;
    };
  };

  "checkout/abandoned": {
    data: {
      tenantId: string;
      abandonedId: string;
      customerPhone: string;
      customerName?: string;
      cartValue: number;
      lineItems: Array<{ title: string; variantTitle?: string; price: number }>;
    };
  };

  "capi/forward-purchase": {
    data: {
      tenantId: string;
      eventId: string;
      eventName: "Purchase" | "InitiateCheckout" | "AddToCart";
      eventTime: number;
      userPhone: string;
      userEmail?: string;
      currency: "BDT";
      value: number;
      clientIp?: string;
      userAgent?: string;
      fbPixelId: string;
      capiToken: string;
    };
  };

  "sms/dispatch": {
    data: {
      tenantId: string;
      recipientPhone: string;
      message: string;
      templateKey: string;
    };
  };
};

export const inngest = new Inngest({
  id: "biztrackbd-ecom",
  schemas: new EventSchemas().fromRecord<BizTrackEvents>(),
});
```

---

## 3. Core Background Functions & Workflows

### A. Abandoned Checkout Recovery Workflow (`checkout.abandoned`)

```typescript
import { inngest } from "../client";
import { db } from "@biztrackbd/db";
import { sendPlatformSms } from "@biztrackbd/integrations";

export const handleAbandonedCheckout = inngest.createFunction(
  {
    id: "workflow-abandoned-checkout-recovery",
    name: "Abandoned Checkout Multi-Step Recovery",
    concurrency: { limit: 10 },
  },
  { event: "checkout/abandoned" },
  async ({ event, step }) => {
    const { tenantId, abandonedId, customerPhone, customerName, cartValue } = event.data;

    // Step 1: Wait 30 minutes for human telemarketing call or customer self-completion
    await step.sleep("wait-30-minutes", "30m");

    // Step 2: Check if checkout converted into an order
    const checkoutRecord = await step.run("check-status-after-30m", async () => {
      return db.abandonedCheckout.findUnique({ where: { id: abandonedId } });
    });

    if (!checkoutRecord || checkoutRecord.status === "recovered" || checkoutRecord.recoveredOrderId) {
      return { status: "already_converted" };
    }

    // Step 3: Send first gentle SMS recovery reminder
    await step.run("send-first-sms-recovery", async () => {
      const recoveryUrl = `https://${checkoutRecord.tenantId}.biztrack.bd/checkout?recover=${abandonedId}`;
      const message = `Assalamu alaikum ${customerName || ""}, finish your order of ৳${cartValue} with 1-click delivery here: ${recoveryUrl}`;
      
      await sendPlatformSms({ recipientPhone: customerPhone, messageText: message });
      await db.abandonedCheckout.update({ where: { id: abandonedId }, data: { status: "sms_sent" } });
    });

    // Step 4: Wait 24 hours for final promotional incentive
    await step.sleep("wait-24-hours", "24h");

    const finalCheck = await step.run("check-status-after-24h", async () => {
      return db.abandonedCheckout.findUnique({ where: { id: abandonedId } });
    });

    if (finalCheck && finalCheck.status !== "recovered") {
      await step.run("send-discount-incentive-sms", async () => {
        const discountUrl = `https://${checkoutRecord.tenantId}.biztrack.bd/checkout?recover=${abandonedId}&coupon=SAVE5`;
        const message = `Special Eid offer: Take 5% off your saved cart today! Use code SAVE5: ${discountUrl}`;
        await sendPlatformSms({ recipientPhone: customerPhone, messageText: message });
      });
    }

    return { status: "workflow_completed" };
  }
);
```

---

### B. Order Placement Automation (`order.created`)

```typescript
export const handleOrderCreated = inngest.createFunction(
  { id: "workflow-order-created", name: "Order Created Orchestration" },
  { event: "order/created" },
  async ({ event, step }) => {
    const { tenantId, orderId, orderNumber, customerPhone, totalBDT } = event.data;

    // Step 1: Send Immediate Order Confirmation SMS
    await step.run("send-order-confirmation-sms", async () => {
      const msg = `Your order ${orderNumber} for ৳${totalBDT} has been received! Track status: https://${tenantId}.biztrack.bd/account`;
      await sendPlatformSms({ recipientPhone: customerPhone, messageText: msg });
    });

    // Step 2: Trigger Server-Side Meta Conversions API (CAPI)
    await step.run("dispatch-capi-purchase", async () => {
      // Fetches tenant's encrypted CAPI token and forwards Purchase event to Meta Graph API
    });

    // Step 3: Recalculate customer trust & order count
    await step.run("update-customer-metrics", async () => {
      // Increments customer totalSpent, orderCount, and checks delivery trust score
    });
  }
);
```

---

### C. Recurring Cron Jobs

| Cron Expression | Job Name | Functionality |
|---|---|---|
| `*/30 * * * *` (Every 30m) | `cron-courier-status-sync` | Polls Pathao, Steadfast, and RedX for tracking status updates on `SHIPPED` orders and notifies customers on delivery. |
| `0 4 * * *` (Daily at 4 AM) | `cron-subscription-grace-check` | Checks tenant subscription expiration, sends renewal reminder emails/SMS, and flags past-due accounts. |
| `0 0 1 * *` (Monthly on 1st) | `cron-reset-monthly-order-counters` | Resets `Tenant.monthlyOrderCount` to 0 for the new billing cycle. |
