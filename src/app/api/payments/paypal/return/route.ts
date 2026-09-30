import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoPaymentAttemptStore } from "@/server/payments/payment-attempt-store";
import { createPayPalGateway, paypalOrderMatchesAttempt } from "@/server/payments/paypal-provider";
import { finalizeTrustedPayment } from "@/server/payments/finalize-payment";

import { resolvePublicAppOrigin } from "@/server/payments/public-app-origin";

function checkoutUrl(request: Request, state: "success" | "cancelled" | "error"): URL {
  const origin = resolvePublicAppOrigin();
  return state === "success"
    ? new URL("/checkout/confirmation?provider=paypal&state=success", origin)
    : new URL(`/checkout?payment=paypal-${state}`, origin);
}

/** PayPal returns here after hosted approval; capture remains server-authoritative. */
export async function GET(request: Request): Promise<Response> {
  const orderId = new URL(request.url).searchParams.get("token");
  if (!orderId || !/^[A-Za-z0-9_-]{3,255}$/.test(orderId)) return NextResponse.redirect(checkoutUrl(request, "error"));
  try {
    const owner = await resolveCurrentCheckoutOwner();
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!owner || !clientId || !clientSecret) return NextResponse.redirect(checkoutUrl(request, "error"));
    const store = new MongoPaymentAttemptStore();
    const attempt = await store.readByProviderExternalId(owner, "paypal", orderId);
    if (!attempt) return NextResponse.redirect(checkoutUrl(request, "error"));
    if (attempt.status === "succeeded") {
      const existing = await finalizeTrustedPayment(owner, attempt);
      return NextResponse.redirect(checkoutUrl(request, existing ? "success" : "error"));
    }
    if (attempt.status !== "provider_waiting") return NextResponse.redirect(checkoutUrl(request, "error"));
    const captureKey = createHash("sha256").update(`${attempt.providerRequestKey}:capture`).digest("base64url");
    const order = await createPayPalGateway(clientId, clientSecret).captureOrder(orderId, captureKey);
    if (!paypalOrderMatchesAttempt(order, attempt) || order.status !== "COMPLETED") return NextResponse.redirect(checkoutUrl(request, "error"));
    const stored = await store.markProviderSucceeded(owner, attempt.paymentAttemptId, "paypal", order.id, order.status);
    if (!stored) return NextResponse.redirect(checkoutUrl(request, "error"));
    const finalized = await finalizeTrustedPayment(owner, stored);
    return NextResponse.redirect(checkoutUrl(request, finalized ? "success" : "error"));
  } catch {
    return NextResponse.redirect(checkoutUrl(request, "error"));
  }
}
