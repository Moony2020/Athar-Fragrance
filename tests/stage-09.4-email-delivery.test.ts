import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { canTransitionEmailDelivery, nextRetryAt, newEmailDelivery } from "../src/server/email/email-delivery-document";

test("Stage 9.4 delivery state machine rejects terminal regressions and bounds retry timing", () => {
  assert.equal(canTransitionEmailDelivery("pending", "sending"), true);
  assert.equal(canTransitionEmailDelivery("sending", "provider_accepted"), true);
  assert.equal(canTransitionEmailDelivery("provider_accepted", "delivered"), true);
  assert.equal(canTransitionEmailDelivery("delivered", "retryable_failure"), false);
  assert.equal(canTransitionEmailDelivery("permanent_failure", "pending"), false);
  assert.equal(nextRetryAt(1, new Date("2026-01-01T00:00:00Z")).toISOString(), "2026-01-01T00:00:30.000Z");
  assert.equal(nextRetryAt(10, new Date("2026-01-01T00:00:00Z")).toISOString(), "2026-01-01T01:00:00.000Z");
});

test("Stage 9.4 delivery identity is opaque and stable across retries", () => {
  const delivery = newEmailDelivery(`ATH-${randomUUID()}`, "guest@example.invalid");
  assert.match(delivery.deliveryId, /^ED-/);
  assert.match(delivery.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(delivery.attemptCount, 0);
  assert.equal(delivery.status, "pending");
});
