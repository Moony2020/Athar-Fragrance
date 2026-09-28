import { expect, test } from "@playwright/test";
import { unlink } from "node:fs/promises";
import { MongoClient } from "mongodb";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const mailSecret = process.env.ATHAR_TEST_MAIL_SECRET;

test("Phase 6 account reset preserves authenticated user-owned Cart and Wishlist", async ({ page, browser }) => {
  test.setTimeout(180_000);
  test.skip(!mongoReady, "requires dedicated athar_stage55_test Mongo configuration");
  test.skip(!mailSecret, "requires the non-production protected test-mail adapter");

  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  await mongo.connect();
  const database = mongo.db("athar_stage55_test");
  const users = database.collection("users");
  const credentials = database.collection("user_credentials");
  const carts = database.collection("carts");
  const wishlists = database.collection("wishlists");
  const email = `stage66-integration-${Date.now()}@example.invalid`;
  const isolationEmail = `stage66-isolation-${Date.now()}@example.invalid`;
  const oldPassword = "Phase six old password 12345";
  const newPassword = "Phase six new password 67890";
  let userId: string | undefined;
  let staleContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let isolationContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  try {
    await page.goto("/account/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    const user = await users.findOne({ normalizedEmail: email.toLowerCase() });
    expect(user?.userId).toBeTruthy();
    userId = user!.userId;

    staleContext = await browser.newContext();
    await staleContext.addCookies(await page.context().cookies());

    await page.goto("/shop");
    const card = page.locator("article[aria-label]").filter({ has: page.locator('a[href="/products/athar-test-no-01"]') });
    const productHref = await card.locator('a[href^="/products/"]').first().getAttribute("href");
    const productLinkLabel = await card.locator('a[href^="/products/"]').first().getAttribute("aria-label");
    expect(productHref).toMatch(/^\/products\/[a-z0-9-]+$/);
    expect(productLinkLabel).toMatch(/^View .+/);
    const productSlug = productHref!.split("/").at(-1)!;
    const productName = productLinkLabel!.replace(/^View /, "");
    const addCart = card.getByRole("button", { name: /^Add .+ to (?:cart|bag)$/ });
    await expect(addCart).toBeEnabled();
    await addCart.click();
    await expect(addCart).toContainText("ADDED");
    await expect.poll(async () => {
      const cart = await carts.findOne({ ownerType: "user", ownerId: userId });
      return Boolean(cart?.state.lines.some((line: { productSlug: string }) => line.productSlug === productSlug));
    }).toBe(true);
    const addWishlist = card.getByRole("button", { name: /^Add .+ to wishlist$/ });
    await addWishlist.click();
    await expect.poll(async () => {
      const wishlist = await wishlists.findOne({ ownerType: "user", ownerId: userId });
      return Boolean(wishlist?.state.productSlugs.includes(productSlug));
    }).toBe(true);

    const userCart = await carts.findOne({ ownerType: "user", ownerId: userId });
    const userWishlist = await wishlists.findOne({ ownerType: "user", ownerId: userId });
    expect(userCart?.state.lines).toContainEqual(expect.objectContaining({ productSlug, quantity: 1 }));
    expect(userWishlist?.state.productSlugs).toContain(productSlug);
    expect(await carts.countDocuments({ ownerType: "guest", ownerId: userId })).toBe(0);
    expect(await wishlists.countDocuments({ ownerType: "guest", ownerId: userId })).toBe(0);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "athar_guest_cart" || cookie.name === "athar_guest_wishlist")).toBe(false);

    isolationContext = await browser.newContext();
    const isolationPage = await isolationContext.newPage();
    await isolationPage.goto("/account/register");
    await isolationPage.getByLabel("Email").fill(isolationEmail);
    await isolationPage.getByLabel("Password").fill("Second isolated account password");
    await isolationPage.getByRole("button", { name: "Create account" }).click();
    await expect(isolationPage).toHaveURL(/\/account$/);
    const isolationUser = await users.findOne({ normalizedEmail: isolationEmail.toLowerCase() }, { projection: { userId: 1 } });
    expect(isolationUser?.userId).toBeTruthy();
    await isolationPage.goto("/cart");
    await expect(isolationPage.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await isolationPage.goto("/wishlist");
    await expect(isolationPage.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
    const isolatedCart = await carts.findOne({ ownerType: "user", ownerId: isolationUser!.userId });
    const isolatedWishlist = await wishlists.findOne({ ownerType: "user", ownerId: isolationUser!.userId });
    expect(isolatedCart?.state.lines ?? []).toEqual([]);
    expect(isolatedWishlist?.state.productSlugs ?? []).toEqual([]);

    await page.goto("/cart");
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: /Your wishlist/ })).toBeVisible();
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible();

    await page.goto("/account/forgot-password");
    const origin = new URL(page.url()).origin;
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
    const captured = await page.request.get(`${origin}/api/testing/password-reset-mail`, {
      headers: { "x-athar-test-mail-secret": mailSecret! },
    });
    const messages = (await captured.json()).messages as Array<{ resetUrl: string }>;
    expect(messages).toHaveLength(1);
    const resetToken = new URL(messages[0].resetUrl).searchParams.get("token");
    expect(resetToken).toBeTruthy();
    await page.goto(`/account/reset-password?token=${encodeURIComponent(resetToken!)}`);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated");

    const stalePage = await staleContext!.newPage();
    await stalePage.goto("/account");
    await expect(stalePage).toHaveURL(/\/account\/sign-in/);
    await staleContext!.close();
    staleContext = undefined;

    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password. Please check your credentials and try again.", { exact: true })).toBeVisible();
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/cart");
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible();
    expect((await carts.findOne({ ownerType: "user", ownerId: userId }))?.state.lines).toContainEqual(expect.objectContaining({ productSlug, quantity: 1 }));
    expect((await wishlists.findOne({ ownerType: "user", ownerId: userId }))?.state.productSlugs).toContain(productSlug);
  } finally {
    await staleContext?.close().catch(() => undefined);
    await isolationContext?.close().catch(() => undefined);
    const usersToClean = await users.find({ normalizedEmail: { $in: [email.toLowerCase(), isolationEmail.toLowerCase()] } }, { projection: { userId: 1 } }).toArray();
    const ownedIds = [...new Set([...usersToClean.map((user) => user.userId), ...(userId ? [userId] : [])])];
    if (ownedIds.length) {
      await database.collection("password_reset_tokens").deleteMany({ userId: { $in: ownedIds } });
      await credentials.deleteMany({ userId: { $in: ownedIds } });
      await carts.deleteMany({ ownerType: "user", ownerId: { $in: ownedIds } });
      await wishlists.deleteMany({ ownerType: "user", ownerId: { $in: ownedIds } });
      await database.collection("commerce_merges").deleteMany({ userId: { $in: ownedIds } });
      await users.deleteMany({ userId: { $in: ownedIds } });
    }
    await mongo.close();
    if (process.env.ATHAR_TEST_MAIL_OUTBOX) await unlink(process.env.ATHAR_TEST_MAIL_OUTBOX).catch(() => undefined);
  }
});
