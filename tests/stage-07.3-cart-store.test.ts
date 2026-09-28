import assert from "node:assert/strict";
import test from "node:test";

import { MongoGuestCartStore, isMongoGuestCartStore } from "../src/server/commerce/mongo-store";

test("Stage 7.3 durable-cart capability accepts the Mongo store across bundler boundaries", () => {
  const store = new MongoGuestCartStore(async () => ({}) as never);
  assert.equal(isMongoGuestCartStore(store), true);
});

test("Stage 7.3 durable-cart capability rejects an incidental readOwner shape", () => {
  const incidentalShape = { async readOwner() { return { lines: [] }; } };
  assert.equal(isMongoGuestCartStore(incidentalShape), false);
});
