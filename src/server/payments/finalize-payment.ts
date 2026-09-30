import "server-only";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";
import type { OrderDocument } from "@/orders/order-document";
import { MongoOrderStore } from "@/server/orders/order-store";

/** Single trusted boundary shared by provider returns and webhooks. */
export async function finalizeTrustedPayment(owner: CommerceOwner, attempt: PaymentAttemptDocument): Promise<OrderDocument | null> {
  if (attempt.status !== "succeeded" || !attempt.providerExternalId || !attempt.provider) return null;
  return new MongoOrderStore().finalizePayment(owner, attempt);
}
