import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { smsParts } from "../messaging/shared";
import { assertCan, type StaffActor } from "../permissions";
import { recordOrderEvent } from "./order-events";

const actorName = (a: StaffActor) => a.name ?? a.email;

/** Longest message the owner can send from an order: two Bangla SMS parts or three English ones. */
export const ORDER_MESSAGE_MAX = 200;

/**
 * Sends the customer an SMS about this order, written by the owner. It uses one SMS credit from the plan, is refused for a customer who
 * opted out, and is written on the order's timeline with its words, so the whole team can see what was said. The customer's reply
 * arrives on the owner's own phone: the platform does not receive SMS.
 */
export async function messageCustomer(tenantId: string, actor: StaffActor, orderId: string, rawText: string): Promise<{ parts: number }> {
  assertCan(actor, "orders", "edit");
  const text = rawText.replace(/\s+/g, " ").trim();
  if (text.length < 2) throw new ValidationError("Write the message first");
  if ([...text].length > ORDER_MESSAGE_MAX) throw new ValidationError(`Keep it under ${ORDER_MESSAGE_MAX} characters`);
  const gate = await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId }, select: { customerPhone: true } });
    if (!o) throw new NotFoundError("Order");
    if (!o.customerPhone) return { kind: "no_phone" as const };
    if (await tx.smsOptOut.findFirst({ where: { phone: o.customerPhone } })) return { kind: "opted_out" as const };
    if (!(await consumeSmsCredit(tx, tenantId))) return { kind: "no_credits" as const };
    return { kind: "ok" as const, phone: o.customerPhone };
  });
  if (gate.kind === "no_phone") throw new ValidationError("This order has no phone number");
  if (gate.kind === "opted_out") throw new ValidationError("This customer asked not to get SMS from your store. Call them instead.");
  if (gate.kind === "no_credits") throw new ValidationError("You have used all the SMS credits in your plan this month.");
  try {
    await currentSmsSender().send(tenantId, gate.phone, text);
  } catch (e) {
    console.error("[order-message] sms failed", e instanceof Error ? e.name : "unknown");
    throw new ValidationError("The SMS could not be sent. Try again in a minute, or call the customer.");
  }
  const parts = smsParts(text).parts;
  await withTenant(tenantId, async (tx) => {
    await recordOrderEvent(tx, tenantId, orderId, { type: "SMS", message: `SMS to customer: ${text}`, actor: { id: actor.userId, name: actorName(actor) }, data: { custom: true, parts } });
    await audit(tx, tenantId, actor, "order.customer_messaged", { parts });
  });
  return { parts };
}
