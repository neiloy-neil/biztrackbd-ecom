import { cookies } from "next/headers";
import { readCustomerSession, type CustomerSession } from "@biztrackbd/core";

export const SESSION_COOKIE = "bt_cs";

/** The signed-in customer for this store, or null. The cookie is bound to the store it was issued for. */
export async function getCustomerSession(tenantId: string): Promise<CustomerSession | null> {
  return readCustomerSession((await cookies()).get(SESSION_COOKIE)?.value, tenantId);
}
