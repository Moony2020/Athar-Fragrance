import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

import { registerCustomer } from "../src/server/auth/registration";

const enabled = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const opaqueId = () => randomBytes(32).toString("base64url");
const lowFixtureSlug = "athar-stage73-test-under-threshold";
function publicVariantId(slug: string, fixtureVariantKey: string) {
  const internalId = createHash("sha256").update(`athar-development:variant:${fixtureVariantKey}`).digest("hex").slice(0, 24);
  return createHash("sha256").update(`${slug}:${internalId}`).digest("base64url").slice(0, 18);
}
const lowFixtureVariantId = publicVariantId(lowFixtureSlug, "ATHAR-STAGE73-TEST-599");

test("Stage 7.4 authenticated totals use the signed-in owner cart and never a browser total", async ({ page }) => {
  test.skip(!enabled, "requires dedicated athar_stage55_test Mongo configuration");
  const email = `stage74-${opaqueId().slice(0, 10)}@example.invalid`;
  const password = `Stage74-${opaqueId().slice(0, 20)}a1`;
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = mongo.db("athar_stage55_test");
  let userId = "";
  try {
    await mongo.connect();
    const user = await registerCustomer({ email, password });
    userId = user.userId;
    await database.collection("carts").insertOne({ _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { lines: [{ productSlug: lowFixtureSlug, variantId: lowFixtureVariantId, quantity: 1 }] }, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });

    await page.goto("/account/sign-in", { waitUntil: "load" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/checkout");
    await expect(page.getByLabel("Email address")).toHaveValue(user.email);

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("Address line 1").fill("12 Test Street");
    await page.getByLabel("Postal code").fill("12345");
    await page.getByLabel("City").fill("Stockholm");
    await page.getByLabel("Country code").fill("SE");
    await page.getByRole("button", { name: "Save contact & address" }).click();
    await page.getByRole("radio", { name: /PostNord 59 kr/ }).check();
    await page.getByRole("button", { name: "Save delivery method" }).click();
    const summary = page.getByLabel("Checkout summary");
    await expect(summary).toContainText("658 kr");
    await expect(summary).toContainText("131,60 kr");
    await page.goto("/checkout?grandTotal=1&vatTotal=1&discountTotal=99999");
    await expect(summary).toContainText("658 kr");
    await expect(summary).toContainText("131,60 kr");
    expect(new URL(page.url()).searchParams.get("grandTotal")).toBe("1");
  } finally {
    if (userId) {
      await database.collection("checkout_drafts").deleteMany({ ownerType: "user", ownerId: userId }).catch(() => undefined);
      await database.collection("carts").deleteMany({ ownerType: "user", ownerId: userId }).catch(() => undefined);
      await database.collection("user_credentials").deleteMany({ userId }).catch(() => undefined);
      await database.collection("users").deleteMany({ userId }).catch(() => undefined);
      expect(await database.collection("checkout_drafts").countDocuments({ ownerType: "user", ownerId: userId })).toBe(0);
      expect(await database.collection("carts").countDocuments({ ownerType: "user", ownerId: userId })).toBe(0);
      expect(await database.collection("user_credentials").countDocuments({ userId })).toBe(0);
      expect(await database.collection("users").countDocuments({ userId })).toBe(0);
    }
    await mongo.close().catch(() => undefined);
  }
});
