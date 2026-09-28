import assert from "node:assert/strict";
import test from "node:test";

import { guestCommerceOwner, userCommerceOwner } from "../src/commerce/durable-contracts";
import { MongoGuestCartStore, MongoGuestWishlistStore } from "../src/server/commerce/mongo-store";
import { mergeGuestCommerceForUser } from "../src/server/commerce/reconciliation";
import { databaseCollections } from "../src/server/db/collections";
import { ensureCommerceIndexes } from "../src/server/db/indexes";
import { getDatabase } from "../src/server/db/mongodb";

test("Stage 6.4 real Mongo merge is canonical, capped, cleared, and idempotent", async () => {
  const userId = `u-stage64-${Date.now()}-${"x".repeat(24)}`.slice(0, 43);
  const guestId = `g-stage64-${Date.now()}-${"x".repeat(24)}`.slice(0, 43);
  const variantId = "gy3VtF_WtJs2l9HTog";
  const database = await getDatabase();
  const cart = new MongoGuestCartStore(getDatabase);
  const wishlist = new MongoGuestWishlistStore(getDatabase);
  try {
    await ensureCommerceIndexes();
    await database.collection(databaseCollections.commerceMerges).deleteMany({ userId, guestId });
    await cart.mutateOwner(guestCommerceOwner(guestId), async () => ({ lines: [{ productSlug: "athar-test-no-01", variantId, quantity: 8 }] }));
    await wishlist.mutateOwner(guestCommerceOwner(guestId), async () => ({ productSlugs: ["athar-test-no-01", "athar-test-no-01"] }));
    await cart.mutateOwner(userCommerceOwner(userId), async () => ({ lines: [{ productSlug: "athar-test-no-01", variantId, quantity: 7 }] }));
    const results = await Promise.allSettled([
      mergeGuestCommerceForUser(userId, { cartId: guestId, wishlistId: guestId }),
      mergeGuestCommerceForUser(userId, { cartId: guestId, wishlistId: guestId }),
    ]);
    assert.ok(results.some((result) => result.status === "fulfilled"));
    const mergedCart = await cart.readOwner(userCommerceOwner(userId));
    const mergedWishlist = await wishlist.readOwner(userCommerceOwner(userId));
    assert.deepEqual(mergedCart.lines, [{ productSlug: "athar-test-no-01", variantId, quantity: 12 }]);
    assert.deepEqual(mergedWishlist.productSlugs, ["athar-test-no-01"]);
    assert.deepEqual(await cart.readOwner(guestCommerceOwner(guestId)), { lines: [] });
    assert.deepEqual(await wishlist.readOwner(guestCommerceOwner(guestId)), { productSlugs: [] });
    await mergeGuestCommerceForUser(userId, { cartId: guestId, wishlistId: guestId });
    assert.deepEqual((await cart.readOwner(userCommerceOwner(userId))).lines, mergedCart.lines);
  } finally {
    await database.collection(databaseCollections.carts).deleteMany({ ownerId: { $in: [userId, guestId] } });
    await database.collection(databaseCollections.wishlists).deleteMany({ ownerId: { $in: [userId, guestId] } });
    await database.collection(databaseCollections.commerceMerges).deleteMany({ userId, guestId });
    await database.client.close();
  }
});
