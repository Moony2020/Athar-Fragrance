import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import argon2 from "argon2";
import { MongoClient } from "mongodb";

const ready = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
const testMailSecret = process.env.ATHAR_TEST_MAIL_SECRET;
const testMailOutbox = process.env.ATHAR_TEST_MAIL_OUTBOX;

test("forgot-password email capture, reset, and old-session invalidation", async ({ page, browser }) => {
  test.setTimeout(180_000);
  test.skip(!ready, "requires dedicated athar_stage55_test Mongo configuration");
  test.skip(!testMailSecret || !testMailOutbox, "requires the local secret-protected file-backed test-mail adapter");

  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB_NAME);
  const suffix = `${Date.now()}-${randomBytes(5).toString("hex")}`;
  const email = `stage65-e2e-${suffix}@example.invalid`;
  const disabledEmail = `stage65-disabled-${suffix}@example.invalid`;
  const userId = randomBytes(32).toString("base64url");
  const disabledUserId = randomBytes(32).toString("base64url");
  const oldPassword = "Browser old password 12345";
  const newPassword = "Browser new password 67890";
  const users = db.collection("users");
  const credentials = db.collection("user_credentials");
  const tokens = db.collection("password_reset_tokens");
  const now = new Date();

  try {
    await users.insertMany([
      { userId, normalizedEmail: email, displayName: "Reset Test", createdAt: now, updatedAt: now },
      { userId: disabledUserId, normalizedEmail: disabledEmail, displayName: "Disabled Reset Test", createdAt: now, updatedAt: now },
    ]);
    await credentials.insertMany([
      { userId, passwordHash: await argon2.hash(oldPassword, { type: argon2.argon2id, timeCost: 3, memoryCost: 65536, parallelism: 4 }), disabledAt: null, securityVersion: 0, createdAt: now, updatedAt: now },
      { userId: disabledUserId, passwordHash: await argon2.hash(oldPassword, { type: argon2.argon2id, timeCost: 3, memoryCost: 65536, parallelism: 4 }), disabledAt: now, securityVersion: 0, createdAt: now, updatedAt: now },
    ]);

    await page.goto("/account/forgot-password");
    const appOrigin = new URL(page.url()).origin;
    const unauthorizedCapture = await page.request.get(`${appOrigin}/api/testing/password-reset-mail`);
    expect(unauthorizedCapture.status()).toBe(404);
    const authorizedCapture = await page.request.get(`${appOrigin}/api/testing/password-reset-mail`, { headers: { "x-athar-test-mail-secret": testMailSecret! } });
    expect(authorizedCapture.status()).toBe(200);
    expect((await authorizedCapture.json()).messages).toHaveLength(0);

    const activeFixture = await users.findOne({ userId });
    const activeCredentialFixture = await credentials.findOne({ userId });
    expect(activeFixture?.normalizedEmail).toBe(email.toLowerCase());
    expect(activeCredentialFixture?.disabledAt).toBeNull();

    await page.getByLabel("Email").fill(`unknown-${suffix}@example.invalid`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");

    await page.getByLabel("Email").fill(disabledEmail);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
    const emptyOutbox = await page.request.get(`${appOrigin}/api/testing/password-reset-mail`, { headers: { "x-athar-test-mail-secret": testMailSecret! } });
    expect((await emptyOutbox.json()).messages).toHaveLength(0);
    expect(await tokens.findOne({ userId: disabledUserId })).toBeNull();

    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
    const staleContext = await browser.newContext();
    await staleContext.addCookies(await page.context().cookies());
    const stalePage = await staleContext.newPage();

    await page.goto("/account/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
    const firstMailResponse = await page.request.get(`${appOrigin}/api/testing/password-reset-mail`, { headers: { "x-athar-test-mail-secret": testMailSecret! } });
    const firstMessages = (await firstMailResponse.json()).messages as Array<{ to: string; resetUrl: string; expiresMinutes: number }>;
    expect(firstMessages).toHaveLength(1);
    expect(firstMessages[0].to).toBe(email);
    expect(firstMessages[0].expiresMinutes).toBe(30);
    const firstToken = new URL(firstMessages[0].resetUrl).searchParams.get("token");
    expect(firstToken).toBeTruthy();
    const firstHash = createHash("sha256").update(firstToken!).digest("hex");
    const firstDocument = await tokens.findOne({ userId, tokenHash: firstHash });
    expect(firstDocument?.tokenHash).toBe(firstHash);
    expect("token" in (firstDocument ?? {})).toBe(false);

    await tokens.updateOne({ userId, tokenHash: firstHash }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await page.goto(`/account/reset-password?token=${encodeURIComponent(firstToken!)}`);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("This reset link is invalid or expired.", { exact: true })).toBeVisible();

    await page.goto("/account/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
    const replacementResponse = await page.request.get(`${appOrigin}/api/testing/password-reset-mail`, { headers: { "x-athar-test-mail-secret": testMailSecret! } });
    const replacementMessages = (await replacementResponse.json()).messages as Array<{ to: string; resetUrl: string; expiresMinutes: number }>;
    expect(replacementMessages).toHaveLength(2);
    const replacementToken = new URL(replacementMessages[1].resetUrl).searchParams.get("token");
    expect(replacementToken).toBeTruthy();
    const replacementHash = createHash("sha256").update(replacementToken!).digest("hex");
    expect(await tokens.countDocuments({ userId })).toBe(1);
    expect(await tokens.findOne({ userId, tokenHash: firstHash })).toBeNull();
    expect(await tokens.findOne({ userId, tokenHash: replacementHash })).not.toBeNull();

    await page.goto(`/account/reset-password?token=${encodeURIComponent(replacementToken!)}`);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated");
    await stalePage.goto("/account");
    await expect(stalePage).toHaveURL(/\/account\/sign-in/);
    await staleContext.close();

    await page.goto(`/account/reset-password?token=${encodeURIComponent(replacementToken!)}`);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("This reset link is invalid or expired.", { exact: true })).toBeVisible();

    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password. Please check your credentials and try again.", { exact: true })).toBeVisible();
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
    expect(await tokens.findOne({ userId })).toBeNull();
    expect((await credentials.findOne({ userId }))?.securityVersion).toBe(1);
  } finally {
    try {
      await tokens.deleteMany({ userId: { $in: [userId, disabledUserId] } });
      await credentials.deleteMany({ userId: { $in: [userId, disabledUserId] } });
      await users.deleteMany({ userId: { $in: [userId, disabledUserId] } });
      const [remainingUsers, remainingCredentials, remainingTokens] = await Promise.all([
        users.countDocuments({ userId: { $in: [userId, disabledUserId] } }),
        credentials.countDocuments({ userId: { $in: [userId, disabledUserId] } }),
        tokens.countDocuments({ userId: { $in: [userId, disabledUserId] } }),
      ]);
      expect([remainingUsers, remainingCredentials, remainingTokens]).toEqual([0, 0, 0]);
    } finally {
      await unlink(testMailOutbox!).catch(() => undefined);
      await mongo.close();
    }
  }
});
