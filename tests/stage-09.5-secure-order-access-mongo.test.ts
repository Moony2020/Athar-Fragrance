import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { getDatabase, getMongoClient } from "../src/server/db/mongodb";
import { databaseCollections } from "../src/server/db/collections";
import { ensureSecureOrderAccessIndexes } from "../src/server/db/indexes";
import { MongoSecureOrderAccessStore } from "../src/server/orders/guest-order-access-store";
import type { OrderDocument } from "../src/orders/order-document";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const testSecret = "test-only-order-lookup-hmac-secret-0123456789";
const newOrder = (orderId: string): OrderDocument => ({ orderId, paymentAttemptId: `attempt-${randomUUID()}`, checkoutId: `checkout-${randomUUID()}`, ownerType: "guest", ownerId: `guest-${randomUUID()}`, provider: "stripe", providerExternalId: "internal", status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "pending", contact: { email: "guest@example.invalid" }, lines: [], subtotalMinor: 100, totalMinor: 100, currency: "SEK", createdAt: new Date() });

test("Stage 9.5 Mongo limiter is shared/atomic and guest sessions are hash-only, fixed and one-Order bound", { skip: !mongoReady }, async () => {
  assert.equal(process.env.MONGODB_DB_NAME, "athar_stage55_test");
  await ensureSecureOrderAccessIndexes();
  const database = await getDatabase(); const store = new MongoSecureOrderAccessStore(() => Promise.resolve(database));
  const order = newOrder(`ATH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`); const now = new Date("2026-10-03T12:00:00.000Z");
  try {
    await database.collection<OrderDocument>(databaseCollections.orders).insertOne(order);
    const attempts = await Promise.all(Array.from({ length: 6 }, () => store.countLookupAttempt({ orderId: order.orderId, normalizedEmail: "guest@example.invalid", hmacSecret: testSecret, now })));
    assert.equal(attempts.filter((value) => value.allowed).length, 5);
    assert.equal((await store.countLookupAttempt({ orderId: order.orderId, normalizedEmail: "guest@example.invalid", hmacSecret: testSecret, now: new Date("2026-10-03T12:15:00.000Z") })).allowed, true);
    const orderLimited = await Promise.all(Array.from({ length: 11 }, (_, index) => store.countLookupAttempt({ orderId: "ATH-111111111111", normalizedEmail: `order-limit-${index}@example.invalid`, hmacSecret: testSecret, now: new Date("2026-10-03T12:30:00.000Z") })));
    assert.equal(orderLimited.filter((value) => value.allowed).length, 10);
    const emailLimited = await Promise.all(Array.from({ length: 11 }, (_, index) => store.countLookupAttempt({ orderId: `ATH-${(index + 100).toString(16).padStart(12, "0").toUpperCase()}`, normalizedEmail: "email-limit@example.invalid", hmacSecret: testSecret, now: new Date("2026-10-03T12:45:00.000Z") })));
    assert.equal(emailLimited.filter((value) => value.allowed).length, 10);
    const rateRecords = await database.collection(databaseCollections.orderLookupRateLimits).find({}).toArray();
    assert.equal(JSON.stringify(rateRecords).includes("guest@example.invalid"), false);
    assert.equal(JSON.stringify(rateRecords).includes(order.orderId), false);
    const session = await store.createGuestSession(order.orderId, now); const sessionRecord = await database.collection(databaseCollections.guestOrderAccessSessions).findOne({ orderId: order.orderId });
    assert.equal(JSON.stringify(sessionRecord).includes(session.secret), false); assert.equal((await store.resolveGuestSession(session.secret, now))?.orderId, order.orderId);
    assert.equal(await store.resolveGuestSession(session.secret, new Date(now.getTime() + 30 * 60 * 1000)), null);
  } finally {
    await database.collection(databaseCollections.orders).deleteOne({ orderId: order.orderId });
    await database.collection(databaseCollections.guestOrderAccessSessions).deleteMany({ orderId: order.orderId });
    await database.collection(databaseCollections.orderLookupRateLimits).deleteMany({});
    await (await getMongoClient()).close();
  }
});
