import "server-only";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";
import type { OrderDocument } from "@/orders/order-document";
import { MongoOrderStore } from "@/server/orders/order-store";
import { dispatchOrderConfirmation, ensureOrderConfirmationDelivery } from "@/server/email/email-delivery-store";
import { isOrderEmailDispatchEnabled } from "@/server/email/order-confirmation-mailer";

/** Single trusted boundary shared by provider returns and webhooks. */
export async function finalizeTrustedPayment(owner: CommerceOwner, attempt: PaymentAttemptDocument): Promise<OrderDocument | null> {
  if (attempt.status !== "succeeded" || !attempt.providerExternalId || !attempt.provider) return null;
  const order = await new MongoOrderStore().finalizePayment(owner, attempt);
  if (order) {
    // Email delivery is separate from trusted payment truth and cannot block it.
    await ensureOrderConfirmationDelivery(order).catch(() => undefined);
    if (isOrderEmailDispatchEnabled()) await dispatchOrderConfirmation(order).catch(() => undefined);
  }
  return order;
}
