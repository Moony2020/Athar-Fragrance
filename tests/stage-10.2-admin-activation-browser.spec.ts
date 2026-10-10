import { expect, test } from "@playwright/test";

test("activation fragment, independent visibility controls, and non-clickable success guidance", async ({ page }) => {
  const syntheticToken = "t".repeat(43);
  await page.route("**/api/admin/activate", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) });
  });
  await page.goto(`/admin/activate#token=${syntheticToken}`);

  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/activate$/);
  await expect(page.getByText("This activation link is invalid, expired, or already used.", { exact: false })).toHaveCount(0);

  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await expect(confirmation).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show confirm password", exact: true }).click();
  await expect(confirmation).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(confirmation).toHaveAttribute("type", "text");

  await password.fill("SyntheticPassphrase123");
  await confirmation.fill("SyntheticPassphrase123");
  await page.getByRole("button", { name: "Activate Admin account" }).click();
  await expect(page.getByRole("status")).toContainText("Your Admin account is activated.");
  await expect(page.getByRole("status")).toContainText("Admin sign-in will be available in a later Admin Portal gate.");
  await expect(page.locator('a[href="/admin/login"]')).toHaveCount(0);
});
