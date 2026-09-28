import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { MongoClient } from "mongodb";

const email = process.env.STAGE62_E2E_EMAIL ?? `stage62-e2e-${Date.now()}@example.invalid`;
const password = "Correct horse battery staple 42";

test("registration, sign-in, protected account, and sign-out work through the browser", async ({ page }) => {
  await page.goto("/account/register");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.goto("/account/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Unable to create account.");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const signInError = await page.locator("p[role=alert]").textContent().catch(() => null);
  expect(signInError).toBe("Invalid email or password. Please check your credentials and try again.");

  const mongo = new MongoClient(process.env.MONGODB_URI!);
  await mongo.connect();
  const users = mongo.db(process.env.MONGODB_DB_NAME).collection("users");
  const credentials = mongo.db(process.env.MONGODB_DB_NAME).collection("user_credentials");
  const disabledUserId = randomBytes(32).toString("base64url");
  const disabledEmail = `stage62-disabled-${Date.now()}@example.invalid`;
  const now = new Date();
  await users.insertOne({ userId: disabledUserId, normalizedEmail: disabledEmail, createdAt: now, updatedAt: now });
  await credentials.insertOne({ userId: disabledUserId, passwordHash: await argon2.hash(password, { type: argon2.argon2id, timeCost: 3, memoryCost: 65536, parallelism: 4 }), disabledAt: now, createdAt: now, updatedAt: now });
  await page.getByLabel("Email").fill(disabledEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Invalid email or password. Please check your credentials and try again.");
  await credentials.deleteOne({ userId: disabledUserId });
  await users.deleteOne({ userId: disabledUserId });
  await mongo.close();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(/^User ID:/)).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/sign-in$/);
});

test("registration enforces the 12-character password policy", async ({ page }) => {
  await page.goto("/account/register");
  await page.getByLabel("Email").fill(`stage62-policy-${Date.now()}@example.invalid`);
  await page.getByLabel("Password").fill("short");
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "12");
});

test("registration rejects a password made only of digits", async ({ page }) => {
  await page.goto("/account/register");
  await page.getByLabel("Email").fill(`stage62-numeric-${Date.now()}@example.invalid`);
  await page.getByLabel("Password").fill("123456789012");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Unable to create account.");
  await expect(page.getByText("Account created. You can now sign in.")).toHaveCount(0);
});
