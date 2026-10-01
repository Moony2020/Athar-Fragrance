import assert from "node:assert/strict";
import test from "node:test";

import type { OrderDocument } from "../src/orders/order-document";
import { buildOrderConfirmationEmail, renderOrderConfirmationEmail } from "../src/server/email/order-confirmation-email";
import { isBrevoConfigured } from "../src/server/auth/brevo-mailer";
import { TestOrderConfirmationMailer, getCapturedOrderConfirmationMessages, isOrderConfirmationTestMailerEnabled } from "../src/server/email/test-order-confirmation-mailer";
import { createOrderConfirmationMailer } from "../src/server/email/order-confirmation-mailer";

const order = {
  orderId: "ATH-ABCDEF123456",
  paymentAttemptId: "attempt-1",
  checkoutId: "checkout-1",
  ownerType: "guest",
  ownerId: "guest-1",
  provider: "paypal",
  providerExternalId: "paypal-1",
  status: "confirmed",
  paymentStatus: "paid",
  fulfillmentStatus: "pending",
  contact: { email: "  Guest@Example.com " },
  lines: [{ productSlug: "athar", variantId: "v1", quantity: 2, priceMinor: 64950, subtotalMinor: 129900, currency: "SEK", productName: "No. 01", brandName: "ATHAR", sizeMl: 50, mediaSrc: null }],
  subtotalMinor: 129900,
  totalMinor: 135800,
  currency: "SEK",
  merchandiseSubtotalMinor: 129900,
  shippingAmountMinor: 5900,
  discountAmountMinor: 0,
  vatIncludedMinor: 27160,
  grandTotalMinor: 135800,
  shippingMethodLabelSnapshot: "PostNord",
  shippingMethodId: "postnord",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
} as OrderDocument;

test("Stage 9.3 uses the persisted Order contact snapshot and immutable line/total snapshot", () => {
  const message = buildOrderConfirmationEmail(order);
  assert.equal(message.to, "guest@example.com");
  assert.equal(message.orderId, order.orderId);
  assert.equal(message.lines[0]?.subtotalMinor, 129900);
  assert.equal(message.totalMinor, 135800);
  assert.equal(message.shippingMethodLabel, "PostNord");
});

test("Stage 9.3 renders both plain text and HTML without exposing provider secrets", () => {
  const message = renderOrderConfirmationEmail(buildOrderConfirmationEmail(order));
  assert.match(message.subject, /ATHAR order confirmation/);
  assert.match(message.textContent, /Order ATH-ABCDEF123456/);
  assert.match(message.textContent, /Total/);
  assert.match(message.htmlContent, /No\. 01/);
  assert.doesNotMatch(message.textContent, /paypal-1/);
  assert.doesNotMatch(message.htmlContent, /paypal-1/);
  assert.doesNotMatch(message.textContent, /Discount:/);
  assert.doesNotMatch(message.subject, /[\r\n]/);
});

test("Stage 9.3 rejects an Order without a persisted contact email", () => {
  assert.throws(() => buildOrderConfirmationEmail({ ...order, contact: undefined }), /contact email/);
});

test("Stage 9.3 escapes persisted HTML text and keeps provider identifiers out of output", () => {
  const malicious = renderOrderConfirmationEmail(buildOrderConfirmationEmail({ ...order, orderId: "ATH-ABCDEF123456\r\nX-Injected: yes", lines: [{ ...order.lines[0], productName: `<img src=x onerror=alert(1)>` }] }));
  assert.doesNotMatch(malicious.htmlContent, /<img src=x/);
  assert.match(malicious.htmlContent, /&lt;img/);
  assert.doesNotMatch(malicious.subject, /[\r\n]/);
  assert.doesNotMatch(malicious.textContent, /paymentAttemptId|providerExternalId|ownerId/);
});

test("Stage 9.3 keeps legacy Orders readable without fabricating financial breakdown", () => {
  const legacy = { ...order, merchandiseSubtotalMinor: undefined, shippingAmountMinor: undefined, discountAmountMinor: undefined, vatIncludedMinor: undefined, shippingMethodLabelSnapshot: undefined };
  const message = renderOrderConfirmationEmail(buildOrderConfirmationEmail(legacy));
  assert.match(message.textContent, /Total/);
  assert.doesNotMatch(message.textContent, /Merchandise:/);
  assert.doesNotMatch(message.textContent, /VAT included:/);
});

test("Stage 9.3 test-mail path captures the rendered message without live delivery", async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorAdapter = process.env.ATHAR_TEST_MAIL_ADAPTER;
  const priorOutbox = process.env.ATHAR_TEST_MAIL_OUTBOX;
  try {
    process.env.NODE_ENV = "test";
    process.env.ATHAR_TEST_MAIL_ADAPTER = "1";
    delete process.env.ATHAR_TEST_MAIL_OUTBOX;
    globalThis.atharOrderConfirmationTestMailState = { messages: [] };
    assert.equal(isOrderConfirmationTestMailerEnabled(), true);
    await new TestOrderConfirmationMailer().sendOrderConfirmation(renderOrderConfirmationEmail(buildOrderConfirmationEmail(order)));
    assert.equal((await getCapturedOrderConfirmationMessages()).length, 1);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
    if (priorAdapter === undefined) delete process.env.ATHAR_TEST_MAIL_ADAPTER; else process.env.ATHAR_TEST_MAIL_ADAPTER = priorAdapter;
    if (priorOutbox === undefined) delete process.env.ATHAR_TEST_MAIL_OUTBOX; else process.env.ATHAR_TEST_MAIL_OUTBOX = priorOutbox;
  }
});

test("Stage 9.3 reports Brevo readiness without exposing the API key", () => {
  const priorKey = process.env.BREVO_API_KEY;
  const priorEmail = process.env.BREVO_SENDER_EMAIL;
  try {
    process.env.BREVO_API_KEY = "test-secret-not-returned";
    process.env.BREVO_SENDER_EMAIL = "mymoon676@hotmail.com";
    assert.equal(isBrevoConfigured(), true);
    delete process.env.BREVO_API_KEY;
    assert.equal(isBrevoConfigured(), false);
  } finally {
    if (priorKey === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = priorKey;
    if (priorEmail === undefined) delete process.env.BREVO_SENDER_EMAIL; else process.env.BREVO_SENDER_EMAIL = priorEmail;
  }
});

test("Stage 9.3 selects the non-production test adapter only when explicitly enabled", () => {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorAdapter = process.env.ATHAR_TEST_MAIL_ADAPTER;
  try {
    process.env.NODE_ENV = "production";
    process.env.ATHAR_TEST_MAIL_ADAPTER = "1";
    assert.equal(createOrderConfirmationMailer().constructor.name, "BrevoOrderConfirmationMailer");
    process.env.NODE_ENV = "test";
    assert.equal(createOrderConfirmationMailer().constructor.name, "TestOrderConfirmationMailer");
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
    if (priorAdapter === undefined) delete process.env.ATHAR_TEST_MAIL_ADAPTER; else process.env.ATHAR_TEST_MAIL_ADAPTER = priorAdapter;
  }
});
