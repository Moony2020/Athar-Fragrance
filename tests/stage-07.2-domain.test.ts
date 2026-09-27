import assert from "node:assert/strict";
import test from "node:test";

import { checkoutContactAddressSchema, checkoutIdSchema, normalizeCheckoutContactAddress } from "../src/checkout/contact-address";
import { toCheckoutDraftPublic, type CheckoutDraftDocument } from "../src/checkout/draft-document";
import { guestCommerceOwner } from "../src/commerce/durable-contracts";
import { parseCheckoutDraftDocument } from "../src/checkout/draft-parser";

const validInput = {
  contact: { email: "  Customer@Example.COM " },
  shippingAddress: {
    firstName: "  Ada ", lastName: " Lovelace ", addressLine1: " 12 Main Street ",
    addressLine2: " ", postalCode: " 12345 ", city: " Stockholm ", region: " ", countryCode: " se ",
  },
};

test("contact and address trim bounded text and normalize email and country code", () => {
  const parsed = normalizeCheckoutContactAddress(validInput);
  assert.equal(parsed.contact.email, "customer@example.com");
  assert.deepEqual(parsed.shippingAddress, {
    firstName: "Ada", lastName: "Lovelace", addressLine1: "12 Main Street",
    postalCode: "12345", city: "Stockholm", countryCode: "SE",
  });
});

test("required contact/address fields and country-code shape reject malformed input", () => {
  for (const input of [
    { ...validInput, contact: { email: "not-an-email" } },
    { ...validInput, shippingAddress: { ...validInput.shippingAddress, firstName: " " } },
    { ...validInput, shippingAddress: { ...validInput.shippingAddress, countryCode: "USA" } },
    { ...validInput, shippingAddress: { ...validInput.shippingAddress, countryCode: "U1" } },
    { ...validInput, shippingAddress: { ...validInput.shippingAddress, city: "x".repeat(101) } },
  ]) assert.equal(checkoutContactAddressSchema.safeParse(input).success, false);
});

test("country validation enforces shape, not an invented supported-country list", () => {
  const parsed = checkoutContactAddressSchema.parse({
    contact: { email: "a@example.invalid" },
    shippingAddress: { firstName: "A", lastName: "B", addressLine1: "1 Road", postalCode: "1", city: "Town", countryCode: "zz" },
  });
  assert.equal(parsed.shippingAddress.countryCode, "ZZ");
});

test("checkout IDs are opaque-shaped and public DTO excludes Mongo and owner metadata", () => {
  const owner = guestCommerceOwner("g".repeat(43));
  const now = new Date("2026-09-27T00:00:00.000Z");
  const document: CheckoutDraftDocument = {
    checkoutId: "c".repeat(43), ...owner, revision: 1, createdAt: now, updatedAt: now,
    expiresAt: new Date(now.getTime() + 1000), contact: { email: "customer@example.com" },
    shippingAddress: normalizeCheckoutContactAddress(validInput).shippingAddress,
  };
  assert.equal(checkoutIdSchema.safeParse(document.checkoutId).success, true);
  const publicDto = toCheckoutDraftPublic(document);
  const serialized = JSON.stringify(publicDto);
  assert.equal(serialized.includes("ownerId"), false);
  assert.equal(serialized.includes("ownerType"), false);
  assert.equal(serialized.includes("_id"), false);
  assert.equal(publicDto.revision, 1);
  assert.equal(serialized.includes("priceMinor"), false);
  assert.equal(parseCheckoutDraftDocument(document, owner).ownerId, owner.ownerId);
  assert.throws(() => parseCheckoutDraftDocument(document, { ownerType: "guest", ownerId: "x".repeat(43) }));
});
