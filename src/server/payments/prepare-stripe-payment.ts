import "server-only";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { preparePaymentAttempt } from "./prepare-payment-attempt";
import { MongoPaymentAttemptStore } from "./payment-attempt-store";
import { createStripeGateway, stripeCreateInput, stripeIntentMatchesAttempt, type StripeGateway } from "./stripe-provider";

export type PrepareStripePaymentResult =
  | { status: "ready"; paymentAttemptId: string; clientSecret: string }
  | { status: "blocked" | "expired" | "unavailable" };

function stripeSecretKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value ? value : null;
}

/**
 * Creates or recovers exactly one card-only automatic-capture PaymentIntent.
 * The browser supplies no amount, currency, intent ID, provider state, or key.
 */
export async function prepareStripePayment(rawCheckoutId: unknown, dependencies: { gateway?: StripeGateway; now?: Date } = {}): Promise<PrepareStripePaymentResult> {
  const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
  if (!checkoutId.success) return { status: "blocked" };
  const now = dependencies.now ?? new Date();
  const prepared = await preparePaymentAttempt(checkoutId.data, "stripe", now);
  if (prepared.status !== "created") return prepared;

  try {
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "blocked" };
    const store = new MongoPaymentAttemptStore();
    const attempt = await store.readCurrent(owner, prepared.attempt.paymentAttemptId);
    if (!attempt || attempt.status !== "local_created") return { status: "blocked" };

    const gateway = dependencies.gateway ?? (() => {
      const secret = stripeSecretKey();
      if (!secret) throw new Error("Stripe is not configured.");
      return createStripeGateway(secret);
    })();
    const intent = attempt.provider === "stripe" && attempt.providerExternalId
      ? await gateway.retrievePaymentIntent(attempt.providerExternalId)
      : await gateway.createPaymentIntent(stripeCreateInput(attempt), attempt.providerRequestKey);
    if (!stripeIntentMatchesAttempt(intent, attempt)) return { status: "blocked" };
    const bound = await store.bindStripePaymentIntent(owner, attempt.paymentAttemptId, intent.id, intent.status, now);
    if (!bound || bound.providerExternalId !== intent.id) return { status: "blocked" };
    return { status: "ready", paymentAttemptId: bound.paymentAttemptId, clientSecret: intent.clientSecret };
  } catch {
    // Never disclose Stripe configuration/provider errors or client secrets.
    return { status: "unavailable" };
  }
}
