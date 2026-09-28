import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { registerCustomer } from "../src/server/auth/registration";

const testDatabaseReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const fixtureSlug = "athar-test-no-01";
const availableVariantId = "gy3VtF_WtJs2l9HTog";
const unavailableVariantId = "not-a-current-variant";
const testPassword = "Stage71-CheckoutFixture-a1";

test.describe("Stage 7.1 server-authoritative checkout", () => {
  test.skip(!testDatabaseReady, "requires the dedicated athar_stage55_test Mongo database");

  test("empty Cart and Checkout states lead to shopping without a circular bag link", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    const checkoutMain = page.locator("main");
    const checkoutExplore = checkoutMain.getByRole("link", { name: /explore fragrances/i });
    await expect(checkoutMain.getByRole("link")).toHaveCount(1);
    await expect(checkoutExplore).toHaveAttribute("href", "/shop");
    await expect(checkoutMain).not.toContainText("ATHAR CHECKOUT");

    await page.goto("/cart");
    const cartMain = page.locator("main");
    await expect(cartMain.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    const cartExplore = cartMain.getByRole("link", { name: /explore fragrances/i });
    await expect(cartExplore).toHaveAttribute("href", "/shop");
    await expect(cartMain).not.toContainText("ATHAR");
  });

  test("guest Cart uses current catalog price and keeps stale lines visible but blocked", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
    const carts = mongo.db("athar_stage55_test").collection("carts");
    const guestId = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let connected = false;
    try {
      await mongo.connect();
      connected = true;
      await carts.insertOne({
        _id: new ObjectId(), ownerType: "guest", ownerId: guestId, revision: 1,
        state: { lines: [
          { productSlug: fixtureSlug, variantId: availableVariantId, quantity: 2 },
          { productSlug: fixtureSlug, variantId: unavailableVariantId, quantity: 1 },
        ] },
        createdAt: now, updatedAt: now, expiresAt,
      });
      await context.addCookies([{ name: "athar_guest_cart", value: guestId, domain: new URL(baseURL!).hostname, path: "/" }]);
      await page.goto("/checkout?ownerId=attacker&priceMinor=1&total=1");

      await expect(page.getByRole("heading", { name: "Review your bag" })).toBeVisible();
      await expect(page.getByRole("img", { name: "Eros front view" })).toBeVisible();
      await expect(page.getByRole("article").filter({ hasText: "Eros" })).toContainText("Quantity 2");
      await expect(page.getByRole("article").filter({ hasText: "Eros" })).toContainText("Eau de Parfum · 50 ml");
      await expect(page.getByRole("article").filter({ hasText: "Eros" })).toContainText("2 598 kr");
      await expect(page.getByText("This item needs review and is not included as an eligible checkout item.")).toBeVisible();
      await expect(page.getByText("Checkout can’t continue yet.")).toBeVisible();
      const rendered = await page.locator("body").innerText();
      expect(rendered).not.toContain("attacker");
      expect(rendered).not.toContain("priceMinor=1");
    } finally {
      try {
        if (connected) {
          const cleanup = await carts.deleteOne({ ownerType: "guest", ownerId: guestId });
          expect(cleanup.deletedCount).toBe(1);
        }
      } finally {
        await mongo.close().catch(() => undefined);
      }
    }
  });

  test("authenticated checkout uses session user Cart, not browser-selected identity or another user's Cart", async ({ page }) => {
    test.setTimeout(120_000);
    const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
    const database = mongo.db("athar_stage55_test");
    const users = database.collection("users");
    const credentials = database.collection("user_credentials");
    const carts = database.collection("carts");
    let targetUserId = "";
    let otherUserId = "";
    const targetEmail = `stage71-checkout-${randomBytes(8).toString("hex")}@example.invalid`;
    const otherEmail = `stage71-other-${randomBytes(8).toString("hex")}@example.invalid`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let connected = false;

    try {
      await mongo.connect();
      connected = true;
      const targetAccount = await registerCustomer({ email: targetEmail, password: testPassword });
      const otherAccount = await registerCustomer({ email: otherEmail, password: testPassword });
      targetUserId = targetAccount.userId;
      otherUserId = otherAccount.userId;
      await carts.insertMany([
        { _id: new ObjectId(), ownerType: "user", ownerId: targetUserId, revision: 1, state: { lines: [{ productSlug: fixtureSlug, variantId: availableVariantId, quantity: 1 }] }, createdAt: now, updatedAt: now, expiresAt },
        { _id: new ObjectId(), ownerType: "user", ownerId: otherUserId, revision: 1, state: { lines: [{ productSlug: "cedar-study", variantId: "cedar-50", quantity: 1 }] }, createdAt: now, updatedAt: now, expiresAt },
      ]);

      await page.goto("/account/sign-in");
      await page.getByLabel("Email").fill(targetEmail);
      await page.getByLabel("Password").fill(testPassword);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/account$/);
      await page.goto("/checkout?ownerId=" + encodeURIComponent(otherUserId) + "&userId=" + encodeURIComponent(otherUserId) + "&priceMinor=1");

      await expect(page.getByRole("heading", { name: "Review your bag" })).toBeVisible();
      await expect(page.getByRole("article").filter({ hasText: "Eros" })).toContainText("1 299 kr");
      await expect(page.getByText("Cedar Study")).toHaveCount(0);
      const rendered = await page.locator("body").innerText();
      expect(rendered).not.toContain(targetUserId);
      expect(rendered).not.toContain(otherUserId);
      expect(rendered).not.toContain(targetEmail);
    } finally {
      try {
        if (connected && targetUserId && otherUserId) {
          const userIds = { $in: [targetUserId, otherUserId] };
          await database.collection("password_reset_tokens").deleteMany({ userId: userIds });
          const removedCarts = await carts.deleteMany({ ownerType: "user", ownerId: userIds });
          const removedCredentials = await credentials.deleteMany({ userId: userIds });
          const removedUsers = await users.deleteMany({ userId: userIds });
          await database.collection("commerce_merges").deleteMany({ userId: { $in: [targetUserId, otherUserId] } });
          expect(removedCarts.deletedCount).toBe(2);
          expect(removedCredentials.deletedCount).toBe(2);
          expect(removedUsers.deletedCount).toBe(2);
        }
      } finally {
        await mongo.close().catch(() => undefined);
      }
    }
  });
});
