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
