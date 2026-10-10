import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { MongoServerError, type ClientSession, type Db } from "mongodb";

import { adminAuthRateLimitAttemptSchema, type AdminAuthRateLimitAttemptDocument, type AdminAuthRateLimitDocument } from "@/admin/admin-auth-rate-limit-document";
import { ADMIN_ACTIVATION_IP_LIMIT, ADMIN_ACTIVATION_TOKEN_LIMIT, ADMIN_ACTIVATION_WINDOW_MS, adminActivationTokenSchema } from "@/admin/admin-activation-contract";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import { AdminTransactionOutcomeUnknownError, runAdminTransaction } from "@/server/admin/admin-transaction";

const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;

export type AdminActivationRateLimitInput = { token: string | null; clientIp: string; now: Date; attemptId?: string };
export type AdminActivationRateLimitResult = { allowed: boolean; counted: boolean; outcome: "decided" | "unavailable" };

export function hmacAdminRateLimitIdentifier(secret: string, dimension: "token" | "ip", value: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Admin activation limiter is not configured.");
  return createHmac("sha256", secret).update(`${dimension}:${value}`, "utf8").digest("hex");
}

function createAttemptId(): string { return randomBytes(32).toString("base64url"); }
function isDuplicateKey(error: unknown): boolean { return error instanceof MongoServerError && error.code === 11000; }

async function hasRequiredIndexes(database: Db): Promise<boolean> {
  const [counterIndexes, attemptIndexes] = await Promise.all([
    database.collection(databaseCollections.adminAuthRateLimits).listIndexes().toArray(),
    database.collection(databaseCollections.adminAuthRateLimitAttempts).listIndexes().toArray(),
  ]);
  const counterUnique = counterIndexes.find((index) => index.name === "admin_auth_rate_limit_window_unique");
  const counterTtl = counterIndexes.find((index) => index.name === "admin_auth_rate_limit_expiry_ttl");
  const attemptUnique = attemptIndexes.find((index) => index.name === "admin_auth_rate_limit_attempt_unique");
  const attemptTtl = attemptIndexes.find((index) => index.name === "admin_auth_rate_limit_attempt_expiry_ttl");
  const hasKey = (actual: Record<string, unknown> | undefined, expected: Record<string, number>) =>
    Boolean(actual && Object.keys(actual).length === Object.keys(expected).length &&
      Object.entries(expected).every(([key, value]) => actual[key] === value));
  return counterUnique?.unique === true && hasKey(counterUnique.key, { dimension: 1, identifierHmac: 1, windowStart: 1 }) &&
    counterTtl?.expireAfterSeconds === 0 && hasKey(counterTtl.key, { expiresAt: 1 }) &&
    attemptUnique?.unique === true && hasKey(attemptUnique.key, { attemptId: 1 }) &&
    attemptTtl?.expireAfterSeconds === 0 && hasKey(attemptTtl.key, { expiresAt: 1 });
}

export class MongoAdminAuthRateLimitStore {
  constructor(
    private readonly database: () => Promise<Db> = getDatabase,
    private readonly secret = process.env.ADMIN_ACTIVATION_RATE_LIMIT_HMAC_SECRET,
    private readonly transaction: <T>(database: Db, work: (session: ClientSession) => Promise<T>) => Promise<T> = runAdminTransaction,
    private readonly afterTokenIncrement: () => Promise<void> = async () => undefined,
  ) {}

  async recordActivationAttempt(input: AdminActivationRateLimitInput): Promise<AdminActivationRateLimitResult> {
    if (!this.secret || Buffer.byteLength(this.secret, "utf8") < 32 || this.secret === process.env.AUTH_SECRET || this.secret === process.env.NEXTAUTH_SECRET) return { allowed: false, counted: false, outcome: "unavailable" };
    let database: Db;
    try { database = await this.database(); } catch { return { allowed: false, counted: false, outcome: "unavailable" }; }
    try { if (!await hasRequiredIndexes(database)) return { allowed: false, counted: false, outcome: "unavailable" }; }
    catch { return { allowed: false, counted: false, outcome: "unavailable" }; }
    const attemptId = input.attemptId ?? createAttemptId();
    const windowStart = new Date(Math.floor(input.now.getTime() / ADMIN_ACTIVATION_WINDOW_MS) * ADMIN_ACTIVATION_WINDOW_MS);
    const parsedToken = input.token === null ? null : adminActivationTokenSchema.safeParse(input.token);
    const tokenValue = parsedToken?.success
      ? parsedToken.data
      : `malformed-token:${input.clientIp}`;
    const tokenHmac = hmacAdminRateLimitIdentifier(this.secret, "token", tokenValue);
    const ipHmac = hmacAdminRateLimitIdentifier(this.secret, "ip", input.clientIp);
    const attempts = database.collection<AdminAuthRateLimitAttemptDocument>(databaseCollections.adminAuthRateLimitAttempts);
    const counters = database.collection<AdminAuthRateLimitDocument>(databaseCollections.adminAuthRateLimits);
    const expiresAt = new Date(windowStart.getTime() + ADMIN_ACTIVATION_WINDOW_MS + COUNTER_RETENTION_MS);

    const existing = await attempts.findOne({ attemptId });
    if (existing) {
      const parsed = adminAuthRateLimitAttemptSchema.parse(existing);
      if (parsed.tokenHmac !== tokenHmac || parsed.ipHmac !== ipHmac) return { allowed: false, counted: false, outcome: "unavailable" };
      return { allowed: parsed.allowed, counted: true, outcome: "decided" };
    }

    for (let conflictRetry = 0; conflictRetry < 3; conflictRetry += 1) {
      try {
        return await this.transaction(database, async (session) => {
        const receipt = await attempts.findOne({ attemptId }, { session });
        if (receipt) {
          const parsed = adminAuthRateLimitAttemptSchema.parse(receipt);
          if (parsed.tokenHmac !== tokenHmac || parsed.ipHmac !== ipHmac) throw new Error("Rate limit attempt identity mismatch.");
          return { allowed: parsed.allowed, counted: true, outcome: "decided" as const };
        }
        const increment = async (dimension: "token" | "ip", identifierHmac: string) => {
          const result = await counters.findOneAndUpdate(
            { dimension, identifierHmac, windowStart },
            { $inc: { count: 1 }, $setOnInsert: { dimension, identifierHmac, windowStart, expiresAt } },
            { upsert: true, returnDocument: "after", session },
          );
          if (!result) throw new Error("Rate limit counter unavailable.");
          return result.count;
        };
        const tokenCount = await increment("token", tokenHmac);
        await this.afterTokenIncrement();
        const ipCount = await increment("ip", ipHmac);
        const allowed = tokenCount <= ADMIN_ACTIVATION_TOKEN_LIMIT && ipCount <= ADMIN_ACTIVATION_IP_LIMIT;
        const event: AdminAuthRateLimitAttemptDocument = {
          attemptId, tokenHmac, ipHmac, allowed, tokenCount, ipCount, createdAt: input.now,
          expiresAt: new Date(input.now.getTime() + ATTEMPT_RETENTION_MS),
        };
        await attempts.insertOne(event, { session });
        return { allowed, counted: true, outcome: "decided" as const };
        });
      } catch (error) {
        if (error instanceof AdminTransactionOutcomeUnknownError) {
          const receipt = await attempts.findOne({ attemptId }).catch(() => null);
          if (receipt) {
            const parsed = adminAuthRateLimitAttemptSchema.parse(receipt);
            if (parsed.tokenHmac !== tokenHmac || parsed.ipHmac !== ipHmac) return { allowed: false, counted: false, outcome: "unavailable" };
            return { allowed: parsed.allowed, counted: true, outcome: "decided" };
          }
          return { allowed: false, counted: false, outcome: "unavailable" };
        }
        if (isDuplicateKey(error)) {
          const receipt = await attempts.findOne({ attemptId }).catch(() => null);
          if (receipt) {
            const parsed = adminAuthRateLimitAttemptSchema.parse(receipt);
            if (parsed.tokenHmac !== tokenHmac || parsed.ipHmac !== ipHmac) return { allowed: false, counted: false, outcome: "unavailable" };
            return { allowed: parsed.allowed, counted: true, outcome: "decided" };
          }
          // A first-upsert race can raise E11000 without committing; retry the same ID.
          if (conflictRetry + 1 < 3) continue;
        }
        return { allowed: false, counted: false, outcome: "unavailable" };
      }
    }
    return { allowed: false, counted: false, outcome: "unavailable" };
  }
}
