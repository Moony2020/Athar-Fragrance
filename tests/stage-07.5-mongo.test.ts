import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { MongoClient, ObjectId } from "mongodb";

import type { ProductDocument } from "../src/server/catalog/documents";
import { INVENTORY_RESERVATION_TTL_MS, type InventoryReservationDocument } from "../src/inventory/reservation-document";
import { MongoInventoryReservationStore } from "../src/server/inventory/reservation-store";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const owner = (kind: "guest" | "user", suffix: string) => ({ ownerType: kind, ownerId: `${kind}-${suffix}-${randomBytes(20).toString("base64url")}` });
const publicVariantId = (slug: string, internalId: string) => createHash("sha256").update(`${slug}:${internalId}`).digest("base64url").slice(0, 18);

function product(slug: string, quantities: number[]): ProductDocument {
  const variants = quantities.map((inventoryQuantity, index) => ({ id: `${index + 1}`.padStart(24, "a"), sku: `STAGE75-${slug}-${index + 1}`.toUpperCase(), sizeMl: 50 + index * 50, priceMinor: 59_900, inventoryQuantity, isActive: true }));
  return {
    _id: new ObjectId(), slug, name: "Stage 7.5 fixture", brandId: new ObjectId(), description: "Fixture only", audience: "unisex", fragranceFamily: "test", notes: { top: [], heart: [], base: [] }, media: [], variants,
    status: "active", featured: false, bestseller: false, collectionIds: [], currency: "SEK", createdAt: new Date(), updatedAt: new Date(),
  };
}

test("Stage 7.5 Mongo reservations atomically prevent oversell, remain idempotent, and release logical expiry", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const products = database.collection<ProductDocument>("products");
  const reservations = database.collection<InventoryReservationDocument>("inventory_reservations");
  const slug = `stage75-${randomBytes(8).toString("hex")}`;
  const fixture = product(slug, [1, 2]);
  const firstVariant = publicVariantId(slug, fixture.variants[0]!.id);
  const secondVariant = publicVariantId(slug, fixture.variants[1]!.id);
  const ownerA = owner("guest", "a"); const ownerB = owner("user", "b"); const ownerC = owner("user", "c");
  const checkoutA = randomBytes(32).toString("base64url"); const checkoutB = randomBytes(32).toString("base64url"); const checkoutC = randomBytes(32).toString("base64url");
  try {
    await client.connect();
    await products.insertOne(fixture);
    await reservations.createIndexes([{ key: { checkoutId: 1 }, name: "inventory_reservation_checkout_unique", unique: true }, { key: { expiresAt: 1 }, name: "inventory_reservation_expiry_ttl", expireAfterSeconds: 0 }]);
    const store = new MongoInventoryReservationStore(async () => database, async () => client);
    const line = [{ productSlug: slug, variantId: firstVariant, quantity: 1 }];

    const competing = await Promise.all([store.prepare(ownerA, checkoutA, line), store.prepare(ownerB, checkoutB, line)]);
    assert.equal(competing.filter((result) => result.status === "reserved").length, 1);
    assert.equal(competing.filter((result) => result.status === "insufficient").length, 1);
    assert.equal((await reservations.find({ status: "active" }).toArray()).flatMap((entry) => entry.lines).reduce((total, entry) => total + entry.quantity, 0), 1);

    const winningOwner = competing[0]!.status === "reserved" ? ownerA : ownerB;
    const winningCheckout = competing[0]!.status === "reserved" ? checkoutA : checkoutB;
    const retry = await Promise.all([store.prepare(winningOwner, winningCheckout, line), store.prepare(winningOwner, winningCheckout, line)]);
    assert.equal(retry.every((result) => result.status === "reserved" && result.idempotent), true);
    assert.equal(await reservations.countDocuments({ checkoutId: winningCheckout, status: "active" }), 1);

    await store.releaseForOwner(winningOwner);
    assert.equal(await reservations.countDocuments({ checkoutId: winningCheckout, status: "released" }), 1);
    assert.equal((await store.prepare(ownerC, checkoutC, line)).status, "reserved");

    const firstReservation = await reservations.findOne({ checkoutId: checkoutC });
    assert.ok(firstReservation);
    const afterExpiry = new Date(firstReservation!.expiresAt.getTime() + 1);
    const expiryCompetitor = await store.prepare(ownerA, checkoutA, line, afterExpiry);
    assert.equal(expiryCompetitor.status, "reserved");
    assert.equal((await reservations.findOne({ checkoutId: checkoutC }))?.status, "expired");

    const switched = await store.prepare(ownerA, checkoutA, [{ productSlug: slug, variantId: secondVariant, quantity: 2 }], new Date(afterExpiry.getTime() + 1));
    assert.equal(switched.status, "reserved");
    const switchedDocument = await reservations.findOne({ checkoutId: checkoutA });
    assert.deepEqual(switchedDocument?.lines, [{ productSlug: slug, variantId: secondVariant, quantity: 2 }]);
    assert.equal(switchedDocument?.status, "active");
    assert.equal(switchedDocument?.expiresAt.getTime() - switchedDocument!.createdAt.getTime(), INVENTORY_RESERVATION_TTL_MS);
    // Reads are non-sliding: the original deadline is retained verbatim.
    const readBeforeExpiry = await store.readActive(ownerA, checkoutA, new Date(switchedDocument!.createdAt.getTime() + 1));
    assert.equal(readBeforeExpiry?.expiresAt.getTime(), switchedDocument!.expiresAt.getTime());
    // A request beyond canonical stock cannot obtain a partial payment-ready claim.
    const beyondStock = await store.prepare(ownerB, checkoutB, [{ productSlug: slug, variantId: secondVariant, quantity: 3 }], new Date(afterExpiry.getTime() + 2));
    assert.equal(beyondStock.status, "insufficient");
    assert.equal(await reservations.countDocuments({ status: "active", "lines.variantId": secondVariant }), 1);
  } finally {
    await reservations.deleteMany({ "lines.productSlug": slug }).catch(() => undefined);
    await products.deleteOne({ _id: fixture._id }).catch(() => undefined);
    assert.equal(await reservations.countDocuments({ "lines.productSlug": slug }), 0);
    assert.equal(await products.countDocuments({ _id: fixture._id }), 0);
    await client.close().catch(() => undefined);
  }
});

test("Stage 7.5 reservation owner matrix serializes real concurrent claims and reconciliation", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const products = database.collection<ProductDocument>("products");
  const reservations = database.collection<InventoryReservationDocument>("inventory_reservations");
  const slug = `stage75-matrix-${randomBytes(8).toString("hex")}`;
  const fixture = product(slug, [1, 2]);
  const first = publicVariantId(slug, fixture.variants[0]!.id);
  const second = publicVariantId(slug, fixture.variants[1]!.id);
  const store = new MongoInventoryReservationStore(async () => database, async () => client);
  const claim = (who: ReturnType<typeof owner>, checkout: string, variant = first, quantity = 1) => store.prepare(who, checkout, [{ productSlug: slug, variantId: variant, quantity }]);
  try {
    await client.connect();
    await products.insertOne(fixture);
    await reservations.createIndex({ checkoutId: 1 }, { name: "inventory_reservation_checkout_unique", unique: true });
    for (const [leftKind, rightKind] of [["guest", "guest"], ["guest", "user"], ["user", "user"]] as const) {
      const left = owner(leftKind, "left"); const right = owner(rightKind, "right");
      const leftCheckout = randomBytes(32).toString("base64url"); const rightCheckout = randomBytes(32).toString("base64url");
      const results = await Promise.all([claim(left, leftCheckout), claim(right, rightCheckout)]);
      assert.equal(results.filter((result) => result.status === "reserved").length, 1, `${leftKind}/${rightKind} stock=1 has one winner`);
      assert.equal(results.filter((result) => result.status === "insufficient").length, 1);
      const winner = results[0]!.status === "reserved" ? [left, leftCheckout] as const : [right, rightCheckout] as const;
      const retries = await Promise.all([claim(winner[0], winner[1]), claim(winner[0], winner[1])]);
      assert.equal(retries.every((result) => result.status === "reserved" && result.idempotent), true);
      await store.releaseForOwner(winner[0]);
      assert.equal((await claim(results[0]!.status === "reserved" ? right : left, results[0]!.status === "reserved" ? rightCheckout : leftCheckout)).status, "reserved");
      await reservations.deleteMany({ "lines.productSlug": slug });
    }
    const reconOwner = owner("user", "reconcile"); const reconCheckout = randomBytes(32).toString("base64url");
    assert.equal((await claim(reconOwner, reconCheckout, second, 1)).status, "reserved");
    assert.equal((await claim(reconOwner, reconCheckout, second, 2)).status, "reserved");
    assert.equal((await claim(reconOwner, reconCheckout, second, 3)).status, "insufficient");
    assert.equal((await store.prepare(reconOwner, reconCheckout, [{ productSlug: slug, variantId: second, quantity: 1 }, { productSlug: slug, variantId: second, quantity: 1 }])).status, "invalid");
    // A stale catalog cannot preserve an otherwise compatible old reservation.
    await products.updateOne({ _id: fixture._id }, { $set: { "variants.1.isActive": false } });
    assert.equal((await claim(reconOwner, reconCheckout, second, 2)).status, "invalid");
    assert.equal(await reservations.countDocuments({ checkoutId: reconCheckout, status: "active" }), 0);
  } finally {
    await reservations.deleteMany({ "lines.productSlug": slug }).catch(() => undefined);
    await products.deleteOne({ _id: fixture._id }).catch(() => undefined);
    assert.equal(await reservations.countDocuments({ "lines.productSlug": slug }), 0);
    await client.close().catch(() => undefined);
  }
});
