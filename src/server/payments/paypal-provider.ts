import "server-only";

import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";

export type PayPalOrderSnapshot = {
  id: string;
  status: "CREATED" | "PAYER_ACTION_REQUIRED" | "APPROVED" | "COMPLETED" | "VOIDED";
  intent: "CAPTURE";
  amountMinor: number;
  currency: "SEK";
  customId: string | null;
  approvalUrl: string | null;
};

export type PayPalGateway = {
  createOrder(input: { attempt: PaymentAttemptDocument; returnUrl: string; cancelUrl: string }, requestId: string): Promise<PayPalOrderSnapshot>;
  retrieveOrder(orderId: string): Promise<PayPalOrderSnapshot>;
  captureOrder(orderId: string, requestId: string): Promise<PayPalOrderSnapshot>;
};

function apiBase(): string {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function money(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

function fromResponse(raw: unknown): PayPalOrderSnapshot {
  if (!raw || typeof raw !== "object") throw new Error("PayPal returned an invalid order.");
  const order = raw as { id?: unknown; status?: unknown; intent?: unknown; links?: Array<{ rel?: unknown; href?: unknown }>; purchase_units?: Array<{ custom_id?: unknown; amount?: { value?: unknown; currency_code?: unknown } }> };
  const value = order.purchase_units?.[0]?.amount?.value;
  const currency = order.purchase_units?.[0]?.amount?.currency_code;
  if (typeof order.id !== "string" || !["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED", "COMPLETED", "VOIDED"].includes(String(order.status)) || order.intent !== "CAPTURE" || typeof value !== "string" || currency !== "SEK") throw new Error("PayPal order did not match ATHAR payment policy.");
  const [whole, fraction = ""] = value.split(".");
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) throw new Error("PayPal returned an invalid amount.");
  const approval = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
  return { id: order.id, status: order.status as PayPalOrderSnapshot["status"], intent: "CAPTURE", amountMinor: Number(whole) * 100 + Number(fraction.padEnd(2, "0")), currency: "SEK", customId: typeof order.purchase_units?.[0]?.custom_id === "string" ? order.purchase_units[0].custom_id : null, approvalUrl: typeof approval === "string" ? approval : null };
}

export function createPayPalGateway(clientId: string, clientSecret: string): PayPalGateway {
  async function token(): Promise<string> {
    const response = await fetch(`${apiBase()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
    const body = await response.json().catch(() => null) as { access_token?: unknown } | null;
    if (!response.ok || typeof body?.access_token !== "string") throw new Error("PayPal authentication failed.");
    return body.access_token;
  }
  async function request(path: string, method: "GET" | "POST", requestId?: string, body?: object): Promise<PayPalOrderSnapshot> {
    const response = await fetch(`${apiBase()}${path}`, { method, cache: "no-store", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId } : {}), Prefer: "return=representation" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("PayPal request failed.");
    return fromResponse(await response.json());
  }
  return {
    createOrder: async ({ attempt, returnUrl, cancelUrl }, requestId) => request("/v2/checkout/orders", "POST", requestId, { intent: "CAPTURE", purchase_units: [{ reference_id: attempt.paymentAttemptId, custom_id: attempt.paymentAttemptId, description: "ATHAR fragrance order", amount: { currency_code: "SEK", value: money(attempt.amountMinor) } }], application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" } }),
    retrieveOrder: async (orderId) => request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, "GET"),
    captureOrder: async (orderId, requestId) => request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, "POST", requestId),
  };
}

export function paypalOrderMatchesAttempt(order: PayPalOrderSnapshot, attempt: PaymentAttemptDocument): boolean {
  return order.intent === "CAPTURE" && order.amountMinor === attempt.amountMinor && order.currency === attempt.currency && order.customId === attempt.paymentAttemptId;
}
