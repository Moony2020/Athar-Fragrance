import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckoutReadModel, type CheckoutCartSnapshot } from "../src/checkout/domain";

const validLine = {
  productSlug: "cedar-study",
  productName: "Cedar Study",
  brandName: "ATHAR",
  fragranceType: "Eau de Parfum",
  variantId: "cedar-50",
  sizeMl: 50,
  media: { src: "/images/catalog/cedar-study-v1.webp", alt: "Cedar Study front view" },
  quantity: 2,
  priceMinor: 149_900,
  subtotalMinor: 149_900,
  currency: "SEK",
  availability: "available" as const,
};

function cart(lines: CheckoutCartSnapshot["lines"], availability: CheckoutCartSnapshot["availability"] = "available"): CheckoutCartSnapshot {
  return { availability, lines };
}

test("empty and unavailable carts cannot start checkout", () => {
  assert.deepEqual(buildCheckoutReadModel(cart([])).blockReasons, ["EMPTY_CART"]);
  assert.equal(buildCheckoutReadModel(cart([], "unavailable")).status, "blocked");
  assert.deepEqual(buildCheckoutReadModel(cart([], "unavailable")).blockReasons, ["CART_UNAVAILABLE", "EMPTY_CART"]);
});

test("checkout reprojects only canonical current-price fields and recalculates minor-unit subtotal", () => {
  const model = buildCheckoutReadModel(cart([{ ...validLine, priceMinor: 131_250, subtotalMinor: 999_999 } as typeof validLine & { _id: string; ownerId: string; totalMinor: number }]));
  assert.equal(model.status, "ready");
  assert.equal(model.lines[0]?.status, "eligible");
  if (model.lines[0]?.status === "eligible") {
    assert.equal(model.lines[0].priceMinor, 131_250);
    assert.equal(model.lines[0].subtotalMinor, 262_500);
    assert.deepEqual(model.lines[0].media, validLine.media);
    assert.equal(model.lines[0].fragranceType, validLine.fragranceType);
  }
  assert.equal(model.eligibleSubtotalMinor, 262_500);
  assert.equal(JSON.stringify(model).includes("_id"), false);
  assert.equal(JSON.stringify(model).includes("ownerId"), false);
});

test("stale and unavailable lines stay visible and block checkout; only eligible prices subtotal", () => {
  const stale = { ...validLine, productSlug: "retired-scent", productName: null, brandName: null, priceMinor: null, subtotalMinor: null, currency: null, availability: "stale" as const };
  const unavailable = { ...validLine, variantId: "cedar-unavailable", priceMinor: null, subtotalMinor: null, availability: "unavailable" as const };
  const model = buildCheckoutReadModel(cart([validLine, stale, unavailable]));
  assert.equal(model.status, "blocked");
  assert.deepEqual(model.lines.map((line) => line.status), ["eligible", "needs-attention", "needs-attention"]);
  assert.equal(model.eligibleSubtotalMinor, 299_800);
  assert.ok(model.blockReasons.includes("REVIEW_CART_ITEMS"));
});

test("quantity must stay integer and within the existing one-to-twelve Cart contract", () => {
  for (const quantity of [0, 13, 1.5]) {
    const model = buildCheckoutReadModel(cart([{ ...validLine, quantity }]));
    assert.equal(model.status, "blocked");
    assert.ok(model.blockReasons.includes("INVALID_CART_DATA"));
  }
});

test("mixed currencies are visible but cannot be combined into one checkout total", () => {
  const model = buildCheckoutReadModel(cart([validLine, { ...validLine, productSlug: "other-scent", currency: "EUR" }]));
  assert.equal(model.status, "blocked");
  assert.equal(model.currency, null);
  assert.ok(model.blockReasons.includes("MIXED_CURRENCIES"));
});

test("browser-supplied decorative or owner fields never flow into the public checkout DTO", () => {
  const model = buildCheckoutReadModel(cart([{ ...validLine, _id: "mongo-id", ownerId: "attacker", passwordHash: "never-public" } as typeof validLine & { _id: string; ownerId: string; passwordHash: string }]));
  const serialized = JSON.stringify(model);
  assert.equal(serialized.includes("mongo-id"), false);
  assert.equal(serialized.includes("attacker"), false);
  assert.equal(serialized.includes("passwordHash"), false);
});
