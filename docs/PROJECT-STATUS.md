# ATHAR Project Status

**Last audited:** 2026-10-06
**Current phase:** Phase 10 — Admin Platform
**Overall status:** **STAGE 10.1 CLOSED / VERIFIED / CHECKPOINTED.**
Stage 9.6 Premium Order Confirmation Email Presentation is **CLOSED / VERIFIED**.
Its implementation checkpoint is `77aae73366bb0b2fe86bf817e0ddd899b134b3ed`;
controlled live Order `ATH-7678DB2848CB` passed Brevo delivery and Gmail visual
review. HTML text branding remains the owner decision: Gmail used fallback
typography, so exact cross-client logo-font parity is not guaranteed. Dispatch
was returned to `0` after the test. Stage 9.4 remains closed
/ verified; trusted payment finalization and the live customer Order
Confirmation delivery pipeline remain unchanged.

## Stage 10.1 planning status — Admin Identity & Server-Side Authorization Foundation

Stage 10.1 is **CLOSED / VERIFIED / CHECKPOINTED**. It now has a canonical
role field, server-side authorization boundary, controlled bootstrap operation,
append-only audit store/index contract, minimal protected `/admin` shell, and
focused verification. The approved contract fixes two roles (`customer` and
`admin`) persisted on the canonical User document; historical/missing/unknown/
malformed roles fail closed to non-Admin and no bulk legacy backfill is
authorized merely for this stage. The initial Admin is an existing account
targeted by public `userId` through a one-off controlled server-only script;
there is no endpoint, UI, browser path, or automatic email/environment
promotion. Privileged checks use the current persisted role server-side, and
role changes invalidate stale sessions through `securityVersion`. Stage 10.1
does not add a disable-account mutation; the existing persisted-`disabledAt`
session rejection remains in place and must deny privileged access. `/admin`
is only a protected minimal shell. Authenticated non-Admins receive a stable
Access Denied presentation without Admin data; the stage does not enable
experimental Next.js `authInterrupts` or assert transport-level HTTP `403` for
that App Router shell. Future privileged route handlers use explicit `401` for
unauthenticated and `403` for authenticated unauthorized callers. Audit events
are append-only with allow-listed safe metadata and no sensitive request data;
the controlled first-Admin bootstrap alone may use `actorType: system` with the
fixed `actorId: admin-bootstrap`; all normal actors use public user IDs.
Retention remains undecided. Dashboard, catalog/order/customer operations,
refunds, provider operations, email administration, all role-management UI/API,
and a new account-disable mutation remain out of scope pending later contracts.

The approved ATHAR Admin Final Visual Reference is reserved for a later
Dashboard stage: Swedish money format `128 450 kr`; inventory states `Low`,
`Critical`, and `Out of Stock`; preserved dark sidebar, lower perfume image,
strong dark gradient, and active state; and the hierarchy KPI cards → Revenue /
Order Status → Recent Orders / Low Stock → compact Latest Reviews. Stage 10.1
still implements only the security foundation and a minimal protected shell.
Focused non-Mongo unit/auth regressions passed with **17 passed, 0 failed, and
1 skipped**; the skip is the existing Stage 6.5 dedicated-Mongo test in the
Codex process without usable Mongo connectivity. The dedicated Stage 10.1 Mongo
transaction verification passed on the real local machine against
`athar_stage55_test` (**1 passed, 0 failed**), covering transaction atomicity,
role promotion, `securityVersion`, the constrained system actor, idempotent
retry, nonexistent targets, audit index, secret safety, and fixture cleanup.

Owner verification passed: unauthenticated `/admin` follows the sign-in flow;
an authenticated customer receives safe Access Denied with no privileged data;
and a fresh session for the temporary local/test-only fixture rendered the
minimal protected Admin shell. The fixture is not a production Admin identity.
No Render/live deployment, production account, or real Admin account was
created or promoted. `u3811698473@gmail.com` was not used or modified in Stage
10.1. The real local `npm run build` passed on Next.js 16.3.8:
compilation, TypeScript, and static generation (36/36) all passed, with
`/admin` included in the production route graph. The historical missing-Next
and Codex build timeout were local environment/process issues, not Stage 10.1
code failures.

Stage 10.2 — Admin Provisioning, Activation & Dedicated Admin Login — remains
separate and out of scope. It has not been implemented by Stage 10.1.

## Trusted Payment Finalization closure (2026-10-01)

The current payment finalization boundary is verified for the following evidence:

- PaymentAttempt automated tests: **VERIFIED**.
- Stripe automated tests: **VERIFIED**.
- Inventory/reservation automated verification against the dedicated
  `athar_stage55_test` database: **VERIFIED** (2 passed, 0 failed, 0 skipped;
  fixture cleanup passed).
- Real Stripe Sandbox finalization and webhook delivery: **VERIFIED**.
- Real PayPal Sandbox create/capture and `PAYMENT.CAPTURE.COMPLETED` delivery:
  **VERIFIED**.
- PayPal `FAIL_SOFT` retry to `DELIVERED`: **VERIFIED**.
- PayPal replay created no duplicate Order, caused no second inventory
  decrement, and preserved the cleared Cart: **VERIFIED**.
- Exactly one Order per verified PaymentAttempt, `paymentStatus = paid`, and
  `fulfillmentStatus = pending`: **VERIFIED**.
- TypeScript, affected ESLint, and production build: **VERIFIED**.

The following are not claims about the old transaction's first stock mutation:

```text
Original PayPal inventory decrement exactly once:
UNVERIFIED historically
```

The consumed reservation was later removed by the existing TTL behavior and no
durable historical consumption ledger exists. The current inventory/reservation
tests verify the current engine, while PayPal replay evidence verifies that the
replay caused no additional mutation; neither is retrospective proof of that
old transaction's first decrement. A dedicated standalone PayPal route test
suite is **NOT APPLICABLE** because none currently exists.

## Stage 8.2 current status

Stage 8.2 is **IMPLEMENTED — TRUSTED PAYMENT FINALIZATION VERIFIED; CHECKPOINT
PENDING**. Current customer card checkout uses a Stripe-hosted Checkout Session
with automatic capture; card details never render inside ATHAR. The Session
creates the underlying PaymentIntent and carries the immutable PaymentAttempt
metadata. The return route and `checkout.session.completed` webhook retrieve and
validate the hosted Session before trusted finalization. The older server-only
PaymentIntent helper remains covered by its focused contract tests but is not the
current customer checkout surface. Refund and Admin remain out of scope.

## Stage 8.1 current status

Stage 8.1 is **COMPLETE — READY FOR CHECKPOINT** from official baseline
`957bde6ab7ac80c82096098f75aa7e8f9933e4f0`. It adds only a durable,
provider-neutral PaymentAttempt foundation after the fixed reservation boundary.
No Stripe/PayPal call, Payment Element, PaymentIntent, webhook, canonical Order,
or capture/authorize decision is implemented. Focused contract/Mongo tests,
affected Phase 7 regression, TypeScript, ESLint, and isolated Webpack build
passed; the production build has an explicit durable exit code of `0`.

## Stage 9.1 current status (closed / checkpointed / pushed)

Stage 9.1 extends the Phase 8 Order boundary with an immutable financial
snapshot captured from the server-authoritative checkout totals: merchandise,
shipping amount and label, explicit zero discount, included VAT, grand total,
currency, and shipping method. New PaymentAttempts persist this snapshot before
provider execution so finalization does not re-derive historical amounts from
current Cart or shipping policy. Existing legacy Orders remain readable without
invented VAT, shipping, or discount history. Stage 9.1 adds no email delivery,
outbox, retry, guest lookup, or independent Order detail route. Refund and
Admin remain not started.

## Stage 9.2 current status (verification-only — complete)

Stage 9.2 confirms that the existing authenticated `/account` Order history is
launch-sufficient. It is owner-scoped, newest-first, and limited to the latest
20 Orders; the read path uses persisted Order and line-item snapshots. New
Orders expose the Stage 9.1 financial snapshot, while legacy Orders remain
readable without fabricated VAT, shipping, or discount values.

The guest confirmation boundary remains the current short-lived,
owner-verified confirmation cookie. A dedicated Order detail route, persistent
guest Order lookup/claim flow, pagination/search, and a fulfillment timeline are
deferred. No production implementation was required for Stage 9.2.

Stage 9.2: **VERIFICATION-ONLY — COMPLETE**. Stages 9.3 and 9.4 are closed;
premium template refinement remains deferred.

## Stage 9.3 current status (closed / checkpointed / pushed)

Stage 9.3 adds the immutable Order confirmation email contract and both plain
text and HTML renderers. The recipient is the persisted `Order.contact.email`
snapshot, and the server-only Brevo adapter uses `BREVO_SENDER_EMAIL` with
`BREVO_SENDER_NAME` (defaulting to `ATHAR`). A non-production test-mail adapter
and protected test route verify delivery shape without sending live mail.

Automatic payment-to-email wiring is implemented behind the Stage 9.4 runtime
flag; live delivery is verified separately below.

## Stage 9.4 current status (closed / verified)

Stage 9.4 adds a Mongo-backed `email_deliveries` outbox with one logical
`order_confirmation` record per Order, stable opaque delivery/idempotency
identity, atomic lease claims, bounded retry, and explicit provider-accepted,
delivered, retryable, permanent, and ambiguous states. Trusted payment and Order
finalization remain independent of email dispatch; finalization only ensures a
pending delivery record and never requires Brevo success.

The Brevo transactional webhook route uses the documented Bearer-token notify
URL authentication contract and correlates only through the opaque delivery tag
and provider message ID. Automatic Order-to-delivery dispatch is implemented
behind the explicit server-only `ATHAR_ORDER_EMAIL_DISPATCH_ENABLED=1` flag;
the flag was returned to `0` after the controlled live test and Render was
redeployed successfully. Email failures cannot change payment truth.

Controlled live E2E evidence for Order `ATH-B277923ECA1B`:

- Stripe Sandbox payment, canonical Order creation, `paymentStatus = paid`,
  and `fulfillmentStatus = pending`: **VERIFIED**.
- Exactly one `order_confirmation` delivery record, `provider = brevo`,
  `attemptCount = 1`, provider message ID present, and Mongo status
  transitioned to `delivered`: **VERIFIED**.
- Brevo Sent, Delivered, customer inbox receipt, and observed first opening:
  **VERIFIED/OBSERVED**.
- Brevo webhook delivery to ATHAR: **VERIFIED**; no duplicate email attempt
  was observed.

Earlier diagnostic Order `ATH-302D0E518312` created its pending delivery record
with `attemptCount = 0` because the dispatch flag was `0` during that checkout;
this was expected safety-flag behavior, not a payment or Brevo defect.

Customer confirmation recipient authority remains the persisted
`Order.contact.email` snapshot. Admin Order notification email is not
implemented. The current functional template is intentionally unchanged;
premium branding/layout refinement is deferred to a later stage.

Stage 9.4: **CLOSED / VERIFIED**.

## Stage 9.5 Secure Order Access closure (2026-10-03)

Stage 9.5 is **CLOSED / VERIFIED / CHECKPOINTED / PUSHED** at
`8b50f7fe5d9c1e433a37b4b2361feedb904e19fd`. It adds secure customer Order
access without changing payment finalization or Stage 9.4 email delivery.

- Authenticated details at `/account/orders/[orderId]` remain scoped to the
  canonical authenticated owner; a public Order number never authorizes access.
- Guest lookup at `/orders/lookup` verifies Order number plus checkout email,
  returns only generic failures, and redirects successful verification to
  `/orders/guest` without placing an Order identifier or email in the URL.
- The guest session is one opaque high-entropy browser secret in an HttpOnly,
  `/orders`-scoped cookie. Mongo stores only its SHA-256 hash, binds it to one
  verified guest Order, and enforces its fixed non-sliding 30-minute expiry.
- Mongo-backed rate limiting is server-authoritative and fail-closed: five
  Order/email-pair attempts, ten per Order number, and ten per normalized email
  in shared fixed 15-minute windows. HMAC-SHA-256 identifiers prevent raw Order
  numbers, emails, and IP addresses from being stored; every submission counts.
- The customer read model exposes persisted customer-safe snapshots only. It
  excludes Mongo IDs, owner IDs, PaymentAttempt/provider IDs, webhook details,
  email-delivery internals, and all secure-access internals.
- New Orders persist canonical server-side `imageSnapshot` and `fragranceType`
  line snapshots. Customer detail routes use those snapshots only: no live
  catalog fallback or backfill is performed, and legacy Orders remain readable
  without a missing historical `fragranceType`.
- Live evidence covered authenticated owner access, guest lookup/protected
  display, generic failure gates, the Confirmation-to-lookup CTA, image and
  fragrance display, address and status presentation, and Mongo persistence for
  guest Order `ATH-A916CBAEBDCC` (`Eau de Toilette`, 75 ml). The customer-facing
  statuses are `Payment status: Paid` and `Your order: Preparing`.
- Mongo secure-access indexes, focused tests (7/7), TypeScript, ESLint,
  production build, diff check, and secret scan passed. The guest route now
  establishes a request-time `connection()` boundary before cookie/session
  resolution, eliminating the Next prerender `new Date()` diagnostic without
  changing session expiry or security semantics.

The audited Stage 9.5 checkpoint history is `a6ace9ba` (initial implementation),
`d24eed36` (secure-access index bootstrap), `3a945162` (image snapshots),
`01cdd3bb` (customer Order UX and fragrance snapshot), `b8669223`
(presentation checkpoint), and `8b50f7fe` (final code checkpoint). There is no
guest ownership claim, IP rate limiting, Redis/KV dependency, payment change,
email redesign, invoice PDF, or carrier-tracking work in this Stage.

## Stage 7.6 current status

Stage 7.6 is **COMPLETE — READY FOR CHECKPOINT**. Phase 7 has been verified as
one server-authoritative flow from the current Cart through contact/address,
Swedish PostNord delivery, VAT-inclusive totals, and Prepare for payment to a
temporary inventory reservation. No payment provider, payment attempt, Order,
or fulfillment truth is introduced.

## Stage 7.5 current status

Stage 7.5 is closed and pushed at `8e6f56ac19ae0c738d7acfcdceaba576e56ac112`.
Prepare for payment creates a fixed, non-sliding 15-minute server-time
reservation only after checkout gates pass. Mongo concurrency/reconciliation
and guest/auth Browser evidence are passing; isolated TypeScript and Webpack
production build passed; final Stage 7.1 regression passed 3/3 and final Stage
7.4 totals/VAT regression passed 2/2.
Reservation is not payment, sale, or Order creation.

## Stage 7.4 current status

The Sweden-only Checkout summary now derives current Cart subtotal, zero
production discount, current selected PostNord charge, included 25% VAT, and
grand total from server state. Derived totals are not persisted in drafts;
coupons, inventory, payment, Orders, and invoices remain out of scope.
Focused domain/regression checks, guest and authenticated Browser E2E, isolated
TypeScript, and isolated Webpack production build passed. **CLOSED /
CHECKPOINTED AND PUSHED at `ce13df789cda5b1938bfbe9994f16eacbd78c0a1`.**

## Stage 7.3 current status

Stage 7.3 — Shipping Methods / Delivery Selection is complete and ready for
checkpoint from official baseline `e9119bbaa4d275dcc203f2fbb49514ae5c220d54`. Owner policy permits only
Sweden (`SE`), `SEK`, and PostNord at `5900` minor units below `69900`, then
free shipping. No delivery estimate is promised. PostNord operational contract
and perfume dangerous-goods acceptance remain **NOT YET VERIFIED** and are
required before production shipping go-live. Authenticated and guest Browser
E2E passed; focused domain/Mongo/fixture/capability checks passed 7/7; fixture
cleanup, isolated TypeScript, and isolated Webpack production build passed.

## Stage 7.2 current status

Stage 7.2 — Contact & Shipping Address is closed and pushed in baseline
`653cd9da4cb21fd34336b21d67ef9574e1a5e3eb`.
The implementation adds
an owner-bound Mongo checkout draft, strict normalized email/address parsing,
and a server-first contact/address form behind the existing Stage 7.1
eligibility gate. Draft lookups and revision-guarded saves resolve the owner
from the Auth.js session or existing guest Cart cookie; no browser owner ID,
price, or total is accepted. Draft data is checkout-scoped and expires after
30 days. No phone requirement or supported-country allowlist is assumed.

Scope excludes Stage 7.3+, shipping methods/rates, tax, discounts, inventory
reservation, billing/saved account addresses, payment providers, payment
attempts, webhooks, Orders, and order email. Domain/checkout regressions passed
31/31; dedicated Mongo draft verification passed against `athar_stage55_test`
with fixture-cleanup assertions. Isolated baseline and Stage-7.2-only production
builds passed, full ESLint has zero errors with one existing auth-form warning,
and the 2/2 guest/authenticated Browser E2E suite passed after secrets were
rotated locally and the test server restarted. Fixture cleanup, no-secret Git
audit, and `git diff --check` passed. The current-tree TypeScript check still
reports the unrelated owner-local catalog `audience` type error; the official
baseline and isolated Stage-7.2-only TypeScript/build checks pass. No commit or
push was made at the Stage 7.2 checkpoint; Stage 7.3 now owns delivery selection.

## Stage 7.1 current status

Official Phase 7 baseline: `5c4ec8139a358568509bd1fffb6041d2925ac0e8`.
Stage 7.1 is **COMPLETE LOCALLY — CHECKOUT DOMAIN & SERVER-AUTHORITATIVE
FOUNDATION**. It adds a read-only checkout projection and server-first
`/checkout` review route over the current session/guest-owner Cart and canonical
catalog. Domain tests passed 6/6; dedicated-test-Mongo Browser E2E passed 2/2,
including guest stale-line/current-price review, authenticated owner isolation,
and disposable-fixture cleanup assertions. Phase 5/6 unit regressions passed
42 with one separately gated Mongo transaction test skipped. TypeScript passed;
full ESLint had zero errors and one existing `SignInForm.tsx` warning;
`git diff --check` passed. Clean-baseline and baseline + Stage-7.1-only
production builds passed. Agent Browser verified the empty-Cart state without
browser errors. No checkout draft, collection, index, payment, or Order was
added. Stage 7.2–7.6 remain not started. No commit or push was made.

## Stage 6.6 integration status

Baseline: `34fc73b0f69a1c04670840bfbe3c782e8a7f6c0e`.

Stage 6.6 closed locally from baseline `34fc73b0f69a1c04670840bfbe3c782e8a7f6c0e`.
Phase 6/Phase 5 domain, auth, and dedicated-Mongo regression tests passed
40/40; Browser E2E passed 8/8 across registration, profile read/update,
guest-to-account Cart/Wishlist merge and ownership, repeated sign-in, and
password reset with prior-session invalidation. Post-run audit confirmed zero
disposable users, credentials, reset tokens, user-owned commerce fixtures,
merge markers, and targeted guest fixtures in `athar_stage55_test`. Full
TypeScript passed; full ESLint had zero errors and one existing
`SignInForm.tsx` warning. Isolated clean-baseline production build passed.
Stage 6.6 added no production/runtime source changes, so its production source
set matches that baseline. Current Owner/local-source build remains blocked at
`/_not-found` by preserved Header/Wishlist request-time data reads; no Owner
code was changed. Live Brevo delivery is **NOT YET VERIFIED** and live
production Atlas is **NOT VERIFIED**. No commit or push was made. Stage 7 has
not started.

## Stage 6.5 current status

Stage 6.5 is **COMPLETE LOCALLY — ACCOUNT SECURITY & PASSWORD RECOVERY** from baseline
`87b9993d9d0a6bb76d6eb88b3909f90591750ff0`. Added forgot/reset interfaces,
generic forgot responses, a server-only Brevo mail adapter, hash-only expiring
reset-token persistence, unique/TTL index contract, transactional password
update/token consumption, and Auth.js session invalidation using a private
credential security version. A secret-protected, non-production-only in-memory
test-mail adapter supports reset-link capture; production always selects Brevo.
The live Stage 6.5 Mongo integration passed 5/5, including index verification,
concurrent one-time token use, credential update, security-version increment,
and fixture cleanup. Earlier TLS failures followed a switch from mobile hotspot
to hotel Wi-Fi while the active IP was absent from Atlas IP Access List. After
addressing the active network IP, the owner reported two consecutive
`MONGO_PING: PASS` results on hotel Wi-Fi. The final Browser E2E passed the
protected test-mail reset flow, old-password rejection/new-password acceptance,
prior-session invalidation, reused-token rejection, and generic unknown/disabled
account behavior. The confirmed cause of earlier missing mail was a route input
shape mismatch; it is fixed and covered by a focused regression. The post-E2E
cleanup audit found zero disposable Stage 6.5 users, credentials, or reset
tokens in the dedicated test DB.
No live Brevo email was sent. Isolated build attribution passes
for clean baseline `87b9993` and baseline + Stage-6.5-only; current-tree build
fails at `/_not-found` because preserved Owner Header/Wishlist code reads the
cookie-backed current wishlist outside Suspense. Brevo delivery is not verified
and does not block closure by itself. Prior-stage focused regression passed
36 domain/auth tests passed with one live transaction case skipped from that
batch and run separately; Stage 6.5 focused tests passed 8/8, and live Mongo
regressions for Stages 6.1, 6.2, and 6.4 each passed. Clean baseline and
Stage-6.5-only production builds passed after the route fix. Full TypeScript and
full ESLint passed; ESLint retains one warning in `SignInForm.tsx`. Current-tree
build remains attributed to preserved Owner Header/Wishlist runtime access,
outside Stage 6.5. Live Brevo delivery is **NOT YET VERIFIED** and is not a
closure blocker. Stage 6.6 had not started at the time of the Stage 6.5
checkpoint record; the current Phase 6 closure status is recorded above. No
commit or push was made for this Stage 6.6 verification.

Historical TLS path isolation: explicit SNI and no-SNI Node TLS probes failed identically
for all three Atlas hosts under TLS 1.2 and TLS 1.3 before any peer
certificate arrives. Node is v24.19.0 with OpenSSL 3.5.7; the MongoDB Node
driver is 7.6.0 and its ping fails with the same alert. `mongosh` and OpenSSL
CLI are absent. No proxy environment variables, WinINET/WinHTTP proxy, VPN, or
custom CA override were detected; Defender status could not be read. Atlas
control-plane MCP access is disabled for the organization, so Atlas state was
not independently inspected. The owner supplied a screen showing the active
network IP was not listed and only `84.219.76.1/32` active. The owner later
reported two successful pings after switching to hotel Wi-Fi and addressing
the IP Access List. No URI or TLS settings were changed.

## Stage 6.1 planning boundary

Stage 6.1 now has its local Customer Identity & Account Foundation implemented
and verified against the dedicated non-production Mongo database.
The approved decisions are email/password only, Auth.js
with future Credentials, no OAuth/social login, no Clerk, Brevo for future
transactional email, no required email verification, and password reset later.
The public opaque User ID, normalized unique email, strict User repository/index/
parser boundary, and `CommerceOwner` user identity contract were established.
This is a historical Stage 6.1 closure record; later stage status is recorded
in the current Stage 6.5 section above.

The Stage 6.1 baseline is `1cc405bf77e44777cae20b1e2998bfbdf5366bcd`. Local
domain/parser/service tests, real Mongo CRUD/index/concurrency checks,
TypeScript, full ESLint, production build, and `git diff --check` pass. Stage
6.2 is not started.

## Stage 6.2 implementation boundary

Stage 6.2 closed locally from baseline
`2a2706429d0ad5231edf903c4d9aff8fdec85df5`. Auth.js Credentials runtime,
email/password registration, sign-in, sign-out handlers, Argon2id hashing,
separate `user_credentials` persistence, disabled-user rejection, generic
duplicate-email errors, and public-`userId` JWT sessions are in scope. OAuth,
Clerk, magic links, email verification, password reset, Brevo sending,
guest-to-account merge, and Stage 6.3 were outside that stage's scope. Live
production Atlas Auth persistence was not verified at that closure.

## Current project state

- ATHAR is a Next.js 16.3 App Router application with a server-first Phase 3 catalog and a locally complete Phase 4 Product Detail flow.
- Stage 5.1 provides the Cart/Wishlist domain foundation. Stages 5.2–5.3 provide PDP Add-to-bag, `/cart`, line management, current-price subtotals, and a safe Header count through an ephemeral development/test guest Cart. Stage 5.4 activates a Product-level guest Wishlist across PDP, Gallery, Shop, Header, and `/wishlist`.
- Durable Cart/Wishlist adapters are verified against the dedicated non-production Mongo database `athar_stage55_test` behind explicit Mongo selection. Checkout, payment, Orders, inventory reservation, and Auth remain outside scope.
- Stage 5.6 integration closure is complete locally: full fixture and production regressions are green, Agent Browser commerce flow is green, Axe has zero violations (with documented manual-review incompletes), and the final security/privacy/cache boundaries are preserved.
- The original static prototype and local assets are preserved as historical visual reference material; they are not the current application architecture.

### Stage 4.3 closure boundary (2026-09-20)

- Product variant selection is domain/read-model backed: stable public variant IDs, deterministic ordering, initial available-size selection, price/compare-at display, and availability labels are implemented and covered by fixture tests.
- The existing PDP quantity, Add to bag, Wishlist, and Shop-card bag/Wishlist controls are preserved as owner-designed visual boundaries. They are disabled/non-persistent previews; no cart, wishlist, cookie, localStorage, or mutation request was added.
- Related fragrances remain catalog-backed merchandising. Product gallery media remains independent from variant selection and no URL variant parameter was introduced.
- The live Atlas adapter and licensed production media are intentionally not claimed as verified in this stage.

### Stage 4.4 audit boundary (2026-09-20)

- Existing Product content is preserved and audited through the public PDP DTO. Descriptions, family, audience, structured notes, variants, brand, media, and Related fragrances remain domain-backed.
- Family and audience are display-mapped only; empty note groups are omitted. Ingredients and concentration remain pending canonical data and are not fabricated.
- Unsupported static operational/authenticity/gifting wording was neutralized without removing the visual service layout. Commerce controls remain disabled and non-persistent.

### Stage 4.5 audit boundary (complete)

- Related fragrances are preserved as catalog-backed merchandising using the shared ProductCard.
- The server-side related read now applies public eligibility, current-product exclusion, deterministic family/audience/Brand/collection scoring, stable tie-breakers, deduplication, and a four-item bound.
- No recommendation engine, personalization, tracking, or cross-sell commerce was introduced.
- Fixture verification: 59 passed, 6 skipped, 0 failed in the full Playwright suite; the focused Stage 4.5/PDP/gallery/content set passed with one isolated 30-second navigation timeout rerunning green.
- Production isolation: 3 passed against the fresh production build; unavailable production reads may return the framework's 200 unavailable shell or 404, but never fictional product or Related content.
- TypeScript, ESLint, Turbopack production build, catalog seed dry-run, runtime compilation/error checks, responsive overflow, and accessibility checks are green within the documented environment limits.

### Stage 4.6 closure boundary (complete locally)

- Phase 4 architecture was audited and preserved: server-first PDP route, public DTO, canonical repositories/fixtures, ProductGallery and ProductVariantSelector client islands, and server-rendered Product content plus Related ProductCards.
- No new commerce, recommendation, authentication, CMS, upload, structured-data, or Phase 5 feature was introduced.
- Production fixture isolation, unavailable/not-found distinction, canonical metadata, responsive PDP/Shop behavior, security/privacy boundaries, and future-commerce UI classification were re-verified.
- Live Atlas Product Detail, media, variant, content, and Related reads remain unverified; owner production catalog/media/business-policy decisions remain pending.

### Stage 5.1 commerce-foundation boundary (historical closure)

- Existing owner commerce-looking UI was inventoried and preserved. PDP purchase controls remain disabled UI-only; gallery and ProductCard hearts/bags remain local presentation-only controls; Header affordances remain static.
- Cart domain lines use canonical Product slug plus public Variant ID and bounded integer quantity; Wishlist is Product-level. Both resolve public Product/Variant eligibility and current integer-minor-unit price through a server-only adapter.
- No persistence, cookie, localStorage, server action, API route, Cart page, Checkout, payment, Order, reservation, or inventory mutation was added. Live Atlas Cart/Wishlist persistence remains not yet verified.

### Stage 5.2 PDP guest-cart boundary (complete locally)

- PDP Quantity and Add to bag now submit only public Product/Variant identity plus a bounded integer quantity through a Next Server Action. The server re-resolves public eligibility and current integer-minor price before mutating a Cart.
- Development/test uses an explicitly ephemeral server-memory guest Cart keyed by an opaque, httpOnly session cookie. It is not durable and intentionally has no production memory fallback.
- ProductGallery, ProductCard bag/hearts, Header counter, and Wishlist persistence remain outside this activation. No Cart route/drawer, Checkout, payment, Order, account merge, inventory reservation, or Atlas Cart read/write was added or claimed.

### Stage 5.3 Cart-management boundary (complete locally)

- `/cart` re-resolves current public Product/Variant data server-side and shows only safe public Cart DTO fields. Valid canonical lines use current integer-minor prices; stale/unavailable lines are excluded from Subtotal and can be removed.
- Quantity updates and removals use existing Server Actions and canonical line identity. Header bag navigation targets `/cart`; its count is total line quantity, not distinct-line count.
- The narrow Header count leaf keeps the root layout free of direct cookie reads, preserving Cache Components/Partial Prefetching architecture. It is visual synchronization from safe action results, not a second Cart source of truth.
- Durable production Cart persistence, live Atlas Cart reads/writes, Wishlist persistence, ProductCard Add-to-bag, Cart drawer, Checkout, payment, Orders, account merge, and inventory reservation remain deferred.

### Stage 5.4 Guest Wishlist boundary (complete locally)

- PDP, Gallery, Shop/ProductCard, and `/wishlist` share an opaque httpOnly guest Wishlist cookie and canonical Product-level Server Action. Client hearts mirror action results and synchronize across surfaces without owning Wishlist truth.
- `/wishlist` is intentionally request-time and declares `instant = false` for the Next.js 16 Cache Components contract. Removal uses `router.refresh()` plus a fresh server read; the control gate passed 3/3 without `revalidatePath`.
- Focused flow, five responsive hit-target sizes, full fixture regression (66 passed / 8 skipped), production isolation (42 passed / 32 skipped), typecheck, lint, dry-run seed, production build, Agent Browser flow, and Axe (0 violations / 0 incomplete) are green locally.
- Durable/live Atlas Wishlist reads and writes and account merging remain outside Stage 5.4; Stage 5.5 now owns the persistence work.

### Stage 5.5 Durable persistence boundary (complete locally)

- Added `CommerceOwner` (`guest | user`) and Mongo-backed Cart/Wishlist stores while preserving every existing Cart/Wishlist UI surface and server-authoritative catalog validation.
- Durable records persist only canonical identity/quantity (Cart) or Product slugs (Wishlist), owner identity, revision, timestamps, and 30-day expiry. Unique owner and TTL indexes are explicit through `ensureCommerceIndexes()`.
- Mongo selection is explicit via `ATHAR_COMMERCE_PERSISTENCE=mongo`; production has no memory fallback. Existing independent guest cookies remain unchanged and now receive a 30-day lifetime when issued.
- Parser tests, TypeScript, ESLint, Mongo Cart/Wishlist CRUD, guest isolation, CAS/revision concurrency, max quantity 12 concurrency, TTL expiry/replacement, server-authoritative reconciliation, controlled failure handling, and separate-process restart persistence are green against `athar_stage55_test`.
- Commerce unique-owner and TTL indexes are present; full fixture Playwright passes 66/66 executed (8 skipped), production isolation passes 42/42 (32 skipped), production build passes, Agent Browser/Axe reports 0 violations and 0 incomplete, seed dry-run and `git diff --check` pass. Stage 5.6 has not started.

### Stage 5.6 Final integration boundary (complete locally)

- Cart/Wishlist cross-surface flows, responsive coverage at 360/430/768/1280/1600, Cache Components/`instant()` behavior, production no-memory-fallback, and Phase 3/4/5 regressions are closed locally.
- Dedicated test Mongo remains the only durable verification target. Live production Atlas reads/writes, account merge, Auth, Checkout, payment, Orders, inventory reservation, and Stage 6 remain unstarted.

## Historical Phase 0 baseline

- At the Phase 0 audit, the repository was a static HTML/CSS/vanilla-JavaScript homepage prototype.
- Entry point: `index.html`.
- Styling is split across `styles.css`, `hero-details.css`, `sections.css`, `index-overrides.css`, and `responsive-rebuild.css`.
- Assets are local PNG/JPG files in the repository root and `assets/`.
- Google Fonts are loaded externally: Cormorant Garamond, DM Sans, and Playfair Display.
- This baseline predates the current Next.js 16.3 App Router, catalog, PDP, and Stage 5 implementation.
- `next.config.ts` enables Cache Components and Partial Prefetching. The production testing API is conditionally enabled only for local test builds through `EXPOSE_TESTING_API=1`.
- Stage 4.1 adds the server-rendered `/products/[slug]` foundation through the same server-only catalog read model. Development/test uses fictional fixtures; production without configured data renders an unavailable state rather than fake catalog content.
- No missing local asset reference was found from the current `index.html` scan.

## Historical baseline evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Repository inventory | Pass | Static entry point, five stylesheets, local imagery, and a standalone banner experiment identified. |
| Git history | Pass | Historical audit snapshot: local and remote `master` pointed to owner checkpoint `68500a7` at that time. This is not a current Git-state claim. |
| Local asset reference scan | Pass | No unresolved local `src`/`href` reference from `index.html`. |
| TypeScript | Pass | `npm run typecheck` completed with zero errors. |
| Repository-wide lint | Pass | `npm run lint` completes with zero findings after obsolete root screenshot scripts were removed. |
| Production build | Pass | Next.js 16.3.0-preview.10 built via Turbopack with Cache Components and Partial Prefetching enabled. |
| Browser/runtime verification | Pass | Agent Browser and `/_next/mcp` verified the public route, React runtime, route map, and zero compile/runtime errors. |
| Production navigation rig | Pass | Playwright's public homepage check and `instant()` smoke check both passed against the freshly built local artifact on port 3100. |

## Historical pre-App-Router implementation snapshot

At the initial audit, the prototype contained a static hero, header/navigation, mobile menu, fragrance-note rail, collection cards, a bestsellers visual with hotspots, editorial story/banner content, fragrance-guide cards, footer, and small vanilla-JS menu/scroll controls. The then-unimplemented interaction statement is historical and superseded by the catalog, PDP, and limited Stage 5.2 PDP Add-to-bag implementation above.

## Current implementation

- `src/app` contains the Next.js App Router homepage, catalog routes, Brand/collection browsing, and server-rendered Product Detail routes.
- `src/styles` contains only global, token, typography, and animation layers; bespoke homepage styling is owned by component CSS Modules.
- Phase 1 added tokenized colour, spacing, layout, type, radius, elevation, and motion foundations; Next.js self-hosted Cormorant Garamond and DM Sans; and six reusable UI primitives under `src/components/ui`.
- The public catalog, PDP read model, gallery, variant selection, Product content, Related merchandising, and the bounded PDP guest-Cart Add-to-bag flow are implemented locally on their documented server/client boundaries.
- `playwright.config.ts`, `tests/home-shell.spec.ts`, `tests/STAGE-05.2.spec.ts`, and `instant-nav.rig.md` establish the reusable local verification rig.
- `.gitignore` excludes generated build, test, and TypeScript output.
- The existing static prototype and its assets remain preserved as visual reference material.

## Current follow-up items

1. Select and implement durable production Cart storage before making any production Cart readiness claim.
2. Confirm production licensing for the reused Hero imagery and third-party brand/product references before any production launch.
3. Provide a least-privilege development/test MongoDB Atlas URI and final database name for non-destructive catalog and future Cart/Wishlist integration verification.
4. Define Wishlist persistence, Cart presentation, Checkout, payment, Order, and inventory-reservation stages before activating those surfaces.
5. `npm audit` reports two dependency vulnerabilities. They are not remediated automatically because an audit fix may change the dependency graph; address them in the dependency-security stage.

## Historical stage records

The records below preserve earlier-stage evidence. Statements such as “has not begun,” old test counts, and old UI boundaries describe their respective historical checkpoints, not the current Stage 5.2 state.

## Stage 2.2 status

- `Collections` is a dedicated server-rendered production component directly after the Hero.
- It uses typed local presentation data and the prototype's four maintainable organic SVG silhouettes.
- Catalog destinations remain documented fragment placeholders; no product, catalog, or database work was introduced.
- Stage 2.2 verification: typecheck, lint, production build, 8 Playwright checks (including `instant()`), responsive overflow coverage, live browser review, and the Next runtime check all pass.
- **IMPLEMENTED — OWNER VISUAL APPROVAL REQUIRED.** Stage 2.3 has not begun.

## Stage 2.3 status

- `Bestsellers` is a dedicated server-rendered component directly after `Collections`, with a typed local prototype-presentation array rather than a Product/Catalog schema.
- It reuses `public/images/home/bestsellers-stage.png`, whose product bottles and pedestal/base presentation are part of the approved prototype composite. Product routes and wishlist behavior remain deferred; fragment links are explicitly temporary.
- Prototype price labels, visual product references, and third-party trademarks are development-only presentation content pending licensing and owner approval.
- Verification: typecheck and build pass; the edited TypeScript files pass ESLint directly; all 9 Playwright checks pass against an isolated fresh production server, including `instant()` and five viewport overflow checks. The full repository lint command is blocked solely by three pre-existing untracked CommonJS test scripts in the root and was left untouched.
- **IMPLEMENTED — OWNER VISUAL APPROVAL REQUIRED.** Stage 2.4 has not begun.

## Stage 2.4 status

- `Story` is a dedicated server-rendered component following `Bestsellers`. It retains the source prototype’s asymmetric ribbon, portrait/quote, editorial narrative, landscape, and value treatment.
- Prototype story copy and visual value labels are preserved as design/presentation content only. No factual ATHAR history, sourcing, business, delivery, or product claim was added or verified.
- The CTA remains a documented `#story` placeholder; no About page, Journal, CMS, database, or editorial functionality was introduced.
- Verification: typecheck, Stage 2.4 changed-file lint, production build, Next runtime inspection, and all 10 Playwright checks (including `instant()` and responsive overflow coverage) pass.
- Repository-wide lint remains **FAIL** only because of the same three pre-existing untracked root CommonJS scripts: `test_bottle_size.js`, `test_final_bottle.js`, and `test_nojump.js`.
- **IMPLEMENTED — OWNER VISUAL APPROVAL REQUIRED.** Stage 2.5 has not begun.

## Stage 2.5 status

- `FragranceGuide` is a dedicated server-rendered component after `Story`; `HomeSections` now retains only the legacy Footer.
- It preserves the prototype's local Floral, Woody, Fresh, and Oriental presentation cards, introductory editorial panel, imagery, and deferred `#guide` links. No catalog taxonomy, filter, or route was introduced.
- Guide imagery and copy remain **PROTOTYPE / DEVELOPMENT-ONLY — LICENSE VERIFICATION REQUIRED**.
- Verification: typecheck, Stage 2.5 changed-file lint, production build, Next runtime inspection, and the full Playwright suite pass. Repository-wide lint remains **FAIL** only for `test_bottle_size.js`, `test_final_bottle.js`, and `test_nojump.js`, each triggering `@typescript-eslint/no-require-imports`.
- **IMPLEMENTED — OWNER VISUAL APPROVAL REQUIRED.** Stage 2.6 has not begun.

## Stage 2.6 status

- `src/components/layout/Footer/` is the final server-rendered homepage component. It preserves the prototype brand, section links, deferred Boutiques/Contact text, copyright, and closing line.
- `HomeSections` and `legacy-home-sections.css` were removed because they had no valid remaining production responsibility. No original static prototype/reference files were removed.
- Final integration also corrected accessibility defects in the existing Hero notes rail: valid definition-list grouping, keyboard access for an intentional nested scroller, and labelled groups for static action/value clusters.
- The homepage order is Header → Hero → Collections → Bestsellers → Story → Fragrance Guide → Footer, with one `main` landmark and no page-level overflow across 360, 430, 768, 1280, and 1600px.
- Prototype imagery, story/value copy, product brands/prices, performance copy, bestsellers/new-arrivals language, and Guide imagery remain **PROTOTYPE / DEVELOPMENT-ONLY — LICENSE VERIFICATION REQUIRED**.
- **PHASE 2 — COMPLETE. OWNER FULL-HOMEPAGE VISUAL APPROVAL REQUIRED.** Phase 3 has not begun.

## Stage 3.1 status

- `src/server/env.ts` validates `MONGODB_URI` and `MONGODB_DB_NAME` only when a database operation is requested; no secret is bundled into client code.
- `src/server/db/` owns a reused MongoDB client, named collections, and controlled idempotent index definitions. `src/server/catalog/` owns canonical domain types, schemas, persistence mapping, repositories, and public-read services.
- Products have a lifecycle (`draft`, `active`, `archived`), normalized unique slugs, integer minor-unit variant prices, explicit currency, structured notes, extensible fragrance-family keys, provider-reference media, and variant-level inventory foundations. Brand and Collection records have separate IDs, unique slugs, lifecycle, timestamps, and optional media.
- Public read methods return active records only. No public route handler exists yet, no prototype visual content is canonical data, and no catalog seed, Shop, Product Detail, Admin, or Phase 4 work has begun.
- Focused Playwright catalog-domain tests use `ATHAR Test No. 01` fictional fixtures only. Atlas connectivity remains **NOT YET VERIFIED** until safe owner-provided development/test configuration is tested.

## Stage 3.2 status

- A development-only bootstrap pipeline now separates fictional fixture data, validation, plan/conflict detection, dry-run reporting, and guarded write execution.
- The dataset contains only fictional ATHAR Test / Study records. It covers active, draft, and archived lifecycle states; different audiences/families; structured notes; one and multiple variants; positive and zero stock; inactive variants; multi-media; and a valid comparison price. No homepage prototype commercial content is canonical data.
- Fixture relationships are authored with readable seed keys and resolved to actual canonical Brand/Collection IDs only at write time. Identical reruns are unchanged; fixture changes update seed-owned fields; non-seed or differently owned matching slugs fail before writes. No seed operation deletes data.
- `npm run catalog:seed:dry` works without Atlas credentials and prints a no-write summary. `npm run catalog:seed` requires a non-production environment, valid MongoDB configuration, and `CATALOG_SEED_ALLOW_WRITE=1`.
- **STAGE 3.2 IMPLEMENTED — LIVE DATABASE EXECUTION NOT YET VERIFIED.** No database write has been performed.

## Stage 3.3 status

- Added public Server Component catalog browsing at `/shop`, `/shop/women`, `/shop/men`, `/shop/unisex`, and `/collections/[slug]`, including active-only results, validated params, accessible empty/unavailable states, and no Product Detail route.
- Catalog cards consume a narrow public read model that formats integer minor-unit prices and does not expose persistence IDs, variants, inventory, lifecycle, or seed metadata. Placeholder media remains deliberate until canonical assets are approved.
- Development/test browsing uses only fictional Stage 3.2 fixtures. Production does not fall back to them: unavailable configuration/read failures render a safe unavailable state. No Atlas read or write has occurred.
- Homepage Shop and supported audience collection links now target real routes; New Arrivals and unsupported destinations remain deferred. The Hero, navbar styling, responsive Hero ranges, and below-Hero visual style were not changed.
- **STAGE 3.3 IMPLEMENTED — LIVE ATLAS READ/WRITE NOT YET VERIFIED.**

## Stage 3.4 status

- Added server-rendered `/brands` and `/brands/[slug]` pages on the existing catalog service/repository boundary. Brand cards are narrow public DTOs; Brand pages reuse the existing ProductCard and CatalogGrid for active public products.
- Public visibility includes active Brands only. Draft/archived/missing or malformed Brand slugs render not-found when the data source is available; a valid active Brand with zero eligible products renders an accessible empty state.
- Development/test uses only fictional Stage 3.2 Brands, including an active empty fixture Brand. Production without configured/readable canonical data renders a safe unavailable state and never reveals fixture Brands. **LIVE ATLAS BRAND READS — NOT YET VERIFIED.**
- No Product Detail, search, filtering, sorting, pagination, cart, wishlist, Admin, third-party logos/media, or commercial prototype Brand data was added. Brand membership does not claim retailer, partner, distributor, or authorization status.
- **STAGE 3.4 IMPLEMENTED LOCALLY — OWNER APPROVAL PENDING.**

## Stage 3.5 status

- `/shop` now has server-rendered GET discovery controls backed by one Zod-validated query model: bounded `q`, public audience/Brand/family/collection filters, and name/lowest-active-price sorting. The URL is the source of truth; ProductCard and CatalogGrid remain shared.
- Route scope is authoritative: audience and collection paths inject their fixed scope and URL values cannot escape it. Valid zero matches use a distinct resettable empty state; unavailable production data remains unavailable and never exposes fixtures.
- Query matching is a bounded portable literal substring operation over public fields only; raw Mongo operators and regex execution are not accepted. Price range and pagination are deferred as disproportionate to the current bounded listing.
- Query URLs use `noindex, follow` plus canonical browse metadata. **LIVE ATLAS SEARCH/FILTER/SORT QUERIES — NOT YET VERIFIED.**
- **STAGE 3.5 IMPLEMENTED LOCALLY — OWNER APPROVAL PENDING.**

## Stage 6.3 status

- Baseline: `3e7840d4ae9d7f8b747f2672c735efeba83be7b4`.
- A protected `/account` shell reads canonical User data from the server
  Auth.js session and repository boundary; unauthenticated requests redirect
  to Sign-in.
- Profile editing is limited to a trimmed, validated `displayName`. Email is
  read-only. The browser never supplies the owning `userId`.
- Mongo `_id`, credentials, and `passwordHash` remain outside public DTOs.
- Stage 6.4 reconciliation, addresses, orders, password changes, and email
  changes are not started. Live production Atlas verification is not claimed.
- Stage 6.3 focused/domain and Browser E2E checks pass. Build attribution is
  conclusive: the clean `3e7840d` baseline and a Stage-6.3-only worktree both
  pass production build. The current-tree build is blocked only by the
  preserved Owner Header/Wishlist change reading cookies in the shared Header
  during `/_not-found` prerender; this external Owner blocker does not prevent
  Stage 6.3 closure.
- **STAGE 6.3 COMPLETE — CUSTOMER ACCOUNT SHELL & PROFILE.**

## Stage 6.4 status

- Baseline: `2851f06308c82c6eeeb25f12154f92fd82a7ac00`.
- Server-only reconciliation now targets the authenticated public `userId`
  owner. Cart merges by `productSlug + variantId`, caps each line at 12, and
  re-resolves canonical availability; Wishlist merges a deduplicated union.
- A durable merge marker prevents repeated callbacks from duplicating state;
  guest records are cleared only after both merge and reconciliation succeed.
- Pure reconciliation, real Mongo, and Browser E2E registration verification
  pass against `athar_stage55_test`; existing-account Browser E2E proves
  authenticated Cart/Wishlist owner resolution, merge cleanup, and repeated
  sign-in idempotency. TypeScript and ESLint pass. **STAGE 6.4 COMPLETE —
  GUEST-TO-ACCOUNT COMMERCE RECONCILIATION.** Clean baseline and
  Stage-6.4-only production builds pass; only the current-tree build is blocked
  at `/_not-found` by the preserved Owner Header/Wishlist dynamic-cookie
  change, outside Stage 6.4. Stage 6.5 had not started at the time of that
  checkpoint; its current status is listed at the top of this document.
