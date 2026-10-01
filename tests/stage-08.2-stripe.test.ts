import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { MongoClient } from "mongodb";

import { userCommerceOwner } from "../src/commerce/durable-contracts";
import { createPaymentAttemptDocument, type PaymentAttemptBinding } from "../src/payments/payment-attempt-contract";
import { parsePaymentAttemptDocument } from "../src/payments/payment-attempt-parser";
import type { PaymentAttemptDocument } from "../src/payments/payment-attempt-document";
import { MongoPaymentAttemptStore } from "../src/server/payments/payment-attempt-store";
import { stripeCreateInput, stripeIntentMatchesAttempt, type StripeIntentSnapshot } from "../src/server/payments/stripe-provider";

const opaque = () => randomBytes(32).toString("base64url");
const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

function attempt(): PaymentAttemptDocument {
  const binding: PaymentAttemptBinding = {
    owner: userCommerceOwner(opaque()), checkoutId: opaque(), checkoutRevision: 2,
    reservation: { reservationId: opaque(), checkoutId: opaque(), status: "active", expiresAt: new Date("2030-01-01T00:15:00.000Z") },
    cartFingerprint: opaque(), shippingMethodId: "postnord-service-point-se",
    totals: { status: "ready", currency: "SEK", merchandiseSubtotal: 59_900, discountTotal: 0, appliedDiscounts: [], shippingTotal: 5_900, shippingMethodLabel: "PostNord", vatTotal: 13_160, grandTotal: 65_800, vatRatePercent: 25, vatIncluded: true },
  };
  return createPaymentAttemptDocument(binding, new Date("2030-01-01T00:00:00.000Z"));
}

function intentFor(document: PaymentAttemptDocument): StripeIntentSnapshot {
  return {
    id: `pi_${opaque().slice(0, 24)}`, clientSecret: `pi_${opaque().slice(0, 24)}_secret_${opaque().slice(0, 18)}`,
    status: "requires_payment_method", amount: document.amountMinor, currency: "sek", captureMethod: "automatic",
    paymentMethodTypes: ["card"], metadata: { paymentAttemptId: document.paymentAttemptId, checkoutId: document.checkoutId },
  };
}

test("Stage 8.2 derives card-only automatic-capture Stripe input from immutable PaymentAttempt data", () => {
  const document = attempt();
  assert.deepEqual(stripeCreateInput(document), {
    amount: 65_800, currency: "sek", capture_method: "automatic", payment_method_types: ["card"],
    metadata: { paymentAttemptId: document.paymentAttemptId, checkoutId: document.checkoutId },
  });
});

test("Stage 8.2 rejects a retrieved Stripe intent that does not match the local attempt", () => {
  const document = attempt();
  const valid = intentFor(document);
  assert.equal(stripeIntentMatchesAttempt(valid, document), true);
  assert.equal(stripeIntentMatchesAttempt({ ...valid, amount: valid.amount + 1 }, document), false);
  assert.equal(stripeIntentMatchesAttempt({ ...valid, captureMethod: "manual" }, document), false);
  assert.equal(stripeIntentMatchesAttempt({ ...valid, metadata: { ...valid.metadata, checkoutId: opaque() } }, document), false);
});

test("Stage 8.2 parser refuses provider state without a valid provider binding", () => {
  const document = attempt();
  assert.throws(() => parsePaymentAttemptDocument({ ...document, providerExternalId: "pi_unbound" }));
  assert.throws(() => parsePaymentAttemptDocument({ ...document, provider: "stripe" }));
});

test("Stage 8.2 Mongo binding permits one Stripe PaymentIntent and no client secret persistence", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const document = attempt();
  const intent = intentFor(document);
  try {
    await client.connect();
    const store = new MongoPaymentAttemptStore(async () => database);
    await database.collection<PaymentAttemptDocument>("payment_attempts").createIndexes([
      { key: { paymentAttemptId: 1 }, name: "payment_attempt_public_id_unique", unique: true },
      { key: { ownerType: 1, ownerId: 1, checkoutId: 1, idempotencyKey: 1 }, name: "payment_attempt_checkout_idempotency_unique", unique: true },
    ]);
    await store.createOrRead(document);
    const bound = await store.bindStripePaymentIntent({ ownerType: document.ownerType, ownerId: document.ownerId }, document.paymentAttemptId, intent.id, intent.status);
    assert.equal(bound?.provider, "stripe");
    assert.equal(bound?.providerExternalId, intent.id);
    assert.equal(JSON.stringify(bound).includes(intent.clientSecret), false);
    const substituted = await store.bindStripePaymentIntent({ ownerType: document.ownerType, ownerId: document.ownerId }, document.paymentAttemptId, `pi_${opaque().slice(0, 24)}`, intent.status);
    assert.equal(substituted, null);
  } finally {
    await database.collection<PaymentAttemptDocument>("payment_attempts").deleteMany({ paymentAttemptId: document.paymentAttemptId }).catch(() => undefined);
    assert.equal(await database.collection<PaymentAttemptDocument>("payment_attempts").countDocuments({ paymentAttemptId: document.paymentAttemptId }), 0);
    await client.close().catch(() => undefined);
  }
});
