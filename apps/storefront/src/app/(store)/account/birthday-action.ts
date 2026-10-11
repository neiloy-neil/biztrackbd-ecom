"use server";

import { revalidatePath } from "next/cache";
import { DomainError, setBirthday } from "@biztrackbd/core";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

/** The signed-in customer tells us their birthday (month and day), once. Refusals are quiet: the page shows what is saved. */
export async function saveBirthdayAction(f: FormData): Promise<void> {
  const store = await getStore();
  const session = await getCustomerSession(store.id);
  if (!session) return;
  try {
    await setBirthday(store.id, session.customerId, Number(f.get("month")), Number(f.get("day")));
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
  }
  revalidatePath("/account");
}
