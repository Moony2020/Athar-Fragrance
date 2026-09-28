import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { MongoClient, ObjectId } from "mongodb";

const slug = "athar-test-no-01";
const variantId = "gy3VtF_WtJs2l9HTog";
const password = "Stage64 existing account password";

test("existing account merges guest cart and wishlist, then stays user-owned across sign-out/sign-in", async ({ page }) => {
  const mongo = new MongoClient(process.env.MONGODB_URI!);
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB_NAME);
  const userId = randomBytes(32).toString("base64url");
  const guestCartId = randomBytes(32).toString("base64url");
  const guestWishlistId = randomBytes(32).toString("base64url");
  const email = `stage64-existing-${Date.now()}@example.invalid`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  try {
    await db.collection("users").insertOne({ _id: new ObjectId(), userId, normalizedEmail: email, createdAt: now, updatedAt: now });
    await db.collection("user_credentials").insertOne({ _id: new ObjectId(), userId, passwordHash: await argon2.hash(password, { type: argon2.argon2id, timeCost: 3, memoryCost: 65536, parallelism: 4 }), disabledAt: null, createdAt: now, updatedAt: now });
    await db.collection("carts").insertMany([
      { _id: new ObjectId(), ownerType: "guest", ownerId: guestCartId, revision: 1, state: { lines: [{ productSlug: slug, variantId, quantity: 2 }] }, createdAt: now, updatedAt: now, expiresAt },
      { _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { lines: [{ productSlug: slug, variantId, quantity: 3 }] }, createdAt: now, updatedAt: now, expiresAt },
    ]);
    await db.collection("wishlists").insertMany([
      { _id: new ObjectId(), ownerType: "guest", ownerId: guestWishlistId, revision: 1, state: { productSlugs: [slug] }, createdAt: now, updatedAt: now, expiresAt },
      { _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { productSlugs: [] }, createdAt: now, updatedAt: now, expiresAt },
    ]);
    await page.context().addCookies([
      { name: "athar_guest_cart", value: guestCartId, domain: "127.0.0.1", path: "/" },
      { name: "athar_guest_wishlist", value: guestWishlistId, domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    const sessionResponse = await page.request.get("/api/auth/session");
    expect((await sessionResponse.json()).user.id).toBe(userId);
    const mergedCart = await db.collection("carts").findOne({ ownerType: "user", ownerId: userId });
    const mergedWishlist = await db.collection("wishlists").findOne({ ownerType: "user", ownerId: userId });
    expect(mergedCart?.state.lines).toEqual([{ productSlug: slug, variantId, quantity: 5 }]);
    expect(mergedWishlist?.state.productSlugs).toEqual([slug]);
    await page.goto("/cart");
    await expect(page.getByText("Eros")).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.getByText("Eros")).toBeVisible();
    expect((await db.collection("carts").findOne({ ownerType: "guest", ownerId: guestCartId }))?.state.lines ?? []).toEqual([]);
    expect((await db.collection("wishlists").findOne({ ownerType: "guest", ownerId: guestWishlistId }))?.state.productSlugs ?? []).toEqual([]);
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/account\/sign-in/);
    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    const afterRepeat = await db.collection("carts").findOne({ ownerType: "user", ownerId: userId });
    expect(afterRepeat?.state.lines).toEqual([{ productSlug: slug, variantId, quantity: 5 }]);
  } finally {
    await db.collection("commerce_merges").deleteMany({ userId });
    await db.collection("carts").deleteMany({ $or: [{ ownerId: userId }, { ownerId: guestCartId }] });
    await db.collection("wishlists").deleteMany({ $or: [{ ownerId: userId }, { ownerId: guestWishlistId }] });
    await db.collection("user_credentials").deleteOne({ userId });
    await db.collection("users").deleteOne({ userId });
    await mongo.close();
  }
});
