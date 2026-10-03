# ATHAR Master Plan

## Product direction

ATHAR is a luxury fragrance ecommerce experience: warm ivory palette, editorial serif display type, restrained sans-serif interface type, asymmetric imagery, generous spacing, and subtle interactions. The hero remains static photography; scroll storytelling, canvas runtimes, frame sequences, video sequences, and GSAP-driven cinematic behaviour are out of scope.

## Delivery governance

Each phase has a goal contract, implementation ledger, evidence, documentation, verification, and explicit owner sign-off. A phase is not complete merely because code exists. Where evidence cannot run, record **IMPLEMENTED — NOT YET VERIFIED** rather than a pass.

## Planned phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Repository audit, baseline, documentation | In progress |
| 1 | Application architecture, design system, domain foundation | Pending owner sign-off |
| 2 | Homepage | Planned |
| 3 | Catalog, brands, collections, discovery | Stages 3.1–3.5 implemented locally; live Atlas execution and Stage 3.6 final integration/QA pending |
| 4 | Product detail and merchandising | Planned |
| 5 | Cart and wishlist | Planned |
| 6 | Authentication and customer account | Phase 6 complete locally |
| 7 | Checkout foundation | Stages 7.1–7.5 closed + pushed; Stage 7.6 complete — ready for Phase closure checkpoint |
| 8 | Stripe cards, direct PayPal, webhooks | Trusted payment finalization verified; checkpoint pending; historical PayPal first-decrement evidence remains limited |
| 9 | Canonical orders and transactional email | Stages 9.1–9.4 closed / verified; Stage 9.5 Secure Order Access in progress; premium email refinement deferred |
| 10 | Admin platform | Planned |
| 11 | Content, journal, legal, customer experience | Planned |
| 12 | Security, performance, accessibility, SEO | Planned |
| 13 | Production readiness | Planned |

### Phase 9 stage map

| Stage | Scope | Status |
| --- | --- | --- |
| 9.1 | Canonical Order financial snapshot | Closed / checkpointed / pushed |
| 9.2 | Customer Order read verification | Verification-only — complete |
| 9.3 | Transactional Order confirmation email | Closed / checkpointed / pushed |
| 9.4 | Durable Order email delivery | Closed / verified |
| 9.5 | Secure Order Access | In progress — owner review required before checkpoint |

#### Stage 9.5 fixed boundary

- Authenticated customers can read only their own persisted Order snapshots at
  `/account/orders/[orderId]`; a public Order number is never authorization.
- Guest lookup uses Order number plus checkout email, then creates a fixed
  30-minute, one-Order, HttpOnly session. The raw session secret is never
  persisted; Mongo retains only its hash.
- Guest lookup applies Mongo-backed, shared fixed-window limits before Order
  lookup: pair 5/15 minutes, Order number 10/15 minutes, and normalized email
  10/15 minutes. Every submitted lookup counts, including success. Identifiers
  use server-only `ORDER_LOOKUP_HMAC_SECRET` HMACs; raw email, Order number,
  and IP are never stored in rate-limit records.
- Rate-limiter failure is fail-closed. IP/network limiting, Redis/KV, Order
  ownership claims, premium email changes, invoice PDF, and carrier tracking
  remain out of scope.

### Phase 6 stage map

| Stage | Scope | Status |
| --- | --- | --- |
| 6.1 | Customer Identity & Account Foundation | Complete locally |
| 6.2 | Auth.js Credentials Runtime + Email/Password Registration & Sign-In | Complete locally |
| 6.3 | Customer Account Shell & Profile | Complete locally |
| 6.4 | Guest-to-Account Commerce Reconciliation | Complete locally |
| 6.5 | Account Security & Password Recovery | Complete locally |
| 6.6 | Phase 6 Integration & Closure | Complete locally |

### Phase 7 stage map

| Stage | Scope | Status |
| --- | --- | --- |
| 7.1 | Checkout Domain & Server-Authoritative Foundation | Complete locally |
| 7.2 | Contact & Shipping Address | Complete — ready for checkpoint from `00b283151050fac514d1bc0f49bbe66eb26229cd` |
| 7.3 | Shipping Methods / Delivery Selection | Closed + pushed in `1d3549e238f1995357285e8fc60e8ca157d501b4` |
| 7.4 | Totals, VAT & Discount Contract | Closed / checkpointed and pushed at `ce13df789cda5b1938bfbe9994f16eacbd78c0a1` |
| 7.5 | Inventory Reservation / Checkout Concurrency | Closed / checkpointed and pushed at `8e6f56ac19ae0c738d7acfcdceaba576e56ac112` |
| 7.6 | Phase 7 Integration & Closure | Complete — ready for checkpoint |

### Phase 7 fixed boundaries

- Checkout begins only from the current server-selected `CommerceOwner` Cart.
- Product, Variant, availability, integer-minor-unit price, currency, and line
  totals are resolved from the canonical server catalog; browser-supplied
  commerce values never establish checkout state.
- Stage 7.1 is a read-only checkout domain/read-model and `/checkout` review
  route. It creates no checkout draft or new Mongo collection because no durable
  checkout lifecycle is needed yet.
- Empty, unavailable, stale, invalid, or mixed-currency carts cannot continue.
  Stale/unavailable lines remain visible and are never counted as eligible.
- No shipping, tax/VAT, discounts, address, inventory reservation, payment,
  provider ID, payment attempt, order, or order email is introduced in 7.1.
- Stage 7.1 baseline: `5c4ec8139a358568509bd1fffb6041d2925ac0e8`.
- Stage 7.1 verification: domain 6/6; dedicated-test-Mongo Browser E2E 2/2
  with disposable-fixture cleanup assertions; Phase 5/6 unit regressions 42
  passed with one separately gated Mongo transaction test skipped; TypeScript,
  ESLint (0 errors, one existing warning), diff check, clean-baseline build, and
  Stage-7.1-only build passed. No checkout-specific persistence was introduced.

### Stage 7.2 contract

Stage 7.2 adds owner-bound, durable checkout contact/address drafts only for the
current eligible Stage 7.1 Cart. The public checkout ID is opaque; authenticated
owner identity comes from the Auth.js session and guest identity from the
existing Cart cookie. Every lookup and revision-guarded save is scoped by that
server-derived owner. Email is required and normalized; account email may
prefill but remains checkout-only. First/last name, address line 1, postal
code, city, and two-letter country code are required; line 2 and region are
optional. No phone requirement or country allowlist is invented.

Drafts contain no commerce totals or downstream authority. Empty, stale,
unavailable, invalid, or mixed-currency Cart state blocks saving. The explicit
Mongo collection/index contract has a 30-day expiry; tests use disposable data
only in `athar_stage55_test`. Stage 7.3+, delivery methods/rates, tax, discounts,
inventory reservation, billing, saved addresses, payments, webhooks, Orders,
and transactional order email remain out of scope. Stage 7.2 must stop at
`ATLAS_STOP`; no commit/push is authorized.

### Phase 6 fixed decisions

- Email + Password only.
- Auth.js is the authentication framework.
- Credentials is the future authentication method.
- OAuth/social login is not used.
- Clerk is not used.
- Brevo is the transactional email provider.
- Required email verification is not implemented.
- Password reset is required and is implemented in Stage 6.5.
- Future order confirmation emails must use Brevo.
- Stage 6.1 baseline: `1cc405bf77e44777cae20b1e2998bfbdf5366bcd`.
- Guest-to-account commerce merge is implemented server-side with canonical
  re-resolution, CAS-safe idempotency, and post-success guest-state clearing.
- Stage 6.2 uses Auth.js Credentials only with Argon2id password hashing.
- Credentials persist separately from canonical User records; sessions carry
  only the public opaque `userId`.
- Stage 6.3 baseline: `3e7840d4ae9d7f8b747f2672c735efeba83be7b4`.
- Stage 6.3 permits server-session-owned `displayName` updates only; email is
  read-only and account addresses, orders, password changes, and guest merge
  remain deferred.
- Stage 6.3 closure evidence: Stage-6.3-only production build passed. The
  current-tree build blocker is a preserved Owner Header/Wishlist change and
  is outside this stage.
- Stage 6.4 merges guest Cart/Wishlist into the authenticated public `userId`
  owner with canonical re-resolution, CAS-safe idempotency, and post-success
  guest-state clearing only.
- Stage 6.4 closure evidence: pure/domain and dedicated Mongo tests pass;
  existing-account Browser E2E proves merge, authenticated owner reads,
  sign-out/sign-in repeat idempotency, and guest-state cleanup. Clean baseline
  and Stage-6.4-only production builds pass; only the current tree is blocked
  at `/_not-found` by the preserved Owner Header/Wishlist dynamic-cookie
  change outside this stage. Stage 6.5 is complete locally.

- Stage 6.5 verification update (2026-09-24): isolated baseline and
  Stage-6.5-only production builds pass. The current-tree build remains blocked
  at `/_not-found` by the preserved Owner Header/Wishlist request-time read
  outside Suspense. The reset page now awaits `searchParams` within Suspense.
  Dedicated Mongo verification passed against `athar_stage55_test`. Earlier TLS
  failures followed a switch from mobile hotspot to hotel Wi-Fi while the active
  network IP was not on Atlas IP Access List; the owner subsequently reported
  two consecutive successful pings on hotel Wi-Fi. Final Browser E2E now passes
  the protected test-mail reset flow, old/new password checks, prior-session
  invalidation, reused-token rejection, and generic unknown/disabled responses.
  The route-shape defect that prevented outbox capture was fixed and covered by
  a focused regression. Disposable fixtures were confirmed absent afterward.
  Final Stage 6.5 focused tests passed 8/8; domain/auth regressions passed
  36/36 with one separately executed live Mongo case, and Stages 6.1, 6.2, and
  6.4 live Mongo regressions passed. After the production fix, clean baseline
  and Stage-6.5-only production builds passed. Full TypeScript, full ESLint,
  and `git diff --check` passed. Current-tree build attribution remains the
  previously identified preserved Owner Header/Wishlist runtime-read issue,
  outside Stage 6.5. Live Brevo delivery remains unverified and is not a
  closure blocker. Stage 6.5 is complete locally; Stage 6.6 is not started.

- Stage 6.6 integration and closure (2026-09-26), baseline
  `34fc73b0f69a1c04670840bfbe3c782e8a7f6c0e`: the interrupted network/session
  was resumed and `athar_stage55_test` was reachable. Required Phase 6/Phase 5
  regressions passed 40/40 and full Browser E2E passed 8/8, including account
  profile, guest Cart/Wishlist merge and repeated sign-in, authenticated owner
  reads/mutations, password reset, session revocation, and commerce preservation
  after reset. Direct cleanup verification found zero disposable records; 11
  abandoned test accounts from earlier attempts were removed by explicit
  test-only prefixes and re-audited to zero. TypeScript passed; ESLint had zero
  errors and one existing `SignInForm.tsx` warning. Isolated baseline production
  build passed. Stage 6.6 introduced no production/runtime source changes, so
  the Stage-only production source set is identical. The current Owner/local
  source build fails at `/_not-found` due preserved Header/Wishlist request-time
  reads outside this stage; no Owner code was changed. Live production Atlas
  remains unverified and live Brevo delivery is not yet verified. **Stage 6.6
  and Phase 6 are complete locally; Stage 7 has not started.**

### Stage 6.5 contract and current implementation

Baseline: `87b9993d9d0a6bb76d6eb88b3909f90591750ff0`.

- Provide Forgot Password and Reset Password pages/routes; forgot responses do
  not disclose whether an account exists.
- Create 256-bit random, single-use tokens with a 30-minute expiry. Persist only
  SHA-256 token hashes in `password_reset_tokens`; replacing a user's token
  invalidates the prior token. TTL and unique indexes are explicit/idempotent.
- Send branded transactional email through the server-only Brevo HTTP API.
  Credentials are `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, optional
  `BREVO_SENDER_NAME`, and `NEXT_PUBLIC_SITE_URL`; production never selects a
  mock mail adapter implicitly.
- Apply the Stage 6.2 password policy (15–128 characters) and Argon2id
  parameters (timeCost 3, memoryCost 65536, parallelism 4).
- Atomically consume a valid token, update the active credential, increment a
  private `securityVersion`, and consume sibling reset tokens in a Mongo
  transaction. Auth.js checks the version server-side so prior sessions are
  rejected without exposing it in public User/session DTOs.
- Email verification, signed-in password change, OAuth, Clerk, Stage 6.6,
  checkout, payments, and orders remain out of scope.
- Dedicated test Mongo transaction/index verification passed; live Brevo
  delivery remains unverified. Do not claim provider delivery or production
  persistence.

## Permanent domain invariants

- Products, brands, collections, inventory, merchandising flags, and prices are canonical data—not hard-coded JSX.
- Monetary values use integer minor units. Images are stored by a media provider with metadata in the database; image binaries do not live in MongoDB.
- Current customer card checkout uses Stripe-hosted Checkout Sessions with
  automatic capture; the Session creates the underlying PaymentIntent. The
  return route and `checkout.session.completed` webhook validate the hosted
  Session before trusted finalization. The older PaymentIntent/Payment Element
  helper is not the current customer surface. PayPal uses the direct PayPal
  Orders API; it is not routed through Stripe.
- A durable local `paymentAttempt` must hold the provider identifier before customer payment progresses. Provider webhooks and trusted provider state, never a browser redirect, prove payment.
- ATHAR owns customer order numbers generated by the current implementation as
  `ATH-` followed by 12 uppercase hexadecimal characters (for example,
  `ATH-7F2A9C10D4B8`); Stripe and PayPal identifiers are internal payment
  references.
- Commercial claims such as bestseller, stock, authorisation, ratings, and discounts require approved canonical data.

## Phase 0 exit contract

Phase 0 exits only after the owner approves the proposed migration from the static prototype to the selected production stack. No Phase 1 implementation begins automatically.
