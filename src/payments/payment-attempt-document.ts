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
export type StripePaymentIntentStatus = "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled";
export type StripeCheckoutSessionStatus = "open" | "complete" | "expired";
export type PayPalOrderStatus = "CREATED" | "PAYER_ACTION_REQUIRED" | "APPROVED" | "COMPLETED" | "VOIDED";
export type ProviderPaymentStatus = StripePaymentIntentStatus | StripeCheckoutSessionStatus | PayPalOrderStatus;

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
  /** Immutable checkout totals captured before provider execution. Optional only for legacy records. */
  merchandiseSubtotalMinor?: number;
  shippingAmountMinor?: number;
  discountAmountMinor?: number;
  vatIncludedMinor?: number;
  grandTotalMinor?: number;
  shippingMethodLabelSnapshot?: string;
  idempotencyKey: string;
  providerRequestKey: string;
  provider: PaymentProvider | null;
  providerExternalId?: string;
  providerStatus?: ProviderPaymentStatus;
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
