import { getMongoClient } from "../src/server/db/mongodb";
import { ensureSecureOrderAccessIndexes } from "../src/server/db/indexes";
import { getServerEnvironment } from "../src/server/env";

const ensuredIndexes = [
  "guest_order_access_session_hash_unique",
  "guest_order_access_session_expiry_ttl",
  "order_lookup_rate_limit_window_unique",
  "order_lookup_rate_limit_expiry_ttl",
] as const;

async function main(): Promise<void> {
  const { MONGODB_DB_NAME } = getServerEnvironment();
  const client = await getMongoClient();
  try {
    await ensureSecureOrderAccessIndexes();
    console.log(`Target database: ${MONGODB_DB_NAME}`);
    console.log("Secure Order Access indexes ensured:");
    for (const name of ensuredIndexes) console.log(`- ${name}`);
  } finally {
    await client.close();
  }
}

main().catch(() => {
  // Do not disclose connection strings, credentials, or environment values.
  console.error("Secure Order Access index bootstrap failed.");
  process.exitCode = 1;
});
