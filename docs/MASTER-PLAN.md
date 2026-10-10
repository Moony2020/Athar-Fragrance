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
| 9 | Canonical orders and transactional email | Stages 9.1–9.6 closed / verified |
| 10 | Admin platform | Stage 10.1 closed / verified / checkpointed |
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
| 9.5 | Secure Order Access | Closed / verified / checkpointed / pushed at `8b50f7fe` |
| 9.6 | Premium Order Confirmation Email Presentation | Closed / verified; implementation checkpoint `77aae733` |

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

#### Stage 9.6 contract — Premium Order Confirmation Email Presentation

Stage 9.6 refines the customer-facing presentation and content of the existing
`order_confirmation` email only. It is a premium transactional email, not a
newsletter and not a redesign of the delivery pipeline.

- The recipient remains the persisted `Order.contact.email` snapshot. There is
  no Admin Order notification in this stage.
- HTML and plain-text renderers remain information-equivalent. The HTML design
  may use ATHAR branding and layout; the plain-text version remains the safe
  accessible counterpart.
- Each Order line is rendered only from persisted snapshots: `imageSnapshot`,
  `brandName`, product name, optional historical `fragranceType`, `sizeMl`,
  quantity, and price. Legacy Orders remain readable: absent image or
  concentration data is omitted, never backfilled or resolved from the live
  catalog.
- The email may render the persisted shipping address, shipping method,
  merchandise, shipping, VAT included, and total. If a legacy Order lacks a
  historical financial or shipping snapshot, that line is omitted rather than
  recalculated from current policy.
- The customer CTA is **View order details**. It must preserve the Stage 9.5
  access model: authenticated customers use their authenticated Order detail
  semantics, while guest recipients go to `/orders/lookup`, never directly to
  `/orders/guest`. No email address, guest session secret, or other access
  credential appears in the URL.
- Customer support/contact, company, legal, social, and footer details appear
  only when an approved canonical configuration value exists. Do not invent
  `support@athar.se` or other business details.
- `Track your order`, carrier tracking, invoice/PDF download, social rows, and
  oversized marketing footers are excluded.
- Brevo configuration, `email_deliveries`, idempotency, leasing, retry,
  provider webhooks, the dispatch flag, payment finalization, Order schema,
  guest access, and rate limiting are unchanged.

Verification will include renderer/contract coverage and one controlled live
Brevo email after deployment to inspect presentation only. The Stage 9.4
delivery, outbox, webhook, and inbox-receipt evidence is not repeated unless a
change affects those semantics.

Closure evidence: controlled Stripe Sandbox Order `ATH-7678DB2848CB` delivered
through Brevo and rendered in Gmail. Product and financial snapshots, shipping,
CTA, contact note, and footer passed visual review. ATHAR remains HTML text;
Gmail used its fallback font rather than Cinzel Decorative, so exact
cross-client logo-font parity is not guaranteed. The owner retained HTML text
branding and rejected wordmark images. Dispatch was returned to `0`; no further
live email is required.

### Phase 10 stage map

| Stage | Scope | Status |
| --- | --- | --- |
| 10.1 | Admin Identity & Server-Side Authorization Foundation | Closed / verified / checkpointed |
| 10.2 | Admin Provisioning, Activation & Dedicated Admin Login | Gate 1 verified / checkpointed / pushed; Gate 2 implemented locally, Final Recheck PASS and Owner Signoff APPROVED — no Gate 2 staging, implementation checkpoint, commit, push, or production exposure authorized |

#### Stage 10.1 Goal Contract — Admin Identity & Server-Side Authorization Foundation

**Goal.** Establish the minimal, server-authoritative identity, authorization,
session-revocation, protected-route, and privileged-audit foundations required
before ATHAR exposes any operational Admin capability. The stage creates the
lock and key only; it does not create an Admin product, order, customer,
payment, or dashboard tool.

**Baseline.** `87a46994156cf5381a30e25aab9e7d3b432ee413`.

**Owner decisions.**

- The only roles in this stage are `customer` and `admin`. No manager, editor,
  support, or generalized RBAC role is introduced.
- The initial Admin is an existing account only. A one-off controlled
  server-only operational script explicitly targets its public `userId`; there
  is no Admin self-registration, endpoint, Admin UI, browser-selected
  privilege, automatic promotion from an email address, or
  environment-variable-driven automatic promotion.
- Stage 10.1 contains no Admin-management UI and no public or private
  promotion API. Creating additional Admins is deferred to a separately
  contracted stage.
- Every privileged request verifies the authenticated identity and its current
  persisted privilege on the server. Hiding `/admin`, a React condition, or a
  JWT/browser role by itself is never authorization.
- A role change increments the existing private `securityVersion`,
  invalidating prior sessions through the existing session-validation
  mechanism. Stage 10.1 does not introduce an account-disable mutation,
  service, API, or UI; it preserves the existing `disabledAt` session-rejection
  behavior and verifies that a persisted disabled credential cannot retain
  privileged access.
- The stage establishes a minimal append-only privileged audit-event
  foundation, but not an audit viewer or dashboard.
- `/admin` is a protected shell/minimal landing page only. It contains no
  operational dashboard or CRUD surface.

**Identity and role contract.** The canonical `User` document persists one
explicit closed role value: `customer` or `admin`. Existing users that have no
historical role, and any missing, unknown, malformed, or otherwise invalid
persisted role, must fail closed as non-Admin. A legacy record therefore cannot
become Admin by default, omission, parser fallback, JWT claim, or browser
input. New customer identity creation must persist `customer` explicitly.
Privilege is never derived from an email address, a frontend value, a route
parameter, or an environment variable.

**Data and migration compatibility.** The implementation must preserve all
existing customer identities and authentication behavior. It may introduce the
role field and any technically necessary explicit migration/index work, but no
request-time read may silently promote a legacy user. No bulk legacy backfill
is authorized merely for Stage 10.1; an implementation audit may report a real
technical need without inventing that migration. No existing User ID,
credential, password hash, customer profile, Cart, Wishlist, Checkout,
payment, or Order authority changes.

**Initial Admin bootstrap contract.** A later implementation provides one
one-off server-only operational script which receives an operator-chosen
existing public `userId` outside browser input. It must first resolve a real
existing user; a nonexistent target fails without creating a user, credential,
or Admin record. It must not contain an Admin email, raw secret, or automatic-
promotion rule in source, frontend configuration, environment configuration,
or documentation. The operation is idempotent: retrying an already-Admin
target does not perform a second privilege mutation. Its bootstrap event may
use the single constrained system actor `actorType: system` and
`actorId: admin-bootstrap`; this actor is permitted only for this controlled
first-Admin bootstrap, never for arbitrary operator strings, email addresses,
or Windows usernames. The target remains the explicit existing public
`userId`. Its success, no-op, and failure outcomes are auditable through the
privileged-event foundation when that foundation is implemented. Bootstrap
implementation itself is out of scope for this documentation-only stage.

**Server-side authorization contract.** A single future server-only
authorization boundary must be usable by Server Components, Route Handlers,
Server Actions, and privileged services. It must derive the candidate identity
from the current authenticated session, confirm that the credential/session is
currently valid, then read and validate the current persisted role before
allowing privileged data or mutations. The JWT can identify a session but is
not the privilege source of truth. Unauthenticated `/admin` requests follow
the established sign-in flow; authenticated non-Admins receive a stable safe
Access Denied presentation with no privileged data. Stage 10.1 does not enable
experimental Next.js `authInterrupts` merely to produce `forbidden()`, and it
does not claim a transport-level HTTP `403` for the App Router shell unless a
stable supported mechanism is identified. Future privileged Route Handlers
return explicit `401` for unauthenticated callers and `403` for authenticated
but unauthorized callers; neither response exposes privileged records.

**Session invalidation contract.** Any role mutation must increment the
affected credential's private `securityVersion` within the same authoritative
transition. The existing Auth.js JWT validation then rejects older sessions.
A stale JWT must not retain Admin access after demotion, and the existing
persisted-`disabledAt` validation must continue to deny privileged access for a
disabled Admin. Creating a disable transition is deferred beyond Stage 10.1.

**Protected `/admin` contract.** `/admin` is introduced only after the
server-side authorization boundary exists. The route itself performs the
server-side check before rendering its minimal shell; client-side hiding is
only presentation. It must not render data, controls, or operational metrics
beyond the proof of an authorized boundary.

**Privileged audit-event contract.** The future append-only event has an
opaque event ID; a discriminated actor; action; optional target type and target
ID; timestamp; outcome; and only explicit allow-listed safe metadata. A normal
actor is `actorType: user` with a public `userId`. The sole system actor is the
fixed `actorType: system`, `actorId: admin-bootstrap`, permitted only for the
controlled first-Admin bootstrap. Stage 10.1 defines only actions that arise
from its own bootstrap, role-security transition, and authorization-sensitive
scope; it does not create a general taxonomy for later Admin operations.
Events never store passwords, credential hashes, reset tokens, cookies, session
secrets, provider secrets, raw request bodies, unnecessary email values, or
arbitrary developer-supplied metadata. Retention remains explicitly undecided;
analytics and an audit viewer are out of scope.

**In scope.** Role compatibility/closed-value contract; controlled initial
Admin bootstrap contract; server-only authorization boundary; security-version
revocation contract; protected `/admin` shell; minimal append-only privileged
audit-event foundation; and focused contract/integration verification.

**Admin Final Visual Reference (future dashboard only).** The approved visual
reference uses Swedish money formatting such as `128 450 kr`; the inventory
states `Low`, `Critical`, and `Out of Stock`; and a dark sidebar with its lower
perfume image, strong dark gradient, and active state preserved. Its future
dashboard hierarchy is KPI cards, then Revenue / Order Status, then Recent
Orders / Low Stock, then compact Latest Reviews. This reference does not
authorize dashboard implementation in Stage 10.1.

**Implementation-boundary ledger (closed / verified / checkpointed).** The initial
bootstrap audit event alone may use the constrained
`system/admin-bootstrap` actor; no experimental Next.js configuration is
authorized for the `/admin` denial presentation; and Stage 10.1 adds no
account-disable transition. The implementation must preserve the existing
persisted-`disabledAt` rejection behavior. The implemented scope creates the
role field, authorization modules, audit collection/index contract, bootstrap
script, minimal `/admin` route, and focused tests; it creates no production
configuration, Dashboard, or operational Admin capability.

**Verification evidence.** Focused non-Mongo contract/regression coverage passed
with 17 passed, 0 failed, and one existing dedicated-Mongo test skipped only in
the Codex process that lacks usable Mongo connectivity. The dedicated Stage 10.1
Mongo transaction test passed on the real local machine against
`athar_stage55_test` (1 passed, 0 failed): transactional bootstrap, customer to
Admin role transition, `securityVersion` increment, constrained
`system/admin-bootstrap` audit actor, idempotent retry, nonexistent-target
handling, rollback atomicity, audit index, secret safety, and fixture cleanup
were verified. Owner verification passed for unauthenticated `/admin` sign-in,
customer Access Denied with no privileged data, and a fresh local test-only
Admin fixture session rendering the minimal protected shell. The real local
production build passed on Next.js 16.3.8, including TypeScript and static
generation (36/36); `/admin` is present in the production route graph. No
Render/live deployment or production Admin account was created or promoted. The
fixture was local/test-only in `athar_stage55_test`; `u3811698473@gmail.com`
was not used or modified by Stage 10.1.

**Next-stage boundary.** Stage 10.2 — Admin Provisioning, Activation & Dedicated
Admin Login — remains separate and out of scope. It may later define
company-controlled provisioning, invitation activation, and dedicated Admin
login/recovery UX, but none of that is implemented by Stage 10.1.

#### Stage 10.2 Goal Contract — Admin Provisioning, Activation & Dedicated Admin Login

**Status.** The overall Stage 10.2 Goal Contract is owner-approved and all seven
owner decisions remain locked. Gate 1 — Pending Admin Invitation & Controlled
Provisioning Foundation — is verified, checkpointed, and pushed at
`f4ae2c1cd93b7295b1149560039ad989de76cbd7`. Gate 2 — Admin Invitation
Activation & Password Setup — now has an owner-approved v2 Goal Contract, with
that Gate 1 checkpoint as its baseline. The complete Gate 2 contract is recorded
in [STAGE-10.2-GATE-2-GOAL-CONTRACT.md](./STAGE-10.2-GATE-2-GOAL-CONTRACT.md).
The documentation write/review gate itself did not authorize implementation,
checkpointing, or production exposure. Separate Owner authorization later
permitted Gate 2 implementation locally. Focused tests (8/8), Gate 2 Mongo
(2/2 against `athar_stage55_test`), Owner browser activation, TypeScript,
ESLint (0 errors; 2 unrelated warnings), and production build (38/38) were
observed PASS before the final success-UI correction. The final blocker
corrections are implemented: success guidance is non-clickable, status evidence
is reconciled, and the fixture cleanup command is PowerShell-safe. The Owner
reported post-correction Playwright 1/1, TypeScript, ESLint (0 errors; known
unrelated warnings), production build (38/38), and Gate 1 / Stage 10.1
non-Mongo regressions 11/11 PASS; see `tests/STAGE-10.2-GATE-2.md`. The
historical Stage 10.1 dedicated Mongo test passed 1/1 and was not rerun for
Gate 2. The Final Recheck passed and the Owner approved Gate 2 Signoff.
Staging, an implementation checkpoint, commit, push, and production exposure
remain unauthorized. Gate 2 is not yet checkpointed or closed. Admin Login and
Recovery remain future gates, not implemented or authorized by Gate 2.

**Goal.** Provide a company-controlled way to provision a future Admin without
customer registration, let that person activate the identity using a one-time
expiring link and their own password, and provide separate Admin-only login and
password recovery UX. This stage extends the Stage 10.1 persisted-role,
security-version, server authorization, and privileged-audit foundations; it
does not add operational Admin capabilities.

**Owner operational interface.**

```text
npm run admin:provision -- --email <admin-email>
npm run admin:provision -- --email <admin-email> --reissue
```

The first command creates a pending invitation only. The reissue form is an
explicit owner operation that replaces an invitation. Neither command accepts a
password argument. This Gate 1 interface is implemented and checkpointed; its
use with a real Admin identity, live email, or production data remains outside
the Gate 2 documentation authorization.

**Pending Admin model and collision policy.** The stage uses a separate pending
Admin invitation document. Before activation there is no canonical User, no
Credential, no session, and no Admin privilege. Normal customer registration is
never part of Admin onboarding. Provisioning a normalized email that belongs to
an existing customer is rejected: it never promotes, merges, overwrites, or
converts that customer. A real Admin identity therefore requires an unused,
separate email. Provisioning an existing active Admin is rejected with no state
mutation: it creates no new invitation and changes no User, Credential, or
privilege.

**Invitation lifetime and reissue.** An invitation is valid for 24 hours. After
expiry activation is rejected and cannot create a privilege; a new explicit
invitation is required. Reissue atomically invalidates the former invitation
and creates one successor, so at most one valid invitation exists for a
normalized email. Any old activation link must fail after successful reissue.

**Activation and identity creation.** A cryptographically random activation
token is issued only for the activation link. Its raw value is never persisted;
the server stores only a SHA-256 or equivalent established secure digest,
`expiresAt`, and durable `consumedAt` or equivalent authoritative consumption
state. Activation conditionally consumes one unexpired, unconsumed invitation.
In one Mongo transaction it creates `User(role: admin)`, creates the Admin's
Argon2id Credential using the chosen password, consumes the invitation, and
appends safe privileged audit events. Invalid, expired, consumed, replayed, or
concurrently consumed tokens fail safely and create no partial Admin identity.
TTL cleanup may remove expired records later but must never be treated as the
expiry authorization decision.

Activation URL handling is mandatory: implementation must prevent raw tokens
from reaching server request URLs or query strings, server logs, audit
metadata, analytics, referrers, and error reporting. The intended activation
link is `/admin/activate#token=<raw-token>`; the fragment is read client-side
and removed from the visible/history URL as early as practical before the
controlled activation submission. The raw token may be submitted only through
that controlled operation and is never persisted raw. Successful activation
never creates a logged-in session; the new Admin must perform a fresh login at
`/admin/login`.

**Portal separation and authorization.** `/account/sign-in` accepts only
customers. `/admin/login` accepts only active Admins. Credentials presented in
the wrong portal receive a generic safe failure and grant no privilege.
Dedicated Admin login reuses the existing credential hashing, credential
validation, session-current, and Auth.js foundation; it does not create a
second password system. It must verify the current persisted role server-side.
Every `/admin` request and future privileged request continues to re-read the
current persisted Admin role; JWT role claims and client-side routing are never
authorization. Disabled credentials and stale security-version sessions fail
safely. Admin login redirects use fixed safe destinations, not arbitrary
callback URLs.

**Admin-only password recovery.** Stage 10.2 includes `/admin/forgot-password`
and an Admin-only reset flow. Customer recovery accepts customers only; Admin
recovery accepts active Admins only. Cross-portal recovery fails generically.
Admin recovery uses a random one-time expiring token, persists its hash only,
uses Argon2id for the new password, and increments `securityVersion` on a
successful reset so prior sessions are invalidated. The final persistence design
must preserve this role separation; a dedicated Admin reset-token boundary is
expected if the existing customer reset-token model cannot enforce it safely.

**Persistent Admin authentication rate limiting.** MongoDB-backed, shared
rate limits are required for `/admin/login`, `/admin/forgot-password`, and
`/admin/activate`. Gate 2 locks Activation to a fixed 15-minute window, five
attempts per token-HMAC and ten attempts per IP-HMAC. The two counters and a
stable server-generated attempt identity must be handled atomically; bounded
write-conflict retries must remain the same logical attempt, double-counting and
partial-counter allow decisions are forbidden, and exhausted or uncertain
outcomes fail closed. Persisted identifiers use a dedicated server-only HMAC
secret and never retain raw token, IP, or email values. Login and Recovery
thresholds remain future-gate work.

**Gate 2 production boundary.** Contract approval, isolated implementation
verification, and checkpointing never authorize production exposure. The
Activation endpoint must remain disabled or fail closed in production until the
actual Render proxy/header contract and trustworthy client-IP provenance are
proven, arbitrary `X-Forwarded-For` input is rejected, the dedicated production
HMAC secret and Mongo limiter are verified, fail-closed security tests pass,
and the owner grants a separate deployment authorization. Documentation alone
is not sufficient evidence.

**Email delivery boundary.** Admin invitation email and Admin password-recovery
email must use ATHAR's existing server-only Brevo transactional-email
foundation. A non-production test-mail adapter is allowed only under the
project's established test conventions. Admin invitation and recovery delivery
must not reuse or couple to Phase 9's order-specific `email_deliveries`
records. The provisioning workflow must send an activation invitation through
this Admin email boundary; it is not an optional conceptual step. If durable
invitation delivery is introduced, it uses a purpose-scoped Admin delivery
model with its own idempotency, lease/retry, recipient-safety, and
secret-safety semantics. Raw activation tokens, passwords, sessions, cookies,
secrets, request bodies, and full activation URLs never enter persistent audit
or delivery metadata.

**Persistence, indexes, and audit.** Expected new persistence boundaries are
Admin invitations, persistent Admin-auth rate limits, an Admin recovery-token
boundary if required by the final role-separated design, and purpose-scoped
invitation delivery state if durable delivery is included. Their implementation
requires uniqueness, expiry/TTL, lookup, idempotency, concurrency, and
transaction invariants before indexes are created. The privileged audit taxonomy
must safely support at least `admin.invitation.provisioned`,
`admin.invitation.reissued`, `admin.invitation.activation_succeeded`,
`admin.password_reset_requested`, and `admin.password_reset_completed`.
Failure events contain only a safe category/reason; they never retain raw
tokens, passwords, hashes, cookies, sessions, request bodies, or secrets.

**Implementation ledger (proposed; no files created by this contract).**

- **Create:** invitation document/parser/repository and provisioning service;
  owner provisioning script; Admin login, activation, and recovery pages/forms;
  focused Stage 10.2 unit and Mongo integration tests.
- **Modify:** Auth.js provider composition; credential and password-reset
  services; User/Credential transaction boundaries as needed; database
  collections/index definitions; privileged audit schema/store; `/admin`
  unauthenticated redirect; Brevo adapter boundary; canonical plan/status docs.
- **Review only:** existing order email outbox, existing password-reset ADR and
  tests, customer sign-in behavior, and Stage 10.1 authorization boundary.

**Required verification.** Future implementation must cover unused-email
provisioning; absence of User/Credential before activation; customer and active
Admin collisions; duplicate provisioning; explicit reissue and prior-token
invalidation; 24-hour expiry; invalid/consumed/replayed/concurrent activation;
transaction rollback; password policy and Argon2id; persisted Admin role and
security-version authority; audit/token secrecy; Admin/customer cross-portal
login rejection; disabled/stale session behavior; all `/admin` access states;
Admin/customer recovery separation; persistent and fail-closed rate limits;
TypeScript; focused automated tests; Mongo integration tests; production build;
and owner browser verification.

**Out of scope.** Admin Dashboard implementation; catalog, inventory, order,
payment, refund, analytics, customer, and general role-management operations;
public Admin registration or request-access; MFA/passkeys; production
deployment or Render changes; Git remote changes; and `package-lock.json`
cleanup.

**Completion gate.** Goal Contract approval or checkpointing does not complete
Stage 10.2. The stage remains incomplete until implementation stays within this
contract; focused automated tests pass; Mongo integration, concurrency, and
transaction verification pass; TypeScript and production build pass;
security/secret-safety verification passes; owner browser verification passes;
documentation records the evidence; and the owner explicitly closes and signs
off Stage 10.2. No later Admin operational or Dashboard stage begins
automatically.

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
