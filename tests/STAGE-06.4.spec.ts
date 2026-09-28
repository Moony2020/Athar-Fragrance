import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";

test("browser registration reconciles disposable guest cart and wishlist", async ({ page, context }) => {
  const guestId = `g-browser64-${Date.now()}-xxxxxxxxxxxxxxxxxxxx`;
  const email = `stage64-browser-${Date.now()}@example.invalid`;
  const password = "Correct horse battery staple 42";
  const variantId = "gy3VtF_WtJs2l9HTog";
  const mongo = new MongoClient(process.env.MONGODB_URI!);
  await mongo.connect();
  const database = mongo.db("athar_stage55_test");
  const now = new Date();
  try {
    await database.collection("carts").insertOne({ ownerType: "guest", ownerId: guestId, revision: 1, state: { lines: [{ productSlug: "athar-test-no-01", variantId, quantity: 2 }] }, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86400000) });
    await database.collection("wishlists").insertOne({ ownerType: "guest", ownerId: guestId, revision: 1, state: { productSlugs: ["athar-test-no-01"] }, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86400000) });
    await context.addCookies([
      { name: "athar_guest_cart", value: guestId, url: process.env.BASE_URL ?? "http://127.0.0.1:3100" },
      { name: "athar_guest_wishlist", value: guestId, url: process.env.BASE_URL ?? "http://127.0.0.1:3100" },
    ]);
    await page.goto("/account/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    const user = await database.collection("users").findOne({ normalizedEmail: email });
    expect(user?.userId).toBeTruthy();
    const cart = await database.collection("carts").findOne({ ownerType: "user", ownerId: user?.userId });
    const wishlist = await database.collection("wishlists").findOne({ ownerType: "user", ownerId: user?.userId });
    expect(cart?.state.lines).toEqual([{ productSlug: "athar-test-no-01", variantId, quantity: 2 }]);
    expect(wishlist?.state.productSlugs).toEqual(["athar-test-no-01"]);
    expect((await database.collection("carts").findOne({ ownerType: "guest", ownerId: guestId }))?.state.lines).toEqual([]);
    expect((await database.collection("wishlists").findOne({ ownerType: "guest", ownerId: guestId }))?.state.productSlugs).toEqual([]);
  } finally {
    const user = await database.collection("users").findOne({ normalizedEmail: email }, { projection: { userId: 1 } });
    const ids = [guestId, user?.userId].filter((id): id is string => Boolean(id));
    await database.collection("carts").deleteMany({ ownerId: { $in: ids } });
    await database.collection("wishlists").deleteMany({ ownerId: { $in: ids } });
    await database.collection("user_credentials").deleteMany({ userId: { $in: ids } });
    await database.collection("users").deleteMany({ userId: { $in: ids } });
    await database.collection("commerce_merges").deleteMany({ guestId });
    await mongo.close();
  }
});
