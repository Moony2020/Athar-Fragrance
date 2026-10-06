import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminBootstrapError, AdminRoleSecurityService } from "../src/server/admin/admin-role-security-service";
import { databaseCollections } from "../src/server/db/collections";
import { ensureIdentityIndexes, ensurePrivilegedAuditEventIndexes } from "../src/server/db/indexes";
import { getDatabase } from "../src/server/db/mongodb";
import { MongoCredentialRepository } from "../src/server/identity/credential-repository";
import { MongoUserRepository } from "../src/server/identity/user-repository";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

test("Stage 10.1 bootstrap is transactional, idempotent and writes safe audit events", { skip: !mongoReady }, async () => {
  assert.equal(process.env.MONGODB_DB_NAME, "athar_stage55_test");
  const database = await getDatabase();
  await ensureIdentityIndexes();
  await ensurePrivilegedAuditEventIndexes();
  const users = new MongoUserRepository(() => Promise.resolve(database));
  const credentials = new MongoCredentialRepository(() => Promise.resolve(database));
  const email = `stage101-${randomUUID()}@example.invalid`;
  const user = await users.create({ email });
  await credentials.create({ userId: user.userId, passwordHash: "stage-10.1-test-hash" });
  const events = database.collection(databaseCollections.privilegedAuditEvents);
  try {
    const service = new AdminRoleSecurityService({ database: () => Promise.resolve(database) });
    await assert.rejects(() => service.bootstrapInitialAdmin({ userId: "x".repeat(43) }), AdminBootstrapError);
    assert.equal(await events.countDocuments({ "target.id": "x".repeat(43) }), 0);

    const duplicateId = "d".repeat(43);
    await events.insertOne({ eventId: duplicateId, actor: { actorType: "system", actorId: "admin-bootstrap" }, action: "admin.bootstrap", target: { type: "user", id: user.userId }, outcome: "noop", metadata: { reason: "already_admin_noop" }, createdAt: new Date() });
    const failingService = new AdminRoleSecurityService({ database: () => Promise.resolve(database), createEventId: () => duplicateId });
    await assert.rejects(() => failingService.bootstrapInitialAdmin({ userId: user.userId }));
    assert.equal((await users.findByUserId(user.userId))?.role, "customer");
    assert.equal((await credentials.findByUserId(user.userId))?.securityVersion, 0);

    assert.equal(await service.bootstrapInitialAdmin({ userId: user.userId }), "promoted");
    assert.equal((await users.findByUserId(user.userId))?.role, "admin");
    assert.equal((await credentials.findByUserId(user.userId))?.securityVersion, 1);
    const succeeded = await events.findOne({ "target.id": user.userId, outcome: "succeeded" });
    assert.deepEqual(succeeded?.actor, { actorType: "system", actorId: "admin-bootstrap" });
    assert.equal(succeeded?.action, "admin.bootstrap");
    assert.equal(JSON.stringify(succeeded).includes("passwordHash"), false);

    assert.equal(await service.bootstrapInitialAdmin({ userId: user.userId }), "already_admin");
    assert.equal((await credentials.findByUserId(user.userId))?.securityVersion, 1);
  } finally {
    await events.deleteMany({ "target.id": user.userId });
    await database.collection(databaseCollections.userCredentials).deleteMany({ userId: user.userId });
    await database.collection(databaseCollections.users).deleteMany({ userId: user.userId });
    await database.client.close();
  }
});
