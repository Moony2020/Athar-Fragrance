import type { Brand, Collection, FragranceNotes, Product, ProductMedia } from "@/server/catalog/domain";
import { createHash } from "node:crypto";
import { formatMoneyMinor } from "@/lib/money";

export type CatalogProductCard = {
  slug: string;
  brandName: string;
  name: string;
  fragranceType: string | null;
  shortDescription: string;
  fragranceFamily: string;
  scentNotes: string[];
  priceLabel: string;
  variantLabel: string;
  badge: "New" | "Bestseller" | null;
  variants: Array<{ id: string; sizeMl: number; priceLabel: string; availability: "available" | "unavailable" }>;
  mediaAlt: string | null;
  isAvailable: boolean;
};

export type CatalogCollectionCard = {
  slug: string;
  name: string;
  description: string | null;
};

/** Deliberately narrow public Brand presentation model. */
export type CatalogBrandCard = {
  slug: string;
  name: string;
  description: string | null;
  mediaAlt: string | null;
};

export type CatalogProductDetailVariant = {
  id: string;
  sizeMl: number;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  availability: "available" | "unavailable";
};

/** Rich public PDP model; it intentionally remains separate from the compact catalog-card contract. */
export type CatalogProductDetail = {
  slug: string;
  name: string;
  fragranceType: string | null;
  currency: string;
  brand: Pick<CatalogBrandCard, "slug" | "name">;
  shortDescription: string | null;
  description: string;
  audience: Product["audience"];
  fragranceFamily: string;
  notes: FragranceNotes;
  media: Pick<ProductMedia, "url" | "alt" | "width" | "height" | "position">[];
  variants: CatalogProductDetailVariant[];
  priceLabel: string;
  isAvailable: boolean;
};

function toPublicProductMedia(product: Product): CatalogProductDetail["media"] {
  return product.media
    .filter((media) => {
      try {
        const url = new URL(media.url);
        return media.type === "image" && (url.protocol === "https:" || url.protocol === "http:");
      } catch {
        return false;
      }
    })
    .slice()
    .sort((left, right) => left.position - right.position || left.url.localeCompare(right.url) || left.alt.localeCompare(right.alt))
    .map(({ url, alt, width, height, position }) => ({
      url,
      alt: alt.trim() || `${product.name}`,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      position,
    }));
}

function publicVariantId(product: Product, variantId: string) {
  return createHash("sha256").update(`${product.slug}:${variantId}`).digest("base64url").slice(0, 18);
}

export function toCatalogProductCard(product: Product, brand: Brand | null): CatalogProductCard {
  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const lowestPrice = activeVariants.reduce<number | null>(
    (lowest, variant) => (lowest === null || variant.priceMinor < lowest ? variant.priceMinor : lowest),
    null,
  );
  const variantLabel = activeVariants.length === 1
    ? `${activeVariants[0].sizeMl} ml`
    : activeVariants.length > 1
      ? `${Math.min(...activeVariants.map((variant) => variant.sizeMl))}–${Math.max(...activeVariants.map((variant) => variant.sizeMl))} ml`
      : "Unavailable";
  const price = lowestPrice === null ? "Unavailable" : formatMoneyMinor(lowestPrice, product.currency);
  const variants = activeVariants
    .slice()
    .sort((left, right) => left.sizeMl - right.sizeMl)
    .map((variant) => ({
      id: publicVariantId(product, variant.id),
      sizeMl: variant.sizeMl,
      priceLabel: formatMoneyMinor(variant.priceMinor, product.currency),
      availability: variant.inventoryQuantity > 0 ? "available" as const : "unavailable" as const,
    }));

  return {
    slug: product.slug,
    brandName: brand?.name ?? "ATHAR",
    name: product.name,
    fragranceType: product.fragranceType ?? null,
    shortDescription: product.shortDescription?.trim() || product.description,
    fragranceFamily: product.fragranceFamily,
    scentNotes: [...product.notes.top, ...product.notes.heart, ...product.notes.base].slice(0, 3),
    priceLabel: activeVariants.length > 1 && lowestPrice !== null ? `From ${price}` : price,
    variantLabel,
    badge: product.bestseller ? "Bestseller" : product.featured ? "New" : null,
    variants,
    mediaAlt: product.media.at(0)?.alt ?? null,
    isAvailable: activeVariants.length > 0,
  };
}

export function toCatalogProductDetail(product: Product, brand: Brand): CatalogProductDetail {
  const variants = product.variants
    .filter((variant) => variant.isActive)
    .sort((left, right) => left.sizeMl - right.sizeMl)
    .map((variant) => ({
      id: publicVariantId(product, variant.id),
      sizeMl: variant.sizeMl,
      priceMinor: variant.priceMinor,
      compareAtPriceMinor: variant.compareAtPriceMinor ?? null,
      availability: variant.inventoryQuantity > 0 ? "available" as const : "unavailable" as const,
    }));
  const lowestPrice = Math.min(...variants.map((variant) => variant.priceMinor));
  return {
    slug: product.slug,
    name: product.name,
    fragranceType: product.fragranceType ?? null,
    currency: product.currency,
    brand: { slug: brand.slug, name: brand.name },
    shortDescription: product.shortDescription ?? null,
    description: product.description,
    audience: product.audience,
    fragranceFamily: product.fragranceFamily,
    notes: product.notes,
    media: toPublicProductMedia(product),
    variants,
    priceLabel: variants.length > 1 ? `From ${formatMoneyMinor(lowestPrice, product.currency)}` : formatMoneyMinor(variants[0].priceMinor, product.currency),
    isAvailable: variants.some((variant) => variant.availability === "available"),
  };
}

export function toCatalogCollectionCard(collection: Collection): CatalogCollectionCard {
  return { slug: collection.slug, name: collection.name, description: collection.description ?? null };
}

export function toCatalogBrandCard(brand: Brand): CatalogBrandCard {
  return {
    slug: brand.slug,
    name: brand.name,
    description: brand.description ?? null,
    mediaAlt: brand.logo?.alt ?? null,
  };
}
