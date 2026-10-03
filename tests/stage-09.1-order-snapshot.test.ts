import assert from "node:assert/strict";
import test from "node:test";

import { parseOrderFinancialSnapshot, type OrderDocument } from "../src/orders/order-document";
import { createPaymentAttemptDocument, type PaymentAttemptBinding } from "../src/payments/payment-attempt-contract";
import { parsePaymentAttemptDocument } from "../src/payments/payment-attempt-parser";
import { userCommerceOwner } from "../src/commerce/durable-contracts";
import { MongoOrderStore } from "../src/server/orders/order-store";

const binding = (): PaymentAttemptBinding => ({
  owner: userCommerceOwner("a".repeat(32)),
  checkoutId: "b".repeat(32),
  checkoutRevision: 1,
  reservation: { reservationId: "c".repeat(32), checkoutId: "b".repeat(32), status: "active", expiresAt: new Date("2030-01-01T00:15:00.000Z") },
  cartFingerprint: "d".repeat(32),
  totals: {
    status: "ready", currency: "SEK", merchandiseSubtotal: 59_900, discountTotal: 0, appliedDiscounts: [],
    shippingTotal: 5_900, shippingMethodLabel: "PostNord", vatTotal: 13_160, grandTotal: 65_800,
    vatRatePercent: 25, vatIncluded: true,
  },
  shippingMethodId: "postnord-service-point-se",
});

test("Stage 9.1 captures the complete trusted financial snapshot on a new PaymentAttempt", () => {
  const attempt = parsePaymentAttemptDocument(createPaymentAttemptDocument(binding()));
  assert.deepEqual({
    merchandiseSubtotalMinor: attempt.merchandiseSubtotalMinor,
    shippingAmountMinor: attempt.shippingAmountMinor,
    discountAmountMinor: attempt.discountAmountMinor,
    vatIncludedMinor: attempt.vatIncludedMinor,
    grandTotalMinor: attempt.grandTotalMinor,
    shippingMethodLabelSnapshot: attempt.shippingMethodLabelSnapshot,
  }, {
    merchandiseSubtotalMinor: 59_900,
    shippingAmountMinor: 5_900,
    discountAmountMinor: 0,
    vatIncludedMinor: 13_160,
    grandTotalMinor: 65_800,
    shippingMethodLabelSnapshot: "PostNord",
  });
});

test("Stage 9.1 validates integer SEK snapshot consistency and rejects tampering", () => {
  const attempt = createPaymentAttemptDocument(binding());
  assert.throws(() => parsePaymentAttemptDocument({ ...attempt, vatIncludedMinor: 1.5 }));
  assert.throws(() => parsePaymentAttemptDocument({ ...attempt, grandTotalMinor: 65_801 }));
  assert.throws(() => parsePaymentAttemptDocument({ ...attempt, merchandiseSubtotalMinor: 1, shippingAmountMinor: 1 }));
});

test("Stage 9.1 accepts a complete Order snapshot without deriving values", () => {
  const order = {
    currency: "SEK",
    merchandiseSubtotalMinor: 59_900,
    shippingAmountMinor: 5_900,
    discountAmountMinor: 0,
    vatIncludedMinor: 13_160,
    grandTotalMinor: 65_800,
    shippingMethodId: "postnord-service-point-se",
    shippingMethodLabelSnapshot: "PostNord",
  } as Pick<OrderDocument, "currency" | "merchandiseSubtotalMinor" | "shippingAmountMinor" | "discountAmountMinor" | "vatIncludedMinor" | "grandTotalMinor" | "shippingMethodId" | "shippingMethodLabelSnapshot">;
  assert.deepEqual(parseOrderFinancialSnapshot(order), order);
});

test("Stage 9.1 preserves legacy Orders without fabricating financial history", () => {
  const legacy = {
    currency: "SEK", shippingMethodId: "postnord-service-point-se",
  } as Pick<OrderDocument, "currency" | "shippingMethodId">;
  assert.equal(parseOrderFinancialSnapshot(legacy), undefined);
  assert.throws(() => parseOrderFinancialSnapshot({ ...legacy, grandTotalMinor: 65_800 } as Pick<OrderDocument, "currency" | "grandTotalMinor" | "shippingMethodId">));
});

test("Stage 9.1 replay reuses an existing Order without rewriting its snapshot", async () => {
  const existing = {
    orderId: "ATH-ABCDEF123456",
    paymentAttemptId: "attempt-1",
    ownerType: "guest" as const,
    ownerId: "guest-1",
    provider: "paypal" as const,
    providerExternalId: "paypal-order-1",
    status: "confirmed" as const,
    paymentStatus: "paid" as const,
    fulfillmentStatus: "pending" as const,
    lines: [{ productSlug: "cedar-study", variantId: "variant-75", quantity: 1, priceMinor: 59_900, subtotalMinor: 59_900, currency: "SEK", productName: "BOSS Bottled", brandName: "HUGO BOSS", sizeMl: 75, mediaSrc: "/images/catalog/cedar-study-v1.webp", imageSnapshot: { src: "/images/catalog/cedar-study-v1.webp", alt: "BOSS Bottled front view" } }], subtotalMinor: 59_900, totalMinor: 65_800, currency: "SEK",
    merchandiseSubtotalMinor: 59_900, shippingAmountMinor: 5_900, discountAmountMinor: 0,
    vatIncludedMinor: 13_160, grandTotalMinor: 65_800,
    shippingMethodId: "postnord-service-point-se", shippingMethodLabelSnapshot: "PostNord",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
  } satisfies OrderDocument;
  const collection = { findOne: async () => existing };
  const database = async () => ({ collection: () => collection }) as unknown as import("mongodb").Db;
  const attempt = { ...createPaymentAttemptDocument(binding()), paymentAttemptId: "attempt-1", provider: "paypal" as const, providerExternalId: "paypal-order-1", status: "succeeded" as const };
  const previousPersistence = process.env.ATHAR_COMMERCE_PERSISTENCE;
  process.env.ATHAR_COMMERCE_PERSISTENCE = "ephemeral";
  try {
    const result = await new MongoOrderStore(database).finalizePayment({ ownerType: "guest", ownerId: "guest-1" }, attempt);
    assert.strictEqual(result, existing);
    assert.deepEqual(result.lines[0]?.imageSnapshot, { src: "/images/catalog/cedar-study-v1.webp", alt: "BOSS Bottled front view" });
  } finally {
    if (previousPersistence === undefined) delete process.env.ATHAR_COMMERCE_PERSISTENCE;
    else process.env.ATHAR_COMMERCE_PERSISTENCE = previousPersistence;
  }
});
