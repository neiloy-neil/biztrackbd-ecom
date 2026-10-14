"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  DomainError,
  createDraftOrder,
  draftLink,
  createQuickOrder,
  findCustomerForOrder,
  parseOrderMessage,
  parseCustomerDetailsWithAi,
  quoteOrder,
  searchVariantsForOrder,
  type ParsedMessage,
  type Quote,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function parseMessageAction(
  text: string
): Promise<ParsedMessage & { parsedWithAi?: boolean; notes?: string }> {
  const s = await requireAction("orders", "edit");
  const catalog = await searchVariantsForOrder(s.tenantId, s.actor, "", 50);
  const regexParsed = parseOrderMessage(text.slice(0, 2000), catalog);
  try {
    const aiResult = await parseCustomerDetailsWithAi(s.tenantId, text.slice(0, 2000));
    const payment =
      aiResult.paymentMethod === "BKASH"
        ? "MANUAL_BKASH"
        : aiResult.paymentMethod === "NAGAD"
        ? "MANUAL_NAGAD"
        : aiResult.paymentMethod === "COD"
        ? "COD"
        : regexParsed.payment;

    return {
      phone: aiResult.phone || regexParsed.phone,
      name: aiResult.name || regexParsed.name,
      division: aiResult.division || regexParsed.division,
      district: aiResult.district || regexParsed.district,
      upazila: aiResult.upazila || regexParsed.upazila,
      addressHint: aiResult.address || regexParsed.addressHint,
      items: regexParsed.items,
      payment,
      notes: aiResult.notes ?? undefined,
      parsedWithAi: true,
    };
  } catch (err) {
    console.error("AI parse failed, fallback to regex:", err);
    return { ...regexParsed, parsedWithAi: false };
  }
}

export async function lookupCustomerAction(phone: string) {
  const s = await requireAction("orders", "edit");
  return findCustomerForOrder(s.tenantId, s.actor, phone);
}

export async function searchProductsAction(q: string) {
  const s = await requireAction("orders", "edit");
  return searchVariantsForOrder(s.tenantId, s.actor, q, 12);
}

export interface DeskQuoteRequest {
  items: { variantId: string; quantity: number }[];
  district?: string;
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD";
  couponCode?: string;
}

export async function deskQuoteAction(req: DeskQuoteRequest): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const s = await requireAction("orders", "edit");
  try {
    return { ok: true, quote: await quoteOrder(s.tenantId, req) };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}

export interface DeskOrder {
  idempotencyKey: string;
  source: string;
  customer: { name: string; phone: string };
  shipping: { division: string; district: string; upazila: string; address: string };
  items: { variantId: string; quantity: number }[];
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD";
  alreadyPaid: boolean;
  trxId?: string;
  couponCode?: string;
  note?: string;
}

export type DeskResult = { ok: true; orderId: string; orderNumber: string; total: number } | { ok: false; error: string };

export async function createDeskOrderAction(order: DeskOrder): Promise<DeskResult> {
  const s = await requireAction("orders", "edit");
  try {
    const r = await createQuickOrder(s.tenantId, s.actor, order);
    revalidatePath("/orders");
    revalidatePath("/");
    return { ok: true, orderId: r.orderId, orderNumber: r.orderNumber, total: r.totalAmount };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createDeskOrderAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. The order was not created." };
  }
}

export async function openOrderAction(id: string): Promise<void> {
  await requireAction("orders", "view");
  redirect(`/orders/${id}`);
}

export type DraftResult = { ok: true; link: string; total: number | null; phone: string; hours: number } | { ok: false; error: string };

/** Saves what is on the desk as a draft and returns the link to send the customer. Nothing is reserved until they place it. */
export async function createDeskDraftAction(order: Pick<DeskOrder, "customer" | "shipping" | "items" | "couponCode" | "note">): Promise<DraftResult> {
  const s = await requireAction("orders", "edit");
  try {
    const hours = 48;
    const d = await createDraftOrder(s.tenantId, s.actor, { ...order, hours });
    revalidatePath("/orders/drafts");
    return { ok: true, link: await draftLink(s.tenantId, d.code), total: d.total, phone: order.customer.phone, hours };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createDeskDraftAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. The draft was not saved." };
  }
}
