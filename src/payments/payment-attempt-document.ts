import { ObjectId } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";

/**
 * Provider-neutral durable payment record. It deliberately contains no card,
 * wallet, customer, or provider credential data. Provider execution starts in
 * a later stage only after the owner chooses a capture policy.
 */
export type PaymentAttemptStatus =
  | "local_created"
  | "provider_waiting"
  | "customer_action_required"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "superseded";

export type PaymentProvider = "stripe" | "paypal";

export type PaymentAttemptDocument = {
  _id?: ObjectId;
  paymentAttemptId: string;
  ownerType: CommerceOwner["ownerType"];
  ownerId: string;
  checkoutId: string;
  checkoutRevision: number;
  reservationId: string;
  reservationExpiresAt: Date;
  cartFingerprint: string;
  amountMinor: number;
  currency: "SEK";
  shippingMethodId: string;
  idempotencyKey: string;
  providerRequestKey: string;
  provider: PaymentProvider | null;
  status: PaymentAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentAttemptPublic = {
  paymentAttemptId: string;
  amountMinor: number;
  currency: "SEK";
  status: "local_created";
  expiresAt: Date;
};

export function toPaymentAttemptPublic(document: PaymentAttemptDocument): PaymentAttemptPublic {
  return {
    paymentAttemptId: document.paymentAttemptId,
    amountMinor: document.amountMinor,
    currency: document.currency,
    status: "local_created",
    expiresAt: document.reservationExpiresAt,
  };
}
