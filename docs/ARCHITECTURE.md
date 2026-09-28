# Architecture

## Current state

ATHAR is a Next.js App Router application with React, TypeScript, Cache Components, and Partial Prefetching. The homepage remains a static, componentized presentation route. Its original HTML/CSS/vanilla-JavaScript prototype remains in the repository as reference material.

## Application and catalog architecture

- Next.js App Router with React and TypeScript; Server Components are the default boundary for future catalog reads.
- MongoDB Atlas is the approved canonical catalog database. Stage 3.1 uses the official MongoDB Node.js driver rather than an ODM because no prior persistence pattern existed and the current scope needs a small, explicit data-access layer.
- `src/server/env.ts` owns server-only database environment validation.
- `src/server/db/` owns the reusable MongoDB client, named collections, and idempotent index initialization.
- `src/server/catalog/` owns domain types, Zod boundary schemas, database-document mapping, repositories, public-read services, a development/test fixture source, and public browse-card mapping.
- `src/server/catalog/seed/` separates fictional fixture authoring, all-fixture validation, deterministic planning/conflict detection, dry-run reporting, and guarded server-only execution. `scripts/catalog-seed.ts` is an operational entry point, not a public API.
- Persistence modules import `server-only`; client components must never import them.

Phase 3 closes over one public discovery flow: **route → validated scope + validated GET discovery query → server-only service → repository or development fixture source → narrow public DTO → ProductCard/BrandCard → shared grid**. Stage 4.1 adds the analogous PDP flow: **`/products/[slug]` → validated slug → server-only detail service → public Product + Brand repository reads → `CatalogProductDetail` → server-rendered ProductDetails**. Scoped audience, collection, and Brand routes replace conflicting matching query values and retain their own clean canonical URLs. Production returns an explicit unavailable state rather than fixtures when configuration/reads are unavailable. There is no route handler, client API, Cart, Wishlist, checkout, Admin, or client-side database access.

Stage 4.2 adds one deliberately small client island: `ProductGallery`. It receives already-mapped public media from the Server Component and owns only selected-thumbnail presentation state; it does not fetch Product data or own variants, prices, availability, Cart, or Wishlist state.

Stage 4.3 adds `ProductVariantSelector` as the domain-backed variant read boundary. The Server Component maps catalog variants to stable public IDs; the client island owns only selected-variant presentation and renders price/compare-at/availability. Existing purchase and wishlist controls remain preserved visual-only boundaries (disabled and non-persistent), while Related fragrances continue to use catalog-backed read data. No cart, wishlist, cookie, localStorage, or mutation state is introduced.

Stage 4.5 keeps Related selection server-side in `getRelatedProductsData`. It reads the public catalog, applies canonical eligibility and identity exclusion, scores family/audience/Brand/collection signals deterministically, deduplicates, and caps the result at four before mapping to the existing `CatalogProductCard` DTO. Related cards reuse `ProductCard`; no client fetch or recommendation state is introduced.

Stage 5.1 introduces a persistence-free commerce domain under `src/commerce/` and a server-only canonical resolver under `src/server/commerce/`. Future Cart lines are `productSlug + publicVariantId + quantity`; Wishlist entries are Product slugs. The domain accepts no client price or availability values and resolves public PDP data server-side before accepting a line or deriving an integer-minor-unit subtotal. No cookie, localStorage, database schema, API route, server action, or client provider is introduced yet.

Stage 5.2 adds a narrow `ProductPurchaseArea` client island that coordinates selected public Variant state between the existing size selector and PDP purchase panel. Its Add-to-bag mutation crosses one Server Action boundary to a server-only guest Cart adapter. Development/test storage is a process-memory `GuestCartStore`; it serializes writes per opaque guest ID and is deliberately unavailable in production until a durable adapter is designed. The cookie stores only that session guest ID; canonical resolution remains the authority for eligibility and price.

Stage 5.3 adds `/cart` as a server-first utility route. A Suspense-bounded server read leaf consumes the guest cookie and maps stored identity/quantity through the current public PDP service into a narrow Cart DTO. The Cart controls and Header count are small client leaves; they consume safe mutation totals and trigger route refresh, but do not duplicate Cart data. The root layout does not read cookies, so unrelated route shells retain Cache Components/Partial Prefetching behavior.

Stage 5.4 adds a Product-level guest Wishlist boundary. A validated Wishlist Server Action uses an opaque httpOnly guest identifier and canonical public Product resolution; the `/wishlist` route re-reads server state and is explicitly `instant = false` because its session cookie is request-time data. Client hearts only mirror the narrow action result and dispatch a local synchronization event; they do not own Wishlist truth.

Stage 5.5 keeps the two existing guest cookies and introduces an account-ready `CommerceOwner` (`guest | user`) contract without implementing Auth. Mongo Cart/Wishlist documents are identity-only durable records selected explicitly by `ATHAR_COMMERCE_PERSISTENCE=mongo`; Mongo `_id`, prices, inventory, Product copy, and account email never cross the public boundary. Optimistic revision updates serialize concurrent same-owner writes across instances, while TTL expiry is refreshed on mutation. Production has no process-memory fallback.

## Planned integrations

- Auth.js for customer authentication.

Stage 6.1 adds a server-only User identity foundation: opaque public `userId`,
normalized unique email, strict Mongo parsing, and an explicit identity index.
Password hashes remain storage-only and are never returned in public DTOs.
Auth.js Credentials runtime, registration/sign-in, OAuth, and account merge are
later stages and are not implemented here.

Stage 6.2 now implements Auth.js Credentials registration/sign-in/sign-out with
JWT sessions. Argon2id hashes live in the separate `user_credentials` collection;
the canonical `users` collection contains identity only. Session `user.id` is
the public opaque ID, disabled credentials are rejected, and duplicate account
errors remain generic.
- Stripe Payment Element for card collection; direct PayPal Orders API for PayPal.
- Verified webhooks for payment state.
- A transactional email provider and a media provider selected by the owner.

No separate Express application is proposed unless a later verified requirement requires one.

## Authenticated commerce ownership

Stage 6.4 resolves commerce ownership server-side from the Auth.js session:
authenticated Cart/Wishlist reads and mutations use the public session
`userId`; only requests without a session use opaque guest cookies. Browser input
never selects a user owner. Reconciliation is CAS-safe and idempotent, clearing
guest state only after successful canonical merge.

## Stage 6.5 password recovery

Forgot/reset routes call server-only services. Reset tokens are 256-bit random
values delivered only in Brevo transactional email; Mongo stores the SHA-256
hash, public user ID, creation time, and expiry only. A Mongo transaction
consumes the eligible token, updates the separate credential record, increments
a private security version, and removes sibling reset tokens. Auth.js checks
the version while processing JWTs, revoking old sessions without adding
credential state to public User/session DTOs. The production mail adapter is
never a mock.

## Migration principle

The static prototype is visual reference material, not production architecture. Recreate approved design intent as accessible, componentized, responsive routes; do not copy CSS override layers forward.

## Design-system ownership

The App Router stays thin. Reusable visual primitives live in `src/components/ui`; future homepage sections belong in dedicated feature/component folders and may consume these primitives. `src/styles` provides global tokens, typography, base rules, and motion only. Tailwind v4 is installed for routine utilities, while CSS Modules own component-specific and editorial styling.

## Phase 6 integration status

The Auth.js/Credentials, canonical public User, session-owned profile,
user-owned Cart/Wishlist reconciliation, and password-recovery boundaries are
implemented in Stages 6.1–6.5. Stage 6.6 integration verified those boundaries
through dedicated-test Mongo regressions and Browser E2E. No Phase 6.6
production/runtime source change was needed. Live production Atlas and Brevo
delivery remain unverified. The preserved Owner Header/Wishlist prerender issue
is an external local-source build blocker, not a Phase 6 integration failure.

## Phase 7 — Checkout Foundation

Stage 7.1 uses a server-only checkout read-model over `readCurrentCommerceCart`.
That existing boundary selects `CommerceOwner` from the Auth.js session or the
opaque guest cookie and re-resolves Product/Variant data and current prices
through the canonical catalog. `/checkout` is a Server Component with an
`io()` request-time boundary below Suspense so Auth.js, owner, cookie, and Cart
reads do not run in the prerendered shell. The read-only DTO contains no owner
identity or Mongo metadata. No draft is
persisted until a later stage defines a checkout lifecycle that requires it.
Contact/address, shipping, tax/discount rules, inventory reservation, payments,
and orders are outside Stage 7.1.

## Stage 7.2 contact and shipping address

The existing `/checkout` page remains server-first. After Stage 7.1 confirms
the current Cart is eligible, a narrow client form submits to a validated
Server Action. The action re-resolves the current owner and re-reads checkout
eligibility before writing. Mongo checkout drafts are keyed by an opaque public
ID but every read/save also filters on the server-derived `CommerceOwner`.
Optimistic revision matching prevents stale concurrent updates; Mongo `_id` and
owner identity stay server-only. A checkout-only contact email may be prefilled
from the canonical User but is not written back to the User record. This stage
does not add address-book/profile data, Cart pricing authority, delivery,
payment, or Order lifecycle.

## Stage 7.3 delivery selection

Stage 7.3 retains the owner-bound draft and adds only a public selected shipping
method ID. A server-only policy resolver rechecks the current eligible Cart,
address, method activity, currency, and price on each read or mutation. The
initial approved policy is Sweden (`SE`) only, PostNord, `5900` SEK minor units
below `69900`, and free delivery at/above that subtotal. No shipping amount is
persisted as authority and no delivery-time promise, carrier API, fulfillment,
or order lifecycle is introduced.
