import { z } from "zod";

const requiredText = (max: number) => z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]+$/);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();

export const checkoutIdSchema = z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const checkoutContactSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
}).strict();

export const checkoutShippingAddressSchema = z.object({
  firstName: requiredText(80),
  lastName: requiredText(80),
  addressLine1: requiredText(160),
  addressLine2: optionalText(160),
  postalCode: requiredText(32),
  city: requiredText(100),
  region: optionalText(100),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
}).strict();

export const checkoutContactAddressSchema = z.object({
  contact: checkoutContactSchema,
  shippingAddress: checkoutShippingAddressSchema,
}).strict();

export type CheckoutContact = z.output<typeof checkoutContactSchema>;
export type CheckoutShippingAddress = z.output<typeof checkoutShippingAddressSchema>;
export type CheckoutContactAddress = z.output<typeof checkoutContactAddressSchema>;

export function normalizeCheckoutContactAddress(raw: unknown): CheckoutContactAddress {
  const parsed = checkoutContactAddressSchema.parse(raw);
  const shippingAddress = Object.fromEntries(
    Object.entries(parsed.shippingAddress).filter(([, value]) => value !== undefined),
  ) as CheckoutShippingAddress;
  return { contact: parsed.contact, shippingAddress };
}
