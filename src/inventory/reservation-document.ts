import { ObjectId } from "mongodb";

import type { CommerceOwner } from "@/commerce/durable-contracts";

export const INVENTORY_RESERVATION_TTL_MS = 15 * 60 * 1000;

export type InventoryReservationStatus = "active" | "consumed" | "released" | "expired";

export type InventoryReservationLine = {
  productSlug: string;
  variantId: string;
  quantity: number;
};

export type InventoryReservationDocument = {
  _id?: ObjectId;
  reservationId: string;
  checkoutId: string;
  ownerType: CommerceOwner["ownerType"];
  ownerId: string;
  cartFingerprint: string;
  lines: InventoryReservationLine[];
  status: InventoryReservationStatus;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type InventoryReservationPublic = {
  reservationId: string;
  checkoutId: string;
  status: "active";
  expiresAt: Date;
};

export function toInventoryReservationPublic(document: InventoryReservationDocument): InventoryReservationPublic {
  return { reservationId: document.reservationId, checkoutId: document.checkoutId, status: "active", expiresAt: document.expiresAt };
}
