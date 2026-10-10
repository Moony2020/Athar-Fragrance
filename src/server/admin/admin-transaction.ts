import "server-only";

import type { ClientSession, Db, MongoError } from "mongodb";

const MAX_TRANSACTION_ATTEMPTS = 3;
const MAX_COMMIT_ATTEMPTS = 3;

export class AdminTransactionOutcomeUnknownError extends Error {
  constructor() {
    super("Admin transaction outcome is unavailable.");
    this.name = "AdminTransactionOutcomeUnknownError";
  }
}

function hasLabel(error: unknown, label: string): boolean {
  return Boolean(error && typeof error === "object" && "hasErrorLabel" in error &&
    typeof (error as MongoError).hasErrorLabel === "function" && (error as MongoError).hasErrorLabel(label));
}

/** Bounded callback retries; unknown commit results retry commit on the same transaction only. */
export async function runAdminTransaction<T>(database: Db, work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = database.client.startSession();
  try {
    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
      let result: T;
      try {
        result = await work(session);
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        if (hasLabel(error, "TransientTransactionError") && attempt + 1 < MAX_TRANSACTION_ATTEMPTS) continue;
        throw error;
      }

      let retryCallback = false;
      for (let commitAttempt = 0; commitAttempt < MAX_COMMIT_ATTEMPTS; commitAttempt += 1) {
        try {
          await session.commitTransaction();
          return result;
        } catch (error) {
          if (hasLabel(error, "UnknownTransactionCommitResult")) {
            if (commitAttempt + 1 < MAX_COMMIT_ATTEMPTS) continue;
            throw new AdminTransactionOutcomeUnknownError();
          }
          if (hasLabel(error, "TransientTransactionError") && attempt + 1 < MAX_TRANSACTION_ATTEMPTS) {
            await session.abortTransaction().catch(() => undefined);
            retryCallback = true;
            break;
          }
          throw error;
        }
      }
      if (retryCallback) continue;
      throw new AdminTransactionOutcomeUnknownError();
    }
    throw new Error("Admin transaction retry budget exhausted.");
  } finally {
    await session.endSession();
  }
}
