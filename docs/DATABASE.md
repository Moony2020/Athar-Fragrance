# Database

## Stage 3.1 status

**Stage 3.1 historical status:** Atlas credentials were not configured during the original Stage 3.1 verification. Stage 6.5 later verified password-reset persistence and transactions against the dedicated non-production `athar_stage55_test` database. Live production Atlas persistence remains **NOT VERIFIED**; no credentials are committed.

## Connection contract

- `MONGODB_URI` must use `mongodb://` or `mongodb+srv://` and is read only by `src/server/env.ts`.
- `MONGODB_DB_NAME` selects the database and accepts only letters, numbers, `_`, and `-`.
- `getDatabase()` reuses one `MongoClient` connection per server process. Development keeps the cache on `globalThis` so Fast Refresh does not create a connection per reload.
- Environment validation runs when a database operation is requested, not while the static homepage is built. Missing configuration produces a clear server-only error without leaking a URI.

## Canonical catalog records

`Product` has a MongoDB `_id` and separate unique public `slug`; it references a `Brand` by `brandId` and Collections by `collectionIds`. Product visibility is governed by explicit `draft`, `active`, or `archived` status. Public repository methods always filter on `active`.

Products use `women`, `men`, or `unisex` audience values. Fragrance family is a normalized taxonomy key such as `floral` or `amber-woody`, rather than a premature managed taxonomy collection. Notes are structured as `top`, `heart`, and `base` string arrays with per-level duplicate protection.

Each Product contains variants. A variant has a persistence-generated stable id, uppercase SKU, positive `sizeMl`, integer `priceMinor`, optional `compareAtPriceMinor`, non-negative `inventoryQuantity`, and `isActive`. SKU values must be unique within a Product; a comparison price, when present, must exceed the selling price. Availability can later be derived from active variants with inventory, without adding reservation or checkout logic in this stage.

All money uses integer minor units. For example, `1299 SEK` is stored as `129900` in `priceMinor`. A Product has an explicit ISO 4217 `currency` (default `SEK`) shared by its variants.

`Brand` and `Collection` each have separate IDs, unique URL-safe slugs, explicit lifecycle status, timestamps, and optional media metadata. Collections additionally have a non-negative `sortOrder`. Neither prototype brands nor homepage collection labels were seeded.

## Media and indexes

Media stores provider references only: URL, optional provider public ID, alt text, optional dimensions, position, and `image` type. Image binaries are not stored in MongoDB.

`ensureCatalogIndexes()` is a controlled, idempotent deployment/migration operation, not a homepage side effect. It defines unique slugs for products, brands, and collections plus Product indexes for public listings, brand, collection membership, audience, and fragrance family.

The current layer has no seed script and performs no writes without an explicit repository create call. Test data uses fictional ATHAR records only.

## Stage 5.5 commerce persistence (complete locally)

The durable commerce adapter uses the existing official MongoDB Node driver and connection reuse. It adds two small collections, `carts` and `wishlists`, without embedding commerce state in Product documents.

Cart records contain `ownerType`, opaque `ownerId`, canonical `lines` (`productSlug`, `publicVariantId`, `quantity`), `revision`, `createdAt`, `updatedAt`, and `expiresAt`. Wishlist records contain the same owner/timestamp/revision fields plus Product `productSlugs`. Current Product/Variant price, availability, inventory, copy, media, subtotal, and Mongo `_id` are deliberately not persisted as public truth.

`ensureCommerceIndexes()` is an explicit deployment operation. It creates unique `(ownerType, ownerId)` indexes and TTL indexes on `expiresAt` for both collections. The inactivity expiry policy is 30 days and is refreshed on mutation. Reads validate stored records with the existing Zod contracts; malformed records fail safely rather than crossing the public boundary.

`ATHAR_COMMERCE_PERSISTENCE=mongo` selects the durable adapter. Development/test otherwise retain the deterministic ephemeral store; production returns an unavailable result when durable selection/configuration is absent and never uses memory fallback. The adapter was verified against the dedicated non-production `athar_stage55_test` database for CRUD, isolation, CAS concurrency, TTL expiry/replacement, and restart persistence. No production database was used.

## Development catalog bootstrap

Stage 3.2 adds a controlled development-only seed pipeline under `src/server/catalog/seed/`. `developmentCatalogSeed` contains fictional ATHAR-only records, never the homepage prototype brands, products, imagery, or prices. Its human-readable references use fixture keys such as `athar-atelier` and `test-unisex`; execution resolves them to the canonical MongoDB IDs created or found for that run.

The pipeline validates the full fixture dataset before any persistence begins. It uses the same Zod brand, collection, product, variant, money, media, note, audience, family, slug, and SKU rules as normal catalog writes. It rejects duplicate fixture keys/slugs, duplicate SKUs across the dataset, and unknown brand/collection references before a write phase begins.

Each seed-owned record persists operational metadata (`seed.key`, a deterministic fixture fingerprint, and version) that is omitted from public domain objects. A rerun with the same fingerprint is unchanged; a changed owned fixture is updated through explicit owned fields; a matching slug owned by another seed or by a non-seed record fails as a conflict. The seed never deletes records and does not perform full-document replacement, preserving future fields outside its ownership.

`npm run catalog:seed:dry` validates and plans in memory, makes no database connection or write, and prints a DRY RUN summary. `npm run catalog:seed` is a write command only when `NODE_ENV` is not `production`, `CATALOG_SEED_ALLOW_WRITE=1`, and valid MongoDB configuration is supplied. Production writes are always rejected. No database write has occurred in this stage.

## Public browsing boundary

Stage 3.3 reads only active public records and maps them to a narrow catalog-card model before rendering. Browser-facing cards do not receive MongoDB IDs, lifecycle values, seed metadata, inventory quantities, or raw variant collections. The displayed price is derived from active variant integer minor units; products with multiple active sizes use the lowest price prefixed by `From`.

In development/test, the service may use the validated fictional Stage 3.2 fixture source without Atlas. In production it never substitutes fixtures: missing configuration or a failed read produces a deliberate unavailable result. No live Atlas read or write has been verified.

## Product Detail public boundary

Stage 4.1 maps Product and its active public Brand to a separate `CatalogProductDetail` read model before rendering `/products/[slug]`. This richer model is still deliberately narrow: it includes public identity/copy, family, structured notes, ordered public media fields, and active variant size/price/safe availability. It omits Mongo IDs, seed/lifecycle metadata, timestamps, raw inventory quantities, and persistence objects. The PDP's displayed default price follows the same lowest-active-variant integer-minor-unit rule as catalog cards. Missing/private products are not-found when the source is available; unavailable infrastructure is a distinct safe state. Production never serves development fixtures.

## Brand browsing

Stage 3.4 adds active Brand discovery and products-by-active-Brand queries through the existing repositories. `BrandRepository.listPublic()` selects active Brands; product listing accepts an internal `brandId` filter and retains the same active Product visibility. The server maps a Brand to only public route/card fields before rendering. A valid active Brand with no eligible Products remains public and receives an empty state, while private/missing Brands are not-found when a catalog source is available.

Brand records classify catalog membership only. They do not establish authorization, retail, distribution, partnership, or trademark claims. No real commercial Brand, official logo, or media was written, read, or imported.

## Discovery reads

Stage 3.5 uses one server-side allow-listed discovery query. It filters only active public records and applies bounded literal search over public Product/Brand fields before mapping to the existing public product card DTO. URL values never become Mongo operators or regular expressions. The current bounded public listing makes price-range UI and pagination unnecessary; future scale can evaluate indexed repository filters or Atlas Search only after live requirements are verified.

## Stage 6.4 commerce reconciliation

Dedicated `athar_stage55_test` verification proved durable user-owned Cart and
Wishlist merge, canonical re-resolution, quantity cap 12, retry/concurrency
idempotency, and guest-state zeroing after success. No live production Atlas
database was used.

## Stage 6.5 password recovery

`password_reset_tokens` contains `userId` (public opaque ID), unique SHA-256
`tokenHash`, `createdAt`, and `expiresAt`; it never stores a raw reset token or
reset URL. `ensurePasswordResetIndexes()` explicitly creates unique indexes on
`userId` and `tokenHash` plus a TTL index on `expiresAt`. A Mongo transaction
consumes a non-expired token and updates the matching enabled
`user_credentials` record's Argon2id hash and private `securityVersion`; sibling
reset tokens are removed atomically. Live verification against
`athar_stage55_test` passed all 8 focused Stage 6.5 tests, including index,
token persistence, concurrent one-time consumption, credential update,
security-version increment, and fixture cleanup. Browser E2E verified protected
test-mail capture, password replacement, prior-session invalidation, and token
replay rejection. Post-run cleanup found no disposable users, credentials, or
reset-token documents. Live production Atlas persistence is not verified.

## Stage 6.6 integration verification status

The final live regression pass used only the dedicated non-production
`athar_stage55_test` database. User/credential, commerce merge, and password
reset transaction cases passed. Browser integration exercised authenticated
user-owned Cart/Wishlist mutations and preservation through password reset.
Disposable fixtures were audited and cleaned; a final direct audit found zero
matching users, credentials, reset tokens, user commerce records, merge
markers, or targeted guest fixtures. Live production Atlas persistence remains
**NOT VERIFIED**.

## Stage 7.1 checkout boundary

Stage 7.1 adds no Mongo collection, index, checkout draft, payment attempt, or
order record. `/checkout` reads the existing owner-bound Cart through the
server-only commerce read path, then uses canonical catalog values for a
transient, read-only projection. The persisted Cart remains identity and
quantity only; no checkout-specific durable data is written. Any later Mongo
integration tests must use only `athar_stage55_test` and remove disposable
fixtures.

## Stage 7.3 shipping selection

`checkout_drafts.selectedShippingMethodId` is an optional public method ID
scoped by the existing server-derived owner and revision. It contains no price,
carrier quote, threshold result, tax, payment, or order authority. Saving an
address outside `SE` clears it; current shipping price is derived from current
Cart subtotal and the owner-approved policy at read/action time.

## Stage 7.2 checkout drafts

`checkout_drafts` stores only an opaque checkout ID, server-derived guest/user
owner, revision, normalized checkout contact email, shipping address fields,
timestamps, and expiry. It stores no price, subtotal, tax, delivery/rate,
discount, inventory, payment, or Order authority. The owner/id pair is unique;
an explicit TTL index expires drafts after 30 days. Index creation is a
controlled setup operation, never an implicit page-read side effect. Runtime
persistence is Mongo-only with no in-memory fallback. Integration tests may
write only to `athar_stage55_test`, use disposable fixtures, and assert cleanup.
