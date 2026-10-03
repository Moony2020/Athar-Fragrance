import "server-only";

import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import { resolveCart } from "@/commerce/domain";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import { getGuestCartStore } from "@/server/commerce/store";
import { isMongoGuestCartStore } from "@/server/commerce/mongo-store";
import { resolvePublicCommerceProduct } from "@/server/commerce/services";
import { getProductDetailData } from "@/server/catalog/services";
import { getCustomerProductImageSnapshot } from "@/lib/customer-product-image";
import { MongoInventoryReservationStore } from "@/server/inventory/reservation-store";
import { MongoCheckoutDraftStore } from "@/server/checkout/draft-store";
import type { PaymentAttemptDocument } from "@/payments/payment-attempt-document";
import type { OrderDocument } from "@/orders/order-document";
import type { ResolvedCartLine } from "@/commerce/domain";
import type { CatalogProductDetail } from "@/server/catalog/read-model";

function ownerFilter(owner: CommerceOwner) { return { ownerType: owner.ownerType, ownerId: owner.ownerId }; }
function orderId() { return `ATH-${randomBytes(6).toString("hex").toUpperCase()}`; }

type SnapshotProduct = Pick<CatalogProductDetail, "slug" | "name" | "brand" | "fragranceType" | "variants" | "media">;

/** Builds a historical line from trusted server-side Cart and catalog data only. */
export function toOrderLineSnapshot(line: ResolvedCartLine, product: SnapshotProduct | null) {
  const imageSnapshot = product ? getCustomerProductImageSnapshot(product) : undefined;
  return {
    ...line,
    productName: product?.name ?? line.productSlug,
    brandName: product?.brand.name ?? "ATHAR",
    fragranceType: product?.fragranceType ?? null,
    sizeMl: product?.variants.find((variant) => variant.id === line.variantId)?.sizeMl ?? null,
    mediaSrc: imageSnapshot?.src ?? null,
    ...(imageSnapshot ? { imageSnapshot } : {}),
  };
}

export class MongoOrderStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async finalizePayment(owner: CommerceOwner, attempt: PaymentAttemptDocument): Promise<OrderDocument | null> {
    const collection = (await this.database()).collection<OrderDocument>(databaseCollections.orders);
    const existing = await collection.findOne({ paymentAttemptId: attempt.paymentAttemptId, ...ownerFilter(owner) });
    if (existing) { await this.clearCart(owner); return existing; }
    const draft = await new MongoCheckoutDraftStore(this.database).get(owner, attempt.checkoutId);
    const store = getGuestCartStore();
    if (!draft || !isMongoGuestCartStore(store) || !attempt.provider || !attempt.providerExternalId) return null;
    if (attempt.merchandiseSubtotalMinor === undefined || attempt.shippingAmountMinor === undefined || attempt.discountAmountMinor === undefined || attempt.vatIncludedMinor === undefined || attempt.grandTotalMinor === undefined || !attempt.shippingMethodLabelSnapshot) return null;
    const resolved = await resolveCart(await store.readOwner(owner), resolvePublicCommerceProduct);
    if (!resolved.lines.length || resolved.currency !== attempt.currency || resolved.subtotalMinor !== attempt.merchandiseSubtotalMinor) return null;
    const consumed = await new MongoInventoryReservationStore(this.database).consume(owner, attempt.reservationId);
    if (consumed === "unavailable") {
      const concurrent = await collection.findOne({ paymentAttemptId: attempt.paymentAttemptId, ...ownerFilter(owner) });
      if (concurrent) { await this.clearCart(owner); return concurrent; }
      return null;
    }
    const now = new Date();
    const lines = await Promise.all(resolved.lines.map(async (line) => {
      const detail = await getProductDetailData(line.productSlug);
      return toOrderLineSnapshot(line, detail.product);
    }));
    const document: OrderDocument = {
      orderId: orderId(), paymentAttemptId: attempt.paymentAttemptId, checkoutId: attempt.checkoutId,
      ...ownerFilter(owner), provider: attempt.provider, providerExternalId: attempt.providerExternalId, status: "confirmed",
      paymentStatus: "paid", fulfillmentStatus: "pending",
      lines,
      subtotalMinor: attempt.merchandiseSubtotalMinor, totalMinor: attempt.grandTotalMinor, currency: attempt.currency,
      merchandiseSubtotalMinor: attempt.merchandiseSubtotalMinor,
      shippingAmountMinor: attempt.shippingAmountMinor,
      discountAmountMinor: attempt.discountAmountMinor,
      vatIncludedMinor: attempt.vatIncludedMinor,
      grandTotalMinor: attempt.grandTotalMinor,
      ...(draft.contact ? { contact: draft.contact } : {}), ...(draft.shippingAddress ? { shippingAddress: draft.shippingAddress } : {}),
      ...(draft.selectedShippingMethodId ? { shippingMethodId: draft.selectedShippingMethodId } : {}),
      shippingMethodLabelSnapshot: attempt.shippingMethodLabelSnapshot,
      createdAt: now,
    };
    try { await collection.insertOne(document); } catch (error) {
      const concurrent = await collection.findOne({ paymentAttemptId: attempt.paymentAttemptId, ...ownerFilter(owner) });
      if (!concurrent) throw error;
      await this.clearCart(owner); return concurrent;
    }
    await this.clearCart(owner); return document;
  }

  async listForOwner(owner: CommerceOwner): Promise<OrderDocument[]> {
    return (await this.database()).collection<OrderDocument>(databaseCollections.orders).find(ownerFilter(owner)).sort({ createdAt: -1 }).limit(20).toArray();
  }

  async findForOwnerByOrderId(owner: CommerceOwner, publicOrderId: string): Promise<OrderDocument | null> {
    return (await this.database()).collection<OrderDocument>(databaseCollections.orders).findOne({ orderId: publicOrderId, ...ownerFilter(owner) });
  }

  private async clearCart(owner: CommerceOwner) {
    const store = getGuestCartStore();
    if (isMongoGuestCartStore(store)) await store.mutateOwner(owner, async () => ({ lines: [] }));
  }
}
