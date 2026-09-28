import "server-only";

import type { Db } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import { parsePaymentAttemptDocument } from "@/payments/payment-attempt-parser";
import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";
import type { StripePaymentIntentStatus } from "@/payments/payment-attempt-document";

function ownerFilter(owner: CommerceOwner) {
  return { ownerType: owner.ownerType, ownerId: owner.ownerId };
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11_000;
}

/** Mongo-only repository. There is intentionally no in-memory production fallback. */
export class MongoPaymentAttemptStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async createOrRead(document: PaymentAttemptDocument): Promise<{ attempt: PaymentAttemptDocument; idempotent: boolean }> {
    const collection = (await this.database()).collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts);
    try {
      await collection.insertOne(document);
      return { attempt: document, idempotent: false };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await collection.findOne({
        ...ownerFilter({ ownerType: document.ownerType, ownerId: document.ownerId }),
        checkoutId: document.checkoutId,
        idempotencyKey: document.idempotencyKey,
      });
      if (!existing) throw error;
      return { attempt: parsePaymentAttemptDocument(existing), idempotent: true };
    }
  }

  async supersedeIncompatible(owner: CommerceOwner, checkoutId: string, idempotencyKey: string, now = new Date()): Promise<void> {
    await (await this.database()).collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts).updateMany(
      { ...ownerFilter(owner), checkoutId, status: "local_created", idempotencyKey: { $ne: idempotencyKey } },
      { $set: { status: "superseded", updatedAt: now } },
    );
  }

  async supersedePending(owner: CommerceOwner, checkoutId: string, now = new Date()): Promise<void> {
    await (await this.database()).collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts).updateMany(
      { ...ownerFilter(owner), checkoutId, status: "local_created" },
      { $set: { status: "superseded", updatedAt: now } },
    );
  }

  async readCurrent(owner: CommerceOwner, paymentAttemptId: string): Promise<PaymentAttemptDocument | null> {
    const document = await (await this.database()).collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts)
      .findOne({ ...ownerFilter(owner), paymentAttemptId });
    return document ? parsePaymentAttemptDocument(document) : null;
  }

  /** Binds exactly one Stripe intent to an attempt; a different ID is rejected. */
  async bindStripePaymentIntent(owner: CommerceOwner, paymentAttemptId: string, paymentIntentId: string, status: StripePaymentIntentStatus, now = new Date()): Promise<PaymentAttemptDocument | null> {
    const collection = (await this.database()).collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts);
    const result = await collection.findOneAndUpdate(
      {
        ...ownerFilter(owner), paymentAttemptId, status: "local_created",
        $or: [{ provider: null }, { provider: "stripe", providerExternalId: paymentIntentId }],
      },
      { $set: { provider: "stripe", providerExternalId: paymentIntentId, providerStatus: status, updatedAt: now } },
      { returnDocument: "after" },
    );
    return result ? parsePaymentAttemptDocument(result) : null;
  }
}
