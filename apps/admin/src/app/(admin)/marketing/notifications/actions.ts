"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  MESSAGE_EVENTS,
  MESSAGE_LOCALES,
  resetMessageTemplate,
  saveMessageTemplate,
  type MessageEvent,
  type MessageLocale,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface MessageState {
  ok?: boolean;
  error?: string;
}

const isEvent = (v: string): v is MessageEvent =>
  MESSAGE_EVENTS.some((e) => e.event === v);
const isLocale = (v: string): v is MessageLocale =>
  (MESSAGE_LOCALES as string[]).includes(v);

/** Saves one lifecycle notification message template. */
export async function saveNotificationAction(
  event: string,
  _prev: MessageState,
  f: FormData
): Promise<MessageState> {
  const s = await requireAction("marketing", "edit");
  if (!isEvent(event)) return { error: "Unknown message event." };

  try {
    await saveMessageTemplate(s.tenantId, s.actor, {
      event,
      enabled: f.get("enabled") === "on",
      texts: {
        en: String(f.get("body_en") ?? ""),
        bn: String(f.get("body_bn") ?? ""),
      },
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }

  revalidatePath("/marketing/notifications");
  revalidatePath("/marketing");
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Resets message text to platform standard defaults. */
export async function resetNotificationAction(
  event: string,
  locale: string
): Promise<void> {
  const s = await requireAction("marketing", "edit");
  if (!isEvent(event) || !isLocale(locale)) return;

  await resetMessageTemplate(s.tenantId, s.actor, event, locale);
  revalidatePath("/marketing/notifications");
  revalidatePath("/marketing");
  revalidatePath("/settings/notifications");
}
