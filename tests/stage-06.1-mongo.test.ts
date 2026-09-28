import assert from "node:assert/strict";
import test from "node:test";

import { userCommerceOwner } from "../src/commerce/durable-contracts";
import { parseUserDocument } from "../src/identity/parser";
import { getDatabase } from "../src/server/db/mongodb";
import { MongoUserRepository } from "../src/server/identity/user-repository";
import { ensureIdentityIndexes } from "../src/server/db/indexes";

const databaseName = process.env.MONGODB_DB_NAME;
const liveMongoReady = Boolean(process.env.MONGODB_URI && databaseName === "athar_stage55_test");

test("Stage 6.1 real Mongo User verification", { skip: !liveMongoReady }, async () => {
  assert.equal(databaseName, "athar_stage55_test");
  const database = await getDatabase();
  try {
    await ensureIdentityIndexes();
    const indexes = await database.collection("users").listIndexes().toArray();
    const indexNames = new Set(indexes.map((index) => index.name));
    assert.equal(indexNames.has("users_email_unique"), true);
    assert.equal(indexNames.has("users_public_id_unique"), true);

    const repository = new MongoUserRepository();
    const email = `stage61-${Date.now()}@example.invalid`;
    const created = await repository.create({ email, passwordHash: "stage-6.1-test-hash" });
    try {
      assert.equal(created.normalizedEmail, email);
      assert.equal((await repository.findByNormalizedEmail(email))?.userId, created.userId);
      assert.equal((await repository.findByUserId(created.userId))?.normalizedEmail, email);
      assert.deepEqual(userCommerceOwner(created.userId), { ownerType: "user", ownerId: created.userId });
      assert.equal(parseUserDocument(created).userId, created.userId);
      assert.equal("passwordHash" in ({ userId: created.userId, email: created.normalizedEmail }), false);

      const raceEmail = `stage61-race-${Date.now()}@example.invalid`;
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => repository.create({ email: raceEmail, passwordHash: "stage-6.1-test-hash" })));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 7);
      await database.collection("users").deleteMany({ normalizedEmail: raceEmail });
    } finally {
      await database.collection("users").deleteMany({ $or: [{ userId: created.userId }, { normalizedEmail: email }] });
    }
  } finally {
    await database.client.close();
  }
});
