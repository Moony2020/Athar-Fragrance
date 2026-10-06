import assert from "node:assert/strict";
import test from "node:test";

import { parsePrivilegedAuditEventDocument } from "../src/admin/privileged-audit-document";
import { parseUserDocument } from "../src/identity/parser";
import { resolveAdminAuthorization } from "../src/server/admin/authorization";

const userId = "u".repeat(43);
const now = new Date("2026-10-06T00:00:00.000Z");

function user(role: unknown) {
  return parseUserDocument({ userId, normalizedEmail: "admin@example.invalid", role, createdAt: now, updatedAt: now });
}

test("persisted role is the sole Admin authority", async () => {
  const customerResult = await resolveAdminAuthorization(
    { user: { id: userId, role: "admin" } } as never,
    { findByUserId: async () => user("customer") },
  );
  assert.deepEqual(customerResult, { kind: "forbidden", userId });

  const adminResult = await resolveAdminAuthorization(
    { user: { id: userId } }, { findByUserId: async () => user("admin") },
  );
  assert.deepEqual(adminResult, { kind: "authorized", userId });
});

test("missing and malformed persisted roles fail closed", async () => {
  for (const role of [undefined, "manager", { role: "admin" }]) {
    const result = await resolveAdminAuthorization(
      { user: { id: userId } }, { findByUserId: async () => user(role) },
    );
    assert.equal(result.kind, "forbidden");
  }
  assert.deepEqual(await resolveAdminAuthorization(null), { kind: "unauthenticated" });
});

test("audit event permits only the fixed bootstrap system actor and safe metadata", () => {
  const event = parsePrivilegedAuditEventDocument({
    eventId: "e".repeat(43), actor: { actorType: "system", actorId: "admin-bootstrap" }, action: "admin.bootstrap",
    target: { type: "user", id: userId }, outcome: "succeeded", metadata: { reason: "first_admin_bootstrap" }, createdAt: now,
  });
  assert.equal(event.actor.actorType, "system");
  assert.throws(() => parsePrivilegedAuditEventDocument({ ...event, actor: { actorType: "system", actorId: "operator@example.invalid" } }));
  assert.throws(() => parsePrivilegedAuditEventDocument({ ...event, metadata: { reason: "first_admin_bootstrap", unsafeField: "rejected" } }));
});
