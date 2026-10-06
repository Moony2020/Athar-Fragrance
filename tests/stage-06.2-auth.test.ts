import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail } from "../src/identity/contracts";
import { authorizeCredentials } from "../src/server/auth/credentials";
import { hashPassword, verifyPassword } from "../src/server/auth/passwords";
import { registerCustomer, RegistrationError } from "../src/server/auth/registration";

test("Argon2id password hashing verifies the password and never stores plaintext", async () => {
  const password = "Correct horse battery staple 42";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(hash.startsWith("$argon2id$"), true);
  assert.match(hash, /m=65536,p=4,t=3/);
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "wrong password"), false);
});

test("registration cleanup removes a newly created User if credential creation fails", async () => {
  let deletedUserId = "";
  await assert.rejects(() => registerCustomer({ email: "orphan@example.com", password: "Correct horse battery staple 42" }, {
    users: {
      async create() { return { userId: "o".repeat(43), normalizedEmail: "orphan@example.com", role: "customer", createdAt: new Date(), updatedAt: new Date() }; },
      async deleteByUserId(userId: string) { deletedUserId = userId; },
    },
    credentials: {
      async create() { throw new Error("credential write failed"); },
      async deleteByUserId() {},
    },
    async hashPassword() { return "hash"; },
  }), RegistrationError);
  assert.equal(deletedUserId, "o".repeat(43));
});

test("Credentials authorization returns only public user identity and rejects disabled users", async () => {
  const passwordHash = await hashPassword("Correct horse battery staple 42");
  const user = { userId: "u".repeat(43), normalizedEmail: "customer@example.com", role: "customer" as const, createdAt: new Date(), updatedAt: new Date() };
  const credential = { userId: user.userId, passwordHash, disabledAt: null, securityVersion: 0, createdAt: new Date(), updatedAt: new Date() };
  const repositories = {
    users: { findByNormalizedEmail: async (email: string) => email === user.normalizedEmail ? user : null },
    credentials: { findByUserId: async () => credential },
  };
  const authorized = await authorizeCredentials(" Customer@Example.com ", "Correct horse battery staple 42", repositories);
  assert.deepEqual(authorized, { id: user.userId, email: user.normalizedEmail, securityVersion: 0 });
  assert.equal("passwordHash" in (authorized ?? {}), false);
  assert.equal(await authorizeCredentials("customer@example.com", "wrong", repositories), null);
  credential.disabledAt = new Date();
  assert.equal(await authorizeCredentials(normalizeEmail(user.normalizedEmail), "Correct horse battery staple 42", repositories), null);
});
