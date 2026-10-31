import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  getOrderDetail,
  listConnectedCouriers,
  transitionOrder,
  markPacked,
  bookCourier,
  shipManually,
  verifyPayment,
  rejectPayment,
  recordAdvancePayment,
  setCallNote,
  addOrderNote,
  DomainError,
  type Actor,
  enqueueNotificationJob,
  consumeSmsCredit,
  recordOrderEvent,
  smsParts,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import type { OrderStatus } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = (await props.params) || (props as any).params;
  if (!id) {
    return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
  }

  try {
    const [order, connectedCouriers] = await Promise.all([
      getOrderDetail(session.tenantId, session.actor, id),
      listConnectedCouriers(session.tenantId).catch(() => []),
    ]);

    return NextResponse.json({
      order,
      connectedCouriers,
    });
  } catch (err: any) {
    console.error("[Mobile Order Detail Error]", err);
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus || 400 });
    }
    return NextResponse.json({ error: "Failed to fetch order details." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = (await props.params) || (props as any).params;
  if (!id) {
    return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, reason, trackingCode, provider, weightGrams, note, amount, method, trxId } = body;

  const actor: Actor = {
    type: "MERCHANT",
    id: session.user.id,
    name: session.user.name || session.user.email,
  };

  try {
    switch (action) {
      case "change_status":
      case "transition": {
        const to = body.toStatus as OrderStatus;
        if (!to) {
          return NextResponse.json({ error: "Missing target order status (toStatus)" }, { status: 400 });
        }
        if (to === "PROCESSING") {
          const result = await markPacked(session.tenantId, session.actor, [id]);
          if (result.skipped.length > 0) {
            throw new DomainError("CANNOT_PACK", result.skipped[0]?.reason || "This order cannot be packed yet. Confirm it first.", 409);
          }
        } else {
          await transitionOrder(session.tenantId, id, to, actor, reason, {
            forceRestock: body.forceRestock,
            refused: body.refused,
          });
        }
        break;
      }

      case "confirm": {
        await transitionOrder(session.tenantId, id, "CONFIRMED", actor, reason || "Confirmed via mobile app");
        break;
      }

      case "pack": {
        const result = await markPacked(session.tenantId, session.actor, [id]);
        if (result.skipped.length > 0) {
          throw new DomainError("CANNOT_PACK", result.skipped[0]?.reason || "This order cannot be packed yet.", 409);
        }
        break;
      }

      case "ship_manual": {
        await shipManually(session.tenantId, session.actor, id, { trackingCode });
        break;
      }

      case "book_courier": {
        if (!provider) {
          return NextResponse.json({ error: "Courier provider is required (e.g. STEADFAST, PATHAO)" }, { status: 400 });
        }
        await bookCourier(session.tenantId, session.actor, id, {
          provider,
          weightGrams: weightGrams ? Number(weightGrams) : undefined,
          note,
        });
        break;
      }

      case "deliver": {
        await transitionOrder(session.tenantId, id, "DELIVERED", actor, reason || "Marked delivered via mobile app");
        break;
      }

      case "return": {
        await transitionOrder(session.tenantId, id, "RETURNED", actor, reason || "Marked returned via mobile app", {
          forceRestock: true,
          refused: body.refused,
        });
        break;
      }

      case "cancel": {
        if (!reason || reason.trim().length < 3) {
          return NextResponse.json({ error: "Cancellation reason must be at least 3 characters" }, { status: 400 });
        }
        await transitionOrder(session.tenantId, id, "CANCELLED", actor, reason.trim());
        break;
      }

      case "verify_payment": {
        await verifyPayment(session.tenantId, session.actor, id);
        break;
      }

      case "reject_payment": {
        if (!reason || reason.trim().length < 3) {
          return NextResponse.json({ error: "Provide a reason for rejecting payment" }, { status: 400 });
        }
        await rejectPayment(session.tenantId, session.actor, id, reason.trim());
        break;
      }

      case "record_advance": {
        if (!amount || Number(amount) <= 0) {
          return NextResponse.json({ error: "Valid advance payment amount is required" }, { status: 400 });
        }
        await recordAdvancePayment(session.tenantId, session.actor, id, {
          amount: Number(amount),
          method: method || "MANUAL_BKASH",
          trxId: trxId ? String(trxId).trim() : undefined,
          note: note ? String(note).trim() : undefined,
        });
        break;
      }

      case "call_note": {
        await setCallNote(session.tenantId, session.actor, id, note || "");
        break;
      }

      case "add_note": {
        await addOrderNote(session.tenantId, session.actor, id, note || "");
        break;
      }

      case "send_sms": {
        const smsText = typeof body.text === "string" ? body.text.trim() : "";
        if (!smsText) {
          return NextResponse.json({ error: "SMS message text is required" }, { status: 400 });
        }

        const orderData = await getOrderDetail(session.tenantId, session.actor, id);
        if (!orderData?.customerPhone) {
          return NextResponse.json({ error: "Customer does not have a valid phone number" }, { status: 400 });
        }

        const gate = await withTenant(session.tenantId, async (tx) => {
          const optOut = await tx.smsOptOut.findFirst({ where: { phone: orderData.customerPhone } });
          if (optOut) return "opted_out" as const;
          const hasCredit = await consumeSmsCredit(tx, session.tenantId);
          return hasCredit ? ("ok" as const) : ("no_credits" as const);
        });

        if (gate === "opted_out") {
          return NextResponse.json({ error: "Customer has opted out of receiving SMS" }, { status: 400 });
        }
        if (gate === "no_credits") {
          return NextResponse.json(
            { error: "Insufficient SMS credits. Please recharge your SMS balance in store settings." },
            { status: 402 }
          );
        }

        const enq = await enqueueNotificationJob({
          tenantId: session.tenantId,
          recipient: orderData.customerPhone,
          body: smsText,
          channel: "SMS",
          event: body.event || "MANUAL_DISPATCH",
          metadata: { orderId: id, orderNumber: orderData.orderNumber, sentBy: session.user.email },
        });

        await withTenant(session.tenantId, (tx) =>
          recordOrderEvent(tx, session.tenantId, id, {
            type: "SMS",
            message: `SMS sent to customer: "${smsText.slice(0, 45)}${smsText.length > 45 ? "..." : ""}"`,
            actor: { name: session.user.name || session.user.email || "Store Staff" },
            data: { jobId: enq.jobId, status: enq.status, parts: smsParts(smsText).parts },
          })
        );
        break;
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    // Return the fresh order state
    const updatedOrder = await getOrderDetail(session.tenantId, session.actor, id).catch(() => null);

    return NextResponse.json({
      success: true,
      message: `Action '${action}' completed successfully`,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error(`[Mobile Order Action ${action} Error]`, err);
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus || 400 });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to execute order action" },
      { status: 500 }
    );
  }
}
