import { MAX_CART_LINE_QUANTITY } from "../commerce/contracts";

export type CheckoutCartLineSnapshot = {
  productSlug: string;
  productName: string | null;
  brandName: string | null;
  fragranceType: string | null;
  variantId: string;
  sizeMl: number | null;
  media: { src: string; alt: string } | null;
  quantity: number;
  priceMinor: number | null;
  subtotalMinor: number | null;
  currency: string | null;
  availability: "available" | "unavailable" | "stale";
};

export type CheckoutCartSnapshot = {
  availability: "available" | "unavailable";
  lines: CheckoutCartLineSnapshot[];
};

export type CheckoutBlockReason =
  | "CART_UNAVAILABLE"
  | "EMPTY_CART"
  | "REVIEW_CART_ITEMS"
  | "MIXED_CURRENCIES"
  | "INVALID_CART_DATA";

export type CheckoutLine =
  | (Pick<CheckoutCartLineSnapshot, "productSlug" | "productName" | "brandName" | "fragranceType" | "variantId" | "sizeMl" | "media" | "quantity"> & {
      status: "eligible";
      priceMinor: number;
      subtotalMinor: number;
      currency: string;
    })
  | (Pick<CheckoutCartLineSnapshot, "productSlug" | "productName" | "brandName" | "fragranceType" | "variantId" | "sizeMl" | "media" | "quantity"> & {
      status: "needs-attention";
      reason: "STALE_PRODUCT" | "UNAVAILABLE_VARIANT" | "INVALID_LINE";
    });

export type CheckoutReadModel = {
  status: "ready" | "blocked";
  lines: CheckoutLine[];
  eligibleSubtotalMinor: number;
  currency: string | null;
  blockReasons: CheckoutBlockReason[];
};

const isoCurrency = /^[A-Z]{3}$/;

/**
 * Builds a read-only checkout projection from the server's canonical Cart read.
 * It deliberately projects an allow-list and never carries owner or database data.
 */
export function buildCheckoutReadModel(cart: CheckoutCartSnapshot): CheckoutReadModel {
  const reasons = new Set<CheckoutBlockReason>();
  if (cart.availability === "unavailable") reasons.add("CART_UNAVAILABLE");
  if (cart.lines.length === 0) reasons.add("EMPTY_CART");

  const lines: CheckoutLine[] = cart.lines.map((line) => {
    const identity = {
      productSlug: line.productSlug,
      productName: line.productName,
      brandName: line.brandName,
      fragranceType: line.fragranceType,
      variantId: line.variantId,
      sizeMl: line.sizeMl,
      media: line.media,
      quantity: line.quantity,
    };

    if (line.availability !== "available") {
      reasons.add("REVIEW_CART_ITEMS");
      return {
        ...identity,
        status: "needs-attention",
        reason: line.availability === "stale" ? "STALE_PRODUCT" : "UNAVAILABLE_VARIANT",
      };
    }

    const validQuantity = Number.isInteger(line.quantity)
      && line.quantity >= 1
      && line.quantity <= MAX_CART_LINE_QUANTITY;
    const validPrice = Number.isSafeInteger(line.priceMinor) && (line.priceMinor ?? -1) >= 0;
    const validCurrency = typeof line.currency === "string" && isoCurrency.test(line.currency);

    if (!validQuantity || !validPrice || !validCurrency) {
      reasons.add("INVALID_CART_DATA");
      reasons.add("REVIEW_CART_ITEMS");
      return { ...identity, status: "needs-attention", reason: "INVALID_LINE" };
    }

    const subtotalMinor = line.priceMinor! * line.quantity;
    if (!Number.isSafeInteger(subtotalMinor)) {
      reasons.add("INVALID_CART_DATA");
      reasons.add("REVIEW_CART_ITEMS");
      return { ...identity, status: "needs-attention", reason: "INVALID_LINE" };
    }

    return {
      ...identity,
      status: "eligible",
      priceMinor: line.priceMinor!,
      subtotalMinor,
      currency: line.currency!,
    };
  });

  const eligibleLines = lines.filter((line) => line.status === "eligible");
  const currencies = new Set(eligibleLines.map((line) => line.currency));
  if (currencies.size > 1) reasons.add("MIXED_CURRENCIES");

  const eligibleSubtotalMinor = eligibleLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
  if (!Number.isSafeInteger(eligibleSubtotalMinor)) reasons.add("INVALID_CART_DATA");

  return {
    status: reasons.size === 0 ? "ready" : "blocked",
    lines,
    eligibleSubtotalMinor: Number.isSafeInteger(eligibleSubtotalMinor) ? eligibleSubtotalMinor : 0,
    currency: currencies.size === 1 ? [...currencies][0]! : null,
    blockReasons: [...reasons],
  };
}
