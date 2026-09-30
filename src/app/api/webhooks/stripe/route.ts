import Stripe from "stripe";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import { finalizeTrustedPayment } from "@/server/payments/finalize-payment";
import { MongoPaymentAttemptStore } from "@/server/payments/payment-attempt-store";
import { createStripeCheckoutGateway } from "@/server/payments/stripe-checkout-provider";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !webhookSecret || !signature) return new Response("Stripe webhook is not configured", { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try { event = new Stripe(secret).webhooks.constructEvent(body, signature, webhookSecret); } catch { return new Response("Invalid Stripe signature", { status: 400 }); }
  if (!event.type.startsWith("checkout.session.")) return Response.json({ received: true });
  const raw = event.data.object as Stripe.Checkout.Session;
  if (!raw.id) return new Response("Invalid Stripe session", { status: 400 });
  const store = new MongoPaymentAttemptStore();
  const attempt = await store.readByProviderExternalIdAnyOwner("stripe", raw.id);
  if (!attempt) return new Response("Payment attempt not found", { status: 404 });
  const session = await createStripeCheckoutGateway(secret).retrieveSession(raw.id);
  if (session.paymentStatus !== "paid" || session.amountTotal !== attempt.amountMinor || session.currency !== attempt.currency.toLowerCase() || session.metadata.paymentAttemptId !== attempt.paymentAttemptId || session.metadata.checkoutId !== attempt.checkoutId) return new Response("Stripe payment did not match attempt", { status: 409 });
  const owner: CommerceOwner = { ownerType: attempt.ownerType, ownerId: attempt.ownerId };
  const stored = await store.markProviderSucceeded(owner, attempt.paymentAttemptId, "stripe", raw.id, session.status);
  if (!stored && attempt.status !== "succeeded") return new Response("Payment attempt could not be finalized", { status: 409 });
  const finalized = await finalizeTrustedPayment(owner, stored ?? attempt);
  if (!finalized) return new Response("Stripe payment verified but order finalization failed", { status: 409 });
  return Response.json({ received: true });
}
