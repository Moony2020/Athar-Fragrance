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
  contact?: CheckoutContact;
  shippingAddress?: CheckoutShippingAddress;
  shippingMethodId?: string;
  createdAt: Date;
};
