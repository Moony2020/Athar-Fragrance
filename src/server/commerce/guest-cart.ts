import "server-only";

import {
  createGuestCartService,
  type CartLineInput,
} from "@/commerce/guest-cart-service";
import { removeCartLine, updateCartLineQuantity } from "@/commerce/domain";
import { CommerceError, quantitySchema, publicVariantIdSchema } from "@/commerce/contracts";
import { slugSchema } from "@/server/catalog/schemas";
import { resolvePublicCommerceProduct } from "@/server/commerce/services";
import { getGuestCartStore } from "@/server/commerce/store";
import { isMongoGuestCartStore } from "@/server/commerce/mongo-store";
import type { CommerceOwner } from "@/commerce/durable-contracts";

export type { GuestCartMutationResult, GuestCartReadResult } from "@/commerce/guest-cart-service";

function getService() {
  return createGuestCartService(getGuestCartStore(), resolvePublicCommerceProduct);
}

function getOwnerService(owner: CommerceOwner) {
  const store = getGuestCartStore();
  if (!isMongoGuestCartStore(store)) return null;
  return createGuestCartService({
    read: () => store.readOwner(owner),
    mutate: (_ignored, mutation) => store.mutateOwner(owner, mutation),
  }, resolvePublicCommerceProduct);
}

export function addToCommerceCart(owner: CommerceOwner, input: CartLineInput | unknown) {
  return owner.ownerType === "guest" ? addToGuestCart(owner.ownerId, input) : (getOwnerService(owner)?.add(owner.ownerId, input) ?? Promise.resolve({ ok: false as const, code: "CART_UNAVAILABLE" as const, message: "Bag service is temporarily unavailable." }));
}

export async function updateCommerceCartLine(owner: CommerceOwner, rawInput: unknown) {
  if (owner.ownerType === "guest") return updateGuestCartLine(owner.ownerId, rawInput);
  const service = getOwnerService(owner);
  if (!service) return { ok: false as const, code: "CART_UNAVAILABLE", message: "Bag service is temporarily unavailable." };
  const input = publicVariantIdSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { variantId?: unknown }).variantId : undefined);
  const productSlug = slugSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { productSlug?: unknown }).productSlug : undefined);
  const quantity = quantitySchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { quantity?: unknown }).quantity : undefined);
  if (!input.success || !productSlug.success || !quantity.success) return { ok: false as const, code: "INVALID_CART_INPUT", message: "Please choose an available size and quantity." };
  try { const cart = await storeForOwner().mutateOwner(owner, async (current) => updateCartLineQuantity(current, { productSlug: productSlug.data, variantId: input.data }, quantity.data, resolvePublicCommerceProduct)); return { ok: true as const, totalQuantity: cart.lines.reduce((t, l) => t + l.quantity, 0), message: "Quantity updated." }; } catch (error) { return mutationFailure(error); }
}

function storeForOwner() { const store = getGuestCartStore(); if (!isMongoGuestCartStore(store)) throw new Error("Cart unavailable"); return store; }

export function addToGuestCart(guestId: string, input: CartLineInput | unknown) {
  return getService().add(guestId, input);
}

export function readGuestCart(guestId: string) {
  return getService().read(guestId);
}

function mutationFailure(error: unknown) {
  console.error("[athar-cart] mutation failed", error instanceof Error ? error.message : error);
  if (!(error instanceof CommerceError)) return { ok: false as const, code: "CART_UNAVAILABLE", message: "Bag service is temporarily unavailable." };
  if (error.code === "CART_LINE_NOT_FOUND") return { ok: false as const, code: "CART_LINE_NOT_FOUND", message: "This item is no longer in your bag." };
  if (error.code === "VARIANT_UNAVAILABLE") return { ok: false as const, code: "VARIANT_UNAVAILABLE", message: "This size is currently unavailable." };
  if (error.code === "PRODUCT_UNAVAILABLE") return { ok: false as const, code: "PRODUCT_UNAVAILABLE", message: "This fragrance is no longer available." };
  return { ok: false as const, code: "INVALID_QUANTITY", message: "Please choose a quantity from 1 to 12." };
}

export async function updateGuestCartLine(guestId: string, rawInput: unknown) {
  const input = publicVariantIdSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { variantId?: unknown }).variantId : undefined);
  const productSlug = slugSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { productSlug?: unknown }).productSlug : undefined);
  const quantity = quantitySchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { quantity?: unknown }).quantity : undefined);
  if (!input.success || !productSlug.success || !quantity.success) return { ok: false as const, code: "INVALID_CART_INPUT", message: "Please choose an available size and quantity." };
  const store = getGuestCartStore();
  if (!store) return { ok: false as const, code: "CART_UNAVAILABLE", message: "Bag service is temporarily unavailable." };
  try {
    const cart = await store.mutate(guestId, (current) => updateCartLineQuantity(current, { productSlug: productSlug.data, variantId: input.data }, quantity.data, resolvePublicCommerceProduct));
    return { ok: true as const, totalQuantity: cart.lines.reduce((total, line) => total + line.quantity, 0), message: "Quantity updated." };
  } catch (error) { return mutationFailure(error); }
}

export async function removeGuestCartLine(guestId: string, rawInput: unknown) {
  const input = publicVariantIdSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { variantId?: unknown }).variantId : undefined);
  const productSlug = slugSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { productSlug?: unknown }).productSlug : undefined);
  if (!input.success || !productSlug.success) return { ok: false as const, code: "INVALID_CART_INPUT", message: "This bag item is invalid." };
  const store = getGuestCartStore();
  if (!store) return { ok: false as const, code: "CART_UNAVAILABLE", message: "Bag service is temporarily unavailable." };
  try {
    const cart = await store.mutate(guestId, async (current) => removeCartLine(current, { productSlug: productSlug.data, variantId: input.data }));
    return { ok: true as const, totalQuantity: cart.lines.reduce((total, line) => total + line.quantity, 0), message: "Item removed from bag." };
  } catch (error) { return mutationFailure(error); }
}

export async function removeCommerceCartLine(owner: CommerceOwner, rawInput: unknown) {
  if (owner.ownerType === "guest") return removeGuestCartLine(owner.ownerId, rawInput);
  const input = publicVariantIdSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { variantId?: unknown }).variantId : undefined);
  const productSlug = slugSchema.safeParse(typeof rawInput === "object" && rawInput ? (rawInput as { productSlug?: unknown }).productSlug : undefined);
  if (!input.success || !productSlug.success) return { ok: false as const, code: "INVALID_CART_INPUT", message: "This bag item is invalid." };
  const store = getGuestCartStore(); if (!isMongoGuestCartStore(store)) return { ok: false as const, code: "CART_UNAVAILABLE", message: "Bag service is temporarily unavailable." };
  try { const cart = await store.mutateOwner(owner, async (current) => removeCartLine(current, { productSlug: productSlug.data, variantId: input.data })); return { ok: true as const, totalQuantity: cart.lines.reduce((t, l) => t + l.quantity, 0), message: "Item removed from bag." }; } catch (error) { return mutationFailure(error); }
}
