import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

import type { CheckoutDraftDocument } from "../src/checkout/draft-document";

const enabled = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const opaqueId = () => randomBytes(32).toString("base64url");
const lowFixtureSlug = "athar-stage73-test-under-threshold";
const highFixtureSlug = "athar-test-no-01";
function publicVariantId(slug: string, fixtureVariantKey: string) {
  const internalId = createHash("sha256").update(`athar-development:variant:${fixtureVariantKey}`).digest("hex").slice(0, 24);
  return createHash("sha256").update(`${slug}:${internalId}`).digest("base64url").slice(0, 18);
}
const lowFixtureVariantId = publicVariantId(lowFixtureSlug, "ATHAR-STAGE73-TEST-599");
const highFixtureVariantId = publicVariantId(highFixtureSlug, "ATHAR-TEST-01-50");

async function saveSwedishAddress(page: Page) {
  await page.getByLabel("Email address").fill("stage74@example.invalid");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Address line 1").fill("12 Test Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Stockholm");
  await page.getByLabel("Country code").fill("SE");
  await page.getByRole("button", { name: "Save contact & address" }).click();
  await expect(page.getByRole("heading", { name: "Choose your delivery method" })).toBeVisible();
}

test("Stage 7.4 guest checkout displays only server-derived VAT-inclusive totals", async ({ page, context, baseURL }) => {
  test.skip(!enabled, "requires dedicated athar_stage55_test Mongo configuration");
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = mongo.db("athar_stage55_test");
  const carts = database.collection("carts");
  const drafts = database.collection<CheckoutDraftDocument>("checkout_drafts");
  const guestId = opaqueId();
  const now = new Date();
  let checkoutId = "";
  try {
    await mongo.connect();
    await carts.insertOne({ _id: new ObjectId(), ownerType: "guest", ownerId: guestId, revision: 1, state: { lines: [{ productSlug: lowFixtureSlug, variantId: lowFixtureVariantId, quantity: 1 }] }, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86_400_000) });
    await context.addCookies([{ name: "athar_guest_cart", value: guestId, domain: new URL(baseURL!).hostname, path: "/" }]);

    await page.goto("/checkout");
    await saveSwedishAddress(page);
    checkoutId = await page.locator('input[name="checkoutId"]').first().inputValue();
    await page.getByRole("radio", { name: /PostNord 59 kr/ }).check();
    const form = page.getByRole("heading", { name: "Choose your delivery method" }).locator("xpath=../following-sibling::form");
    await form.evaluate((element) => element.addEventListener("formdata", (event) => {
      event.formData.set("shippingAmountMinor", "1");
      event.formData.set("grandTotal", "1");
      event.formData.set("vatTotal", "1");
      event.formData.set("discountTotal", "59900");
    }, { once: true }));
    await page.getByRole("button", { name: "Save delivery method" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Delivery method saved." })).toBeVisible();
    const summary = page.getByLabel("Checkout summary");
    await expect(summary).toContainText("Subtotal");
    await expect(summary).toContainText("599 kr");
    await expect(summary).toContainText("Shipping");
    await expect(summary).toContainText("59 kr");
    await expect(summary).toContainText("VAT included (25%)");
    await expect(summary).toContainText("131,60 kr");
    await expect(summary).toContainText("Total");
    await expect(summary).toContainText("658 kr");
    expect(new URL(page.url()).search).toBe("");
    expect((await drafts.findOne({ checkoutId }))?.selectedShippingMethodId).toBe("postnord-service-point-se");

    await carts.updateOne({ ownerType: "guest", ownerId: guestId }, { $set: { state: { lines: [{ productSlug: highFixtureSlug, variantId: highFixtureVariantId, quantity: 1 }] }, updatedAt: new Date() }, $inc: { revision: 1 } });
    await page.reload();
    await expect(summary).toContainText("Free");
    await expect(summary).toContainText("VAT included (25%)");
    await expect(summary).toContainText("259,80 kr");
    await expect(summary).toContainText("1 299 kr");
  } finally {
    if (checkoutId) await drafts.deleteMany({ checkoutId }).catch(() => undefined);
    await carts.deleteMany({ ownerType: "guest", ownerId: guestId }).catch(() => undefined);
    expect(await drafts.countDocuments({ checkoutId })).toBe(0);
    expect(await carts.countDocuments({ ownerType: "guest", ownerId: guestId })).toBe(0);
    await mongo.close().catch(() => undefined);
  }
});
