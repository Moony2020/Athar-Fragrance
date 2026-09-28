import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("authenticated account reads and updates canonical display name", async ({ page }) => {
  const email = `stage63-e2e-${Date.now()}@example.invalid`;
  const password = "Correct horse battery staple 42";
  await page.goto("/account/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Account created");
  await page.goto("/account/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
  await page.getByLabel("Display name").fill("  Atelier Guest  ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Atelier Guest");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
});

test("unauthenticated visitors are redirected from the account shell", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/sign-in$/);
});

test("credentials sign-in keeps submitted values out of URLs", async ({ page }) => {
  const email = `stage63-url-${Date.now()}@example.invalid`;
  const password = `Auth-${randomBytes(16).toString("base64url")}`;
  const requestUrls: string[] = [];

  page.on("request", (request) => requestUrls.push(request.url()));
  await page.goto("/account/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/account\/sign-in$/);
  expect(requestUrls.some((url) => {
    const decodedUrl = decodeURIComponent(url);
    return decodedUrl.includes(email) || decodedUrl.includes(password);
  })).toBe(false);
  await expect(page.locator('p[role="alert"]')).toHaveText("Unable to sign in with those details.");
});
