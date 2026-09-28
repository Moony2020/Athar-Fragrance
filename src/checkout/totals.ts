import type { CheckoutDraftPublic } from "./draft-document";
import type { CheckoutReadModel } from "./domain";
import { resolveSelectedShippingMethod } from "./shipping";

/**
 * Current owner-approved Swedish checkout tax policy. Prices and shipping are
 * customer-facing gross amounts; VAT is extracted for display and downstream
 * accounting hand-off, never added to the shopper's total.
 */
export const swedenCheckoutVatPolicy = {
  countryCode: "SE",
  currency: "SEK",
  ratePercent: 25,
  pricesIncludeVat: true,
} as const;

export type AppliedDiscountPublic = never;

export type CheckoutTotals = {
  status: "ready";
  currency: "SEK";
  merchandiseSubtotal: number;
  discountTotal: 0;
  appliedDiscounts: AppliedDiscountPublic[];
  shippingTotal: number;
  vatTotal: number;
  grandTotal: number;
  vatRatePercent: 25;
  vatIncluded: true;
};

export type CheckoutTotalsBlocked = {
  status: "blocked";
  reason: "CHECKOUT_NOT_READY" | "SHIPPING_SELECTION_REQUIRED" | "SHIPPING_SELECTION_INVALID" | "CURRENCY_MISMATCH";
};

export type CheckoutTotalsReadModel = CheckoutTotals | CheckoutTotalsBlocked;

function assertMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Expected a non-negative integer minor-unit amount.");
}

function addMinorUnits(...values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Checkout total exceeds safe integer range.");
  return total;
}

/**
 * Extracts included VAT using integer arithmetic and half-up rounding. For the
 * current 25% rate this is one fifth of the gross amount, but keeping the
 * fraction explicit preserves the policy boundary for future rates.
 */
export function extractIncludedVatMinor(grossAmountMinor: number, ratePercent = swedenCheckoutVatPolicy.ratePercent): number {
  assertMinorUnits(grossAmountMinor);
  if (!Number.isSafeInteger(ratePercent) || ratePercent < 0 || ratePercent > 100) throw new Error("Invalid VAT rate.");

  const numerator = BigInt(grossAmountMinor) * BigInt(ratePercent);
  const denominator = BigInt(100 + ratePercent);
  const rounded = (numerator + (denominator / 2n)) / denominator;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("VAT amount exceeds safe integer range.");
  return result;
}

/**
 * Builds final checkout totals from the current server-read Cart and current
 * owner-bound draft. Browser totals, VAT, discounts, and shipping amounts are
 * intentionally not inputs to this contract.
 */
export function resolveCheckoutTotals(input: {
  checkout: CheckoutReadModel;
  draft?: Pick<CheckoutDraftPublic, "shippingAddress" | "selectedShippingMethodId">;
}): CheckoutTotalsReadModel {
  if (input.checkout.status !== "ready") return { status: "blocked", reason: "CHECKOUT_NOT_READY" };
  if (input.checkout.currency !== swedenCheckoutVatPolicy.currency) return { status: "blocked", reason: "CURRENCY_MISMATCH" };
  if (!input.draft?.shippingAddress || !input.draft.selectedShippingMethodId) {
    return { status: "blocked", reason: "SHIPPING_SELECTION_REQUIRED" };
  }

  const selectedShipping = resolveSelectedShippingMethod({
    selectedShippingMethodId: input.draft.selectedShippingMethodId,
    shippingAddress: input.draft.shippingAddress,
    eligibleSubtotalMinor: input.checkout.eligibleSubtotalMinor,
    currency: input.checkout.currency,
  });
  if (!selectedShipping) return { status: "blocked", reason: "SHIPPING_SELECTION_INVALID" };

  assertMinorUnits(input.checkout.eligibleSubtotalMinor);
  assertMinorUnits(selectedShipping.shippingAmountMinor);
  const merchandiseSubtotal = input.checkout.eligibleSubtotalMinor;
  // No production discount policy is owner-approved in Stage 7.4.
  const discountTotal = 0 as const;
  const shippingTotal = selectedShipping.shippingAmountMinor;
  const grandTotal = addMinorUnits(merchandiseSubtotal, -discountTotal, shippingTotal);

  return {
    status: "ready",
    currency: "SEK",
    merchandiseSubtotal,
    discountTotal,
    appliedDiscounts: [],
    shippingTotal,
    vatTotal: extractIncludedVatMinor(grandTotal),
    grandTotal,
    vatRatePercent: swedenCheckoutVatPolicy.ratePercent,
    vatIncluded: true,
  };
}
