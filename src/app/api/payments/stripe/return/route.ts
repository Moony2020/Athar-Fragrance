import { NextResponse } from "next/server";

import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoPaymentAttemptStore } from "@/server/payments/payment-attempt-store";
import { createStripeCheckoutGateway, stripeCheckoutMatchesAttempt } from "@/server/payments/stripe-checkout-provider";

function confirmationUrl(request: Request, state: "success" | "error"): URL {
  return new URL(`/checkout/confirmation?provider=stripe&state=${state}`, request.url);
}

/** Verifies the hosted Stripe session on the server before showing payment confirmation. */
export async function GET(request: Request): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.redirect(confirmationUrl(request, "error"));
  try {
    const owner = await resolveCurrentCheckoutOwner();
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!owner || !secret) return NextResponse.redirect(confirmationUrl(request, "error"));
    const store = new MongoPaymentAttemptStore();
    const attempt = await store.readByProviderExternalId(owner, "stripe", sessionId);
    if (!attempt || attempt.status !== "provider_waiting") return NextResponse.redirect(confirmationUrl(request, "error"));
    const session = await createStripeCheckoutGateway(secret).retrieveSession(sessionId);
    if (!stripeCheckoutMatchesAttempt(session, attempt) || session.paymentStatus !== "paid") return NextResponse.redirect(confirmationUrl(request, "error"));
    const stored = await store.markProviderSucceeded(owner, attempt.paymentAttemptId, "stripe", session.id, session.status);
    return NextResponse.redirect(confirmationUrl(request, stored ? "success" : "error"));
  } catch {
    return NextResponse.redirect(confirmationUrl(request, "error"));
  }
}
