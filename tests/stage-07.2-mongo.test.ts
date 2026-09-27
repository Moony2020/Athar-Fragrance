import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { MongoClient } from "mongodb";

import { guestCommerceOwner } from "../src/commerce/durable-contracts";
import type { CheckoutDraftDocument } from "../src/checkout/draft-document";
import { databaseCollections } from "../src/server/db/collections";
import { ensureCheckoutDraftIndexes } from "../src/server/db/indexes";
import { MongoCheckoutDraftStore } from "../src/server/checkout/draft-store";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const ownerId = () => randomBytes(32).toString("base64url");

test("Stage 7.2 Mongo drafts persist, isolate owners, enforce CAS/expiry and clean disposable records", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const drafts = database.collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts);
  const fixtureIds: string[] = [];
  let connected = false;

  try {
    await client.connect();
    connected = true;
    await ensureCheckoutDraftIndexes();
    await ensureCheckoutDraftIndexes();
    const indexes = await drafts.listIndexes().toArray();
    assert.equal(indexes.find((index) => index.name === "checkout_id_unique")?.unique, true);
    assert.equal(indexes.find((index) => index.name === "checkout_draft_expiry_ttl")?.expireAfterSeconds, 0);

    const store = new MongoCheckoutDraftStore(async () => database);
    const owner = guestCommerceOwner(ownerId());
    const otherOwner = guestCommerceOwner(ownerId());
    const draft = await store.getOrCreate(owner);
    fixtureIds.push(draft.checkoutId);

    const contactAddress = {
      contact: { email: " Buyer@Example.com " },
      shippingAddress: {
        firstName: " Ada ", lastName: " Lovelace ", addressLine1: " 12 Main Street ",
        addressLine2: " ", postalCode: " 12345 ", city: " Stockholm ", region: " ", countryCode: " se ",
      },
    };
    assert.equal(await store.save(otherOwner, draft.checkoutId, draft.revision, contactAddress), "not-found");
    assert.equal(await store.save(owner, draft.checkoutId, draft.revision, contactAddress), "saved");

    const reopenedStore = new MongoCheckoutDraftStore(async () => database);
    const reloaded = await reopenedStore.getOrCreate(owner, draft.checkoutId);
    assert.equal(reloaded.checkoutId, draft.checkoutId);
    assert.equal(reloaded.revision, 2);
    assert.equal(reloaded.contact?.email, "buyer@example.com");
    assert.equal(reloaded.shippingAddress?.countryCode, "SE");
    assert.equal(reloaded.shippingAddress?.addressLine2, undefined);

    const isolated = await reopenedStore.getOrCreate(otherOwner, draft.checkoutId);
    fixtureIds.push(isolated.checkoutId);
    assert.notEqual(isolated.checkoutId, draft.checkoutId);
    assert.equal(isolated.contact, undefined);

    const competing = await Promise.all([
      store.save(owner, draft.checkoutId, reloaded.revision, { ...contactAddress, contact: { email: "one@example.com" } }),
      store.save(owner, draft.checkoutId, reloaded.revision, { ...contactAddress, contact: { email: "two@example.com" } }),
    ]);
    assert.deepEqual([...competing].sort(), ["conflict", "saved"]);
    assert.equal(await store.save(owner, draft.checkoutId, reloaded.revision, contactAddress), "conflict");

    const expiredId = ownerId();
    fixtureIds.push(expiredId);
    const now = new Date();
    await drafts.insertOne({
      checkoutId: expiredId, ...owner, revision: 1, createdAt: now, updatedAt: now,
      expiresAt: new Date(now.getTime() - 60_000),
    });
    assert.equal(await store.save(owner, expiredId, 1, contactAddress), "not-found");
    const replacement = await store.getOrCreate(owner, expiredId);
    fixtureIds.push(replacement.checkoutId);
    assert.notEqual(replacement.checkoutId, expiredId);

    const publicJson = JSON.stringify(reloaded);
    assert.equal(publicJson.includes("ownerId"), false);
    assert.equal(publicJson.includes("ownerType"), false);
    assert.equal(publicJson.includes("_id"), false);
    assert.equal(publicJson.includes("priceMinor"), false);
  } finally {
    try {
      if (connected) {
        await drafts.deleteMany({ checkoutId: { $in: fixtureIds } });
        assert.equal(await drafts.countDocuments({ checkoutId: { $in: fixtureIds } }), 0);
      }
    } finally {
      await client.close().catch(() => undefined);
    }
  }
});
