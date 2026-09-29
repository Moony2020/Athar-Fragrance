import { createHash, randomBytes } from "node:crypto";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import type { CheckoutTotals } from "@/checkout/totals";
import type { InventoryReservationPublic } from "@/inventory/reservation-document";
import type { PaymentAttemptDocument, PaymentProvider } from "./payment-attempt-document";

export type PaymentAttemptBinding = {
  owner: CommerceOwner;
  checkoutId: string;
  checkoutRevision: number;
  reservation: InventoryReservationPublic;
  cartFingerprint: string;
  totals: CheckoutTotals;
  shippingMethodId: string;
};

export function paymentAttemptIdempotencyKey(binding: PaymentAttemptBinding, provider: PaymentProvider = "stripe"): string {
  const value = [
    binding.owner.ownerType,
    binding.owner.ownerId,
    binding.checkoutId,
    binding.checkoutRevision,
    binding.reservation.reservationId,
    binding.cartFingerprint,
    binding.totals.grandTotal,
    binding.totals.currency,
    binding.shippingMethodId,
    provider,
  ].join(":");
  return createHash("sha256").update(value).digest("base64url");
}

export function createPaymentAttemptDocument(binding: PaymentAttemptBinding, now = new Date(), provider: PaymentProvider = "stripe"): PaymentAttemptDocument {
  return {
    paymentAttemptId: randomBytes(32).toString("base64url"),
    ownerType: binding.owner.ownerType,
    ownerId: binding.owner.ownerId,
    checkoutId: binding.checkoutId,
    checkoutRevision: binding.checkoutRevision,
    reservationId: binding.reservation.reservationId,
    reservationExpiresAt: binding.reservation.expiresAt,
    cartFingerprint: binding.cartFingerprint,
    amountMinor: binding.totals.grandTotal,
    currency: binding.totals.currency,
    shippingMethodId: binding.shippingMethodId,
    idempotencyKey: paymentAttemptIdempotencyKey(binding, provider),
    providerRequestKey: randomBytes(32).toString("base64url"),
    provider: null,
    status: "local_created",
    createdAt: now,
    updatedAt: now,
  };
}
