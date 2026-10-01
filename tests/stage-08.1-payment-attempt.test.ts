import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { MongoClient } from "mongodb";

import { userCommerceOwner } from "../src/commerce/durable-contracts";
import { createPaymentAttemptDocument, paymentAttemptIdempotencyKey, type PaymentAttemptBinding } from "../src/payments/payment-attempt-contract";
import { parsePaymentAttemptDocument } from "../src/payments/payment-attempt-parser";
import { toPaymentAttemptPublic, type PaymentAttemptDocument } from "../src/payments/payment-attempt-document";
import { MongoPaymentAttemptStore } from "../src/server/payments/payment-attempt-store";

const opaque = () => randomBytes(32).toString("base64url");
const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

function binding(overrides: Partial<PaymentAttemptBinding> = {}): PaymentAttemptBinding {
  return {
    owner: userCommerceOwner(opaque()),
    checkoutId: opaque(),
    checkoutRevision: 3,
    reservation: { reservationId: opaque(), checkoutId: opaque(), status: "active", expiresAt: new Date("2030-01-01T00:15:00.000Z") },
    cartFingerprint: opaque(),
    totals: {
      status: "ready", currency: "SEK", merchandiseSubtotal: 59_900, discountTotal: 0, appliedDiscounts: [], shippingTotal: 5_900,
      shippingMethodLabel: "PostNord", vatTotal: 13_160, grandTotal: 65_800, vatRatePercent: 25, vatIncluded: true,
    },
    shippingMethodId: "postnord-service-point-se",
    ...overrides,
  };
}

test("Stage 8.1 payment attempts use opaque public IDs and immutable SEK minor-unit bindings", () => {
  const input = binding();
  const document = createPaymentAttemptDocument(input, new Date("2030-01-01T00:00:00.000Z"));
  const parsed = parsePaymentAttemptDocument(document);
  const publicAttempt = toPaymentAttemptPublic(parsed);

  assert.equal(parsed.amountMinor, 65_800);
  assert.equal(parsed.currency, "SEK");
  assert.equal(parsed.provider, null);
  assert.equal(parsed.status, "local_created");
  assert.match(publicAttempt.paymentAttemptId, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(JSON.stringify(publicAttempt).includes("_id"), false);
  assert.equal(JSON.stringify(publicAttempt).includes("ownerId"), false);
  assert.equal(JSON.stringify(publicAttempt).includes("providerRequestKey"), false);
  assert.equal(JSON.stringify(publicAttempt).includes("idempotencyKey"), false);
});

test("Stage 8.1 idempotency is stable only for the same canonical checkout binding", () => {
  const current = binding();
  const retry = { ...current, reservation: { ...current.reservation } };
  assert.equal(paymentAttemptIdempotencyKey(current), paymentAttemptIdempotencyKey(retry));
  assert.notEqual(paymentAttemptIdempotencyKey(current), paymentAttemptIdempotencyKey({ ...current, checkoutRevision: current.checkoutRevision + 1 }));
  assert.notEqual(paymentAttemptIdempotencyKey(current), paymentAttemptIdempotencyKey({ ...current, cartFingerprint: opaque() }));
  assert.notEqual(paymentAttemptIdempotencyKey(current), paymentAttemptIdempotencyKey({ ...current, totals: { ...current.totals, grandTotal: 65_900 } }));
});

test("Stage 8.1 parser rejects browser-shaped tampering, provider identifiers, and unsafe money", () => {
  const document = createPaymentAttemptDocument(binding());
  assert.throws(() => parsePaymentAttemptDocument({ ...document, amountMinor: 65_800.5 }));
  assert.throws(() => parsePaymentAttemptDocument({ ...document, currency: "EUR" }));
  assert.throws(() => parsePaymentAttemptDocument({ ...document, providerPaymentIntentId: "pi_not_allowed" }));
  assert.throws(() => parsePaymentAttemptDocument({ ...document, cardNumber: "not-allowed" }));
});

test("Stage 8.1 Mongo repository is durable, concurrent-idempotent, and cleanup scoped", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const attempts = database.collection<PaymentAttemptDocument>("payment_attempts");
  const document = createPaymentAttemptDocument(binding());
  try {
    await client.connect();
    await attempts.createIndexes([
      { key: { paymentAttemptId: 1 }, name: "payment_attempt_public_id_unique", unique: true },
      { key: { ownerType: 1, ownerId: 1, checkoutId: 1, idempotencyKey: 1 }, name: "payment_attempt_checkout_idempotency_unique", unique: true },
    ]);
    const store = new MongoPaymentAttemptStore(async () => database);
    const results = await Promise.all([store.createOrRead(document), store.createOrRead(document)]);
    assert.equal(results.filter((result) => !result.idempotent).length, 1);
    assert.equal(results.filter((result) => result.idempotent).length, 1);
    assert.equal(await attempts.countDocuments({ paymentAttemptId: document.paymentAttemptId }), 1);
    await store.supersedeIncompatible({ ownerType: document.ownerType, ownerId: document.ownerId }, document.checkoutId, "another-binding");
    assert.equal((await attempts.findOne({ paymentAttemptId: document.paymentAttemptId }))?.status, "superseded");
  } finally {
    await attempts.deleteMany({ paymentAttemptId: document.paymentAttemptId }).catch(() => undefined);
    assert.equal(await attempts.countDocuments({ paymentAttemptId: document.paymentAttemptId }), 0);
    await client.close().catch(() => undefined);
  }
});
