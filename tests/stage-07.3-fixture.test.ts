import assert from "node:assert/strict";
import test from "node:test";

import { getDevelopmentBrands, getDevelopmentProducts } from "../src/server/catalog/development-source";

const fixtureSlug = "athar-stage73-test-under-threshold";

test("Stage 7.3 under-threshold catalog fixture is test-runtime-only and never seeded", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFixtureRuntime = process.env.CATALOG_FIXTURE_RUNTIME;
  try {
    process.env.NODE_ENV = "development";
    delete process.env.CATALOG_FIXTURE_RUNTIME;
    assert.equal(getDevelopmentProducts().some((product) => product.slug === fixtureSlug), false);

    process.env.CATALOG_FIXTURE_RUNTIME = "1";
    const product = getDevelopmentProducts().find((candidate) => candidate.slug === fixtureSlug);
    assert.equal(product?.variants[0]?.priceMinor, 59_900);
    assert.equal(product?.variants[0]?.inventoryQuantity, 10);
    assert.equal(getDevelopmentBrands().some((brand) => brand.slug === "athar-stage73-test-lab"), true);

    process.env.NODE_ENV = "production";
    assert.equal(getDevelopmentProducts().some((candidate) => candidate.slug === fixtureSlug), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousFixtureRuntime === undefined) delete process.env.CATALOG_FIXTURE_RUNTIME;
    else process.env.CATALOG_FIXTURE_RUNTIME = previousFixtureRuntime;
  }
});
