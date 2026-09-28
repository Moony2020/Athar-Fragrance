import assert from "node:assert/strict";
import test from "node:test";

import { buildCheckoutReadModel, type CheckoutCartSnapshot } from "../src/checkout/domain";
import { extractIncludedVatMinor, resolveCheckoutTotals } from "../src/checkout/totals";

const swedishAddress = { firstName: "Ada", lastName: "Lovelace", addressLine1: "1 Test Street", postalCode: "12345", city: "Stockholm", countryCode: "SE" };

function checkout(subtotalMinor: number, currency = "SEK") {
  const cart: CheckoutCartSnapshot = {
    availability: "available",
    lines: [{ productSlug: "test-fragrance", productName: "Test fragrance", brandName: "ATHAR", variantId: "test-50", sizeMl: 50, quantity: 1, priceMinor: subtotalMinor, subtotalMinor: 1, currency, availability: "available" }],
  };
  return buildCheckoutReadModel(cart);
}

function selectedDraft(countryCode = "SE", method = "postnord-service-point-se") {
  return { shippingAddress: { ...swedishAddress, countryCode }, selectedShippingMethodId: method };
}

test("Stage 7.4 derives gross totals and included 25% VAT entirely from canonical checkout state", () => {
  const totals = resolveCheckoutTotals({ checkout: checkout(59_900), draft: selectedDraft() });
  assert.deepEqual(totals, {
    status: "ready", currency: "SEK", merchandiseSubtotal: 59_900, discountTotal: 0, appliedDiscounts: [],
    shippingTotal: 5_900, vatTotal: 13_160, grandTotal: 65_800, vatRatePercent: 25, vatIncluded: true,
  });
});

test("Stage 7.4 preserves the Stage 7.3 free-shipping threshold exactly", () => {
  const below = resolveCheckoutTotals({ checkout: checkout(69_899), draft: selectedDraft() });
  const atThreshold = resolveCheckoutTotals({ checkout: checkout(69_900), draft: selectedDraft() });
  const above = resolveCheckoutTotals({ checkout: checkout(70_000), draft: selectedDraft() });
  assert.equal(below.status, "ready");
  assert.equal(atThreshold.status, "ready");
  assert.equal(above.status, "ready");
  if (below.status === "ready" && atThreshold.status === "ready" && above.status === "ready") {
    assert.equal(below.shippingTotal, 5_900);
    assert.equal(atThreshold.shippingTotal, 0);
    assert.equal(above.shippingTotal, 0);
  }
});

test("Stage 7.4 VAT extraction uses deterministic integer half-up rounding without double VAT", () => {
  assert.equal(extractIncludedVatMinor(1), 0);
  assert.equal(extractIncludedVatMinor(3), 1);
  assert.equal(extractIncludedVatMinor(5_900), 1_180);
  assert.equal(extractIncludedVatMinor(65_800), 13_160);
  const totals = resolveCheckoutTotals({ checkout: checkout(59_900), draft: selectedDraft() });
  assert.equal(totals.status, "ready");
  if (totals.status === "ready") assert.equal(totals.grandTotal, 59_900 + 5_900);
});

test("Stage 7.4 has no production discounts and never accepts browser-shaped total inputs", () => {
  const canonical = checkout(59_900) as typeof checkout extends (...args: never[]) => infer T ? T : never;
  const totals = resolveCheckoutTotals({
    checkout: { ...canonical, eligibleSubtotalMinor: 59_900, browserSubtotal: 1, vatTotal: 1, discountTotal: 99_999 } as typeof canonical,
    draft: selectedDraft(),
  });
  assert.equal(totals.status, "ready");
  if (totals.status === "ready") {
    assert.equal(totals.merchandiseSubtotal, 59_900);
    assert.equal(totals.discountTotal, 0);
    assert.deepEqual(totals.appliedDiscounts, []);
  }
});

test("Stage 7.4 totals DTO exposes no owner, checkout, shipping-method, or policy internals", () => {
  const totals = resolveCheckoutTotals({ checkout: checkout(59_900), draft: selectedDraft() });
  const serialized = JSON.stringify(totals);
  assert.equal(serialized.includes("ownerId"), false);
  assert.equal(serialized.includes("checkoutId"), false);
  assert.equal(serialized.includes("postnord-service-point-se"), false);
  assert.equal(serialized.includes("freeShippingThresholdMinor"), false);
});

test("Stage 7.4 blocks stale checkout state, invalid shipping selection, and currency mismatch", () => {
  assert.deepEqual(resolveCheckoutTotals({ checkout: checkout(59_900), draft: selectedDraft("FI") }), { status: "blocked", reason: "SHIPPING_SELECTION_INVALID" });
  assert.deepEqual(resolveCheckoutTotals({ checkout: checkout(59_900), draft: selectedDraft("SE", "unknown") }), { status: "blocked", reason: "SHIPPING_SELECTION_INVALID" });
  assert.deepEqual(resolveCheckoutTotals({ checkout: checkout(59_900, "EUR"), draft: selectedDraft() }), { status: "blocked", reason: "CURRENCY_MISMATCH" });
  assert.deepEqual(resolveCheckoutTotals({ checkout: checkout(59_900), draft: undefined }), { status: "blocked", reason: "SHIPPING_SELECTION_REQUIRED" });
});
