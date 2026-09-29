import "server-only";

import { cache } from "react";
import type { Brand, Collection, Product } from "@/server/catalog/domain";
import type { Audience } from "@/server/catalog/domain";
import { getDevelopmentBrands, getDevelopmentCollections, getDevelopmentProducts } from "@/server/catalog/development-source";
import {
  toCatalogBrandCard,
  toCatalogCollectionCard,
  toCatalogProductCard,
  toCatalogProductDetail,
  type CatalogBrandCard,
  type CatalogCollectionCard,
  type CatalogProductCard,
  type CatalogProductDetail,
} from "@/server/catalog/read-model";
import {
  getBrandRepository,
  getCollectionRepository,
  getProductRepository,
} from "@/server/catalog/repositories";
import {
  hasUnscopedDiscoveryQuery,
  publicDiscoveryQuerySchema,
  publicProductListQuerySchema,
  slugSchema,
  type CatalogDiscoveryScope,
  type PublicDiscoveryQuery,
  type PublicProductListQuery,
} from "@/server/catalog/schemas";

export { hasUnscopedDiscoveryQuery, type CatalogDiscoveryScope };

export type CatalogAvailability = "available" | "unavailable";

export type CatalogBrowseResult = {
  availability: CatalogAvailability;
  products: CatalogProductCard[];
  collections: CatalogCollectionCard[];
};

export type BrandIndexResult = {
  availability: CatalogAvailability;
  brands: CatalogBrandCard[];
};

export type BrandBrowseResult = {
  availability: CatalogAvailability;
  brand: CatalogBrandCard | null;
  products: CatalogProductCard[];
};

export type ProductDetailResult = {
  availability: CatalogAvailability;
  product: CatalogProductDetail | null;
};

export type RelatedProductsResult = {
  availability: CatalogAvailability;
  products: CatalogProductCard[];
};

export type CatalogDiscoveryOptions = {
  brands: CatalogBrandCard[];
  collections: CatalogCollectionCard[];
  families: string[];
};

export type CatalogDiscoveryResult = CatalogBrowseResult & {
  query: PublicDiscoveryQuery;
  options: CatalogDiscoveryOptions;
  scope: CatalogDiscoveryScope;
};



function isDevelopmentCatalogSource(): boolean {
  // A durable cart/reservation flow must resolve its products from the same
  // catalog that inventory uses. Fixtures remain useful when Mongo is absent.
  return process.env.NODE_ENV !== "production" && !canReadMongoCatalog();
}

function canReadMongoCatalog(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Route identity is authoritative: a scoped route replaces only its matching URL filter. */
function applyDiscoveryScope(query: PublicDiscoveryQuery, scope: CatalogDiscoveryScope): PublicDiscoveryQuery {
  return {
    ...query,
    ...(scope.audience ? { audience: scope.audience } : {}),
    ...(scope.brandSlug ? { brand: scope.brandSlug } : {}),
    ...(scope.collectionSlug ? { collection: scope.collectionSlug } : {}),
  };
}

/** Unknown, repeated, and malformed URL values are ignored; only allow-listed scalar fields are parsed. */
export function parsePublicDiscoveryQuery(raw: Record<string, string | string[] | undefined>): PublicDiscoveryQuery {
  const candidate = {
    q: firstValue(raw.q), audience: firstValue(raw.audience), brand: firstValue(raw.brand),
    family: firstValue(raw.family), collection: firstValue(raw.collection), sort: firstValue(raw.sort),
  };
  // Validate one allow-listed field at a time. A malformed URL value must not
  // discard a separate valid filter (for example, `?q=cedar&sort=unknown`).
  let query: PublicDiscoveryQuery = { sort: "name-asc" };
  for (const key of ["q", "audience", "brand", "family", "collection", "sort"] as const) {
    const result = publicDiscoveryQuerySchema.safeParse({ ...query, [key]: candidate[key] });
    if (result.success) query = result.data;
  }
  return query;
}

function matchingProduct(product: Product, brand: Brand | null, query: PublicDiscoveryQuery, collectionId?: string): boolean {
  if (query.audience && product.audience !== query.audience) return false;
  if (query.brand && brand?.slug !== query.brand) return false;
  if (query.family && product.fragranceFamily !== query.family) return false;
  if (query.collection && (!collectionId || !product.collectionIds.includes(collectionId))) return false;
  if (query.q) {
    const haystack = `${product.name} ${product.description} ${product.shortDescription ?? ""} ${brand?.name ?? ""} ${product.fragranceFamily}`.toLocaleLowerCase();
    if (!haystack.includes(query.q.toLocaleLowerCase())) return false;
  }
  return true;
}

function sortProducts(products: Product[], query: PublicDiscoveryQuery): Product[] {
  const lowest = (product: Product) => Math.min(...product.variants.filter((variant) => variant.isActive).map((variant) => variant.priceMinor));
  return [...products].sort((left, right) => {
    if (query.sort === "price-asc") return lowest(left) - lowest(right) || left.slug.localeCompare(right.slug);
    if (query.sort === "price-desc") return lowest(right) - lowest(left) || left.slug.localeCompare(right.slug);
    const direction = query.sort === "name-desc" ? -1 : 1;
    return direction * left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug);
  });
}

async function toProductCards(products: Product[], findBrand: (id: string) => Promise<Brand | null>): Promise<CatalogProductCard[]> {
  return Promise.all(products.map(async (product) => toCatalogProductCard(product, await findBrand(product.brandId))));
}

export const getCatalogBrowseData = cache(async (options: { audience?: Audience; collectionSlug?: string } = {}): Promise<CatalogBrowseResult> => {
  if (isDevelopmentCatalogSource()) {
    const collections = getDevelopmentCollections();
    const collection = options.collectionSlug ? collections.find((candidate) => candidate.slug === options.collectionSlug) ?? null : null;
    if (options.collectionSlug && !collection) return { availability: "available", products: [], collections: [] };
    const products = getDevelopmentProducts().filter((product) => {
      if (options.audience && product.audience !== options.audience) return false;
      return !collection || product.collectionIds.includes(collection.id);
    });
    return {
      availability: "available",
      products: await toProductCards(products, async (id) => getDevelopmentBrands().find((brand) => brand.id === id) ?? null),
      collections: collections.map(toCatalogCollectionCard),
    };
  }

  if (!canReadMongoCatalog()) return { availability: "unavailable", products: [], collections: [] };

  try {
    const collectionRepository = await getCollectionRepository();
    const collection = options.collectionSlug ? await collectionRepository.findPublicBySlug(options.collectionSlug) : null;
    if (options.collectionSlug && !collection) return { availability: "available", products: [], collections: [] };
    const products = await (await getProductRepository()).listPublic({
      limit: 24,
      audience: options.audience,
      collectionId: collection?.id,
    });
    const publicCollections = options.collectionSlug ? [collection].filter((value): value is Collection => value !== null) : [];
    const brandRepository = await getBrandRepository();
    return {
      availability: "available",
      products: await toProductCards(products, (id) => brandRepository.findPublicById(id)),
      collections: publicCollections.map(toCatalogCollectionCard),
    };
  } catch {
    return { availability: "unavailable", products: [], collections: [] };
  }
});

/** Canonical server-side discovery query. Route scopes are injected by callers and cannot be overridden by URL state. */
export const getCatalogDiscoveryData = cache(async (rawQuery: PublicDiscoveryQuery, scope: CatalogDiscoveryScope = {}): Promise<CatalogDiscoveryResult> => {
  const query = applyDiscoveryScope(rawQuery, scope);
  if (isDevelopmentCatalogSource()) {
    const brands = getDevelopmentBrands();
    const collections = getDevelopmentCollections();
    const scopedBrand = scope.brandSlug ? brands.find((brand) => brand.slug === scope.brandSlug) ?? null : undefined;
    const scopedCollection = scope.collectionSlug ? collections.find((collection) => collection.slug === scope.collectionSlug) ?? null : undefined;
    if (scopedBrand === null || scopedCollection === null) return { availability: "available", products: [], collections: [], query, scope, options: { brands: [], collections: [], families: [] } };
    const selectedCollection = query.collection ? collections.find((collection) => collection.slug === query.collection) : undefined;
    const products = sortProducts(getDevelopmentProducts().filter((product) => {
      const brand = brands.find((candidate) => candidate.id === product.brandId) ?? null;
      return (!scope.audience || product.audience === scope.audience) && (!scopedBrand || product.brandId === scopedBrand.id) && (!scopedCollection || product.collectionIds.includes(scopedCollection.id)) && matchingProduct(product, brand, query, selectedCollection?.id);
    }), query);
    return { availability: "available", products: await toProductCards(products, async (id) => brands.find((brand) => brand.id === id) ?? null), collections: collections.map(toCatalogCollectionCard), query, scope, options: { brands: brands.map(toCatalogBrandCard), collections: collections.map(toCatalogCollectionCard), families: [...new Set(getDevelopmentProducts().map((product) => product.fragranceFamily))].sort() } };
  }
  if (!canReadMongoCatalog()) return { availability: "unavailable", products: [], collections: [], query, scope, options: { brands: [], collections: [], families: [] } };
  try {
    const brandRepository = await getBrandRepository(); const collectionRepository = await getCollectionRepository(); const productRepository = await getProductRepository();
    const brands = await brandRepository.listPublic(); const collections = await collectionRepository.listPublic();
    const scopedBrand = scope.brandSlug ? brands.find((brand) => brand.slug === scope.brandSlug) ?? null : undefined;
    const scopedCollection = scope.collectionSlug ? collections.find((collection) => collection.slug === scope.collectionSlug) ?? null : undefined;
    if (scopedBrand === null || scopedCollection === null) return { availability: "available", products: [], collections: [], query, scope, options: { brands: [], collections: [], families: [] } };
    const selectedCollection = query.collection ? collections.find((collection) => collection.slug === query.collection) : undefined;
    const products = sortProducts((await productRepository.listPublic({ limit: 100 })).filter((product) => {
      const brand = brands.find((candidate) => candidate.id === product.brandId) ?? null;
      return (!scope.audience || product.audience === scope.audience) && (!scopedBrand || product.brandId === scopedBrand.id) && (!scopedCollection || product.collectionIds.includes(scopedCollection.id)) && matchingProduct(product, brand, query, selectedCollection?.id);
    }), query);
    return { availability: "available", products: await toProductCards(products, (id) => brandRepository.findPublicById(id)), collections: collections.map(toCatalogCollectionCard), query, scope, options: { brands: brands.map(toCatalogBrandCard), collections: collections.map(toCatalogCollectionCard), families: [...new Set((await productRepository.listPublic({ limit: 100 })).map((product) => product.fragranceFamily))].sort() } };
  } catch { return { availability: "unavailable", products: [], collections: [], query, scope, options: { brands: [], collections: [], families: [] } }; }
});

/** Public Brand browsing shares the same server-only source and fixture isolation as catalog browsing. */
export const getBrandIndexData = cache(async (): Promise<BrandIndexResult> => {
  if (isDevelopmentCatalogSource()) {
    return { availability: "available", brands: getDevelopmentBrands().map(toCatalogBrandCard) };
  }

  if (!canReadMongoCatalog()) return { availability: "unavailable", brands: [] };

  try {
    return { availability: "available", brands: (await (await getBrandRepository()).listPublic()).map(toCatalogBrandCard) };
  } catch {
    return { availability: "unavailable", brands: [] };
  }
});

/** Product cards on Brand pages use the existing public Product read model and visibility rules. */
export const getBrandBrowseData = cache(async (slug: string): Promise<BrandBrowseResult> => {
  if (isDevelopmentCatalogSource()) {
    const brand = getDevelopmentBrands().find((candidate) => candidate.slug === slug) ?? null;
    if (!brand) return { availability: "available", brand: null, products: [] };
    const products = getDevelopmentProducts().filter((product) => product.brandId === brand.id);
    return {
      availability: "available",
      brand: toCatalogBrandCard(brand),
      products: await toProductCards(products, async (id) => getDevelopmentBrands().find((candidate) => candidate.id === id) ?? null),
    };
  }

  if (!canReadMongoCatalog()) return { availability: "unavailable", brand: null, products: [] };

  try {
    const brandRepository = await getBrandRepository();
    const brand = await brandRepository.findPublicBySlug(slug);
    if (!brand) return { availability: "available", brand: null, products: [] };
    const products = await (await getProductRepository()).listPublic({ limit: 24, brandId: brand.id });
    return {
      availability: "available",
      brand: toCatalogBrandCard(brand),
      products: await toProductCards(products, (id) => brandRepository.findPublicById(id)),
    };
  } catch {
    return { availability: "unavailable", brand: null, products: [] };
  }
});

/** PDP reads use the same public visibility source as listing routes and never expose raw records to React. */
export const getProductDetailData = cache(async (rawSlug: string): Promise<ProductDetailResult> => {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return { availability: "available", product: null };

  if (isDevelopmentCatalogSource()) {
    const product = getDevelopmentProducts().find((candidate) => candidate.slug === parsed.data) ?? null;
    if (!product) return { availability: "available", product: null };
    const brand = getDevelopmentBrands().find((candidate) => candidate.id === product.brandId) ?? null;
    if (!brand || !product.variants.some((variant) => variant.isActive)) return { availability: "available", product: null };
    return { availability: "available", product: toCatalogProductDetail(product, brand) };
  }

  if (!canReadMongoCatalog()) return { availability: "unavailable", product: null };
  try {
    const product = await (await getProductRepository()).findPublicBySlug(parsed.data);
    if (!product || !product.variants.some((variant) => variant.isActive)) return { availability: "available", product: null };
    const brand = await (await getBrandRepository()).findPublicById(product.brandId);
    if (!brand) return { availability: "available", product: null };
    return { availability: "available", product: toCatalogProductDetail(product, brand) };
  } catch {
    return { availability: "unavailable", product: null };
  }
});

/** Deterministic, bounded merchandising read. Related selection stays server-side and reuses public catalog eligibility. */
export const getRelatedProductsData = cache(async (rawSlug: string, limit = 4): Promise<RelatedProductsResult> => {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return { availability: "available", products: [] };
  const current = await getPublicProductBySlug(parsed.data);
  if (!current) return { availability: "available", products: [] };

  let candidates: Product[];
  let brands: Brand[];
  try {
    if (isDevelopmentCatalogSource()) {
      candidates = getDevelopmentProducts();
      brands = getDevelopmentBrands();
    } else {
      if (!canReadMongoCatalog()) return { availability: "unavailable", products: [] };
      candidates = await (await getProductRepository()).listPublic({ limit: 100 });
      brands = await (await getBrandRepository()).listPublic();
    }
  } catch {
    return { availability: "unavailable", products: [] };
  }

  const publicBrandIds = new Set(brands.map((brand) => brand.id));
  const scored = candidates
    .filter((candidate) => candidate.slug !== current.slug && candidate.id !== current.id)
    .filter((candidate) => candidate.status === "active" && candidate.variants.some((variant) => variant.isActive) && publicBrandIds.has(candidate.brandId))
    .map((candidate) => {
      const sharedCollections = candidate.collectionIds.filter((id) => current.collectionIds.includes(id)).length;
      const score = (candidate.fragranceFamily === current.fragranceFamily ? 4 : 0)
        + (candidate.audience === current.audience ? 2 : 0)
        + (candidate.brandId === current.brandId ? 1 : 0)
        + Math.min(sharedCollections, 2);
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name) || left.candidate.slug.localeCompare(right.candidate.slug))
    .slice(0, Math.max(0, Math.min(limit, 4)));

  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  return { availability: "available", products: scored.map(({ candidate }) => toCatalogProductCard(candidate, brandById.get(candidate.brandId) ?? null)) };
});

/** Public catalog reads deliberately return active records only. */
export async function getPublicProductBySlug(slug: string): Promise<Product | null> {
  if (isDevelopmentCatalogSource()) return getDevelopmentProducts().find((product) => product.slug === slug) ?? null;
  if (!canReadMongoCatalog()) return null;
  return (await getProductRepository()).findPublicBySlug(slug);
}

/** This is a bounded foundation query, not Stage 3 discovery/filtering. */
export async function listPublicProducts(query: PublicProductListQuery = { limit: 24 }): Promise<Product[]> {
  if (isDevelopmentCatalogSource()) {
    const parsed = publicProductListQuerySchema.parse(query);
    return getDevelopmentProducts()
      .filter((product) => (!parsed.audience || product.audience === parsed.audience) && (!parsed.brandId || product.brandId === parsed.brandId) && (!parsed.collectionId || product.collectionIds.includes(parsed.collectionId)))
      .slice(0, parsed.limit);
  }
  if (!canReadMongoCatalog()) return [];
  return (await getProductRepository()).listPublic(publicProductListQuerySchema.parse(query));
}

export async function getPublicBrandBySlug(slug: string): Promise<Brand | null> {
  if (isDevelopmentCatalogSource()) return getDevelopmentBrands().find((brand) => brand.slug === slug) ?? null;
  if (!canReadMongoCatalog()) return null;
  return (await getBrandRepository()).findPublicBySlug(slug);
}

export async function getPublicCollectionBySlug(slug: string): Promise<Collection | null> {
  if (isDevelopmentCatalogSource()) return getDevelopmentCollections().find((collection) => collection.slug === slug) ?? null;
  if (!canReadMongoCatalog()) return null;
  return (await getCollectionRepository()).findPublicBySlug(slug);
}
