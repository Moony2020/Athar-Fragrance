import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { getDatabase, getMongoClient } from "../src/server/db/mongodb";
import { databaseCollections } from "../src/server/db/collections";
import { ensureEmailDeliveryIndexes } from "../src/server/db/indexes";
import { MongoEmailDeliveryStore } from "../src/server/email/email-delivery-store";
import type { OrderDocument } from "../src/orders/order-document";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

const order = (orderId: string): OrderDocument => ({
  orderId, paymentAttemptId: `attempt-${randomUUID()}`, checkoutId: `checkout-${randomUUID()}`,
  ownerType: "guest", ownerId: `guest-${randomUUID()}`, provider: "paypal", providerExternalId: "provider-test",
  status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "pending", contact: { email: "guest@example.invalid" },
  lines: [{ productSlug: "test", variantId: "v1", quantity: 1, priceMinor: 100, subtotalMinor: 100, currency: "SEK", productName: "Test", brandName: "ATHAR", sizeMl: 50, mediaSrc: null }],
  subtotalMinor: 100, totalMinor: 100, currency: "SEK", createdAt: new Date(),
});

test("Stage 9.4 Mongo delivery uniqueness, concurrency, claim, retry and webhook replay", { skip: !mongoReady }, async () => {
  assert.equal(process.env.MONGODB_DB_NAME, "athar_stage55_test");
  await ensureEmailDeliveryIndexes();
  const database = await getDatabase();
  const collection = database.collection(databaseCollections.emailDeliveries);
  const firstOrder = order(`ATH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`);
  const secondOrder = order(`ATH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`);
  const store = new MongoEmailDeliveryStore(() => Promise.resolve(database));
  try {
    const created = await Promise.all(Array.from({ length: 5 }, () => store.ensureForOrder(firstOrder)));
    assert.equal(new Set(created.map((value) => value.deliveryId)).size, 1);
    assert.equal(new Set(created.map((value) => value.idempotencyKey)).size, 1);
    const claimed = await Promise.all(Array.from({ length: 5 }, () => store.claim(created[0].deliveryId)));
    assert.equal(claimed.filter(Boolean).length, 1);
    const accepted = await store.markProviderAccepted(created[0].deliveryId, "brevo-message-1");
    assert.equal(accepted?.status, "provider_accepted");
    assert.equal((await store.applyProviderEvent({ providerMessageId: "brevo-message-1", status: "delivered" }))?.status, "delivered");
    assert.equal((await store.applyProviderEvent({ providerMessageId: "brevo-message-1", status: "opened" }))?.status, "delivered");
    const retry = await store.ensureForOrder(secondOrder);
    assert.ok(await store.claim(retry.deliveryId));
    const retryable = await store.markFailure(retry.deliveryId, "temporary");
    assert.equal(retryable?.status, "retryable_failure");
    assert.equal((await store.claim(retry.deliveryId, new Date(Date.now() + 120_000)))?.status, "sending");
    const permanent = await store.markFailure(retry.deliveryId, "permanent");
    assert.equal(permanent?.status, "permanent_failure");
    assert.equal(await store.claim(retry.deliveryId), null);
  } finally {
    await collection.deleteMany({ orderId: { $in: [firstOrder.orderId, secondOrder.orderId] } });
    await (await getMongoClient()).close();
  }
});
