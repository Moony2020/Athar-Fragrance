import "server-only";

import { cookies } from "next/headers";
import { guestCommerceOwner, userCommerceOwner, type CommerceOwner } from "@/commerce/durable-contracts";
import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import { readCurrentCommerceOwner } from "@/server/commerce/current-owner";
import { MongoUserRepository } from "@/server/identity/user-repository";
import { MongoCheckoutDraftStore } from "./draft-store";

export const checkoutIdCookieName = "athar_checkout_id";

export async function resolveCurrentCheckoutOwner(): Promise<CommerceOwner | null> {
  const current = await readCurrentCommerceOwner();
  if (current.ownerType === "user") return userCommerceOwner(current.ownerId);
  return current.cartId ? guestCommerceOwner(current.cartId) : null;
}

export type CheckoutDraftPageState =
  | { status: "ready"; draft: CheckoutDraftPublic; email: string }
  | { status: "unavailable" };

/** Reads/creates an owner-bound, empty session only after the Cart is eligible. */
export async function readCurrentCheckoutDraft(): Promise<CheckoutDraftPageState> {
  try {
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "unavailable" };
    const requestedId = (await cookies()).get(checkoutIdCookieName)?.value;
    const draft = await new MongoCheckoutDraftStore().getOrCreate(owner, requestedId);
    const canonicalEmail = owner.ownerType === "user"
      ? (await new MongoUserRepository().findByUserId(owner.ownerId))?.normalizedEmail ?? ""
      : "";
    return { status: "ready", draft, email: draft.contact?.email ?? canonicalEmail };
  } catch {
    // Never log or return personal data or raw persistence errors.
    return { status: "unavailable" };
  }
}
