import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { MongoClient } from "mongodb";

import { guestCommerceOwner } from "../src/commerce/durable-contracts";
import type { CheckoutDraftDocument } from "../src/checkout/draft-document";
import { databaseCollections } from "../src/server/db/collections";
import { MongoCheckoutDraftStore } from "../src/server/checkout/draft-store";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const ownerId = () => randomBytes(32).toString("base64url");
const swedishDetails = { contact: { email: "buyer@example.invalid" }, shippingAddress: { firstName: "Ada", lastName: "Lovelace", addressLine1: "1 Test Street", postalCode: "12345", city: "Stockholm", countryCode: "SE" } };

test("Stage 7.3 persists only an owner-bound public shipping method ID and invalidates it for a non-SE address", { skip: !mongoReady }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = client.db("athar_stage55_test");
  const drafts = database.collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts);
  const fixtureIds: string[] = [];
  try {
    await client.connect();
    const store = new MongoCheckoutDraftStore(async () => database);
    const owner = guestCommerceOwner(ownerId());
    const otherOwner = guestCommerceOwner(ownerId());
    const draft = await store.getOrCreate(owner);
    fixtureIds.push(draft.checkoutId);
    assert.equal(await store.save(owner, draft.checkoutId, draft.revision, swedishDetails), "saved");
    const withAddress = await store.get(owner, draft.checkoutId);
    assert.ok(withAddress);
    assert.equal(await store.saveShippingSelection(otherOwner, draft.checkoutId, withAddress.revision, "postnord-service-point-se"), "not-found");
    assert.equal(await store.saveShippingSelection(owner, draft.checkoutId, withAddress.revision, "postnord-service-point-se"), "saved");
    const selected = await store.get(owner, draft.checkoutId);
    assert.equal(selected?.selectedShippingMethodId, "postnord-service-point-se");
    assert.equal(JSON.stringify(selected).includes("shippingAmountMinor"), false);
    assert.equal(await store.save(owner, draft.checkoutId, selected!.revision, { ...swedishDetails, shippingAddress: { ...swedishDetails.shippingAddress, countryCode: "FI" } }), "saved");
    const invalidated = await store.get(owner, draft.checkoutId);
    assert.equal(invalidated?.selectedShippingMethodId, undefined);
  } finally {
    await drafts.deleteMany({ checkoutId: { $in: fixtureIds } }).catch(() => undefined);
    assert.equal(await drafts.countDocuments({ checkoutId: { $in: fixtureIds } }), 0);
    await client.close().catch(() => undefined);
  }
});
