import { ObjectId } from "mongodb";
import { z } from "zod";

import { commerceOwnerSchema, type CommerceOwner } from "@/commerce/durable-contracts";
import { checkoutContactSchema, checkoutIdSchema, checkoutShippingAddressSchema } from "./contact-address";
import type { CheckoutDraftDocument } from "./draft-document";

const draftDocumentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  checkoutId: checkoutIdSchema,
  ownerType: z.enum(["guest", "user"]),
  ownerId: z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  revision: z.number().int().positive(),
  contact: checkoutContactSchema.optional(),
  shippingAddress: checkoutShippingAddressSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
}).strict();

export function parseCheckoutDraftDocument(raw: CheckoutDraftDocument, owner: CommerceOwner): CheckoutDraftDocument {
  const parsed = draftDocumentSchema.parse(raw);
  commerceOwnerSchema.parse({ ownerType: parsed.ownerType, ownerId: parsed.ownerId });
  if (parsed.ownerType !== owner.ownerType || parsed.ownerId !== owner.ownerId) {
    throw new Error("Checkout draft owner mismatch.");
  }
  if (parsed.contact && parsed.contact.email !== raw.contact?.email) {
    throw new Error("Checkout contact email is not normalized.");
  }
  return parsed;
}
