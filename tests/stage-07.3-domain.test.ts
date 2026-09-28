import assert from "node:assert/strict";
import test from "node:test";

import { resolveSelectedShippingMethod, resolveShippingAvailability, swedenShippingPolicy } from "../src/checkout/shipping";

const swedishAddress = { firstName: "Ada", lastName: "Lovelace", addressLine1: "1 Test Street", postalCode: "12345", city: "Stockholm", countryCode: "SE" };

test("Stage 7.3 resolves only the approved Swedish PostNord method and threshold pricing", () => {
  const below = resolveShippingAvailability({ shippingAddress: swedishAddress, eligibleSubtotalMinor: 69_899, currency: "SEK" });
  const threshold = resolveShippingAvailability({ shippingAddress: swedishAddress, eligibleSubtotalMinor: 69_900, currency: "SEK" });
  const above = resolveShippingAvailability({ shippingAddress: swedishAddress, eligibleSubtotalMinor: 90_000, currency: "SEK" });

  assert.equal(below.status, "available");
  assert.deepEqual(below.methods, [{ shippingMethodId: "postnord-service-point-se", label: "PostNord", currency: "SEK", shippingAmountMinor: 5_900, isFree: false }]);
  assert.equal(threshold.status, "available");
  assert.equal(threshold.methods[0].shippingAmountMinor, 0);
  assert.equal(above.status, "available");
  assert.equal(above.methods[0].isFree, true);
  assert.equal(swedenShippingPolicy.freeShippingThresholdMinor, 69_900);
});

test("Stage 7.3 rejects unsupported countries and currency mismatches without fictional fallback methods", () => {
  assert.deepEqual(resolveShippingAvailability({ shippingAddress: { ...swedishAddress, countryCode: "DK" }, eligibleSubtotalMinor: 1, currency: "SEK" }), { status: "unsupported-country", methods: [] });
  assert.deepEqual(resolveShippingAvailability({ shippingAddress: swedishAddress, eligibleSubtotalMinor: 1, currency: "EUR" }), { status: "currency-mismatch", methods: [] });
  assert.deepEqual(resolveShippingAvailability({ eligibleSubtotalMinor: 1, currency: "SEK" }), { status: "needs-address", methods: [] });
});

test("Stage 7.3 derives the selected method from current server values rather than a stored price", () => {
  const selected = resolveSelectedShippingMethod({ selectedShippingMethodId: "postnord-service-point-se", shippingAddress: swedishAddress, eligibleSubtotalMinor: 69_900, currency: "SEK" });
  assert.equal(selected?.shippingAmountMinor, 0);
  assert.equal(resolveSelectedShippingMethod({ selectedShippingMethodId: "unknown", shippingAddress: swedishAddress, eligibleSubtotalMinor: 1, currency: "SEK" }), undefined);
  assert.equal(resolveSelectedShippingMethod({ selectedShippingMethodId: "postnord-service-point-se", shippingAddress: { ...swedishAddress, countryCode: "FI" }, eligibleSubtotalMinor: 1, currency: "SEK" }), undefined);
});
