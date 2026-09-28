import "server-only";

import { createHash } from "node:crypto";

import type { Brand, Collection, Product } from "@/server/catalog/domain";
import { developmentCatalogSeed } from "@/server/catalog/seed/fixtures";
import { validateCatalogSeedDataset } from "@/server/catalog/seed/plan";

function deterministicId(key: string): string {
  return createHash("sha256").update(`athar-development:${key}`).digest("hex").slice(0, 24);
}

const fixtureDataset = validateCatalogSeedDataset(developmentCatalogSeed);
const now = new Date("2026-09-19T00:00:00.000Z");
const stage73ShippingFixtureSlug = "athar-stage73-test-under-threshold";

function isCatalogFixtureRuntimeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CATALOG_FIXTURE_RUNTIME === "1";
}

const brands: Brand[] = fixtureDataset.brands.map((fixture) => ({
  id: deterministicId(`brand:${fixture.key}`),
  ...fixture.input,
  createdAt: now,
  updatedAt: now,
}));

const collections: Collection[] = fixtureDataset.collections.map((fixture) => ({
  id: deterministicId(`collection:${fixture.key}`),
  ...fixture.input,
  createdAt: now,
  updatedAt: now,
}));

const products: Product[] = fixtureDataset.products.map((fixture) => ({
  id: deterministicId(`product:${fixture.key}`),
  ...fixture.input,
  brandId: deterministicId(`brand:${fixture.brandKey}`),
  collectionIds: fixture.collectionKeys.map((key) => deterministicId(`collection:${key}`)),
  variants: fixture.input.variants.map((variant) => ({ ...variant, id: deterministicId(`variant:${variant.sku}`) })),
  createdAt: now,
  updatedAt: now,
}));

// This record is intentionally outside developmentCatalogSeed: it must never
// be written by the catalog seed command or become production catalog data.
const stage73ShippingFixtureBrand: Brand = {
  id: deterministicId("brand:athar-stage73-test-lab"),
  name: "ATHAR Test Lab",
  slug: "athar-stage73-test-lab",
  description: "Fixture-only test brand.",
  status: "active",
  createdAt: now,
  updatedAt: now,
};

const stage73ShippingFixtureProduct: Product = {
  id: deterministicId("product:athar-stage73-test-under-threshold"),
  slug: stage73ShippingFixtureSlug,
  name: "Shipping Threshold Fixture",
  brandId: stage73ShippingFixtureBrand.id,
  fragranceType: "Test Fragrance",
  shortDescription: "Fixture-only checkout test product.",
  description: "A fictional development-only record for checkout shipping verification.",
  audience: "unisex",
  fragranceFamily: "test-fixture",
  notes: { top: ["Test"], heart: ["Fixture"], base: ["Only"] },
  media: [],
  variants: [{ id: deterministicId("variant:ATHAR-STAGE73-TEST-599"), sku: "ATHAR-STAGE73-TEST-599", sizeMl: 50, priceMinor: 59_900, inventoryQuantity: 10, isActive: true }],
  status: "active",
  featured: false,
  bestseller: false,
  collectionIds: [],
  currency: "SEK",
  createdAt: now,
  updatedAt: now,
};

export function getDevelopmentBrands(): Brand[] {
  const source = isCatalogFixtureRuntimeEnabled() ? [...brands, stage73ShippingFixtureBrand] : brands;
  return source.filter((brand) => brand.status === "active");
}

export function getDevelopmentCollections(): Collection[] {
  return collections.filter((collection) => collection.status === "active").sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getDevelopmentProducts(): Product[] {
  const activeBrandIds = new Set(getDevelopmentBrands().map((brand) => brand.id));
  const source = isCatalogFixtureRuntimeEnabled() ? [...products, stage73ShippingFixtureProduct] : products;
  return source.filter((product) => product.status === "active" && activeBrandIds.has(product.brandId));
}
