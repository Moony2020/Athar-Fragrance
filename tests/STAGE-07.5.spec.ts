import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

import type { ProductDocument } from "../src/server/catalog/documents";
import { registerCustomer } from "../src/server/auth/registration";

const enabled = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test" && process.env.CATALOG_FIXTURE_RUNTIME === "1");
const slug = "athar-stage73-test-under-threshold";
const internalVariantId = createHash("sha256").update("athar-development:variant:ATHAR-STAGE73-TEST-599").digest("hex").slice(0, 24);
const variantId = createHash("sha256").update(`${slug}:${internalVariantId}`).digest("base64url").slice(0, 18);
const opaqueId = () => randomBytes(32).toString("base64url");

test.describe.configure({ mode: "serial" });

function reservationFixture(): ProductDocument {
  return {
    _id: new ObjectId(), slug, name: "Shipping Threshold Fixture", brandId: new ObjectId(), shortDescription: "Fixture-only checkout test product.", fragranceType: "Test Fragrance", description: "Fixture-only checkout test product.", audience: "unisex", fragranceFamily: "test-fixture", notes: { top: ["Test"], heart: ["Fixture"], base: ["Only"] }, media: [],
    variants: [{ id: internalVariantId, sku: "ATHAR-STAGE73-TEST-599", sizeMl: 50, priceMinor: 59_900, inventoryQuantity: 1, isActive: true }], status: "active", featured: false, bestseller: false, collectionIds: [], currency: "SEK", createdAt: new Date(), updatedAt: new Date(),
  };
}

async function completeCheckout(page: Page) {
  await page.goto("/checkout");
  await page.getByLabel("Email address").fill("stage75@example.invalid");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Address line 1").fill("12 Test Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Stockholm");
  await page.getByLabel("Country code").fill("SE");
  await page.getByRole("button", { name: "Save contact & address" }).click();
  await page.getByRole("radio", { name: /PostNord 59 kr/ }).check();
  await page.getByRole("button", { name: "Save delivery method" }).click();
  await expect(page.getByRole("button", { name: "Prepare for payment" })).toBeVisible();
}

test("Stage 7.5 guest checkout creates a 15-minute reservation only at prepare-for-payment", async ({ page, context, baseURL }) => {
  test.skip(!enabled, "requires isolated fixture runtime and athar_stage55_test");
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = mongo.db("athar_stage55_test");
  const fixture = reservationFixture(); const guestId = opaqueId();
  try {
    await mongo.connect();
    await database.collection<ProductDocument>("products").insertOne(fixture);
    await database.collection("inventory_reservations").createIndex({ checkoutId: 1 }, { name: "inventory_reservation_checkout_unique", unique: true });
    await database.collection("carts").insertOne({ _id: new ObjectId(), ownerType: "guest", ownerId: guestId, revision: 1, state: { lines: [{ productSlug: slug, variantId, quantity: 1 }] }, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
    await context.addCookies([{ name: "athar_guest_cart", value: guestId, domain: new URL(baseURL!).hostname, path: "/" }]);
    await completeCheckout(page);
    expect(await database.collection("inventory_reservations").countDocuments({ "lines.productSlug": slug })).toBe(0);
    await page.getByRole("button", { name: "Prepare for payment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Payment will be available soon" })).toBeVisible();
    expect(await database.collection("inventory_reservations").countDocuments({ "lines.productSlug": slug, status: "active" })).toBe(1);
  } finally {
    await database.collection("inventory_reservations").deleteMany({ "lines.productSlug": slug }).catch(() => undefined);
    await database.collection("checkout_drafts").deleteMany({ ownerType: "guest", ownerId: guestId }).catch(() => undefined);
    await database.collection("carts").deleteMany({ ownerType: "guest", ownerId: guestId }).catch(() => undefined);
    await database.collection<ProductDocument>("products").deleteOne({ _id: fixture._id }).catch(() => undefined);
    await mongo.close().catch(() => undefined);
  }
});

test("Stage 7.5 authenticated checkout reserves the server-owned cart without browser inventory authority", async ({ page }) => {
  test.skip(!enabled, "requires isolated fixture runtime and athar_stage55_test");
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = mongo.db("athar_stage55_test");
  const fixture = reservationFixture(); const email = `stage75-${opaqueId().slice(0, 10)}@example.invalid`; const password = `Stage75-${opaqueId().slice(0, 20)}a1`;
  let userId = "";
  try {
    await mongo.connect();
    await database.collection<ProductDocument>("products").insertOne(fixture);
    await database.collection("inventory_reservations").createIndex({ checkoutId: 1 }, { name: "inventory_reservation_checkout_unique", unique: true });
    const user = await registerCustomer({ email, password }); userId = user.userId;
    await database.collection("carts").insertOne({ _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { lines: [{ productSlug: slug, variantId, quantity: 1 }] }, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
    await page.goto("/account/sign-in", { waitUntil: "load" });
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password); await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await completeCheckout(page);
    await page.getByRole("button", { name: "Prepare for payment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Payment will be available soon" })).toBeVisible();
    expect(await database.collection("inventory_reservations").countDocuments({ ownerType: "user", ownerId: userId, status: "active" })).toBe(1);
  } finally {
    if (userId) {
      await database.collection("inventory_reservations").deleteMany({ ownerType: "user", ownerId: userId }).catch(() => undefined);
      await database.collection("checkout_drafts").deleteMany({ ownerType: "user", ownerId: userId }).catch(() => undefined);
      await database.collection("carts").deleteMany({ ownerType: "user", ownerId: userId }).catch(() => undefined);
      await database.collection("user_credentials").deleteMany({ userId }).catch(() => undefined);
      await database.collection("users").deleteMany({ userId }).catch(() => undefined);
    }
    await database.collection<ProductDocument>("products").deleteOne({ _id: fixture._id }).catch(() => undefined);
    await mongo.close().catch(() => undefined);
  }
});
