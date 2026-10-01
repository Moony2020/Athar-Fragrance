# Testing

## Current tooling

- TypeScript: `npm run typecheck`
- Repository-wide ESLint: `npm run lint`
- Production build: `npm run build`
- Browser regression and `instant()` navigation rig: `npm run test:instant`

## Stage verification records

Every implementation stage must add a dedicated, versioned verification record in `tests/` named `STAGE-XX.X.md`. The record must state the exact commands used (including `npm run` commands and any required local environment variables), what each command verifies, the expected result, the recorded pass/skip count, and any intentional separation between development fixtures and production. The current records include [Stage 3.6 Catalog Integration & QA](../tests/STAGE-03.6.md) and Stage 4.1 Product Detail (added with its final verification evidence).

The Playwright suite includes homepage visual/semantic regression coverage and Stage 3.1 catalog-domain tests. Catalog tests use clearly fictional `ATHAR Test No. 01` data and verify normalization/defaults, money and variant constraints, slug/identifier separation, and database-document mapping. They never contact Atlas.

Stage 3.2 adds seed-pipeline tests for fictional fixture validation, reference resolution, cross-product SKU uniqueness, dry-run summaries, deterministic idempotent plans, changed-fixture updates, conflict detection, and public lifecycle eligibility. The seed command's dry-run is also run without database credentials to prove it makes no write or connectivity claim.

Stage 3.3 adds browser coverage for Shop, validated audience and collection routes, active-only fixture visibility, empty states, homepage catalog links, not-found responses, and responsive page overflow. Fixture assertions run against the development runtime (`CATALOG_FIXTURE_RUNTIME=1` selects them in Playwright); the local production suite instead proves missing database configuration renders the explicit unavailable state and never exposes fixture products.

Stage 3.4 adds the same separated evidence for `/brands` and `/brands/[slug]`: active-only fictional Brand discovery, semantic Brand links, products-by-Brand through the existing product grid, non-public/malformed Brand not-found behavior, active empty Brand state, responsive overflow, and safe production unavailability without fixture leakage.

Stage 4.1 adds development-fixture PDP coverage for name, Brand link, shared lowest-active-price presentation, active public variants, family/structured notes, ProductCard navigation, and non-public/malformed Product routes. Its production-style assertion proves a fictional PDP is never shown when canonical access is unavailable.

Stage 4.2 adds fixture coverage for deterministic ordered multi-media selection, button/keyboard selected state, single-media restraint, zero-media placeholders, viewport overflow, and production media isolation. It also exercises equal media positions at the read-model boundary.

Stage 4.3 adds fixture coverage for deterministic initial variant selection, stable public IDs, price/compare-at and availability rendering, disabled unavailable sizes, keyboard semantics, canonical PDP links, responsive overflow, and the preserved disabled purchase-control boundary. The closing gate also records production build, TypeScript, ESLint, catalog seed dry-run, full Playwright, instant/Turbopack, runtime diagnostics, and Axe checks; live Atlas Product reads remain unverified.

The reconciled full fixture regression completed at **54 passed, 5 skipped, 0 failed**. Production fixture-isolation checks completed at **2 passed, 0 failed**. The `instant()` homepage smoke test passed in isolation and remains part of the suite.

Stage 4.4 adds focused coverage for canonical descriptions, family/audience display mapping, structured notes and empty-group handling, absence of fabricated ingredients/concentration, neutral service wording, Related fragrances, and inert future-commerce controls.

After the Stage 4.4 changes, the complete fixture regression completed at **57 passed, 5 skipped, 0 failed** (62 tests total). The isolated catalog-discovery timeout was rerun successfully; no implementation regression was found.

Stage 4.5 adds focused coverage for Related eligibility, current-product exclusion, duplicate protection, deterministic ordering, four-item bounding, canonical PDP links, responsive ProductCard reuse, and production fixture isolation.

Stage 5.1 adds pure domain coverage for canonical Cart-line merging, bounded integer quantity validation, unavailable/private Product and Variant rejection, canonical integer-minor price subtotal resolution, and Product-level Wishlist deduplication. Browser coverage confirms that the preserved PDP controls remain disabled and that ProductCard local affordances do not make commerce mutations.

Stage 5.2 adds pure guest-Cart service coverage for canonical merge/separate-variant behavior, integer-minor subtotals, price tampering, unavailable/private catalog targets, and explicit production-adapter absence. Browser coverage exercises bounded PDP Quantity, Add-to-bag, cookie attributes, selected available Variant use, blocked unavailable Variant behavior, and unchanged gallery/Wishlist boundaries. Its full regression record separates fixture development from production isolation and retains `instant()`, Turbopack, and Axe verification.

Stage 5.3 adds Cart page coverage for empty state, PDP-to-Header-to-Cart continuity, canonical product link/subtotal presentation, bounded quantity mutation, removal, and count updates. Pure coverage retains canonical identity and stale-line removal semantics. Production coverage confirms no fictional Cart data or development-memory persistence is claimed.

Stage 5.4 adds a real guest Wishlist flow: PDP/Gallery synchronization, Shop save, `/wishlist` server read, normal removal, immediate empty state, and fresh-navigation empty state. The focused flow passed 3 consecutive runs with no `revalidatePath` dependency; responsive hit-target checks passed at 360/430/768/1280/1600px. Full fixture regression passed 66/66 executed tests (8 skipped), production isolation passed 42/42 (32 skipped), and Axe reported 0 violations / 0 incomplete. Live Atlas and durable persistence are not covered.

Stage 5.5 is closed locally against the dedicated non-production `athar_stage55_test` database. Parser/owner tests pass 7/7; commerce domain/service tests pass 17/17; Mongo control covers Cart/Wishlist write-read-parse, guest isolation, CAS/revision and max-quantity-12 concurrency, TTL expiry/replacement, server-authoritative price/stale reconciliation, controlled failure handling, and separate-process restart persistence. Commerce indexes are verified. Full fixture Playwright passes 66/66 executed (8 skipped), production isolation passes 42/42 (32 skipped), TypeScript, ESLint, production Turbopack build, catalog seed dry-run, Agent Browser, Axe (0 violations / 0 incomplete), and `git diff --check` pass.

Stage 5.6 closes Phase 5 locally through an integrated commerce flow: Cart multi-line/quantity/Header behavior, Wishlist PDP/Gallery/ProductCard/Related/Header synchronization, guest and Cart/Wishlist isolation, responsive 360/430/768/1280/1600 checks, Cache Components/`instant()` coverage, security/privacy review, full fixture and production regressions, Agent Browser interaction, and DB/index checks. Axe reports 0 violations on Cart and Wishlist; gradient/image and disabled-symbol contrast findings remain documented manual reviews. Live production Atlas Cart/Wishlist, Auth/account merge, Checkout, payment, Orders, inventory reservation, and Stage 6 remain outside scope.

## Atlas integration testing

No automated test connects to a production Atlas database. When an owner-provided development/test URI is available, a future non-destructive connectivity check may call the server connection layer and read server metadata only. It must not reset, seed, or delete an arbitrary database.

Required future evidence includes responsive visual checks, keyboard navigation, screen-reader semantics, validation failures, authorization checks, payment webhook idempotency, and checkout/order concurrency scenarios.

Stage 6.4 verification adds pure reconciliation, real Mongo concurrency/retry
coverage, and an existing-account Browser E2E: guest Cart/Wishlist merge into
the authenticated user owner, `/cart` and `/wishlist` authenticated reads,
sign-out/sign-in repeat idempotency, and guest cleanup. The current-tree build
blocker is the preserved Owner Header/Wishlist dynamic-cookie change, not a
Stage 6.4 failure.

Stage 6.5 focused tests cover strict reset-token parsing, generic account
responses, disabled accounts, token-hash-only persistence, expiry/replacement,
password policy/Argon2id replacement, one-time/concurrent consumption, and
session security-version invalidation. All 8 focused auth/Mongo tests passed
against `athar_stage55_test`. Browser E2E passed the full protected test-mail
flow, including password replacement, prior-session invalidation, replay
rejection, and generic unknown/disabled responses. The request adapter has a
regression test for passing the validated email string to the reset service.
Post-run fixture audit found zero disposable users, credentials, and reset
tokens. Live Brevo delivery is not claimed and is not required for Stage 6.5
closure. Clean baseline and Stage-6.5-only production builds passed after the
route fix; full TypeScript, full ESLint, and `git diff --check` passed.

## Stage 6.6 integration and closure (2026-09-26)

Baseline: `34fc73b0f69a1c04670840bfbe3c782e8a7f6c0e`. After resuming on the
available network, the Phase 6/Phase 5 focused regression bundle passed 40/40,
including live Mongo User/credential, merge, and password-reset transaction
tests against `athar_stage55_test`. Full Browser E2E passed 8/8 across Stages
6.2–6.6: registration, sign-in/out, profile update, guest Cart/Wishlist merge,
authenticated user ownership and repeated sign-in, two-account Cart/Wishlist
isolation, password reset, and prior-session invalidation. Cart and Wishlist
remain available after password reset.
The direct test-database audit found zero disposable test records after cleanup;
11 abandoned prior-run accounts and their dependent records were removed by
explicit test-only prefixes and rechecked to zero.

Full TypeScript passed. Full ESLint passed with zero errors and one existing
`SignInForm.tsx` warning. `git diff --check` passed. Isolated clean-baseline
production build passed; no Stage 6.6 production/runtime source changed, so the
Stage-6.6-only production source set is identical to the baseline. The current
Owner/local-source snapshot fails at `/_not-found` due preserved Header/Wishlist
request-time data access; this was not modified. Live Brevo delivery and live
production Atlas remain unverified. Stage 6.6 and Phase 6 are complete locally;
Stage 7 has not started.

The Next dev-loop preflight was also completed on an isolated port: Next MCP
listed its tools, `get_compilation_issues` returned no compile issues, and
`get_routes` listed the account/cart/wishlist routes. Agent Browser 0.38.1
rendered the Sign-in form and React tree inspection completed. MCP runtime
diagnostics surfaced only the known preserved Header/`not-found` dynamic-value
warning. The temporary server was stopped and its snapshot removed.

## Stage 7.1 focused verification

`tests/stage-07.1-domain.test.ts` passed 6/6 across empty/unavailable carts,
canonical integer-minor-unit subtotal calculation, bounded quantities, stale
and unavailable lines remaining visible but excluded from eligible subtotal,
mixed-currency blocking, and allow-listed DTO output without owner/Mongo fields.
The server route obtains data only from `readCurrentCommerceCart`; it accepts
no browser owner, Cart, price, or total payload. Browser E2E passed 2/2 using
disposable guest/user Cart fixtures only in `athar_stage55_test`; `finally`
assertions verified fixture deletion. Phase 5/6 unit regressions passed 42 with
one separately gated Mongo transaction test skipped. TypeScript, ESLint (zero
errors and one existing warning), `git diff --check`, clean-baseline production
build, and Stage-7.1-only production build passed. Agent Browser confirmed the
empty Cart and Checkout states: both use one primary `/shop` action, and the
empty Checkout no longer sends customers to the same empty Cart. Dependencies
were restored with `npm ci` from the unchanged lock file using an isolated
temporary npm cache. Next MCP reported no compilation
issues; its runtime diagnostic remained the preserved Header/`not-found`
dynamic-value issue outside Stage 7.1. Live production Atlas remains
unverified; Stage 7.2 final verification is recorded below and has passed.

## Stage 7.2 focused verification

`tests/stage-07.2-domain.test.ts` covers strict contact/address normalization,
optional fields, invalid data, owner binding, and the public DTO boundary.
`tests/stage-07.2-mongo.test.ts` is gated to the exact non-production
`athar_stage55_test` database and checks durable reload, indexes, owner
isolation, compare-and-set conflicts, expiry, and cleanup. The Playwright
coverage in `tests/STAGE-07.2.spec.ts` exercises guest/authenticated flow,
Cart recheck, email prefill without User mutation, reload persistence, and
tampered owner references. The final results are recorded below.

### Stage 7.2 final verification gate (2026-09-27 — passed)

- Domain + Stage 7.1 + Phase 5/6 domain regression: **31/31 passed**.
- Dedicated Mongo draft integration against `athar_stage55_test`: **passed**;
  index, ownership, reload persistence, CAS, expiry, and fixture cleanup checks
  completed after credential rotation and test-server restart.
- Isolated production builds: official baseline **passed**; baseline + only
  Stage 7.2 source/docs/tests **passed**, including build TypeScript.
- Full ESLint: **0 errors**, one pre-existing `SignInForm.tsx` warning.
- Full current-tree `tsc --noEmit`: **fails outside Stage 7.2** at
  `src/server/catalog/services.ts:91` (`audience` inferred as `string` rather
  than the domain union); preserve that owner-local change.
- Browser E2E: **2/2 passed** — guest persistence/reload, validation,
  tampered checkout ID rejection, stale/expired draft, Cart ineligibility,
  authenticated canonical-email prefill, user isolation, and no User mutation.
- Security recovery gate: local credentials were rotated by the owner, a safe
  Mongo ping passed, `.env.local` remained ignored/untracked, no current secret
  appeared in tracked/diff/staged content, and only generated Stage-7.2
  fixtures were removed. `git diff --check` passed.

## Stage 7.3 verification plan

Stage 7.3 tests use only `athar_stage55_test` for Mongo writes. Focused domain
coverage verifies the Sweden-only PostNord policy, `5900` minor-unit fee below
`69900`, zero fee at/above that threshold, currency/country rejection, and
server-derived selection. Mongo and Browser coverage verify guest and
authenticated owner isolation, CAS conflicts, reload persistence, tampered
method/price rejection or non-authority, subtotal re-resolution, address
invalidation, expiry, ineligible Cart blocking, no PII in URLs/logs, and
fixture cleanup. PostNord operational and dangerous-goods acceptance are
explicitly outside software-test evidence and remain not verified.

### Stage 7.3 final verification gate (2026-09-28 — passed)

- Authenticated Browser E2E and affected guest Browser E2E: **2/2 passed**.
- Focused domain/Mongo/catalog-fixture/capability checks: **7/7 passed**.
- The dedicated `59900` fixture produced `5900` shipping; current server Cart
  re-resolution produced free shipping at/above `69900`. Tampered method and
  browser price input were rejected or ignored; non-SE address invalidated the
  selection. Disposable fixtures were rechecked to zero.
- Isolated TypeScript and Webpack production build passed. Native Turbopack in
  the worktree was not executable because its `node_modules` Junction points
  outside the Turbopack filesystem root, before source evaluation.

## Stage 7.4 verification plan

Coverage verifies integer totals, included 25% VAT extraction and rounding,
`59900 + 5900 = 65800`, exact `69900` free shipping, zero production discount,
invalid selection/currency blocking, and ignored browser totals. Guest and
authenticated Browser E2E use only `athar_stage55_test` with cleanup.

### Stage 7.4 final verification gate (2026-09-28 — passed)

- Focused Stage 7.4 plus affected Stage 7.1/7.3 domain/capability/fixture and
  Mongo checks: **19/19 passed**.
- Isolated Browser E2E: **2/2 passed**. Guest and authenticated owners both
  rendered `59900 + 5900 = 65800`, including `13160` VAT minor units; an
  above-threshold Cart re-read rendered free shipping and `25980` VAT minor
  units. Submitted total fields could not alter server-derived totals.
- Disposable User, Credential, Cart, and Checkout fixtures were removed by
  each E2E `finally` block. Isolated TypeScript and Webpack production build
passed from the Stage 7.4-only worktree.

## Stage 7.5 verification complete — ready for checkpoint

Mongo tests use only `athar_stage55_test` and disposable cleanup. Current
evidence covers two real concurrent owner-matrix tests, fixed logical expiry,
idempotent retries, release/re-reserve, quantity reconciliation, duplicate-line
rejection, and stale unavailable-variant invalidation. Guest and authenticated
Browser prepare flows passed without a payment page. Isolated TypeScript and
Webpack production build passed with an explicit durable build exit code of `0`.
Final Stage 7.1 checkout regression passed 3/3 and Stage 7.4 totals/VAT
regression passed 2/2 after the reconciliation fix. Disposable fixtures and
temporary browser/server evidence were cleaned after the runs.

## Stage 7.6 Phase 7 integration closure (2026-09-28 — passed)

- Isolated Phase 7 regression: Stage 7.1 **9/9**, Stage 7.2 **7/7**, Stage
  7.3 **9/9**, Stage 7.4 **8/8**, and Stage 7.5 **4/4** passed.
- Guest and authenticated closure paths each reached the inventory-ready
  Prepare for payment boundary: **2/2 passed**. The guest path retained the
  `599 kr + 59 kr = 658 kr` total; authenticated shipping/totals coverage
  retained account-email isolation, free-shipping re-resolution, and browser
  input rejection.
- Mongo closure checks used `athar_stage55_test` only. The stock-one concurrent
  proof admitted exactly one reservation; fixture cleanup asserted zero records.
- Isolated TypeScript passed. Webpack production build completed with terminal
  exit code **0**. The worktree required a temporary `node_modules` Junction
  because npm 11 rejected the existing lockfile before installation; this is an
  environment/tooling limitation, not a source or dependency-graph change.
- PostNord operational and dangerous-goods acceptance remains not verified.

## Stage 8.1 payment-attempt verification (complete)

Focused tests cover opaque public IDs, strict parser rejection, SEK integer
minor-unit bindings, binding-sensitive idempotency and safe DTOs. The Mongo
test is gated to `athar_stage55_test`, creates a disposable record, proves
concurrent duplicate idempotency and superseding, then verifies cleanup. No
Stripe or PayPal call is made. The focused suite passed 4/4; affected Stage 7.4
and Stage 7.5 regression passed 8/8. TypeScript, affected ESLint, and isolated
Webpack production build passed; build evidence records terminal exit code `0`.

## Stage 8.2 Stripe verification (implemented; trusted finalization verified)

Focused tests cover immutable SEK amount/currency, explicit automatic capture,
card-only scope, metadata validation, provider-ID substitution rejection, and
no client-secret persistence. Mongo uses `athar_stage55_test` only and verifies
cleanup. Stage 8.1 and Stage 7.4/7.5 regressions remain required. The current
customer surface is Stripe-hosted Checkout Session; the older server-only
PaymentIntent helper remains covered by contract tests but is not the active
browser flow. Payment Element-specific browser tests are **NOT APPLICABLE** to
the current surface. Real Stripe Sandbox finalization is recorded below.

## Trusted Payment Finalization closure (2026-10-01 — verified; checkpoint pending)

External and automated evidence is recorded with explicit status labels:

- PaymentAttempt and Stripe automated suites: **VERIFIED**.
- Stage 7.5 inventory/reservation gate: **VERIFIED** against exactly
  `athar_stage55_test` (2 passed, 0 failed, 0 skipped; fixture cleanup PASS).
- Real Stripe Sandbox finalization/webhook delivery: **VERIFIED**.
- Real PayPal Sandbox create/capture, `PAYMENT.CAPTURE.COMPLETED`, delivery,
  `FAIL_SOFT → DELIVERED` retry, and one replay: **VERIFIED**.
- Replay preserved one Order, unchanged inventory, and an empty Cart:
  **VERIFIED**.
- TypeScript, affected ESLint, production build, and `git diff --check`:
  **VERIFIED**.
- PayPal route-specific automated suite: **NOT APPLICABLE** — no dedicated
  standalone suite currently exists.

Historical limitation (must not be promoted to PASS):

```text
Original PayPal inventory decrement exactly once:
UNVERIFIED historically
```

The old consumed reservation was removed by the existing TTL behavior and the
project has no durable historical consumption ledger. Current inventory tests
prove current engine behavior; PayPal replay proves no second mutation, but
neither retrospectively proves the first decrement for that old transaction.

## Stage 9.1 Order snapshot verification (closed / checkpointed / pushed)

Stage 9.1 tests verify that new PaymentAttempts carry the complete trusted
financial snapshot into Order finalization, including integer SEK amounts,
server-derived VAT, shipping amount/label, explicit zero discount, and grand
total consistency. They reject partial or tampered snapshots and preserve
legacy Orders without fabricating missing historical values. No email is sent.

## Stage 9.2 customer Order read verification (verification-only — complete)

The authenticated `/account` Order history is launch-sufficient: it enforces
owner scope, sorts newest-first, and reads at most the latest 20 Orders from
persisted Order snapshots. New Orders include the Stage 9.1 financial snapshot;
legacy Orders remain readable without inventing VAT, shipping, or discount
history. The confirmation page continues to use the short-lived verified cookie
boundary for guest and authenticated confirmation lookup.

No dedicated `/account/orders/[orderId]` route, persistent guest Order
lookup/claim, pagination/search, or fulfillment timeline is required at this
stage. These capabilities are optional/deferred. Stage 9.2 is
**VERIFICATION-ONLY — COMPLETE**; transactional email remains deferred to
Stage 9.3.

## Stage 9.3 transactional Order email verification (closed / checkpointed / pushed)

- Order email contract, HTML template, and plain-text template: **VERIFIED**.
- Persisted contact-email recipient authority and immutable Order snapshot use:
  **VERIFIED**.
- Brevo server boundary and non-production test-mail adapter: **VERIFIED**.
- Password-reset regression and dedicated `athar_stage55_test` Mongo regression:
  **VERIFIED**.
- Live Brevo Order delivery: **NOT YET VERIFIED**.
- Automatic payment-to-email wiring and durable outbox/idempotency/retry:
  **NOT STARTED**; these remain Stage 9.4 scope.
