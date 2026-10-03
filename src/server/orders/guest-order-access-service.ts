import "server-only";

import { orderLookupInputSchema } from "@/server/orders/guest-order-access-document";
import { MongoSecureOrderAccessStore, SecureOrderAccessUnavailableError } from "@/server/orders/guest-order-access-store";
import { toCustomerOrderReadModel, type CustomerOrderReadModel } from "@/orders/customer-order-read-model";

export type GuestOrderLookupResult = { ok: true; sessionSecret: string; expiresAt: Date } | { ok: false };
type GuestOrderAccessStore = Pick<MongoSecureOrderAccessStore, "countLookupAttempt" | "findGuestOrder" | "createGuestSession" | "resolveGuestSession">;

export async function lookupGuestOrder(input: unknown, store: GuestOrderAccessStore = new MongoSecureOrderAccessStore()): Promise<GuestOrderLookupResult> {
  const parsed = orderLookupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const rate = await store.countLookupAttempt({ orderId: parsed.data.orderId, normalizedEmail: parsed.data.email });
    if (!rate.allowed) return { ok: false };
    const order = await store.findGuestOrder(parsed.data.orderId, parsed.data.email);
    if (!order) return { ok: false };
    const session = await store.createGuestSession(order.orderId);
    return { ok: true, sessionSecret: session.secret, expiresAt: session.expiresAt };
  } catch (error) {
    if (error instanceof SecureOrderAccessUnavailableError) return { ok: false };
    return { ok: false };
  }
}

export async function readGuestOrderFromSession(secret: string | undefined, store: Pick<GuestOrderAccessStore, "resolveGuestSession"> = new MongoSecureOrderAccessStore()): Promise<CustomerOrderReadModel | null> {
  try {
    const order = secret ? await store.resolveGuestSession(secret) : null;
    return order ? toCustomerOrderReadModel(order) : null;
  } catch {
    return null;
  }
}
