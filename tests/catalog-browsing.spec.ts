import { expect, test } from "@playwright/test";

const usesFixtureRuntime = process.env.CATALOG_FIXTURE_RUNTIME === "1";

test.describe("development catalog fixture runtime", () => {
  test.skip(!usesFixtureRuntime, "These assertions run against the development fixture source only.");

test("shop renders the canonical active development catalog with normalized money", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Shop Fragrances" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Catalog products" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Versace Eros Eau de Parfum" })).toBeVisible();
  await expect(page.getByText("1 299 kr", { exact: true })).toBeVisible();
  await expect(page.getByText("Floral Study", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Archive Sample", { exact: true })).toHaveCount(0);
});

test("audience routes are validated and expose only active public fixtures", async ({ page }) => {
  await page.goto("/shop/men");
  await expect(page.getByRole("heading", { name: "For Him" })).toBeVisible();
  await expect(page.getByText("BOSS Bottled", { exact: true })).toBeVisible();
  await expect(page.getByText("Eros", { exact: true })).toHaveCount(0);

});

test("collection routes render public products or an accessible empty state", async ({ page }) => {
  await page.goto("/collections/test-unisex");
  await expect(page.getByRole("heading", { name: "Test Unisex" })).toBeVisible();
  await expect(page.getByText("Eros", { exact: true })).toBeVisible();

  await page.goto("/collections/test-women");
  await expect(page.getByText("Libre", { exact: true })).toBeVisible();

});

});

test("invalid catalog parameters render the not-found surface", async ({ page }) => {
  await page.goto("/shop/not-audience");
  await expect(page.getByRole("heading", { name: "This page is not available." })).toBeVisible();

  await page.goto("/collections/NOT_VALID");
  await expect(page.getByRole("heading", { name: "This page is not available." })).toBeVisible();
});

test("production without configured catalog data does not expose fixtures", async ({ page }) => {
  test.skip(usesFixtureRuntime, "The development fixture run deliberately exercises the non-production source.");

  await page.goto("/shop");
  await expect(page.getByRole("status")).toHaveText("Catalog browsing is temporarily unavailable.");
  await expect(page.getByText("Eros", { exact: true })).toHaveCount(0);
});

test("homepage catalog links lead only to implemented catalog routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  await expect(page.getByRole("link", { name: "Browse For Her collection" })).toHaveAttribute("href", "/shop/women");
  await expect(page.getByRole("link", { name: "Browse For Him collection" })).toHaveAttribute("href", "/shop/men");
  await expect(page.getByRole("link", { name: "Browse Unisex collection" })).toHaveAttribute("href", "/shop/unisex");
});

for (const width of [360, 430, 768, 1280, 1600]) {
  test(`catalog browsing has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
