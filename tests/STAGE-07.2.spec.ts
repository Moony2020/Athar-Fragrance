import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId, type Collection } from "mongodb";

import { guestCommerceOwner, userCommerceOwner } from "../src/commerce/durable-contracts";
import type { CheckoutDraftDocument } from "../src/checkout/draft-document";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const fixtureSlug = "athar-test-no-01";
const canonicalFixtureVariantId = createHash("sha256").update("athar-development:variant:ATHAR-TEST-01-50").digest("hex").slice(0, 24);
// Cart identity is the public variant reference exposed by the catalog, never
// the internal deterministic catalog variant ID.
const availableVariantId = createHash("sha256").update(`${fixtureSlug}:${canonicalFixtureVariantId}`).digest("base64url").slice(0, 18);
const testPassword = "Stage seven checkout address test 12345";
const opaqueId = () => randomBytes(32).toString("base64url");

async function ensureTestDraftIndexes(drafts: Collection<CheckoutDraftDocument>) {
  await drafts.createIndexes([
    { key: { checkoutId: 1 }, name: "checkout_id_unique", unique: true },
    { key: { expiresAt: 1 }, name: "checkout_draft_expiry_ttl", expireAfterSeconds: 0 },
  ]);
}

async function fillAddress(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Address line 1").fill("12 Main Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Stockholm");
  await page.getByLabel("Country code").fill("se");
}

test.describe("Stage 7.2 contact and shipping address", () => {
  test.skip(!mongoReady, "requires the dedicated athar_stage55_test Mongo configuration");

  test("guest saves address, survives reload, rejects invalid/tampered input, and rechecks Cart eligibility", async ({ page, context, baseURL }) => {
    test.setTimeout(150_000);
    const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
    const database = mongo.db("athar_stage55_test");
    const carts = database.collection("carts");
    const drafts = database.collection<CheckoutDraftDocument>("checkout_drafts");
    const guestId = opaqueId();
    const otherGuest = guestCommerceOwner(opaqueId());
    const draftIds: string[] = [];
    const now = new Date();
    let connected = false;
    try {
      await mongo.connect();
      connected = true;
      await ensureTestDraftIndexes(drafts);
      await carts.insertOne({
        _id: new ObjectId(), ownerType: "guest", ownerId: guestId, revision: 1,
        state: { lines: [{ productSlug: fixtureSlug, variantId: availableVariantId, quantity: 1 }] },
        createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });
      await context.addCookies([{ name: "athar_guest_cart", value: guestId, domain: new URL(baseURL!).hostname, path: "/" }]);
      await page.goto("/checkout");
      await expect(page.getByRole("heading", { name: "Where should we reach you?" })).toBeVisible();
      expect(new URL(page.url()).search).toBe("");

      let checkoutId = await page.locator('input[name="checkoutId"]').inputValue();
      draftIds.push(checkoutId);
      const revision = Number(await page.locator('input[name="revision"]').inputValue());
      await fillAddress(page, "not-an-email");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
      expect((await drafts.findOne({ checkoutId }))?.contact).toBeUndefined();

      await fillAddress(page, "guest@example.invalid");
      await carts.updateOne({ ownerType: "guest", ownerId: guestId }, {
        $set: { state: { lines: [{ productSlug: fixtureSlug, variantId: "removed-variant", quantity: 1 }] } },
        $inc: { revision: 1 },
      });
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByText("Your bag has changed and can’t continue yet. Please review it again.")).toBeVisible();
      expect((await drafts.findOne({ checkoutId }))?.contact).toBeUndefined();

      await carts.updateOne({ ownerType: "guest", ownerId: guestId }, {
        $set: { state: { lines: [{ productSlug: fixtureSlug, variantId: availableVariantId, quantity: 1 }] } },
        $inc: { revision: 1 },
      });
      await page.reload();
      checkoutId = await page.locator('input[name="checkoutId"]').inputValue();
      draftIds.push(checkoutId);
      await fillAddress(page, "  Guest@Example.invalid ");
      await page.getByLabel("Address line 2 (optional)").fill("Apartment 4");
      await page.getByLabel("Region / state (optional)").fill("Stockholm County");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Contact and shipping address saved." })).toBeVisible();
      expect(new URL(page.url()).search).toBe("");

      const stored = await drafts.findOne({ checkoutId, ownerType: "guest", ownerId: guestId });
      expect(stored?.contact?.email).toBe("guest@example.invalid");
      expect(stored?.shippingAddress?.countryCode).toBe("SE");
      await page.reload();
      await expect(page.getByLabel("Email address")).toHaveValue("guest@example.invalid");
      await expect(page.getByLabel("Address line 1")).toHaveValue("12 Main Street");
      await expect(page.getByLabel("Address line 2 (optional)")).toHaveValue("Apartment 4");

      const otherDraft = { checkoutId: opaqueId(), ...otherGuest, revision: 1, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
      draftIds.push(otherDraft.checkoutId);
      await drafts.insertOne(otherDraft);
      await page.locator("form").evaluate((form, id) => {
        form.addEventListener("formdata", (event) => event.formData.set("checkoutId", id), { once: true });
      }, otherDraft.checkoutId);
      await fillAddress(page, "attacker@example.invalid");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByText("This checkout session has expired or changed. Reload the page and try again.")).toBeVisible();
      expect((await drafts.findOne({ checkoutId: otherDraft.checkoutId }))?.contact).toBeUndefined();
      const original = await drafts.findOne({ checkoutId, ownerType: "guest", ownerId: guestId });
      expect(original?.contact?.email).toBe("guest@example.invalid");

      expect(revision).toBe(1);
    } finally {
      try {
        if (connected) {
          await carts.deleteOne({ ownerType: "guest", ownerId: guestId });
          await drafts.deleteMany({ checkoutId: { $in: draftIds } });
          expect(await drafts.countDocuments({ checkoutId: { $in: draftIds } })).toBe(0);
          expect(await carts.countDocuments({ ownerType: "guest", ownerId: guestId })).toBe(0);
        }
      } finally {
        await mongo.close().catch(() => undefined);
      }
    }
  });

  test("authenticated email prefills canonically, updates only the checkout, and rejects another user's draft", async ({ page }) => {
    test.setTimeout(150_000);
    const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
    const database = mongo.db("athar_stage55_test");
    const users = database.collection("users");
    const credentials = database.collection("user_credentials");
    const carts = database.collection("carts");
    const drafts = database.collection<CheckoutDraftDocument>("checkout_drafts");
    const email = `stage72-${opaqueId().slice(0, 12)}@example.invalid`.toLowerCase();
    const otherUserId = opaqueId();
    const userIds = [otherUserId];
    let userId = "";
    const draftIds: string[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let connected = false;
    try {
      await mongo.connect();
      connected = true;
      await ensureTestDraftIndexes(drafts);
      await page.goto("/account/register");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(testPassword);
      const accountCreated = page.waitForResponse((response) => response.url().includes("/api/auth/register") && response.status() === 201);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByRole("status")).toHaveText("Account created. You can now sign in.");
      const created = await (await accountCreated).json() as { user?: { userId?: string } };
      userId = created.user?.userId ?? "";
      expect(userId.length >= 32).toBe(true);
      const createdUser = await users.findOne({ userId });
      expect(createdUser).not.toBeNull();
      expect(createdUser!.normalizedEmail === email).toBe(true);
      userIds.push(userId);
      await carts.insertOne({ _id: new ObjectId(), ownerType: "user", ownerId: userId, revision: 1, state: { lines: [{ productSlug: fixtureSlug, variantId: availableVariantId, quantity: 1 }] }, createdAt: now, updatedAt: now, expiresAt });

      const otherOwner = userCommerceOwner(otherUserId);
      const otherDraft = { checkoutId: opaqueId(), ...otherOwner, revision: 1, createdAt: now, updatedAt: now, expiresAt };
      draftIds.push(otherDraft.checkoutId);
      await drafts.insertOne(otherDraft);

      await page.goto("/account/sign-in");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(testPassword);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/account$/);
      await page.goto("/checkout");
      await expect(page.getByRole("heading", { name: "Where should we reach you?" })).toBeVisible();
      await expect(page.getByLabel("Email address")).toHaveValue(email);
      const ownCheckoutId = await page.locator('input[name="checkoutId"]').inputValue();
      draftIds.push(ownCheckoutId);

      await page.locator("form").evaluate((form, id) => {
        form.addEventListener("formdata", (event) => event.formData.set("checkoutId", id), { once: true });
      }, otherDraft.checkoutId);
      await fillAddress(page, email);
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByText("This checkout session has expired or changed. Reload the page and try again.")).toBeVisible();
      expect((await drafts.findOne({ checkoutId: otherDraft.checkoutId }))?.contact).toBeUndefined();

      await page.locator("form").evaluate((form, id) => {
        form.addEventListener("formdata", (event) => event.formData.set("checkoutId", id), { once: true });
      }, ownCheckoutId);
      await fillAddress(page, "checkout-only@example.invalid");
      await page.getByRole("button", { name: "Save contact & address" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Contact and shipping address saved." })).toBeVisible();

      const savedDraft = await drafts.findOne({ checkoutId: ownCheckoutId, ownerType: "user", ownerId: userId });
      expect(savedDraft?.contact?.email).toBe("checkout-only@example.invalid");
      expect((await users.findOne({ userId }))?.normalizedEmail).toBe(email);
      await page.reload();
      await expect(page.getByLabel("Email address")).toHaveValue("checkout-only@example.invalid");
    } finally {
      try {
        if (connected) {
          const userIdFilter = { $in: userIds };
          await database.collection("password_reset_tokens").deleteMany({ userId: userIdFilter });
          await carts.deleteMany({ ownerType: "user", ownerId: userIdFilter });
          await credentials.deleteMany({ userId: userIdFilter });
          await database.collection("commerce_merges").deleteMany({ userId: userIdFilter });
          await users.deleteMany({ userId: userIdFilter });
          await drafts.deleteMany({ checkoutId: { $in: draftIds } });
          expect(await users.countDocuments({ userId: userIdFilter })).toBe(0);
          expect(await carts.countDocuments({ ownerType: "user", ownerId: userIdFilter })).toBe(0);
          expect(await credentials.countDocuments({ userId: userIdFilter })).toBe(0);
          expect(await drafts.countDocuments({ checkoutId: { $in: draftIds } })).toBe(0);
        }
      } finally {
        await mongo.close().catch(() => undefined);
      }
    }
  });
});
