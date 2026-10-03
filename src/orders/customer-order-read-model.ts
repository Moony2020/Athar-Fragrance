import "server-only";

import { parseOrderFinancialSnapshot, type OrderDocument } from "@/orders/order-document";

export type CustomerOrderReadModel = {
  orderId: string;
  createdAt: Date;
  paymentStatus: "paid";
  fulfillmentStatus: "pending";
  lines: Array<{
    productSlug: string;
    variantId: string;
    productName: string;
    brandName: string;
    sizeMl: number | null;
    mediaSrc: string | null;
    quantity: number;
    priceMinor: number;
    subtotalMinor: number;
    currency: string;
  }>;
  totals: {
    subtotalMinor: number;
    totalMinor: number;
    currency: string;
    financialSnapshot?: {
      merchandiseSubtotalMinor: number;
      shippingAmountMinor: number;
      discountAmountMinor: number;
      vatIncludedMinor: number;
      grandTotalMinor: number;
      shippingMethodId: string;
      shippingMethodLabelSnapshot: string;
    };
  };
  contact?: { email: string };
  shippingAddress?: OrderDocument["shippingAddress"];
};

/** Maps persisted Order snapshots to the only customer-safe detail boundary. */
export function toCustomerOrderReadModel(order: OrderDocument): CustomerOrderReadModel {
  const financial = parseOrderFinancialSnapshot(order);
  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    lines: order.lines.map((line) => ({
      productSlug: line.productSlug, variantId: line.variantId, productName: line.productName,
      brandName: line.brandName, sizeMl: line.sizeMl, mediaSrc: line.mediaSrc,
      quantity: line.quantity, priceMinor: line.priceMinor, subtotalMinor: line.subtotalMinor, currency: line.currency,
    })),
    totals: {
      subtotalMinor: order.subtotalMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      ...(financial ? { financialSnapshot: {
        merchandiseSubtotalMinor: financial.merchandiseSubtotalMinor,
        shippingAmountMinor: financial.shippingAmountMinor,
        discountAmountMinor: financial.discountAmountMinor,
        vatIncludedMinor: financial.vatIncludedMinor,
        grandTotalMinor: financial.grandTotalMinor,
        shippingMethodId: financial.shippingMethodId,
        shippingMethodLabelSnapshot: financial.shippingMethodLabelSnapshot,
      } } : {}),
    },
    ...(order.contact ? { contact: { email: order.contact.email } } : {}),
    ...(order.shippingAddress ? { shippingAddress: order.shippingAddress } : {}),
  };
}
