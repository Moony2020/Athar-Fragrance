import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { ClientSession, Db, MongoClient } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import { checkoutIdSchema } from "@/checkout/contact-address";
import {
  INVENTORY_RESERVATION_TTL_MS,
  type InventoryReservationDocument,
  type InventoryReservationLine,
  type InventoryReservationPublic,
  toInventoryReservationPublic,
} from "@/inventory/reservation-document";
import type { ProductDocument } from "@/server/catalog/documents";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase, getMongoClient } from "@/server/db/mongodb";

type ReservationResult =
  | { status: "reserved"; reservation: InventoryReservationPublic; idempotent: boolean }
  | { status: "insufficient" }
  | { status: "invalid" }
  | { status: "unavailable" };

function ownerFilter(owner: CommerceOwner) {
  return { ownerType: owner.ownerType, ownerId: owner.ownerId };
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11_000;
}

function publicVariantId(productSlug: string, internalVariantId: string): string {
  return createHash("sha256").update(`${productSlug}:${internalVariantId}`).digest("base64url").slice(0, 18);
}

function cartFingerprint(lines: readonly InventoryReservationLine[]): string {
  return createHash("sha256").update(lines
    .slice()
    .sort((left, right) => left.productSlug.localeCompare(right.productSlug) || left.variantId.localeCompare(right.variantId))
    .map((line) => `${line.productSlug}:${line.variantId}:${line.quantity}`).join("|"))
    .digest("base64url");
}

function validLines(lines: readonly InventoryReservationLine[]): lines is InventoryReservationLine[] {
  const identities = new Set<string>();
  return lines.length > 0 && lines.every((line) => {
    const identity = `${line.productSlug}:${line.variantId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
    return /^[a-z0-9-]+$/.test(line.productSlug) && /^[A-Za-z0-9_-]{1,64}$/.test(line.variantId) && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 12;
  });
}

/**
 * A durable, transaction-backed reservation ledger. Product inventory remains
 * canonical on the Product document; reservations are temporary claims only.
 */
export class MongoInventoryReservationStore {
  constructor(
    private readonly database: () => Promise<Db> = getDatabase,
    private readonly client: () => Promise<MongoClient> = getMongoClient,
  ) {}

  async prepare(owner: CommerceOwner, rawCheckoutId: unknown, requestedLines: readonly InventoryReservationLine[], now = new Date()): Promise<ReservationResult> {
    const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
    if (!checkoutId.success || !validLines(requestedLines)) return { status: "invalid" };
    const lines = requestedLines.map((line) => ({ ...line }));
    const fingerprint = cartFingerprint(lines);
    let result: ReservationResult = { status: "unavailable" };

    try {
      const client = await this.client();
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          result = await this.prepareInTransaction(session, owner, checkoutId.data, lines, fingerprint, now);
        });
      } finally {
        await session.endSession();
      }
      return result;
    } catch (error) {
      // The unique checkout index is an extra durable idempotency fence. A
      // retry after another transaction commits may see this duplicate-key
      // result instead of a transient transaction label, so re-read only the
      // same owner-bound active reservation before returning an outcome.
      if (isDuplicateKeyError(error)) {
        const existing = await this.readCompatibleActive(owner, checkoutId.data, fingerprint, now);
        if (existing) return { status: "reserved", reservation: existing, idempotent: true };
      }
      return { status: "unavailable" };
    }
  }

  private async readCompatibleActive(owner: CommerceOwner, checkoutId: string, fingerprint: string, now: Date): Promise<InventoryReservationPublic | null> {
    const document = await (await this.database()).collection<InventoryReservationDocument>(databaseCollections.inventoryReservations)
      .findOne({ checkoutId, ...ownerFilter(owner), status: "active", expiresAt: { $gt: now }, cartFingerprint: fingerprint });
    return document ? toInventoryReservationPublic(document) : null;
  }

  private async prepareInTransaction(session: ClientSession, owner: CommerceOwner, checkoutId: string, lines: InventoryReservationLine[], fingerprint: string, now: Date): Promise<ReservationResult> {
    const database = await this.database();
    const reservations = database.collection<InventoryReservationDocument>(databaseCollections.inventoryReservations);
    const existing = await reservations.findOne({ checkoutId, ...ownerFilter(owner) }, { session });
    const compatibleActiveReservation = existing?.status === "active" && existing.expiresAt > now && existing.cartFingerprint === fingerprint;
    const lockSlugs = [...new Set([...(existing?.status === "active" ? existing.lines : []), ...lines].map((line) => line.productSlug))].sort();
    const products = database.collection<ProductDocument>(databaseCollections.products);
    for (const slug of lockSlugs) {
      // This benign private revision update is the transaction write-conflict
      // point: competing reservations for the same Product must serialize.
      await products.updateOne({ slug }, { $inc: { inventoryReservationRevision: 1 } } as never, { session });
    }

    if (existing?.status === "active" && !compatibleActiveReservation) {
      await reservations.updateOne(
        { _id: existing._id, status: "active" },
        { $set: { status: existing.expiresAt <= now ? "expired" : "released", updatedAt: now }, $inc: { revision: 1 } },
        { session },
      );
    }

    // Expiry is logical: documents remain non-authoritative as soon as their
    // server-time deadline passes, independently of Mongo's delayed TTL sweep.
    await reservations.updateMany(
      { status: "active", expiresAt: { $lte: now }, "lines.productSlug": { $in: lockSlugs } },
      { $set: { status: "expired", updatedAt: now }, $inc: { revision: 1 } },
      { session },
    );

    const documents = await products.find({ slug: { $in: lockSlugs }, status: "active" }, { session }).toArray();
    const bySlug = new Map(documents.map((document) => [document.slug, document]));
    if (lines.some((line) => {
      const product = bySlug.get(line.productSlug);
      const variant = product?.variants.find((candidate) => publicVariantId(product.slug, candidate.id) === line.variantId);
      return !variant || !variant.isActive;
    })) {
      if (existing?.status === "active") {
        await reservations.updateOne({ _id: existing._id, status: "active" }, { $set: { status: "released", updatedAt: now }, $inc: { revision: 1 } }, { session });
      }
      return { status: "invalid" };
    }

    if (compatibleActiveReservation) {
      return { status: "reserved", reservation: toInventoryReservationPublic(existing), idempotent: true };
    }

    const active = await reservations.find(
      { status: "active", expiresAt: { $gt: now }, "lines.productSlug": { $in: lockSlugs } },
      { session },
    ).toArray();
    const reserved = new Map<string, number>();
    for (const reservation of active) for (const line of reservation.lines) {
      const key = `${line.productSlug}:${line.variantId}`;
      reserved.set(key, (reserved.get(key) ?? 0) + line.quantity);
    }

    for (const line of lines) {
      const product = bySlug.get(line.productSlug)!;
      const variant = product.variants.find((candidate) => publicVariantId(product.slug, candidate.id) === line.variantId)!;
      const alreadyReserved = reserved.get(`${line.productSlug}:${line.variantId}`) ?? 0;
      if (variant.inventoryQuantity - alreadyReserved < line.quantity) return { status: "insufficient" };
    }

    const document: InventoryReservationDocument = {
      reservationId: randomBytes(32).toString("base64url"),
      checkoutId,
      ...owner,
      cartFingerprint: fingerprint,
      lines,
      status: "active",
      revision: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + INVENTORY_RESERVATION_TTL_MS),
    };
    if (existing) {
      await reservations.replaceOne({ _id: existing._id }, document, { session });
    } else {
      await reservations.insertOne(document, { session });
    }
    return { status: "reserved", reservation: toInventoryReservationPublic(document), idempotent: false };
  }

  async releaseForOwner(owner: CommerceOwner, now = new Date()): Promise<void> {
    const collection = (await this.database()).collection<InventoryReservationDocument>(databaseCollections.inventoryReservations);
    await collection.updateMany({ ...ownerFilter(owner), status: "active", expiresAt: { $gt: now } }, { $set: { status: "released", updatedAt: now }, $inc: { revision: 1 } });
  }

  async readActive(owner: CommerceOwner, rawCheckoutId: unknown, now = new Date()): Promise<InventoryReservationPublic | null> {
    const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
    if (!checkoutId.success) return null;
    const document = await (await this.database()).collection<InventoryReservationDocument>(databaseCollections.inventoryReservations)
      .findOne({ checkoutId: checkoutId.data, ...ownerFilter(owner), status: "active", expiresAt: { $gt: now } });
    return document ? toInventoryReservationPublic(document) : null;
  }
}
