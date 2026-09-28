import "server-only";

import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import type { BrandDocument, CollectionDocument, ProductDocument } from "@/server/catalog/documents";
import type { DurableCartDocument, DurableWishlistDocument } from "@/server/commerce/mongo-store";
import type { UserDocument } from "@/identity/documents";
import type { UserCredentialDocument } from "@/identity/credential-documents";
import type { CheckoutDraftDocument } from "@/checkout/draft-document";
import type { InventoryReservationDocument } from "@/inventory/reservation-document";
import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";

/**
 * Idempotent catalog indexes. Invoke from a controlled deployment/migration
 * operation, never as an implicit homepage side effect.
 */
export async function ensureCatalogIndexes(): Promise<void> {
  const database = await getDatabase();
  const products = database.collection<ProductDocument>(databaseCollections.products);
  const brands = database.collection<BrandDocument>(databaseCollections.brands);
  const collections = database.collection<CollectionDocument>(databaseCollections.collections);

  await Promise.all([
    products.createIndexes([
      { key: { slug: 1 }, name: "product_slug_unique", unique: true },
      { key: { status: 1, createdAt: -1 }, name: "product_public_listing" },
      { key: { brandId: 1 }, name: "product_brand" },
      { key: { collectionIds: 1 }, name: "product_collections" },
      { key: { audience: 1 }, name: "product_audience" },
      { key: { fragranceFamily: 1 }, name: "product_fragrance_family" },
    ]),
    brands.createIndex({ slug: 1 }, { name: "brand_slug_unique", unique: true }),
    collections.createIndex({ slug: 1 }, { name: "collection_slug_unique", unique: true }),
  ]);
}

/** Commerce indexes are explicit deployment work; importing the app never creates them. */
export async function ensureCommerceIndexes(): Promise<void> {
  const database = await getDatabase();
  await Promise.all([
    database.collection<DurableCartDocument>(databaseCollections.carts).createIndexes([
      { key: { ownerType: 1, ownerId: 1 }, name: "cart_owner_unique", unique: true },
      { key: { expiresAt: 1 }, name: "cart_expiry_ttl", expireAfterSeconds: 0 },
    ]),
    database.collection<DurableWishlistDocument>(databaseCollections.wishlists).createIndexes([
      { key: { ownerType: 1, ownerId: 1 }, name: "wishlist_owner_unique", unique: true },
      { key: { expiresAt: 1 }, name: "wishlist_expiry_ttl", expireAfterSeconds: 0 },
    ]),
    (async () => { const merges = database.collection(databaseCollections.commerceMerges); await merges.dropIndex("commerce_merge_pair_unique").catch(() => undefined); return merges.createIndex({ userId: 1, guestId: 1, kind: 1 }, { name: "commerce_merge_pair_kind_unique", unique: true }); })(),
  ]);
}

/** Checkout-draft indexes are explicit deployment work, never a request side effect. */
export async function ensureCheckoutDraftIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<CheckoutDraftDocument>(databaseCollections.checkoutDrafts).createIndexes([
    { key: { checkoutId: 1 }, name: "checkout_id_unique", unique: true },
    { key: { expiresAt: 1 }, name: "checkout_draft_expiry_ttl", expireAfterSeconds: 0 },
  ]);
}

/** Inventory reservation indexes are an explicit deployment operation, never a request side effect. */
export async function ensureInventoryReservationIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<InventoryReservationDocument>(databaseCollections.inventoryReservations).createIndexes([
    { key: { checkoutId: 1 }, name: "inventory_reservation_checkout_unique", unique: true },
    { key: { status: 1, expiresAt: 1, "lines.productSlug": 1 }, name: "inventory_reservation_active_lookup" },
    { key: { expiresAt: 1 }, name: "inventory_reservation_expiry_ttl", expireAfterSeconds: 0 },
    { key: { ownerType: 1, ownerId: 1, status: 1 }, name: "inventory_reservation_owner_status" },
  ]);
}

/** Payment-attempt indexes are explicit deployment work, never request work. */
export async function ensurePaymentAttemptIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<PaymentAttemptDocument>(databaseCollections.paymentAttempts).createIndexes([
    { key: { paymentAttemptId: 1 }, name: "payment_attempt_public_id_unique", unique: true },
    { key: { ownerType: 1, ownerId: 1, checkoutId: 1, idempotencyKey: 1 }, name: "payment_attempt_checkout_idempotency_unique", unique: true },
    { key: { ownerType: 1, ownerId: 1, checkoutId: 1, status: 1 }, name: "payment_attempt_owner_checkout_status" },
    { key: { reservationId: 1 }, name: "payment_attempt_reservation" },
  ]);
}

/** Identity indexes are explicit deployment work; importing identity code never creates them. */
export async function ensureIdentityIndexes(): Promise<void> {
  const database = await getDatabase();
  await Promise.all([
    database.collection<UserDocument>(databaseCollections.users).createIndexes([
      { key: { normalizedEmail: 1 }, name: "users_email_unique", unique: true },
      { key: { userId: 1 }, name: "users_public_id_unique", unique: true },
    ]),
    database.collection<UserCredentialDocument>(databaseCollections.userCredentials).createIndex({ userId: 1 }, { name: "credentials_user_unique", unique: true }),
  ]);
}

/** Password recovery indexes are explicit, idempotent deployment work. */
export async function ensurePasswordResetIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection(databaseCollections.passwordResetTokens).createIndexes([
    { key: { userId: 1 }, name: "password_reset_user_unique", unique: true },
    { key: { tokenHash: 1 }, name: "password_reset_token_hash_unique", unique: true },
    { key: { expiresAt: 1 }, name: "password_reset_expiry_ttl", expireAfterSeconds: 0 },
  ]);
}

export async function ensureCommerceMergeIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection(databaseCollections.commerceMerges).createIndex({ userId: 1, guestId: 1 }, { name: "commerce_merge_pair_unique", unique: true });
}
