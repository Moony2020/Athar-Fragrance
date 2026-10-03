import { ObjectId } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import type { CheckoutContact, CheckoutShippingAddress } from "@/checkout/contact-address";

export type OrderLineSnapshot = {
  productSlug: string;
  variantId: string;
  quantity: number;
  priceMinor: number;
  subtotalMinor: number;
  currency: string;
  productName: string;
  brandName: string;
  sizeMl: number | null;
  mediaSrc: string | null;
  /** Optional for legacy Orders created before the immutable product-image snapshot. */
  imageSnapshot?: {
    src: string;
    alt: string;
  };
};

export type OrderFinancialSnapshot = {
  merchandiseSubtotalMinor: number;
  shippingAmountMinor: number;
  discountAmountMinor: number;
  vatIncludedMinor: number;
  grandTotalMinor: number;
  currency: "SEK";
  shippingMethodId: string;
  shippingMethodLabelSnapshot: string;
};

export type OrderDocument = {
  _id?: ObjectId;
  orderId: string;
  paymentAttemptId: string;
  checkoutId: string;
  ownerType: CommerceOwner["ownerType"];
  ownerId: string;
  provider: "stripe" | "paypal";
  providerExternalId: string;
  status: "confirmed";
  paymentStatus: "paid";
  fulfillmentStatus: "pending";
  lines: OrderLineSnapshot[];
  subtotalMinor: number;
  totalMinor: number;
  currency: string;
  /** Optional to preserve historical Orders created before Stage 9.1. */
  merchandiseSubtotalMinor?: number;
  shippingAmountMinor?: number;
  discountAmountMinor?: number;
  vatIncludedMinor?: number;
  grandTotalMinor?: number;
  shippingMethodLabelSnapshot?: string;
  contact?: CheckoutContact;
  shippingAddress?: CheckoutShippingAddress;
  shippingMethodId?: string;
  createdAt: Date;
};

export function parseOrderFinancialSnapshot(order: Pick<OrderDocument, keyof OrderFinancialSnapshot>): OrderFinancialSnapshot | undefined {
  const snapshotFields = [order.merchandiseSubtotalMinor, order.shippingAmountMinor, order.discountAmountMinor, order.vatIncludedMinor, order.grandTotalMinor, order.shippingMethodLabelSnapshot];
  if (snapshotFields.every((value) => value === undefined)) return undefined;
  if (snapshotFields.some((value) => value === undefined) || order.shippingMethodId === undefined) throw new Error("Order financial snapshot is incomplete.");
  const snapshot = order as unknown as OrderFinancialSnapshot;
  const amounts = [snapshot.merchandiseSubtotalMinor, snapshot.shippingAmountMinor, snapshot.discountAmountMinor, snapshot.vatIncludedMinor, snapshot.grandTotalMinor];
  if (snapshot.currency !== "SEK" || amounts.some((value) => !Number.isSafeInteger(value) || value < 0) || snapshot.grandTotalMinor !== snapshot.merchandiseSubtotalMinor - snapshot.discountAmountMinor + snapshot.shippingAmountMinor || snapshot.vatIncludedMinor > snapshot.grandTotalMinor) {
    throw new Error("Order financial snapshot is invalid.");
  }
  return snapshot;
}
