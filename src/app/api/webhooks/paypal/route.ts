import type { CommerceOwner } from "@/commerce/durable-contracts";
import { finalizeTrustedPayment } from "@/server/payments/finalize-payment";
import { MongoPaymentAttemptStore } from "@/server/payments/payment-attempt-store";
import { createPayPalGateway, paypalOrderMatchesAttempt } from "@/server/payments/paypal-provider";

function apiBase() { return process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"; }

async function accessToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  const body = await response.json().catch(() => null) as { access_token?: unknown } | null;
  if (!response.ok || typeof body?.access_token !== "string") throw new Error("PayPal authentication failed");
  return body.access_token;
}

export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");
  if (!clientId || !clientSecret || !webhookId || !transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return new Response("PayPal webhook is not configured", { status: 400 });
  const body = await request.text();
  let event: { event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };
  try { event = JSON.parse(body) as typeof event; } catch { return new Response("Invalid PayPal event", { status: 400 }); }
  const token = await accessToken(clientId, clientSecret);
  const verify = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId, transmission_sig: transmissionSig, transmission_time: transmissionTime, webhook_id: webhookId, webhook_event: JSON.parse(body) }), cache: "no-store" });
  const verification = await verify.json().catch(() => null) as { verification_status?: unknown } | null;
  if (!verify.ok || verification?.verification_status !== "SUCCESS") return new Response("Invalid PayPal signature", { status: 400 });
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return Response.json({ received: true });
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (!orderId) return new Response("PayPal order id missing", { status: 400 });
  const store = new MongoPaymentAttemptStore();
  const attempt = await store.readByProviderExternalIdAnyOwner("paypal", orderId);
  if (!attempt) return new Response("Payment attempt not found", { status: 404 });
  const order = await createPayPalGateway(clientId, clientSecret).retrieveOrder(orderId);
  if (order.status !== "COMPLETED" || !paypalOrderMatchesAttempt(order, attempt)) return new Response("PayPal payment did not match attempt", { status: 409 });
  const owner: CommerceOwner = { ownerType: attempt.ownerType, ownerId: attempt.ownerId };
  const stored = await store.markProviderSucceeded(owner, attempt.paymentAttemptId, "paypal", orderId, order.status);
  if (!stored && attempt.status !== "succeeded") return new Response("Payment attempt could not be finalized", { status: 409 });
  const finalized = await finalizeTrustedPayment(owner, stored ?? attempt);
  if (!finalized) return new Response("PayPal payment verified but order finalization failed", { status: 409 });
  return Response.json({ received: true });
}
