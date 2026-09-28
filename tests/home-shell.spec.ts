import { expect, test } from "@playwright/test";
import { instant } from "@next/playwright";

test("the public homepage shell contains the ATHAR hero", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scents That Stay With You" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the fragrance" })).toBeVisible();
  await expect(page.getByAltText("ATHAR Eau de Parfum bottle")).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch our story is not available yet" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Shopping bag, 0 items" })).toHaveAttribute("href", "/cart");
  await expect(page.getByRole("heading", { name: "Shop by Collection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fragrance Icons" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discover Your Signature" })).toBeVisible();
});

test("the public homepage shell is available through the instant-navigation rig", async ({ page }) => {
  await instant(
    page,
    async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Scents That Stay With You" })).toBeVisible();
    },
    { baseURL: process.env.INSTANT_BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:3100" },
  );
});

test("Shop by Collection provides reachable presentation links without viewport overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shop by Collection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse For Her collection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse For Him collection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Unisex collection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse New Arrivals collection" })).toBeVisible();

  for (const width of [360, 430, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("Fragrance Icons presents separate fragrance cards with clearly labeled visual and price references", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Fragrance Icons" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore fragrances" })).toHaveAttribute("href", "/shop");
  const fragranceList = page.getByRole("list", { name: "Selected fragrance references" });
  await expect(fragranceList.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Scroll fragrances left" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Scroll fragrances right" })).toBeEnabled();
  for (const fragrance of ["Sauvage", "Eros", "Libre", "La Vie Est Belle", "Acqua di Giò"]) {
    await expect(page.getByRole("heading", { name: fragrance, level: 3 })).toBeVisible();
  }
  const diorImage = page.getByRole("img", { name: /Dior Sauvage Eau de Toilette, 100 ml/ });
  await expect(diorImage).toBeVisible();
  await expect.poll(() => diorImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const armaniImage = page.getByRole("img", { name: /Giorgio Armani Acqua di Giò Eau de Toilette, 100 ml/ });
  await expect.poll(() => armaniImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(/Retail reference prices from KICKS Sweden.*not ATHAR sale prices/i)).toBeVisible();

  await page.getByRole("button", { name: "Scroll fragrances right" }).click();
  await expect(page.getByRole("button", { name: "Scroll fragrances left" })).toBeEnabled();
  await expect.poll(() => fragranceList.evaluate((list) => list.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Scroll fragrances left" }).click();
  await expect.poll(() => fragranceList.evaluate((list) => list.scrollLeft)).toBe(0);

  for (const [width, expectedVisibleCards] of [[360, 2], [430, 2], [768, 3], [1280, 4], [1600, 5]]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(fragranceList.getByRole("listitem")).toHaveCount(5);
    const visibleCards = await fragranceList.evaluate((list) => {
      const track = list.getBoundingClientRect();
      return Array.from(list.children).filter((item) => {
        const card = item.getBoundingClientRect();
        return card.right > track.left + 1 && card.left < track.right - 1;
      }).length;
    });
    expect(visibleCards).toBe(expectedVisibleCards);
  }
});

test("Our Story preserves the prototype narrative and a deferred story link", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "More Than a Perfume, It's a Feeling" })).toBeVisible();
  await expect(page.locator("blockquote").last()).toHaveText("“Fragrance turns moments into memories.”");
  await expect(page.locator("#story svg").last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover Our Story" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Fragrance Guide preserves the four prototype families with deferred links", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Discover Your Signature" })).toBeVisible();
  for (const family of ["Floral", "Woody", "Fresh", "Oriental"]) {
    await expect(page.getByRole("link", { name: `Explore ${family} fragrance family (not available yet)` })).toBeVisible();
  }

  for (const width of [360, 430, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("the production footer preserves reachable homepage navigation without fake destinations", async ({ page }) => {
  await page.goto("/");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("heading", { name: "ATHAR" })).toBeVisible();
  await expect(footer.getByRole("navigation", { name: "Footer navigation" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Collections" })).toHaveAttribute("href", "#collections");
  await expect(footer.getByRole("link", { name: "Fragrance Guide" })).toHaveAttribute("href", "#guide");
  await expect(footer.getByText("Boutiques", { exact: true })).toBeVisible();
  await expect(footer.getByText("Contact", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);

  for (const width of [360, 430, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
