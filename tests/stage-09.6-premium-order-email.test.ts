import assert from "node:assert/strict";
import test from "node:test";

import type { OrderDocument } from "../src/orders/order-document";
import { buildOrderConfirmationEmail, renderOrderConfirmationEmail } from "../src/server/email/order-confirmation-email";

const order = (overrides: Partial<OrderDocument> = {}): OrderDocument => ({
  orderId: "ATH-ABCDEF123456",
  paymentAttemptId: "payment-attempt-internal",
  checkoutId: "checkout-internal",
  ownerType: "guest",
  ownerId: "owner-internal",
  provider: "stripe",
  providerExternalId: "provider-internal",
  status: "confirmed",
  paymentStatus: "paid",
  fulfillmentStatus: "pending",
  contact: { email: "guest@example.test" },
  lines: [{ productSlug: "boss-bottled", variantId: "75ml", quantity: 1, priceMinor: 149900, subtotalMinor: 149900, currency: "SEK", productName: "BOSS Bottled", brandName: "HUGO BOSS", fragranceType: "Eau de Toilette", sizeMl: 75, mediaSrc: "/legacy-media.webp", imageSnapshot: { src: "/images/catalog/cedar-study-v1.webp", alt: "BOSS Bottled front view" } }],
  subtotalMinor: 149900,
  totalMinor: 149900,
  currency: "SEK",
  merchandiseSubtotalMinor: 149900,
  shippingAmountMinor: 0,
  discountAmountMinor: 0,
  vatIncludedMinor: 30000,
  grandTotalMinor: 149900,
  shippingMethodId: "postnord",
  shippingMethodLabelSnapshot: "PostNord",
  shippingAddress: { firstName: "Jony", lastName: "Nelson", addressLine1: "Varbergagatan 2", addressLine2: "1101", postalCode: "70300", city: "Örebro", countryCode: "SE" },
  createdAt: new Date("2026-10-03T12:00:00.000Z"),
  ...overrides,
});

function withPublicOrigin(run: () => void): void {
  const prior = process.env.APP_URL;
  try {
    process.env.APP_URL = "https://athar.example.test";
    run();
  } finally {
    if (prior === undefined) delete process.env.APP_URL; else process.env.APP_URL = prior;
  }
}

test("Stage 9.6 renders premium snapshot-only order content and a guest lookup CTA", () => withPublicOrigin(() => {
  const message = renderOrderConfirmationEmail(buildOrderConfirmationEmail(order()));
  assert.equal(message.to, "guest@example.test");
  assert.equal(message.orderDetailsUrl, "https://athar.example.test/orders/lookup");
  assert.match(message.htmlContent, /Thank you for your order/);
  assert.match(message.htmlContent, />Order items</);
  assert.doesNotMatch(message.htmlContent, /Order items \(1\)/);
  assert.match(message.htmlContent, /HUGO BOSS/);
  assert.match(message.htmlContent, /BOSS Bottled/);
  assert.match(message.htmlContent, /Eau de Toilette · 75 ml/);
  assert.match(message.htmlContent, /https:\/\/athar\.example\.test\/images\/catalog\/cedar-study-v1\.webp/);
  assert.match(message.htmlContent, />ATHAR<\/p>/);
  assert.match(message.htmlContent, />HAUTE PARFUMERIE<\/p>/);
  assert.match(message.htmlContent, /Cinzel Decorative/);
  assert.match(message.htmlContent, /fonts\.googleapis\.com\/css2\?family=Cinzel\+Decorative/);
  assert.doesNotMatch(message.htmlContent, /athar-email-wordmark(?:-light)?\.png/);
  assert.match(message.htmlContent, /@media only screen and \(max-width:520px\)/);
  assert.match(message.htmlContent, /Merchandise/);
  assert.match(message.htmlContent, /Shipping \(PostNord\)/);
  assert.match(message.htmlContent, /VAT included/);
  assert.match(message.htmlContent, /margin-top:10px;border-bottom:1px solid #ded6c8/);
  assert.match(message.htmlContent, /Questions about your order\?.*Reply to this email\./);
  assert.match(message.htmlContent, /Varbergagatan 2, 1101/);
  assert.match(message.textContent, /View order details:\nhttps:\/\/athar\.example\.test\/orders\/lookup/);
  assert.match(message.textContent, /Questions about your order\? Reply to this email\./);
  assert.doesNotMatch(message.htmlContent, /\/orders\/guest/);
  assert.doesNotMatch(message.htmlContent, /Track your order|Download invoice|support@athar\.se/);
}));

test("Stage 9.6 keeps legacy snapshot gaps readable without catalog fallback or invented totals", () => withPublicOrigin(() => {
  const legacy = order({ lines: [{ ...order().lines[0], fragranceType: undefined, imageSnapshot: undefined, sizeMl: 50 }], merchandiseSubtotalMinor: undefined, shippingAmountMinor: undefined, discountAmountMinor: undefined, vatIncludedMinor: undefined, shippingMethodLabelSnapshot: undefined });
  const message = renderOrderConfirmationEmail(buildOrderConfirmationEmail(legacy));
  assert.match(message.htmlContent, /50 ml/);
  assert.doesNotMatch(message.htmlContent, /Eau de Toilette/);
  assert.doesNotMatch(message.htmlContent, /cedar-study-v1\.webp|BOSS Bottled front view/);
  assert.doesNotMatch(message.textContent, /Merchandise:|VAT included:|Shipping \(/);
}));

test("Stage 9.6 uses a protected authenticated detail URL and escapes all dynamic HTML", () => withPublicOrigin(() => {
  const malicious = order({ ownerType: "user", ownerId: "user-internal", orderId: "ATH-ABCDEF123456\r\nX-Injected: yes", lines: [{ ...order().lines[0], productName: '<img src=x onerror=alert(1)>', brandName: "<b>brand</b>", imageSnapshot: { src: "javascript:alert(1)", alt: '\" onerror=\"alert(1)' } }], shippingAddress: { ...order().shippingAddress!, city: "<script>alert(1)</script>" } });
  const message = renderOrderConfirmationEmail(buildOrderConfirmationEmail(malicious));
  assert.equal(message.orderDetailsUrl, "https://athar.example.test/account/orders/ATH-ABCDEF123456%0D%0AX-Injected%3A%20yes");
  assert.doesNotMatch(message.htmlContent, /<img src=x|javascript:alert|<script>/);
  assert.match(message.htmlContent, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(message.subject, /[\r\n]/);
  for (const internal of ["payment-attempt-internal", "checkout-internal", "owner-internal", "provider-internal", "user-internal"]) assert.doesNotMatch(`${message.htmlContent}\n${message.textContent}`, new RegExp(internal));
}));
