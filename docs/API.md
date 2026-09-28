# API

The catalog remains server-rendered with no public Product API. Account
registration/profile and Stage 6.5 password-recovery endpoints are documented
in their stage-specific contracts below.

The available internal read contracts are `getPublicProductBySlug`, `listPublicProducts`, `getPublicBrandBySlug`, `getPublicCollectionBySlug`, `getCatalogBrowseData`, `getBrandBrowseData`, and `getCatalogDiscoveryData`. They validate route/query boundaries and return only active public records. `getCatalogDiscoveryData` accepts only the bounded allow-list `q`, `audience`, `brand`, `family`, `collection`, and `sort`; route scope is authoritative. Public services map canonical records to narrow card DTOs before Server Component rendering and never create a client endpoint.

Future route contracts will be defined alongside their feature phases with Zod validation, authenticated authorization checks, documented error shapes, idempotency requirements where relevant, and tests. Payment and webhook routes are reserved for Phase 8.

## Stage 6.5 account security endpoints

- `POST /api/auth/forgot-password` accepts only `{ email }`; responses are
  generic across unknown, disabled, and eligible accounts.
- `POST /api/auth/reset-password` accepts only `{ token, password }`; invalid,
  expired, or consumed links receive a generic invalid/expired response.
- The forgot-password route passes the validated `email` string to the
  password-reset service; malformed payloads retain the same generic response
  and do not invoke the service.
- Tokens never appear in logs or API responses. Reset links are delivered by
  the server-only Brevo adapter. A successful reset requires a subsequent
  sign-in with the new password.

## Phase 6 integration status

No endpoint contract changed in Stage 6.6. Browser E2E verified registration,
profile read/update, guest Cart/Wishlist reconciliation, authenticated
user-owned commerce mutations, repeated sign-in idempotency, password reset,
and prior-session invalidation. Authenticated ownership is derived from the
server-side Auth.js session public user ID; browser input cannot choose an
owner. Live production Atlas and live Brevo delivery remain unverified.

## Stage 7.1 checkout read route

- `GET /checkout` is a server-rendered page; it has no browser-supplied Cart,
  owner, price, or total input.
- It reads the current server-selected guest or authenticated Cart, resolves
  current Product/Variant price and availability through the canonical catalog,
  and presents an allow-listed checkout read model.
- Empty, unavailable, stale, invalid, or mixed-currency Cart states do not
  permit proceeding. Stale/unavailable lines remain visible and are excluded
  from the eligible subtotal.
- No Checkout POST/action, draft, address, shipping/tax/discount calculation,
  inventory reservation, payment, payment attempt, or Order exists in Stage 7.1.

## Stage 7.2 checkout contact action

- The checkout page presents a contact/address form only when the current
  Stage 7.1 Cart read-model is eligible.
- The Server Action accepts an opaque checkout ID, expected revision, email,
  and shipping-address fields. It validates and normalizes fields, resolves
  ownership from the authenticated session or existing guest Cart cookie, and
  re-reads current Cart eligibility before a CAS save.
- Browser-supplied owner/user IDs, Cart contents, prices, totals, shipping,
  tax, discount, or payment data are never accepted as authority.
- Contact email is required; address line 2 and region are optional. Account
  email can prefill the checkout field but saving does not mutate the User.
- Conflicts, foreign IDs, expiry, invalid input, and ineligible Cart state
  return safe generic/form feedback. PII is not placed in URLs or logs.

## Stage 7.3 delivery selection

- The delivery action accepts only checkout ID, revision, and public
  `shippingMethodId`; it never accepts a browser price, threshold result,
  carrier quote, owner, Cart total, or eligibility claim.
- The server re-resolves the current owner draft, valid address, current Cart,
  active policy method, currency, and current charge before a CAS save.
- The production launch policy is `SE` + PostNord: `5900` minor SEK below
  `69900`, otherwise free. Non-SE addresses receive a safe unavailable state.

## Stage 7.4 totals read contract

`/checkout` derives public integer-minor-unit subtotal, zero production
discount, re-resolved shipping, included VAT, and grand total only from current
server state. It accepts no browser total, VAT, discount, shipping, threshold,
or owner claim; its public DTO exposes no Checkout/Mongo ID or policy object.

## Stage 7.5 prepare-for-payment contract

The action accepts only an opaque checkout reference. It derives the owner,
current Cart/catalog, draft contact/address, shipping and totals on the server
before an inventory claim. Browser input cannot set stock, reserved quantity,
expiry, status, owner, or a Mongo ID. Success exposes only an opaque reservation
ID and fixed server-derived expiry; unavailable or stale state returns safe
generic feedback. No payment provider, payment attempt, or Order is created.

## Stage 7.6 integration boundary

Stage 7.6 adds no public route or action. It closes the composed contract:
`/checkout` and its existing server actions resolve current owner, Cart,
contact/address, shipping, VAT-inclusive totals, and reservation eligibility
in that order. A browser cannot promote its own total, VAT, shipping amount,
stock, reservation expiry, owner, or Order claim to authority.

## Stage 8.1 payment-attempt service boundary

Stage 8.1 adds server-only `preparePaymentAttempt`, not a browser endpoint or
payment UI. It re-resolves the current owner, Cart/catalog, Checkout revision,
contact/address, shipping, VAT-inclusive totals and compatible unexpired
reservation. Browser input cannot select provider, amount, currency,
reservation, status, or payment outcome. Its safe result exposes only an opaque
local attempt ID, SEK amount, local state and existing reservation expiry. No
provider request, redirect, PaymentIntent, PayPal Order, webhook or Order exists.

## Stage 8.2 Stripe payment boundary

The server-only Stripe preparation action accepts only the opaque Checkout
reference. It reuses the compatible local PaymentAttempt, then creates or
retrieves one card-only PaymentIntent with the durable provider-operation key.
Amount and `sek` currency are read exclusively from the local immutable
snapshot; `capture_method` is explicitly `automatic`. Its minimal response
returns an opaque local attempt ID and transient client secret only to the
current owner. No browser amount, currency, PaymentIntent ID, provider status,
or payment result is trusted.
