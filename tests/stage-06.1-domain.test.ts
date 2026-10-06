import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";

import { normalizeEmail, userPublicSchema } from "../src/identity/contracts";
import { toPublicUser, type UserDocument } from "../src/identity/documents";
import { parseUserDocument } from "../src/identity/parser";
import { createCustomer } from "../src/identity/customer-service";
import { userCommerceOwner } from "../src/commerce/durable-contracts";

function document(overrides: Partial<UserDocument> = {}): UserDocument {
  const now = new Date("2026-09-21T00:00:00.000Z");
  return {
    _id: new ObjectId(),
    userId: "u".repeat(43),
    normalizedEmail: "customer@example.com",
    role: "customer",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("normalizes customer email and keeps a public opaque identity", () => {
  assert.equal(normalizeEmail(" Customer@Example.COM "), "customer@example.com");
  assert.deepEqual(toPublicUser(document()), { userId: "u".repeat(43), email: "customer@example.com", displayName: "customer" });
  assert.deepEqual(userPublicSchema.parse(toPublicUser(document())), toPublicUser(document()));
});

test("User role parser fails closed for legacy, malformed and unknown role values", () => {
  const parsed = parseUserDocument(document());
  assert.ok(parsed._id instanceof ObjectId);
  assert.equal(parseUserDocument({ ...document(), role: "admin" }).role, "admin");
  assert.equal(parseUserDocument({ ...document(), role: undefined } as unknown).role, "customer");
  assert.equal(parseUserDocument({ ...document(), role: "operator" } as unknown).role, "customer");
  assert.equal(parseUserDocument({ ...document(), role: { role: "admin" } } as unknown).role, "customer");
  assert.throws(() => parseUserDocument({ ...document(), unexpected: true }));
  assert.throws(() => parseUserDocument({ ...document(), normalizedEmail: "not-an-email" }));
  assert.throws(() => parseUserDocument({ ...document(), normalizedEmail: "Customer@example.com" }));
});

test("user CommerceOwner uses the public opaque User ID without changing guest ownership", () => {
  const owner = userCommerceOwner("u".repeat(43));
  assert.deepEqual(owner, { ownerType: "user", ownerId: "u".repeat(43) });
});

test("customer creation service enforces normalized-email uniqueness and hides password hash", async () => {
  const records: UserDocument[] = [];
  const repository = {
    findByNormalizedEmail: async (email: string) => records.find((record) => record.normalizedEmail === normalizeEmail(email)) ?? null,
    create: async ({ email }: { email: string }) => {
      const created = document({ userId: "x".repeat(43), normalizedEmail: normalizeEmail(email), role: "customer" });
      records.push(created);
      return created;
    },
  };
  const publicUser = await createCustomer({ email: " New@Example.com " }, repository);
  assert.deepEqual(publicUser, { userId: "x".repeat(43), email: "new@example.com", displayName: "new" });
  await assert.rejects(() => createCustomer({ email: "NEW@example.com" }, repository), /already exists/);
});
