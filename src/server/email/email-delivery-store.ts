import "server-only";

import type { Db } from "mongodb";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import type { OrderDocument } from "@/orders/order-document";
import { buildOrderConfirmationEmail, renderOrderConfirmationEmail } from "@/server/email/order-confirmation-email";
import type { OrderConfirmationMailer } from "@/server/auth/brevo-mailer";
import { createOrderConfirmationMailer } from "@/server/email/order-confirmation-mailer";
import { newEmailDelivery, nextRetryAt, type EmailDelivery, type EmailDeliveryStatus, ORDER_CONFIRMATION_MESSAGE_TYPE } from "@/server/email/email-delivery-document";

function duplicateKey(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }
function retryableStatus(status: string): boolean { return ["soft_bounce", "softbounced", "deferred", "error", "blocked"].includes(status.toLowerCase()); }
function permanentStatus(status: string): boolean { return ["hard_bounce", "hardbounce", "invalid", "invalid_email", "spam"].includes(status.toLowerCase()); }

export class MongoEmailDeliveryStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async ensureForOrder(order: OrderDocument, now = new Date()): Promise<EmailDelivery> {
    const recipient = order.contact?.email?.trim().toLowerCase();
    if (!recipient) throw new Error("Order contact email is required for delivery record.");
    const collection = (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries);
    const document = newEmailDelivery(order.orderId, recipient, now);
    try { await collection.insertOne(document); return document; } catch (error) {
      if (!duplicateKey(error)) throw error;
      const existing = await collection.findOne({ orderId: order.orderId, messageType: ORDER_CONFIRMATION_MESSAGE_TYPE });
      if (!existing) throw error;
      return existing;
    }
  }

  async claimNext(now = new Date(), leaseMs = 120_000): Promise<EmailDelivery | null> {
    const leaseId = newEmailDelivery("lease", "lease", now).deliveryId;
    const collection = (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries);
    const result = await collection.findOneAndUpdate(
      { status: { $in: ["pending", "retryable_failure"] }, attemptCount: { $lt: 5 }, $and: [{ $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] }, { $or: [{ leaseExpiresAt: { $exists: false } }, { leaseExpiresAt: { $lte: now } }] }] },
      { $set: { status: "sending", leaseId, leaseExpiresAt: new Date(now.getTime() + leaseMs), updatedAt: now }, $inc: { attemptCount: 1 } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    return result ?? null;
  }

  async claim(deliveryId: string, now = new Date(), leaseMs = 120_000): Promise<EmailDelivery | null> {
    const leaseId = newEmailDelivery("lease", "lease", now).deliveryId;
    const collection = (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries);
    const result = await collection.findOneAndUpdate(
      { deliveryId, status: { $in: ["pending", "retryable_failure"] }, attemptCount: { $lt: 5 }, $and: [{ $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] }, { $or: [{ leaseExpiresAt: { $exists: false } }, { leaseExpiresAt: { $lte: now } }] }] },
      { $set: { status: "sending", leaseId, leaseExpiresAt: new Date(now.getTime() + leaseMs), updatedAt: now }, $inc: { attemptCount: 1 } },
      { returnDocument: "after" },
    );
    return result ?? null;
  }

  async markProviderAccepted(deliveryId: string, providerMessageId: string | undefined, now = new Date()): Promise<EmailDelivery | null> {
    return this.updateState(deliveryId, ["sending"], "provider_accepted", { providerMessageId, leaseId: undefined, leaseExpiresAt: undefined, nextAttemptAt: undefined, lastErrorClass: undefined }, now);
  }

  async markFailure(deliveryId: string, kind: "temporary" | "permanent" | "ambiguous", now = new Date()): Promise<EmailDelivery | null> {
    const current = await (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries).findOne({ deliveryId, status: "sending" });
    if (!current) return null;
    const exhausted = kind === "temporary" && current.attemptCount >= 5;
    const status: EmailDeliveryStatus = exhausted || kind === "permanent" ? "permanent_failure" : kind === "temporary" ? "retryable_failure" : "ambiguous";
    return this.updateState(deliveryId, ["sending"], status, { lastErrorClass: exhausted ? "permanent" : kind, nextAttemptAt: status === "retryable_failure" ? nextRetryAt(current.attemptCount, now) : undefined, leaseId: undefined, leaseExpiresAt: undefined }, now);
  }

  async applyProviderEvent(input: { deliveryId?: string; providerMessageId?: string; status: string; now?: Date }): Promise<EmailDelivery | null> {
    const now = input.now ?? new Date();
    const collection = (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries);
    const query = input.deliveryId && input.providerMessageId ? { deliveryId: input.deliveryId, providerMessageId: input.providerMessageId } : input.deliveryId ? { deliveryId: input.deliveryId } : input.providerMessageId ? { providerMessageId: input.providerMessageId } : null;
    if (!query) return null;
    const current = await collection.findOne(query);
    if (!current) return null;
    const normalized = input.status.toLowerCase();
    if (normalized === "delivered") return this.updateState(current.deliveryId, ["provider_accepted", "delivered"], "delivered", { leaseId: undefined, leaseExpiresAt: undefined, nextAttemptAt: undefined }, now);
    if (permanentStatus(normalized)) return this.updateState(current.deliveryId, ["sending", "provider_accepted", "ambiguous", "retryable_failure", "permanent_failure"], "permanent_failure", { lastErrorClass: "permanent", leaseId: undefined, leaseExpiresAt: undefined, nextAttemptAt: undefined }, now);
    if (retryableStatus(normalized)) return this.updateState(current.deliveryId, ["sending", "provider_accepted", "ambiguous", "retryable_failure"], "retryable_failure", { lastErrorClass: "temporary", nextAttemptAt: nextRetryAt(Math.max(1, current.attemptCount), now), leaseId: undefined, leaseExpiresAt: undefined }, now);
    return current;
  }

  private async updateState(deliveryId: string, from: EmailDeliveryStatus[], status: EmailDeliveryStatus, extra: Record<string, unknown>, now: Date): Promise<EmailDelivery | null> {
    const collection = (await this.database()).collection<EmailDelivery>(databaseCollections.emailDeliveries);
    const set: Record<string, unknown> = { status, updatedAt: now };
    const unset: Record<string, ""> = {};
    for (const [key, value] of Object.entries(extra)) { if (value === undefined) unset[key] = ""; else set[key] = value; }
    return collection.findOneAndUpdate({ deliveryId, status: { $in: from } }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { returnDocument: "after" });
  }
}

export async function ensureOrderConfirmationDelivery(order: OrderDocument): Promise<EmailDelivery> { return new MongoEmailDeliveryStore().ensureForOrder(order); }

export async function dispatchOrderConfirmation(order: OrderDocument, mailer: OrderConfirmationMailer = createOrderConfirmationMailer()): Promise<EmailDelivery | null> {
  const store = new MongoEmailDeliveryStore();
  const ensured = await store.ensureForOrder(order);
  const claimed = await store.claim(ensured.deliveryId);
  if (!claimed) return ensured;
  try {
    const rendered = renderOrderConfirmationEmail(buildOrderConfirmationEmail(order));
    const result = await mailer.sendOrderConfirmation(rendered, { deliveryId: claimed.deliveryId, idempotencyKey: claimed.idempotencyKey });
    return await store.markProviderAccepted(claimed.deliveryId, result?.providerMessageId) ?? claimed;
  } catch (error) {
    const kind = error instanceof Error && error.name === "BrevoAmbiguousError" ? "ambiguous" : error instanceof Error && error.name === "BrevoPermanentError" ? "permanent" : "temporary";
    return await store.markFailure(claimed.deliveryId, kind) ?? claimed;
  }
}
