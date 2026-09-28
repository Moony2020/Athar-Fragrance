import { z } from "zod";

import { audiences, catalogStatuses } from "@/server/catalog/domain";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Expected a MongoDB ObjectId hex string.");
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase URL-safe words separated by single hyphens.");
const noteSchema = z.string().trim().min(1).max(80);
const normalizedFamilySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(/^[a-z]+(?:-[a-z]+)*$/, "Use a normalized fragrance-family key such as floral or amber-woody.");

export const catalogStatusSchema = z.enum(catalogStatuses);
export const audienceSchema = z.enum(audiences);
export const currencyCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code.");
export { objectIdSchema, slugSchema };

export const mediaSchema = z
  .object({
    url: z.string().trim().url(),
    publicId: z.string().trim().min(1).max(255).optional(),
    alt: z.string().trim().min(1).max(240),
    width: z.number().int().positive().max(20_000).optional(),
    height: z.number().int().positive().max(20_000).optional(),
    position: z.number().int().nonnegative().max(10_000),
    type: z.literal("image"),
  })
  .strict();

export const fragranceNotesSchema = z
  .object({
    top: z.array(noteSchema).max(12),
    heart: z.array(noteSchema).max(12),
    base: z.array(noteSchema).max(12),
  })
  .strict()
  .superRefine((notes, context) => {
    for (const [level, values] of Object.entries(notes)) {
      const normalized = values.map((value) => value.toLocaleLowerCase());
      if (new Set(normalized).size !== normalized.length) {
        context.addIssue({ code: "custom", path: [level], message: "Notes must not be duplicated within the same level." });
      }
    }
  });

export const productVariantInputSchema = z
  .object({
    sku: z.string().trim().toUpperCase().min(3).max(64).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Use an uppercase SKU without spaces."),
    sizeMl: z.number().int().positive().max(10_000),
    priceMinor: z.number().int().nonnegative(),
    compareAtPriceMinor: z.number().int().nonnegative().optional(),
    inventoryQuantity: z.number().int().nonnegative(),
    isActive: z.boolean(),
  })
  .strict()
  .superRefine((variant, context) => {
    if (variant.compareAtPriceMinor !== undefined && variant.compareAtPriceMinor <= variant.priceMinor) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPriceMinor"],
        message: "compareAtPriceMinor must be greater than priceMinor when provided.",
      });
    }
  });

const productInputShape = {
  slug: slugSchema,
  name: z.string().trim().min(1).max(160),
  brandId: objectIdSchema,
  shortDescription: z.string().trim().min(1).max(320).optional(),
  fragranceType: z.enum(["Eau de Parfum", "Eau de Toilette", "Parfum", "Eau de Cologne"]).optional(),
  description: z.string().trim().min(1).max(10_000),
  audience: audienceSchema,
  fragranceFamily: normalizedFamilySchema,
  notes: fragranceNotesSchema,
  media: z.array(mediaSchema).max(24),
  variants: z.array(productVariantInputSchema).min(1).max(48),
  status: catalogStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  bestseller: z.boolean().default(false),
  launchAt: z.coerce.date().optional(),
  collectionIds: z.array(objectIdSchema).max(32).default([]),
  currency: currencyCodeSchema.default("SEK"),
};

export const productCreateInputSchema = z
  .object(productInputShape)
  .strict()
  .superRefine((product, context) => {
    const skus = product.variants.map((variant) => variant.sku);
    if (new Set(skus).size !== skus.length) {
      context.addIssue({ code: "custom", path: ["variants"], message: "Variant SKUs must be unique within a product." });
    }

    if (new Set(product.collectionIds).size !== product.collectionIds.length) {
      context.addIssue({ code: "custom", path: ["collectionIds"], message: "Collection IDs must be unique." });
    }
  });

/** Update callers must merge this patch with the stored record before re-validating full product invariants. */
export const productUpdateInputSchema = z.object(productInputShape).partial().strict();

export const brandCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    description: z.string().trim().min(1).max(5_000).optional(),
    logo: mediaSchema.optional(),
    status: catalogStatusSchema.default("draft"),
  })
  .strict();

export const collectionCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    description: z.string().trim().min(1).max(5_000).optional(),
    media: mediaSchema.optional(),
    status: catalogStatusSchema.default("draft"),
    sortOrder: z.number().int().nonnegative().default(0),
  })
  .strict();

export const publicProductListQuerySchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(24),
    audience: audienceSchema.optional(),
    brandId: objectIdSchema.optional(),
    collectionId: objectIdSchema.optional(),
  })
  .strict();

export type ProductCreateInput = z.output<typeof productCreateInputSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateInputSchema>;
export type BrandCreateInput = z.output<typeof brandCreateInputSchema>;
export type CollectionCreateInput = z.output<typeof collectionCreateInputSchema>;
export type PublicProductListQuery = z.output<typeof publicProductListQuerySchema>;

export const discoverySortValues = ["name-asc", "name-desc", "price-asc", "price-desc"] as const;
export const discoverySortSchema = z.enum(discoverySortValues);
export type DiscoverySort = z.output<typeof discoverySortSchema>;

const discoveryTextSchema = z.string().trim().max(80).transform((value) => value.replace(/\s+/g, " ")).optional();
export const publicDiscoveryQuerySchema = z.object({
  q: discoveryTextSchema,
  audience: audienceSchema.optional(),
  brand: slugSchema.optional(),
  family: normalizedFamilySchema.optional(),
  collection: slugSchema.optional(),
  sort: discoverySortSchema.default("name-asc"),
}).strict();
export type PublicDiscoveryQuery = z.output<typeof publicDiscoveryQuerySchema>;

export type CatalogDiscoveryScope = { audience?: z.infer<typeof audienceSchema>; brandSlug?: string; collectionSlug?: string };

export function hasUnscopedDiscoveryQuery(query: PublicDiscoveryQuery, scope: CatalogDiscoveryScope = {}): boolean {
  return Boolean(
    query.q || query.family || query.sort !== "name-asc" ||
    (!scope.audience && query.audience) ||
    (!scope.brandSlug && query.brand) ||
    (!scope.collectionSlug && query.collection),
  );
}
