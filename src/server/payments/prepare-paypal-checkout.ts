import "server-only";

import { headers } from "next/headers";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoPaymentAttemptStore } from "./payment-attempt-store";
import { createPayPalGateway, paypalOrderMatchesAttempt, type PayPalGateway } from "./paypal-provider";
import { preparePaymentAttempt } from "./prepare-payment-attempt";

export type PreparePayPalCheckoutResult =
  | { status: "ready"; paymentAttemptId: string; url: string }
  | { status: "blocked" | "expired" | "unavailable" };

async function requestOrigin(): Promise<string | null> {
  const origin = (await headers()).get("origin");
  try { const url = origin ? new URL(origin) : null; return url && (url.protocol === "https:" || url.hostname === "localhost") ? url.origin : null; } catch { return null; }
}

function configuredAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Creates a server-authoritative PayPal Order with immediate CAPTURE intent. */
export async function preparePayPalCheckout(rawCheckoutId: unknown, dependencies: { gateway?: PayPalGateway; origin?: string; now?: Date } = {}): Promise<PreparePayPalCheckoutResult> {
  const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
  if (!checkoutId.success) return { status: "blocked" };
  // Prefer the canonical deployment URL so provider redirects never point at
  // Render's internal listener (for example localhost:10000). Tests can still
  // inject an origin explicitly, while local development falls back to the
  // browser origin when no app URL is configured.
  const origin = dependencies.origin ?? configuredAppOrigin() ?? await requestOrigin();
  if (!origin) return { status: "unavailable" };
  const now = dependencies.now ?? new Date();
  const prepared = await preparePaymentAttempt(checkoutId.data, "paypal", now);
  if (prepared.status !== "created") return prepared;
  try {
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "blocked" };
    const attempt = await new MongoPaymentAttemptStore().readCurrent(owner, prepared.attempt.paymentAttemptId);
    if (!attempt || !["local_created", "provider_waiting"].includes(attempt.status) || (attempt.provider && attempt.provider !== "paypal")) return { status: "blocked" };
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim(); const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    const gateway = dependencies.gateway ?? (clientId && clientSecret ? createPayPalGateway(clientId, clientSecret) : null);
    if (!gateway) return { status: "unavailable" };
    const order = attempt.providerExternalId
      ? await gateway.retrieveOrder(attempt.providerExternalId)
      : await gateway.createOrder({ attempt, returnUrl: `${origin}/api/payments/paypal/return`, cancelUrl: `${origin}/checkout?payment=paypal-cancelled` }, attempt.providerRequestKey);
    if (!order || !paypalOrderMatchesAttempt(order, attempt) || !order.approvalUrl) return { status: "blocked" };
    const bound = await new MongoPaymentAttemptStore().bindProviderOperation(owner, attempt.paymentAttemptId, "paypal", order.id, order.status, now);
    return bound && bound.providerExternalId === order.id ? { status: "ready", paymentAttemptId: bound.paymentAttemptId, url: order.approvalUrl } : { status: "blocked" };
  } catch { return { status: "unavailable" }; }
}
