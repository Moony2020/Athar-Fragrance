import assert from "node:assert/strict";
import test from "node:test";

import { getDatabase } from "../src/server/db/mongodb";
import { ensureIdentityIndexes } from "../src/server/db/indexes";
import { authorizeCredentials } from "../src/server/auth/credentials";
import { registerCustomer, RegistrationError } from "../src/server/auth/registration";
import { databaseCollections } from "../src/server/db/collections";

const liveMongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

test("Stage 6.2 real Mongo registration, Credentials sign-in, disabled user, and duplicate race", { skip: !liveMongoReady }, async () => {
  const database = await getDatabase();
  try {
    await ensureIdentityIndexes();
    const userIndexes = await database.collection(databaseCollections.users).listIndexes().toArray();
    const credentialIndexes = await database.collection(databaseCollections.userCredentials).listIndexes().toArray();
    assert.equal(new Set(userIndexes.map((index) => index.name)).has("users_email_unique"), true);
    assert.equal(new Set(userIndexes.map((index) => index.name)).has("users_public_id_unique"), true);
    assert.equal(new Set(credentialIndexes.map((index) => index.name)).has("credentials_user_unique"), true);

    const email = `stage62-${Date.now()}@example.invalid`;
    const password = "Correct horse battery staple 42";
    const user = await registerCustomer({ email, password });
    try {
      assert.equal((await authorizeCredentials(email, password))?.id, user.userId);
      assert.equal(await authorizeCredentials(email, "wrong password"), null);
      await assert.rejects(() => registerCustomer({ email: email.toUpperCase(), password }), RegistrationError);
      await database.collection(databaseCollections.userCredentials).updateOne({ userId: user.userId }, { $set: { disabledAt: new Date() } });
      assert.equal(await authorizeCredentials(email, password), null);
    } finally {
      await database.collection(databaseCollections.userCredentials).deleteMany({ userId: user.userId });
      await database.collection(databaseCollections.users).deleteMany({ userId: user.userId });
    }
  } finally {
    await database.client.close();
  }
});
