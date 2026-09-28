import "server-only";

import Stripe from "stripe";

import type { PaymentAttemptDocument, StripePaymentIntentStatus } from "@/payments/payment-attempt-document";

export type StripeIntentSnapshot = {
  id: string;
  clientSecret: string;
  status: StripePaymentIntentStatus;
  amount: number;
  currency: string;
  captureMethod: string;
  paymentMethodTypes: string[];
  metadata: Record<string, string>;
};

export type StripeGateway = {
  createPaymentIntent(input: { amount: number; currency: "sek"; capture_method: "automatic"; payment_method_types: ["card"]; metadata: Record<string, string> }, idempotencyKey: string): Promise<StripeIntentSnapshot>;
  retrievePaymentIntent(id: string): Promise<StripeIntentSnapshot>;
};

function toSafeSnapshot(intent: Stripe.PaymentIntent): StripeIntentSnapshot {
  if (!intent.client_secret) throw new Error("Stripe PaymentIntent did not include a client secret.");
  if (!isMappedStripeStatus(intent.status)) throw new Error("Stripe returned an unsupported PaymentIntent status.");
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency,
    captureMethod: intent.capture_method,
    paymentMethodTypes: [...intent.payment_method_types],
    metadata: { ...intent.metadata },
  };
}

function isMappedStripeStatus(status: string): status is StripePaymentIntentStatus {
  return ["requires_payment_method", "requires_action", "processing", "succeeded", "canceled"].includes(status);
}

export function createStripeGateway(secretKey: string): StripeGateway {
  const stripe = new Stripe(secretKey);
  return {
    async createPaymentIntent(input, idempotencyKey) {
      return toSafeSnapshot(await stripe.paymentIntents.create(input, { idempotencyKey }));
    },
    async retrievePaymentIntent(id) {
      return toSafeSnapshot(await stripe.paymentIntents.retrieve(id));
    },
  };
}

export function stripeCreateInput(attempt: PaymentAttemptDocument) {
  return {
    amount: attempt.amountMinor,
    currency: "sek" as const,
    capture_method: "automatic" as const,
    payment_method_types: ["card"] as ["card"],
    metadata: { paymentAttemptId: attempt.paymentAttemptId, checkoutId: attempt.checkoutId },
  };
}

export function stripeIntentMatchesAttempt(intent: StripeIntentSnapshot, attempt: PaymentAttemptDocument): boolean {
  return intent.amount === attempt.amountMinor
    && intent.currency === "sek"
    && intent.captureMethod === "automatic"
    && intent.paymentMethodTypes.length === 1
    && intent.paymentMethodTypes[0] === "card"
    && intent.metadata.paymentAttemptId === attempt.paymentAttemptId
    && intent.metadata.checkoutId === attempt.checkoutId;
}
