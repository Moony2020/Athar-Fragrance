import assert from "node:assert/strict";
import test from "node:test";

import type { OrderDocument } from "../src/orders/order-document";
import { toCustomerOrderReadModel } from "../src/orders/customer-order-read-model";
import { guestOrderAccessSessionTtlMs, genericOrderAccessMessage } from "../src/server/orders/guest-order-access-document";
import { fixedOrderLookupWindow, hashGuestOrderAccessSession, hmacOrderLookupIdentifier } from "../src/server/orders/guest-order-access-store";
import { lookupGuestOrder, readGuestOrderFromSession } from "../src/server/orders/guest-order-access-service";
import { MongoOrderStore } from "../src/server/orders/order-store";

const order = (overrides: Partial<OrderDocument> = {}): OrderDocument => ({
  orderId: "ATH-ABCDEF123456", paymentAttemptId: "payment-attempt-internal", checkoutId: "checkout-internal",
  ownerType: "guest", ownerId: "owner-internal", provider: "stripe", providerExternalId: "provider-internal",
  status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "pending", createdAt: new Date("2026-10-03T00:00:00.000Z"),
  contact: { email: "guest@example.invalid" }, shippingAddress: { firstName: "Guest", lastName: "Customer", addressLine1: "1 Main Street", postalCode: "12345", city: "Örebro", countryCode: "SE" },
  lines: [{ productSlug: "test", variantId: "v1", productName: "Test fragrance", brandName: "ATHAR", sizeMl: 50, mediaSrc: null, quantity: 1, priceMinor: 10000, subtotalMinor: 10000, currency: "SEK" }],
  subtotalMinor: 10000, totalMinor: 10000, currency: "SEK", merchandiseSubtotalMinor: 10000, shippingAmountMinor: 0, discountAmountMinor: 0, vatIncludedMinor: 2000, grandTotalMinor: 10000, shippingMethodId: "postnord", shippingMethodLabelSnapshot: "PostNord", ...overrides,
});

test("Stage 9.5 customer Order model uses only customer-safe persisted snapshots", () => {
  const model = toCustomerOrderReadModel(order());
  assert.deepEqual(Object.keys(model).sort(), ["contact", "createdAt", "fulfillmentStatus", "lines", "orderId", "paymentStatus", "shippingAddress", "totals"]);
  const serialized = JSON.stringify(model);
  for (const forbidden of ["owner-internal", "payment-attempt-internal", "checkout-internal", "provider-internal", "ownerId", "paymentAttemptId", "providerExternalId"]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(model.totals.financialSnapshot?.grandTotalMinor, 10000);
});

test("Stage 9.5 preserves legacy Orders without inventing a financial breakdown", () => {
  const legacy = order({ merchandiseSubtotalMinor: undefined, shippingAmountMinor: undefined, discountAmountMinor: undefined, vatIncludedMinor: undefined, grandTotalMinor: undefined, shippingMethodId: undefined, shippingMethodLabelSnapshot: undefined });
  assert.equal(toCustomerOrderReadModel(legacy).totals.financialSnapshot, undefined);
});

test("Stage 9.5 authenticated detail keeps Order lookup owner-scoped", async () => {
  const queries: unknown[] = [];
  const owned = order({ ownerType: "user", ownerId: "u".repeat(32) });
  const database = async () => ({ collection: () => ({ findOne: async (query: unknown) => { queries.push(query); return query && JSON.stringify(query).includes(owned.ownerId) ? owned : null; } }) }) as never;
  const store = new MongoOrderStore(database);
  assert.equal((await store.findForOwnerByOrderId({ ownerType: "user", ownerId: owned.ownerId }, owned.orderId))?.orderId, owned.orderId);
  assert.equal(await store.findForOwnerByOrderId({ ownerType: "user", ownerId: "v".repeat(32) }, owned.orderId), null);
  assert.deepEqual(queries, [
    { orderId: owned.orderId, ownerType: "user", ownerId: owned.ownerId },
    { orderId: owned.orderId, ownerType: "user", ownerId: "v".repeat(32) },
  ]);
});

test("Stage 9.5 lookup failures share one generic result and valid lookup creates one Order session", async () => {
  const calls: string[] = [];
  const validStore = {
    async countLookupAttempt() { calls.push("rate"); return { allowed: true }; },
    async findGuestOrder() { calls.push("order"); return order(); },
    async createGuestSession(orderId: string) { calls.push(orderId); return { secret: "s".repeat(43), expiresAt: new Date(Date.now() + guestOrderAccessSessionTtlMs) }; },
    async resolveGuestSession() { return order(); },
  };
  const valid = await lookupGuestOrder({ orderId: "ath-abcdef123456", email: " GUEST@example.invalid " }, validStore);
  assert.equal(valid.ok, true); assert.deepEqual(calls, ["rate", "order", "ATH-ABCDEF123456"]);
  const missingStore = { ...validStore, async findGuestOrder() { return null; } };
  assert.deepEqual(await lookupGuestOrder({ orderId: "ATH-ABCDEF123456", email: "guest@example.invalid" }, missingStore), { ok: false });
  assert.deepEqual(await lookupGuestOrder({ orderId: "bad", email: "not-email" }, validStore), { ok: false });
  const read = await readGuestOrderFromSession("s".repeat(43), validStore);
  assert.equal(read?.orderId, "ATH-ABCDEF123456");
  assert.equal(genericOrderAccessMessage.includes("order number"), false);
});

test("Stage 9.5 uses fixed windows and privacy-preserving HMAC/session hashes", () => {
  const secret = "test-only-order-lookup-hmac-secret-0123456789";
  assert.equal(fixedOrderLookupWindow(new Date("2026-10-03T12:14:59.999Z")).toISOString(), "2026-10-03T12:00:00.000Z");
  assert.equal(fixedOrderLookupWindow(new Date("2026-10-03T12:15:00.000Z")).toISOString(), "2026-10-03T12:15:00.000Z");
  const hmac = hmacOrderLookupIdentifier(secret, "email:guest@example.invalid");
  assert.match(hmac, /^[a-f0-9]{64}$/); assert.equal(hmac.includes("guest@example.invalid"), false);
  const sessionHash = hashGuestOrderAccessSession("s".repeat(43));
  assert.match(sessionHash, /^[a-f0-9]{64}$/); assert.notEqual(sessionHash, "s".repeat(43));
});
