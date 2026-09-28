"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { addToCommerceCart, removeCommerceCartLine, type GuestCartMutationResult, updateCommerceCartLine } from "@/server/commerce/guest-cart";
import { readCurrentCommerceCart } from "@/server/commerce/cart-read";
import { toggleCommerceWishlist } from "@/server/commerce/guest-wishlist";
import { readCurrentCommerceWishlist } from "@/server/commerce/wishlist-read";
import { readCurrentCommerceOwner } from "@/server/commerce/current-owner";
import { guestCommerceOwner, userCommerceOwner, type CommerceOwner } from "@/commerce/durable-contracts";
import { guestWishlistCookieName, guestWishlistIdPattern, readGuestWishlistId } from "@/server/commerce/guest-wishlist-cookie";
import { MongoInventoryReservationStore } from "@/server/inventory/reservation-store";

const guestCartCookieName = "athar_guest_cart";
const guestCartIdPattern = /^[A-Za-z0-9_-]{32,128}$/;
const guestCommerceCookieMaxAge = 30 * 24 * 60 * 60;

export async function readGuestCartSnapshotAction() {
  return readCurrentCommerceCart();
}

export async function readGuestWishlistSnapshotAction() {
  return readCurrentCommerceWishlist();
}

function createGuestCartId() {
  return randomBytes(32).toString("base64url");
}

async function invalidateOwnerReservation(owner: CommerceOwner) {
  await new MongoInventoryReservationStore().releaseForOwner(owner);
}

/** PDP-only Cart mutation. It receives identity + quantity, never browser-owned commerce data. */
export async function addToGuestCartAction(input: unknown): Promise<GuestCartMutationResult> {
  const owner = await readCurrentCommerceOwner();
  const cookieStore = await cookies();
  const existing = cookieStore.get(guestCartCookieName)?.value;
  const guestId = existing && guestCartIdPattern.test(existing) ? existing : createGuestCartId();
  const result = await addToCommerceCart(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId), input);
  if (result.ok && owner.ownerType === "guest" && guestId !== existing) {
    cookieStore.set({ name: guestCartCookieName, value: guestId, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: guestCommerceCookieMaxAge, path: "/" });
  }
  if (result.ok) {
    await invalidateOwnerReservation(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId));
    refresh();
  }
  return result;
}

export async function updateGuestCartLineAction(input: unknown) {
  const owner = await readCurrentCommerceOwner();
  const guestId = owner.ownerType === "guest" ? owner.cartId : null;
  if (owner.ownerType === "guest" && !guestId) return { ok: false as const, code: "CART_LINE_NOT_FOUND", message: "This item is no longer in your bag." };
  const result = await updateCommerceCartLine(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId!), input);
  if (result.ok) {
    await invalidateOwnerReservation(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId!));
    refresh();
  }
  return result;
}

export async function removeGuestCartLineAction(input: unknown) {
  const owner = await readCurrentCommerceOwner();
  const guestId = owner.ownerType === "guest" ? owner.cartId : null;
  if (owner.ownerType === "guest" && !guestId) return { ok: false as const, code: "CART_LINE_NOT_FOUND", message: "This item is no longer in your bag." };
  const result = await removeCommerceCartLine(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId!), input);
  if (result.ok) {
    await invalidateOwnerReservation(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId!));
    refresh();
  }
  return result;
}

export async function toggleGuestWishlistAction(input: unknown) {
  const owner = await readCurrentCommerceOwner();
  const cookieStore = await cookies(); const existing = await readGuestWishlistId(); const guestId = existing ?? createGuestCartId();
  const result = await toggleCommerceWishlist(owner.ownerType === "user" ? userCommerceOwner(owner.ownerId) : guestCommerceOwner(guestId), input);
  if (result.ok && owner.ownerType === "guest" && !existing && guestWishlistIdPattern.test(guestId)) cookieStore.set({ name: guestWishlistCookieName, value: guestId, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: guestCommerceCookieMaxAge, path: "/" });
  if (result.ok) refresh(); return result;
}
