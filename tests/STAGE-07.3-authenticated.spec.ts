import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

import { registerCustomer } from "../src/server/auth/registration";

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
const postNordId = "postnord-service-point-se";

async function fillAddress(page: Page, email: string, countryCode: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Address line 1").fill("12 Test Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Stockholm");
  await page.getByLabel("Country code").fill(countryCode);
}

test("Stage 7.3 authenticated harness: session then checkout smoke", async ({ page }) => {
  test.skip(!enabled, "requires athar_stage55_test");
  const email = `stage73-${opaqueId().slice(0, 10)}@example.invalid`;
  const password = `Stage73-${opaqueId().slice(0, 20)}a1`;
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const database = mongo.db("athar_stage55_test");
  let userId = "";
  let canonicalEmail = "";
  try {
  await test.step("A: create disposable fixture and establish authenticated session", async () => {
    await mongo.connect();
    const user = await registerCustomer({ email, password });
    userId = user.userId;
    canonicalEmail = user.email;
    await database.collection("carts").insertOne({ _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { lines: [{ productSlug: lowFixtureSlug, variantId: lowFixtureVariantId, quantity: 1 }] }, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
    await page.goto("/account/sign-in", { waitUntil: "load", timeout: 15_000 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  });
  await test.step("B: open authenticated checkout", async () => {
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(response?.status()).toBe(200);
    const checkoutState = () => page.evaluate(() => {
      const text = document.body.innerText;
      return {
        review: text.includes("Review your bag"),
        loading: text.includes("Preparing your bag"),
        empty: text.includes("Your bag is empty"),
        unavailable: text.includes("We can’t read your bag right now."),
      };
    });
    try {
      await expect.poll(checkoutState, { timeout: 10_000 }).toMatchObject({ review: true });
    } catch {
      throw new Error(`Checkout safe state: ${JSON.stringify(await checkoutState())}`);
    }
    await expect(page.getByRole("heading", { name: "Review your bag" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Email address")).toHaveValue(canonicalEmail, { timeout: 10_000 });

    await fillAddress(page, canonicalEmail, "SE");
    await page.getByRole("button", { name: "Save contact & address" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Contact and shipping address saved." })).toBeVisible();
    const lowPostNord = page.getByRole("radio", { name: /PostNord 59 kr/ });
    await expect(lowPostNord).toBeVisible();
    const checkoutId = await page.locator('input[name="checkoutId"]').first().inputValue();
    await lowPostNord.check();
    await page.getByRole("button", { name: "Save delivery method" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Delivery method saved." })).toBeVisible();
    await expect(page.getByLabel("Checkout summary")).toContainText("59 kr");
    const draft = await database.collection("checkout_drafts").findOne({ checkoutId, ownerType: "user", ownerId: userId });
    expect(draft?.selectedShippingMethodId).toBe(postNordId);
    expect(draft).not.toHaveProperty("shippingAmountMinor");
    await page.reload();
    await expect(page.getByRole("radio", { name: /PostNord 59 kr/ })).toBeChecked();

    await database.collection("carts").updateOne({ ownerType: "user", ownerId: userId }, { $set: { state: { lines: [{ productSlug: highFixtureSlug, variantId: highFixtureVariantId, quantity: 1 }] }, updatedAt: new Date() }, $inc: { revision: 1 } });
    await page.reload();
    await expect(page.getByRole("radio", { name: /PostNord Free/ })).toBeChecked();
    await expect(page.getByLabel("Checkout summary")).toContainText("Free");

    const shippingForm = page.getByRole("heading", { name: "Choose your delivery method" }).locator("xpath=../following-sibling::form");
    await shippingForm.evaluate((form) => form.addEventListener("formdata", (event) => event.formData.set("shippingAmountMinor", "1"), { once: true }));
    await page.getByRole("button", { name: "Save delivery method" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Delivery method saved." })).toBeVisible();
    await expect(page.getByLabel("Checkout summary")).toContainText("Free");

    await page.reload();
    const tamperedShippingForm = page.getByRole("heading", { name: "Choose your delivery method" }).locator("xpath=../following-sibling::form");
    await tamperedShippingForm.evaluate((form) => form.addEventListener("formdata", (event) => event.formData.set("shippingMethodId", "made-up-method"), { once: true }));
    await page.getByRole("button", { name: "Save delivery method" }).click();
    await expect(page.getByText("This delivery method is no longer available. Review your address and bag.")).toBeVisible();
    expect((await database.collection("checkout_drafts").findOne({ checkoutId }))?.selectedShippingMethodId).toBe(postNordId);

    await page.reload();
    await fillAddress(page, canonicalEmail, "FI");
    await page.getByRole("button", { name: "Save contact & address" }).click();
    await expect(page.getByText("Shipping is not available to this country yet.")).toBeVisible();
    expect((await database.collection("checkout_drafts").findOne({ checkoutId }))?.selectedShippingMethodId).toBeUndefined();
    await fillAddress(page, canonicalEmail, "SE");
    await page.getByRole("button", { name: "Save contact & address" }).click();
    await expect(page.getByRole("radio", { name: /PostNord Free/ })).not.toBeChecked();
  });
  } finally {
    const database = mongo.db("athar_stage55_test");
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
