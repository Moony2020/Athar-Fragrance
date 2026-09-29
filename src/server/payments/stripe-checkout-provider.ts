import "server-only";

import Stripe from "stripe";

import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";

export type StripeCheckoutSessionSnapshot = {
  id: string;
  url: string;
  status: "open" | "complete" | "expired";
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  metadata: Record<string, string>;
};

export type StripeCheckoutGateway = {
  createSession(input: Stripe.Checkout.SessionCreateParams, idempotencyKey: string): Promise<StripeCheckoutSessionSnapshot>;
  retrieveSession(id: string): Promise<StripeCheckoutSessionSnapshot>;
};

function toSnapshot(session: Stripe.Checkout.Session): StripeCheckoutSessionSnapshot {
  if (!session.url || !["open", "complete", "expired"].includes(session.status ?? "") || !["paid", "unpaid", "no_payment_required"].includes(session.payment_status)) {
    throw new Error("Stripe Checkout did not return a usable session.");
  }
  return {
    id: session.id,
    url: session.url,
    status: session.status as StripeCheckoutSessionSnapshot["status"],
    amountTotal: session.amount_total,
    currency: session.currency,
    paymentStatus: session.payment_status as StripeCheckoutSessionSnapshot["paymentStatus"],
    metadata: { ...session.metadata },
  };
}

export function createStripeCheckoutGateway(secretKey: string): StripeCheckoutGateway {
  const stripe = new Stripe(secretKey);
  return {
    async createSession(input, idempotencyKey) {
      return toSnapshot(await stripe.checkout.sessions.create(input, { idempotencyKey }));
    },
    async retrieveSession(id) {
      return toSnapshot(await stripe.checkout.sessions.retrieve(id));
    },
  };
}

export function stripeCheckoutInput(input: { attempt: PaymentAttemptDocument; origin: string; customerEmail?: string }): Stripe.Checkout.SessionCreateParams {
  const { attempt, origin, customerEmail } = input;
  return {
    mode: "payment",
    success_url: `${origin}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?payment=stripe-cancelled`,
    billing_address_collection: "required",
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    line_items: [{
      price_data: {
        currency: "sek",
        product_data: { name: "ATHAR fragrance order" },
        unit_amount: attempt.amountMinor,
      },
      quantity: 1,
    }],
    metadata: { paymentAttemptId: attempt.paymentAttemptId, checkoutId: attempt.checkoutId },
    payment_intent_data: {
      capture_method: "automatic",
      metadata: { paymentAttemptId: attempt.paymentAttemptId, checkoutId: attempt.checkoutId },
    },
  };
}

export function stripeCheckoutMatchesAttempt(session: StripeCheckoutSessionSnapshot, attempt: PaymentAttemptDocument): boolean {
  return session.amountTotal === attempt.amountMinor
    && session.currency === "sek"
    && session.metadata.paymentAttemptId === attempt.paymentAttemptId
    && session.metadata.checkoutId === attempt.checkoutId;
}
