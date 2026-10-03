import { z } from "zod";

export const guestOrderAccessSessionCookieName = "athar_guest_order_access";
export const guestOrderAccessSessionTtlMs = 30 * 60 * 1000;
export const orderLookupWindowMs = 15 * 60 * 1000;

export type GuestOrderAccessSessionDocument = {
  sessionHash: string;
  orderId: string;
  expiresAt: Date;
  createdAt: Date;
};

export const orderLookupRateLimitDimensions = ["pair", "order", "email"] as const;
export type OrderLookupRateLimitDimension = (typeof orderLookupRateLimitDimensions)[number];

export type OrderLookupRateLimitDocument = {
  dimension: OrderLookupRateLimitDimension;
  identifierHmac: string;
  windowStart: Date;
  expiresAt: Date;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export const orderLookupInputSchema = z.object({
  orderId: z.string().trim().toUpperCase().regex(/^ATH-[A-F0-9]{12}$/),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
}).strict();

export const genericOrderAccessMessage = "We couldn't access your order right now. Please check your details and try again later.";
