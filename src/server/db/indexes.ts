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
import type { OrderDocument } from "@/orders/order-document";
import type { EmailDelivery } from "@/server/email/email-delivery-document";
import type { GuestOrderAccessSessionDocument, OrderLookupRateLimitDocument } from "@/server/orders/guest-order-access-document";
import type { PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import type { AdminInvitationDocument } from "@/admin/admin-invitation-document";
import type { AdminAuthRateLimitDocument, AdminAuthRateLimitAttemptDocument } from "@/admin/admin-auth-rate-limit-document";

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
    { key: { provider: 1, providerExternalId: 1 }, name: "payment_attempt_provider_external" },
  ]);
}

/** Order indexes are explicit deployment work, never request work. */
export async function ensureOrderIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<OrderDocument>(databaseCollections.orders).createIndexes([
    { key: { orderId: 1 }, name: "order_public_id_unique", unique: true },
    { key: { paymentAttemptId: 1 }, name: "order_payment_attempt_unique", unique: true },
    { key: { ownerType: 1, ownerId: 1, createdAt: -1 }, name: "order_owner_created" },
  ]);
}

/** Email delivery indexes are explicit deployment work, never request work. */
export async function ensureEmailDeliveryIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<EmailDelivery>(databaseCollections.emailDeliveries).createIndexes([
    { key: { orderId: 1, messageType: 1 }, name: "email_delivery_order_message_unique", unique: true },
    { key: { deliveryId: 1 }, name: "email_delivery_public_id_unique", unique: true },
    { key: { status: 1, nextAttemptAt: 1, leaseExpiresAt: 1, createdAt: 1 }, name: "email_delivery_dispatch_claim" },
    { key: { providerMessageId: 1 }, name: "email_delivery_provider_message" },
  ]);
}

/** Secure Order Access indexes are explicit deployment work, never request work. */
export async function ensureSecureOrderAccessIndexes(): Promise<void> {
  const database = await getDatabase();
  await Promise.all([
    database.collection<GuestOrderAccessSessionDocument>(databaseCollections.guestOrderAccessSessions).createIndexes([
      { key: { sessionHash: 1 }, name: "guest_order_access_session_hash_unique", unique: true },
      { key: { expiresAt: 1 }, name: "guest_order_access_session_expiry_ttl", expireAfterSeconds: 0 },
    ]),
    database.collection<OrderLookupRateLimitDocument>(databaseCollections.orderLookupRateLimits).createIndexes([
      { key: { dimension: 1, identifierHmac: 1, windowStart: 1 }, name: "order_lookup_rate_limit_window_unique", unique: true },
      { key: { expiresAt: 1 }, name: "order_lookup_rate_limit_expiry_ttl", expireAfterSeconds: 0 },
    ]),
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

/** Privileged audit indexes are explicit deployment/bootstrap work and never request work. */
export async function ensurePrivilegedAuditEventIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents).createIndexes([
    { key: { eventId: 1 }, name: "privileged_audit_event_id_unique", unique: true },
    { key: { "target.id": 1, createdAt: -1 }, name: "privileged_audit_target_created" },
    { key: { action: 1, createdAt: -1 }, name: "privileged_audit_action_created" },
  ]);
}

/** Admin invitation indexes are explicit Owner provisioning work, never request work. */
export async function ensureAdminInvitationIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations).createIndexes([
    { key: { invitationId: 1 }, name: "admin_invitation_id_unique", unique: true },
    { key: { tokenHash: 1 }, name: "admin_invitation_token_hash_unique", unique: true },
    {
      key: { normalizedEmail: 1 },
      name: "admin_invitation_pending_email_unique",
      unique: true,
      partialFilterExpression: { status: "pending" },
    },
    { key: { normalizedEmail: 1, createdAt: -1 }, name: "admin_invitation_email_created" },
    { key: { purgeAt: 1 }, name: "admin_invitation_cleanup_ttl", expireAfterSeconds: 0 },
  ]);
}

/** Activation limiter indexes are explicit deployment work, never request work. */
export async function ensureAdminActivationIndexes(): Promise<void> {
  const database = await getDatabase();
  await Promise.all([
    database.collection<AdminAuthRateLimitDocument>(databaseCollections.adminAuthRateLimits).createIndexes([
      { key: { dimension: 1, identifierHmac: 1, windowStart: 1 }, name: "admin_auth_rate_limit_window_unique", unique: true },
      { key: { expiresAt: 1 }, name: "admin_auth_rate_limit_expiry_ttl", expireAfterSeconds: 0 },
    ]),
    database.collection<AdminAuthRateLimitAttemptDocument>(databaseCollections.adminAuthRateLimitAttempts).createIndexes([
      { key: { attemptId: 1 }, name: "admin_auth_rate_limit_attempt_unique", unique: true },
      { key: { expiresAt: 1 }, name: "admin_auth_rate_limit_attempt_expiry_ttl", expireAfterSeconds: 0 },
    ]),
  ]);
}
