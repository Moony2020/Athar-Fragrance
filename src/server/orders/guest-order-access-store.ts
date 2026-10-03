import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Db } from "mongodb";

import type { OrderDocument } from "@/orders/order-document";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import {
  guestOrderAccessSessionTtlMs, orderLookupRateLimitDimensions, orderLookupWindowMs,
  type GuestOrderAccessSessionDocument, type OrderLookupRateLimitDimension, type OrderLookupRateLimitDocument,
} from "@/server/orders/guest-order-access-document";

const limits: Record<OrderLookupRateLimitDimension, number> = { pair: 5, order: 10, email: 10 };

export class SecureOrderAccessUnavailableError extends Error {}

function requireHmacSecret(value = process.env.ORDER_LOOKUP_HMAC_SECRET): string {
  if (!value || value.length < 32) throw new SecureOrderAccessUnavailableError("Secure Order Access is not configured.");
  return value;
}

export function hashGuestOrderAccessSession(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function hmacOrderLookupIdentifier(secret: string, value: string): string {
  return createHmac("sha256", requireHmacSecret(secret)).update(value, "utf8").digest("hex");
}

export function fixedOrderLookupWindow(now: Date): Date {
  return new Date(Math.floor(now.getTime() / orderLookupWindowMs) * orderLookupWindowMs);
}

function duplicateKey(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }

export class MongoSecureOrderAccessStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async countLookupAttempt(input: { orderId: string; normalizedEmail: string; hmacSecret?: string; now?: Date }): Promise<{ allowed: boolean }> {
    const now = input.now ?? new Date();
    const secret = requireHmacSecret(input.hmacSecret);
    const windowStart = fixedOrderLookupWindow(now);
    const expiresAt = new Date(windowStart.getTime() + orderLookupWindowMs);
    const identifiers: Record<OrderLookupRateLimitDimension, string> = {
      order: hmacOrderLookupIdentifier(secret, `order:${input.orderId}`),
      email: hmacOrderLookupIdentifier(secret, `email:${input.normalizedEmail}`),
      pair: hmacOrderLookupIdentifier(secret, `pair:${input.orderId}\u0000${input.normalizedEmail}`),
    };
    try {
      const counts = await Promise.all(orderLookupRateLimitDimensions.map(async (dimension) => {
        const collection = (await this.database()).collection<OrderLookupRateLimitDocument>(databaseCollections.orderLookupRateLimits);
        const filter = { dimension, identifierHmac: identifiers[dimension], windowStart };
        const update = { $inc: { attemptCount: 1 }, $set: { updatedAt: now }, $setOnInsert: { expiresAt, createdAt: now } };
        try {
          const result = await collection.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
          if (!result) throw new SecureOrderAccessUnavailableError("Rate limit update unavailable.");
          return { dimension, count: result.attemptCount };
        } catch (error) {
          if (!duplicateKey(error)) throw error;
          const result = await collection.findOneAndUpdate(filter, { $inc: { attemptCount: 1 }, $set: { updatedAt: now } }, { returnDocument: "after" });
          if (!result) throw new SecureOrderAccessUnavailableError("Rate limit update unavailable.");
          return { dimension, count: result.attemptCount };
        }
      }));
      return { allowed: counts.every(({ dimension, count }) => count <= limits[dimension]) };
    } catch (error) {
      if (error instanceof SecureOrderAccessUnavailableError) throw error;
      throw new SecureOrderAccessUnavailableError("Rate limit unavailable.");
    }
  }

  async findGuestOrder(orderId: string, normalizedEmail: string): Promise<OrderDocument | null> {
    return (await this.database()).collection<OrderDocument>(databaseCollections.orders).findOne({ ownerType: "guest", orderId, "contact.email": normalizedEmail });
  }

  async createGuestSession(orderId: string, now = new Date()): Promise<{ secret: string; expiresAt: Date }> {
    const secret = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + guestOrderAccessSessionTtlMs);
    const document: GuestOrderAccessSessionDocument = { sessionHash: hashGuestOrderAccessSession(secret), orderId, expiresAt, createdAt: now };
    await (await this.database()).collection<GuestOrderAccessSessionDocument>(databaseCollections.guestOrderAccessSessions).insertOne(document);
    return { secret, expiresAt };
  }

  async resolveGuestSession(secret: string, now = new Date()): Promise<OrderDocument | null> {
    if (!secret || secret.length < 32 || secret.length > 256) return null;
    const database = await this.database();
    const session = await database.collection<GuestOrderAccessSessionDocument>(databaseCollections.guestOrderAccessSessions)
      .findOne({ sessionHash: hashGuestOrderAccessSession(secret), expiresAt: { $gt: now } });
    if (!session) return null;
    return database.collection<OrderDocument>(databaseCollections.orders).findOne({ orderId: session.orderId, ownerType: "guest" });
  }
}
