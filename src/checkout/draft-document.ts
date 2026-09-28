import { ObjectId } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";
import type { CheckoutContact, CheckoutShippingAddress } from "./contact-address";

export type CheckoutDraftDocument = {
  _id?: ObjectId;
  checkoutId: string;
  ownerType: CommerceOwner["ownerType"];
  ownerId: string;
  revision: number;
  contact?: CheckoutContact;
  shippingAddress?: CheckoutShippingAddress;
  selectedShippingMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type CheckoutDraftPublic = {
  checkoutId: string;
  revision: number;
  contact?: CheckoutContact;
  shippingAddress?: CheckoutShippingAddress;
  selectedShippingMethodId?: string;
};

export function toCheckoutDraftPublic(document: CheckoutDraftDocument): CheckoutDraftPublic {
  return {
    checkoutId: document.checkoutId,
    revision: document.revision,
    ...(document.contact ? { contact: document.contact } : {}),
    ...(document.shippingAddress ? { shippingAddress: document.shippingAddress } : {}),
    ...(document.selectedShippingMethodId ? { selectedShippingMethodId: document.selectedShippingMethodId } : {}),
  };
}
