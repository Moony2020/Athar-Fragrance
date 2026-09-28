import { z } from "zod";

import type { CheckoutShippingAddress } from "./contact-address";

export const shippingMethodIdSchema = z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/);

export const swedenShippingPolicy = {
  countryCode: "SE",
  currency: "SEK",
  freeShippingThresholdMinor: 69_900,
  methods: [{
    shippingMethodId: "postnord-service-point-se",
    label: "PostNord",
    active: true,
    customerChargeMinor: 5_900,
  }],
} as const;

export type ShippingMethodPublic = {
  shippingMethodId: string;
  label: string;
  currency: "SEK";
  shippingAmountMinor: number;
  isFree: boolean;
};

export type ShippingAvailability =
  | { status: "needs-address"; methods: [] }
  | { status: "unsupported-country"; methods: [] }
  | { status: "currency-mismatch"; methods: [] }
  | { status: "available"; methods: ShippingMethodPublic[] };

/**
 * Owner-approved launch policy. It is intentionally data-shaped so future
 * country policies can be added without making browser input authoritative.
 */
export function resolveShippingAvailability(input: {
  shippingAddress?: CheckoutShippingAddress;
  eligibleSubtotalMinor: number;
  currency?: string;
}): ShippingAvailability {
  if (!input.shippingAddress) return { status: "needs-address", methods: [] };
  if (input.shippingAddress.countryCode !== swedenShippingPolicy.countryCode) return { status: "unsupported-country", methods: [] };
  if (input.currency !== swedenShippingPolicy.currency) return { status: "currency-mismatch", methods: [] };

  const isFree = input.eligibleSubtotalMinor >= swedenShippingPolicy.freeShippingThresholdMinor;
  return {
    status: "available",
    methods: swedenShippingPolicy.methods.filter((method) => method.active).map((method) => ({
      shippingMethodId: method.shippingMethodId,
      label: method.label,
      currency: swedenShippingPolicy.currency,
      shippingAmountMinor: isFree ? 0 : method.customerChargeMinor,
      isFree,
    })),
  };
}

export function resolveSelectedShippingMethod(input: {
  selectedShippingMethodId?: string;
  shippingAddress?: CheckoutShippingAddress;
  eligibleSubtotalMinor: number;
  currency?: string;
}): ShippingMethodPublic | undefined {
  const availability = resolveShippingAvailability(input);
  return availability.status === "available"
    ? availability.methods.find((method) => method.shippingMethodId === input.selectedShippingMethodId)
    : undefined;
}
