# Security

## Current state

Auth.js Credentials and customer-account routes are implemented through Stage
6.5 locally. Password-reset Mongo transaction/index tests and Browser reset,
token-replay, generic-response, and session-revocation checks pass on the
dedicated test database. Live Brevo delivery is not yet verified. No payment
handling is active.
Mongo access is server-only and live production credentials are not in source
control.

## Catalog data boundary

- `MONGODB_URI` and `MONGODB_DB_NAME` are server-only variables and must never use the `NEXT_PUBLIC_` prefix.
- Database, repository, and catalog-service modules import `server-only`, producing a build-time failure if a Client Component imports them.
- Zod validates product, variant, brand, collection, media, slug, money, and bounded public-list inputs before persistence/query use.
- Repositories construct fixed MongoDB filters from validated values; arbitrary client-provided Mongo operators are not accepted.
- Discovery accepts only allow-listed scalar URL fields; `q` is normalized and capped at 80 characters, uses literal substring matching, and never becomes a Mongo `$` operator or a regular expression.
- PDP slug input is validated before the server-only Product repository read. Its public DTO omits Mongo IDs, seed/lifecycle fields, timestamps, raw inventory quantities, and internal repository metadata. Private/missing Products remain indistinguishable to public routing; unavailable infrastructure is represented separately without a fixture fallback.
- Database errors are allowed to surface to trusted server-side callers, but connection strings are not interpolated into application errors or logs.
- `ensureCatalogIndexes()` is not a public endpoint and must be run only through a controlled deployment/migration process.
- The catalog seed is developer/operations tooling, not a route handler. Its write path rejects `NODE_ENV=production`, requires `CATALOG_SEED_ALLOW_WRITE=1`, and validates every fixture before the first write.
- Matching an existing slug is insufficient authority to overwrite it: seed records must carry the expected operational seed key. Conflicts fail rather than replacing unrelated records, and the pipeline deletes nothing.
- Stage 5.1 commerce inputs are Zod-validated and use canonical Product slug plus public Variant ID and a bounded integer quantity. The server-only commerce adapter resolves current public Product/Variant eligibility, price, and safe availability; browser-supplied prices, totals, stock, and Product records are not accepted. No Cart/Wishlist persistence, cookie, localStorage, public API, mutation, or inventory reservation exists yet.
- Stage 5.2 adds one strict Server Action for PDP Add-to-bag. Its payload permits only Product slug, public Variant ID, and bounded integer quantity; unexpected price/total fields are rejected. The `athar_guest_cart` cookie is an opaque, session-scoped identifier with `httpOnly`, `SameSite=Lax`, `Path=/`, and production `Secure`; it conveys no cart state or customer identity. Public canonical data is re-read for every mutation. Development/test memory storage is disabled in production, avoiding an accidental non-durable production Cart fallback.
- Stage 5.3 Cart reads never reveal raw Cart storage or cookie values. Public Cart lines are re-resolved from canonical public catalog data; stale/unavailable lines have no payable price or subtotal and may only be removed by the same opaque guest identity. Update/remove actions validate canonical Product slug, public Variant ID, and bounded quantity; Header count receives only a safe aggregate quantity.
- Stage 5.4 Wishlist entries are Product-level canonical slugs only. The `athar_guest_wishlist` cookie is opaque, httpOnly, SameSite=Lax, Path=/, and Secure in production; no price, inventory, account identity, or client-owned Wishlist payload is stored. Every mutation revalidates public Product eligibility server-side.
- Stage 5.5 durable records use an opaque `CommerceOwner` (`guest | user`) and never accept owner identity from browser mutation input. Mongo `_id`, email, prices, inventory, Product copy, and subtotal are not persisted as commerce authority. Unique owner indexes, strict Zod read/write validation, optimistic revisions, TTL expiry, and production no-memory-fallback behavior were verified against dedicated non-production `athar_stage55_test`; no production database was used.
- Stage 6.4 derives authenticated commerce ownership only from the server-side
  Auth.js public `userId` session claim. Guest cookies cannot select an account;
  merge retries/concurrency are idempotent and guest state is cleared only
  after successful canonical reconciliation.

## Future baseline

- Keep secrets server-only and publish an `.env.example` without values.
- Validate untrusted input with Zod; enforce authorization server-side.
- Use secure session handling through the approved authentication design.
- Verify Stripe and PayPal webhook signatures; persist and deduplicate provider events.
- Never persist raw card data.
- Apply security headers, rate limits where appropriate, dependency review, and least-privilege access before production.

Stage 6.5 password recovery stores only SHA-256 hashes of 256-bit random
one-time tokens, expires them after 30 minutes, and atomically consumes them
with a credential password update. Forgot responses are account-independent;
reset tokens/URLs and provider credentials are never logged or returned. Brevo
credentials are server-only. Password resets increment a private credential
security version checked by Auth.js to invalidate prior JWT sessions; the
version is not part of public DTO/session data.

## Stage 6.6 integration verification status

The final Phase 6/Phase 5 regression set passed 40/40, and Browser E2E passed
8/8. Authenticated commerce ownership is selected from the server session;
public session data contains the public user ID only, not Mongo `_id`, password
hashes, or the private credential security version. Unknown/disabled account
responses remain generic. The test-mail adapter is non-production-only and the
capture endpoint requires a per-run secret. Disposable account, credential,
reset-token, Cart/Wishlist, and merge fixtures were audited and cleaned in the
dedicated test database. The preserved Owner Header/Wishlist prerender issue
is outside Stage 6.6. Live Brevo delivery remains **NOT YET VERIFIED**; live
production Atlas remains **NOT VERIFIED**.

## Stage 7.1 checkout boundary

The checkout page takes no browser-owned Cart or owner values. The server
selects the `CommerceOwner` from the Auth.js session public `userId`, or from
the existing opaque guest cookie when no session exists. It reads only stored
Cart identity/quantity, then re-resolves catalog name, active Product/Variant,
availability, current integer-minor-unit price, and currency server-side. The
public checkout projection is allow-listed and omits owner identity, Mongo
`_id`, persistence metadata, and credentials. No checkout mutation, draft,
payment credential, or new attack surface is introduced in Stage 7.1.

## Stage 7.2 checkout draft boundary

The checkout form's ID and revision are untrusted references, not authorization.
The server resolves the owner from the Auth.js session or existing guest Cart
cookie, scopes every lookup and compare-and-set write to that owner, validates
the payload with strict schemas, and rechecks the current Stage 7.1 Cart before
save. Public DTOs exclude Mongo `_id` and owner identity. Account email prefill
is read-only; submitted contact email is checkout-scoped and never updates the
User. Drafts contain no commerce totals or payment/order authority. PII is not
placed in URLs/logs, cookies contain only opaque IDs, and drafts expire after
30 days. No production database was used for test fixtures.

## Stage 7.3 shipping selection boundary

Shipping policy is resolved only on the server from the current owner-bound
draft, current eligible Cart subtotal, canonical currency, and shipping address.
The browser submits only an opaque checkout reference, its revision, and a
public shipping-method ID. It cannot select an owner, country eligibility,
carrier charge, threshold result, price, or currency. Mongo stores only the
selected public method identity; a current shipping amount is re-derived on
each read and never becomes draft authority. The selection is cleared if the
address leaves the supported launch country. Production has no fictional
shipping fallback. PostNord merchant/service and perfume dangerous-goods
acceptance are **NOT YET VERIFIED**; no carrier API, label, EDI, fulfillment,
payment, or order capability is implied.

## Stage 7.4 totals authority boundary

Totals are constructed only from the current Cart and current owner-bound draft.
The browser cannot establish subtotal, discount, VAT, shipping, free-shipping,
grand total, or owner identity. The public totals DTO omits internal policy,
Checkout/Mongo IDs, and owner identity; production discount remains zero.

## Stage 7.5 reservation authority

Inventory claims are server-owned. The browser cannot select a reservation
owner, stock, availability, expiry, ledger status, or Mongo identifier. The
server re-resolves current checkout state and catalog before every prepare; a
catalog-invalid compatible claim is released inside the transaction. Public
results contain only an opaque reservation identifier and no ledger internals.
