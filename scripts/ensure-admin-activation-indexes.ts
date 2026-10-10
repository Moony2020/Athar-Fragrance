import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ensureAdminActivationIndexes } from "../src/server/db/indexes";
import { getDatabase } from "../src/server/db/mongodb";

export async function runEnsureAdminActivationIndexes(): Promise<number> {
  if (process.env.MONGODB_DB_NAME !== "athar_stage55_test") {
    console.error("Refusing to create activation indexes outside athar_stage55_test.");
    return 1;
  }
  let connectedDatabase: Awaited<ReturnType<typeof getDatabase>> | undefined;
  try {
    connectedDatabase = await getDatabase();
    await ensureAdminActivationIndexes();
    console.log("Admin activation indexes verified.");
    return 0;
  } catch {
    console.error("Admin activation indexes could not be verified.");
    return 1;
  } finally {
    await connectedDatabase?.client.close().catch(() => undefined);
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  void runEnsureAdminActivationIndexes().then((exitCode) => { process.exitCode = exitCode; });
}
