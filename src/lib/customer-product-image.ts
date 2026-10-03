import type { CatalogProductDetail } from "@/server/catalog/read-model";

export type CustomerProductImageSnapshot = {
  src: string;
  alt: string;
};

/**
 * Customer-facing catalog imagery is served from the reviewed local ATHAR
 * assets. Canonical catalog media supplies the accessible descriptive text;
 * provider-hosted media remains data-only until its domain is approved for
 * customer rendering.
 */
const customerImageSourceByProductSlug: Record<string, string> = {
  "athar-test-no-01": "/images/catalog/athar-test-no-01-v1.webp",
  "cedar-study": "/images/catalog/cedar-study-v1.webp",
  "no-media-study": "/images/catalog/no-media-study-v1.webp",
  "velvet-sillage": "/images/catalog/velvet-sillage-v1.webp",
  "luminous-fig": "/images/catalog/luminous-fig-v1.webp",
};

type ImageBearingCatalogProduct = Pick<CatalogProductDetail, "slug" | "name" | "media">;

export function getCustomerProductImageSource(productSlug: string): string | undefined {
  return customerImageSourceByProductSlug[productSlug];
}

/**
 * Creates the only order-image snapshot allowed at trusted finalization.
 * A product without canonical media deliberately receives no snapshot.
 */
export function getCustomerProductImageSnapshot(product: ImageBearingCatalogProduct): CustomerProductImageSnapshot | undefined {
  const canonicalMedia = product.media[0];
  const src = getCustomerProductImageSource(product.slug);
  if (!canonicalMedia || !src) return undefined;
  return { src, alt: canonicalMedia.alt.trim() || product.name };
}
