import "server-only";

import { readGuestCartId } from "@/server/commerce/guest-cookie";
import { getProductDetailData } from "@/server/catalog/services";
import { getGuestCartStore } from "@/server/commerce/store";
import { isMongoGuestCartStore } from "@/server/commerce/mongo-store";
import { userCommerceOwner } from "@/commerce/durable-contracts";
import { readCurrentCommerceOwner } from "@/server/commerce/current-owner";

export type PublicCartLine = {
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

export type PublicCart = {
  availability: "available" | "unavailable";
  lines: PublicCartLine[];
  subtotalMinor: number;
  currency: string | null;
  totalQuantity: number;
};

const generatedMedia: Record<string, string> = {
  "athar-test-no-01": "/images/catalog/athar-test-no-01-v1.webp",
  "cedar-study": "/images/catalog/cedar-study-v1.webp",
  "no-media-study": "/images/catalog/no-media-study-v1.webp",
  "velvet-sillage": "/images/catalog/velvet-sillage-v1.webp",
  "luminous-fig": "/images/catalog/luminous-fig-v1.webp",
};

function staleLine(productSlug: string, variantId: string, quantity: number, availability: "unavailable" | "stale"): PublicCartLine {
  return { productSlug, productName: null, brandName: null, fragranceType: null, variantId, sizeMl: null, media: null, quantity, priceMinor: null, subtotalMinor: null, currency: null, availability };
}

/** Reads only stored identity/quantity, then derives all public Cart values from the current catalog. */
export async function readCurrentGuestCart(): Promise<PublicCart> {
  const guestId = await readGuestCartId();
  const store = getGuestCartStore();
  if (!guestId) return { availability: "available", lines: [], subtotalMinor: 0, currency: null, totalQuantity: 0 };
  if (!store) return { availability: "unavailable", lines: [], subtotalMinor: 0, currency: null, totalQuantity: 0 };
  const state = await store.read(guestId);
  const lines = await Promise.all(state.lines.map(async (line): Promise<PublicCartLine> => {
    const result = await getProductDetailData(line.productSlug);
    if (result.availability === "unavailable") return staleLine(line.productSlug, line.variantId, line.quantity, "stale");
    if (!result.product) return staleLine(line.productSlug, line.variantId, line.quantity, "stale");
    const variant = result.product.variants.find((candidate) => candidate.id === line.variantId);
    if (!variant) return staleLine(line.productSlug, line.variantId, line.quantity, "stale");
    const media = generatedMedia[result.product.slug]
      ? { src: generatedMedia[result.product.slug], alt: result.product.media[0]?.alt ?? result.product.name }
      : null;
    if (variant.availability !== "available") return {
      productSlug: result.product.slug, productName: result.product.name, brandName: result.product.brand.name, fragranceType: result.product.fragranceType,
      variantId: variant.id, sizeMl: variant.sizeMl, media, quantity: line.quantity,
      priceMinor: null, subtotalMinor: null, currency: result.product.currency, availability: "unavailable",
    };
    return {
      productSlug: result.product.slug, productName: result.product.name, brandName: result.product.brand.name, fragranceType: result.product.fragranceType,
      variantId: variant.id, sizeMl: variant.sizeMl, media, quantity: line.quantity,
      priceMinor: variant.priceMinor, subtotalMinor: variant.priceMinor * line.quantity,
      currency: result.product.currency, availability: "available",
    };
  }));
  const validLines = lines.filter((line) => line.availability === "available");
  const currencies = new Set(validLines.map((line) => line.currency).filter((currency): currency is string => Boolean(currency)));
  return {
    availability: "available",
    lines,
    subtotalMinor: validLines.reduce((total, line) => total + (line.subtotalMinor ?? 0), 0),
    currency: currencies.size === 1 ? [...currencies][0] : null,
    totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
  };
}

/** Reads the durable owner selected by the server session; cookies are used only for guests. */
export async function readCurrentCommerceCart(): Promise<PublicCart> {
  const owner = await readCurrentCommerceOwner();
  if (owner.ownerType === "guest") return readCurrentGuestCart();
  const store = getGuestCartStore();
  if (!isMongoGuestCartStore(store)) return { availability: "unavailable", lines: [], subtotalMinor: 0, currency: null, totalQuantity: 0 };
  const state = await store.readOwner(userCommerceOwner(owner.ownerId));
  const lines = await Promise.all(state.lines.map(async (line): Promise<PublicCartLine> => {
    const result = await getProductDetailData(line.productSlug);
    if (result.availability === "unavailable" || !result.product) return staleLine(line.productSlug, line.variantId, line.quantity, "stale");
    const variant = result.product.variants.find((candidate) => candidate.id === line.variantId);
    if (!variant) return staleLine(line.productSlug, line.variantId, line.quantity, "stale");
    const media = generatedMedia[result.product.slug] ? { src: generatedMedia[result.product.slug], alt: result.product.media[0]?.alt ?? result.product.name } : null;
    if (variant.availability !== "available") return { productSlug: result.product.slug, productName: result.product.name, brandName: result.product.brand.name, fragranceType: result.product.fragranceType, variantId: variant.id, sizeMl: variant.sizeMl, media, quantity: line.quantity, priceMinor: null, subtotalMinor: null, currency: result.product.currency, availability: "unavailable" };
    return { productSlug: result.product.slug, productName: result.product.name, brandName: result.product.brand.name, fragranceType: result.product.fragranceType, variantId: variant.id, sizeMl: variant.sizeMl, media, quantity: line.quantity, priceMinor: variant.priceMinor, subtotalMinor: variant.priceMinor * line.quantity, currency: result.product.currency, availability: "available" };
  }));
  const validLines = lines.filter((line) => line.availability === "available");
  const currencies = new Set(validLines.map((line) => line.currency).filter((currency): currency is string => Boolean(currency)));
  return { availability: "available", lines, subtotalMinor: validLines.reduce((total, line) => total + (line.subtotalMinor ?? 0), 0), currency: currencies.size === 1 ? [...currencies][0] : null, totalQuantity: lines.reduce((total, line) => total + line.quantity, 0) };
}

export async function readCurrentGuestCartCount() {
  return (await readCurrentGuestCart()).totalQuantity;
}

export async function readCurrentCommerceCartCount() { return (await readCurrentCommerceCart()).totalQuantity; }
