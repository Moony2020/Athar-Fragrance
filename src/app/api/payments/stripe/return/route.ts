import { NextResponse } from "next/server";

import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoPaymentAttemptStore } from "@/server/payments/payment-attempt-store";
import { createStripeCheckoutGateway, stripeCheckoutMatchesAttempt } from "@/server/payments/stripe-checkout-provider";
import { finalizeTrustedPayment } from "@/server/payments/finalize-payment";

function confirmationUrl(request: Request, state: "success" | "error", reason?: string): URL {
  const url = new URL(`/checkout/confirmation?provider=stripe&state=${state}`, request.url);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

/** Verifies the hosted Stripe session on the server before showing payment confirmation. */
export async function GET(request: Request): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.redirect(confirmationUrl(request, "error", "invalid-session"));
  try {
    const owner = await resolveCurrentCheckoutOwner();
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!owner) return NextResponse.redirect(confirmationUrl(request, "error", "missing-owner"));
    if (!secret) return NextResponse.redirect(confirmationUrl(request, "error", "missing-stripe-config"));
    const store = new MongoPaymentAttemptStore();
    const attempt = await store.readByProviderExternalId(owner, "stripe", sessionId);
    if (!attempt) return NextResponse.redirect(confirmationUrl(request, "error", "attempt-not-found"));
    if (attempt.status === "succeeded") {
      const existing = await finalizeTrustedPayment(owner, attempt);
      return NextResponse.redirect(confirmationUrl(request, existing ? "success" : "error", existing ? undefined : "order-finalization-failed"));
    }
    if (attempt.status !== "provider_waiting") return NextResponse.redirect(confirmationUrl(request, "error", "attempt-not-pending"));
    const session = await createStripeCheckoutGateway(secret).retrieveSession(sessionId);
    if (!stripeCheckoutMatchesAttempt(session, attempt)) return NextResponse.redirect(confirmationUrl(request, "error", "session-mismatch"));
    if (session.paymentStatus !== "paid") return NextResponse.redirect(confirmationUrl(request, "error", `stripe-${session.paymentStatus}`));
    const stored = await store.markProviderSucceeded(owner, attempt.paymentAttemptId, "stripe", session.id, session.status);
    if (!stored) return NextResponse.redirect(confirmationUrl(request, "error", "attempt-update-failed"));
    const order = await finalizeTrustedPayment(owner, stored);
    return NextResponse.redirect(confirmationUrl(request, order ? "success" : "error", order ? undefined : "order-finalization-failed"));
  } catch (error) {
    console.error("[athar-stripe-return] verification failed", error instanceof Error ? error.message : error);
    return NextResponse.redirect(confirmationUrl(request, "error", "verification-failed"));
  }
}
