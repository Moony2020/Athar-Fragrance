import "server-only";

import { randomBytes } from "node:crypto";
import type { Db, UpdateFilter } from "mongodb";

import { DURABLE_COMMERCE_TTL_DAYS, type CommerceOwner } from "@/commerce/durable-contracts";
import { checkoutIdSchema, normalizeCheckoutContactAddress, type CheckoutContactAddress } from "@/checkout/contact-address";
import type { CheckoutDraftDocument, CheckoutDraftPublic } from "@/checkout/draft-document";
import { toCheckoutDraftPublic } from "@/checkout/draft-document";
import { parseCheckoutDraftDocument } from "@/checkout/draft-parser";
import { shippingMethodIdSchema, swedenShippingPolicy } from "@/checkout/shipping";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";

const draftTtlMs = DURABLE_COMMERCE_TTL_DAYS * 24 * 60 * 60 * 1000;

function createCheckoutId(): string {
  return randomBytes(32).toString("base64url");
}

function ownerFilter(owner: CommerceOwner) {
  return { ownerType: owner.ownerType, ownerId: owner.ownerId };
}

export class MongoCheckoutDraftStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async getOrCreate(owner: CommerceOwner, requestedCheckoutId?: string | null): Promise<CheckoutDraftPublic> {
    const collection = (await this.database()).collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts);
    const now = new Date();
    const requested = checkoutIdSchema.safeParse(requestedCheckoutId);

    if (requested.success) {
      const existing = await collection.findOne({ checkoutId: requested.data, ...ownerFilter(owner), expiresAt: { $gt: now } });
      if (existing) return toCheckoutDraftPublic(parseCheckoutDraftDocument(existing, owner));
    }

    // Never adopt a browser-provided ID that does not resolve to this owner.
    const createdAt = now;
    const draft: CheckoutDraftDocument = {
      checkoutId: createCheckoutId(),
      ...owner,
      revision: 1,
      createdAt,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + draftTtlMs),
    };
    await collection.insertOne(draft);
    return toCheckoutDraftPublic(draft);
  }

  async get(owner: CommerceOwner, rawCheckoutId: unknown): Promise<CheckoutDraftPublic | null> {
    const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
    if (!checkoutId.success) return null;
    const existing = await (await this.database()).collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts)
      .findOne({ checkoutId: checkoutId.data, ...ownerFilter(owner), expiresAt: { $gt: new Date() } });
    return existing ? toCheckoutDraftPublic(parseCheckoutDraftDocument(existing, owner)) : null;
  }

  async save(owner: CommerceOwner, rawCheckoutId: unknown, expectedRevision: unknown, input: CheckoutContactAddress): Promise<"saved" | "not-found" | "conflict"> {
    const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
    const revision = typeof expectedRevision === "number" && Number.isSafeInteger(expectedRevision) && expectedRevision > 0
      ? expectedRevision
      : null;
    const data = normalizeCheckoutContactAddress(input);
    if (!checkoutId.success || revision === null) return "not-found";

    const collection = (await this.database()).collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts);
    const now = new Date();
    const existing = await collection.findOne({ checkoutId: checkoutId.data, ...ownerFilter(owner) });
    if (!existing || existing.expiresAt <= now) return "not-found";
    const parsed = parseCheckoutDraftDocument(existing, owner);
    if (parsed.revision !== revision) return "conflict";
    const update: UpdateFilter<CheckoutDraftDocument> = {
      $set: { contact: data.contact, shippingAddress: data.shippingAddress, updatedAt: now, expiresAt: new Date(now.getTime() + draftTtlMs) },
      $inc: { revision: 1 },
      ...(data.shippingAddress.countryCode === swedenShippingPolicy.countryCode ? {} : { $unset: { selectedShippingMethodId: "" as const } }),
    };
    const result = await collection.updateOne(
      { _id: parsed._id, ...ownerFilter(owner), checkoutId: checkoutId.data, revision, expiresAt: { $gt: now } },
      update,
    );
    return result.matchedCount === 1 ? "saved" : "conflict";
  }

  async saveShippingSelection(owner: CommerceOwner, rawCheckoutId: unknown, expectedRevision: unknown, rawShippingMethodId: unknown): Promise<"saved" | "not-found" | "conflict"> {
    const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
    const shippingMethodId = shippingMethodIdSchema.safeParse(rawShippingMethodId);
    const revision = typeof expectedRevision === "number" && Number.isSafeInteger(expectedRevision) && expectedRevision > 0 ? expectedRevision : null;
    if (!checkoutId.success || !shippingMethodId.success || revision === null) return "not-found";

    const collection = (await this.database()).collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts);
    const now = new Date();
    const existing = await collection.findOne({ checkoutId: checkoutId.data, ...ownerFilter(owner) });
    if (!existing || existing.expiresAt <= now) return "not-found";
    const parsed = parseCheckoutDraftDocument(existing, owner);
    if (parsed.revision !== revision) return "conflict";
    const result = await collection.updateOne(
      { _id: parsed._id, ...ownerFilter(owner), checkoutId: checkoutId.data, revision, expiresAt: { $gt: now } },
      { $set: { selectedShippingMethodId: shippingMethodId.data, updatedAt: now, expiresAt: new Date(now.getTime() + draftTtlMs) }, $inc: { revision: 1 } },
    );
    return result.matchedCount === 1 ? "saved" : "conflict";
  }
}
