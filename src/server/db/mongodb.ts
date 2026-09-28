import "server-only";

import { Db, MongoClient } from "mongodb";

import { getServerEnvironment } from "@/server/env";

type MongoClientCache = {
  client: MongoClient | null;
  clientPromise: Promise<MongoClient> | null;
};

declare global {
  var atharMongoClientCache: MongoClientCache | undefined;
}

const globalCache = globalThis.atharMongoClientCache ?? {
  client: null,
  clientPromise: null,
};

if (process.env.NODE_ENV !== "production") {
  globalThis.atharMongoClientCache = globalCache;
}

/** Server-only shared client used by explicit transactional persistence boundaries. */
export async function getMongoClient(): Promise<MongoClient> {
  if (globalCache.client) {
    return globalCache.client;
  }

  if (!globalCache.clientPromise) {
    const { MONGODB_URI } = getServerEnvironment();
    const client = new MongoClient(MONGODB_URI);
    globalCache.clientPromise = client.connect();
  }

  try {
    globalCache.client = await globalCache.clientPromise;
    return globalCache.client;
  } catch (error) {
    globalCache.clientPromise = null;
    throw error;
  }
}

/** Returns the configured Atlas database through a reused process connection. */
export async function getDatabase(): Promise<Db> {
  const [{ MONGODB_DB_NAME }, client] = await Promise.all([getServerEnvironment(), getMongoClient()]);
  return client.db(MONGODB_DB_NAME);
}
