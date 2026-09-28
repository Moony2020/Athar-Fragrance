import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

import type { CheckoutDraftDocument } from "../src/checkout/draft-document";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const fixtureSlug = "athar-test-no-01";
const canonicalVariantId = createHash("sha256").update("athar-development:variant:ATHAR-TEST-01-50").digest("hex").slice(0, 24);
const availableVariantId = createHash("sha256").update(`${fixtureSlug}:${canonicalVariantId}`).digest("base64url").slice(0, 18);
const opaqueId = () => randomBytes(32).toString("base64url");

async function fillAddress(page: import("@playwright/test").Page, countryCode: string) {
  await page.getByLabel("Email address").fill("stage73@example.invalid");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Address line 1").fill("12 Main Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Stockholm");
  await page.getByLabel("Country code").fill(countryCode);
}

test.describe("Stage 7.3 shipping delivery selection", () => {
  test.skip(!mongoReady, "requires the dedicated athar_stage55_test Mongo configuration");

  test("guest selects server-derived PostNord delivery, persists on reload, and loses it for a non-SE address", async ({ page, context, baseURL }) => {
    const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
    const database = mongo.db("athar_stage55_test");
    const carts = database.collection("carts");
    const drafts = database.collection<CheckoutDraftDocument>("checkout_drafts");
    const guestId = opaqueId();
    const draftIds: string[] = [];
    const now = new Date();
    try {
      await mongo.connect();
      await carts.insertOne({ _id: new ObjectId(), ownerType: "guest", ownerId: guestId, revision: 1, state: { lines: [{ productSlug: fixtureSlug, variantId: availableVariantId, quantity: 1 }] }, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86_400_000) });
      await context.addCookies([{ name: "athar_guest_cart", value: guestId, domain: new URL(baseURL!).hostname, path: "/" }]);
      await page.goto("/checkout");
      await fillAddress(page, "SE");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByRole("heading", { name: "Choose your delivery method" })).toBeVisible();
      await expect(page.getByText("PostNord")).toBeVisible();
      // This fixture's current canonical subtotal is above the owner-approved
      // threshold, so the browser must display the server-derived free result.
      await expect(page.getByRole("radio", { name: /PostNord Free/ })).toBeVisible();
      expect(new URL(page.url()).search).toBe("");

      const checkoutId = await page.locator('input[name="checkoutId"]').first().inputValue();
      draftIds.push(checkoutId);
      await page.getByRole("radio", { name: /PostNord/ }).check();
      await page.getByRole("button", { name: "Save delivery method" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Delivery method saved." })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("radio", { name: /PostNord/ })).toBeChecked();
      expect((await drafts.findOne({ checkoutId }))?.selectedShippingMethodId).toBe("postnord-service-point-se");

      await fillAddress(page, "FI");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByText("Shipping is not available to this country yet.")).toBeVisible();
      expect((await drafts.findOne({ checkoutId }))?.selectedShippingMethodId).toBeUndefined();
    } finally {
      await drafts.deleteMany({ checkoutId: { $in: draftIds } }).catch(() => undefined);
      await carts.deleteMany({ ownerType: "guest", ownerId: guestId }).catch(() => undefined);
      expect(await drafts.countDocuments({ checkoutId: { $in: draftIds } })).toBe(0);
      expect(await carts.countDocuments({ ownerType: "guest", ownerId: guestId })).toBe(0);
      await mongo.close().catch(() => undefined);
    }
  });

});
