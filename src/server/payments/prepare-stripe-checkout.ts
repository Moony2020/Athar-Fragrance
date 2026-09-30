import "server-only";

import { headers } from "next/headers";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoCheckoutDraftStore } from "@/server/checkout/draft-store";
import { MongoPaymentAttemptStore } from "./payment-attempt-store";
import { preparePaymentAttempt } from "./prepare-payment-attempt";
import { createStripeCheckoutGateway, stripeCheckoutInput, stripeCheckoutMatchesAttempt, type StripeCheckoutGateway } from "./stripe-checkout-provider";

export type PrepareStripeCheckoutResult =
  | { status: "ready"; paymentAttemptId: string; url: string }
  | { status: "blocked" | "expired" | "unavailable" };

function stripeSecretKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value || null;
}

async function requestOrigin(): Promise<string | null> {
  const origin = (await headers()).get("origin");
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Opens Stripe-hosted Checkout. Card details and cardholder name never enter ATHAR. */
export async function prepareStripeCheckout(rawCheckoutId: unknown, dependencies: { gateway?: StripeCheckoutGateway; origin?: string; now?: Date } = {}): Promise<PrepareStripeCheckoutResult> {
  const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
  if (!checkoutId.success) return { status: "blocked" };
  const now = dependencies.now ?? new Date();
  const origin = dependencies.origin ?? await requestOrigin();
  if (!origin) return { status: "unavailable" };
  const prepared = await preparePaymentAttempt(checkoutId.data, "stripe", now);
  if (prepared.status !== "created") return prepared;

  try {
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "blocked" };
    const store = new MongoPaymentAttemptStore();
    const attempt = await store.readCurrent(owner, prepared.attempt.paymentAttemptId);
    if (!attempt || !["local_created", "provider_waiting"].includes(attempt.status) || (attempt.provider && attempt.provider !== "stripe")) return { status: "blocked" };
    const gateway = dependencies.gateway ?? (() => {
      const secret = stripeSecretKey();
      if (!secret) throw new Error("Stripe is not configured.");
      return createStripeCheckoutGateway(secret);
    })();
    const draft = await new MongoCheckoutDraftStore().get(owner, checkoutId.data);
    const session = attempt.providerExternalId
      ? await gateway.retrieveSession(attempt.providerExternalId)
      : await gateway.createSession(stripeCheckoutInput({ attempt, origin, customerEmail: draft?.contact?.email }), attempt.providerRequestKey);
    if (!stripeCheckoutMatchesAttempt(session, attempt) || session.status !== "open" || !session.url) return { status: "blocked" };
    const bound = await store.bindProviderOperation(owner, attempt.paymentAttemptId, "stripe", session.id, session.status, now);
    if (!bound || bound.providerExternalId !== session.id) return { status: "blocked" };
    return { status: "ready", paymentAttemptId: bound.paymentAttemptId, url: session.url };
  } catch {
    return { status: "unavailable" };
  }
}
