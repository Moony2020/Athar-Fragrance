# Stage 10.2 — Gate 2 Goal Contract

## Version 2 — Owner approved; implementation not authorized

### 1. Document identity and status

```yaml
PROJECT: ATHAR
STAGE: Stage 10.2
GATE: Gate 2 — Admin Invitation Activation & Password Setup
DOCUMENT: Goal Contract v2
STATUS: OWNER APPROVED

IMPLEMENTATION_AUTHORIZED: NO
CHECKPOINT_AUTHORIZED: NO
COMMIT_PUSH_AUTHORIZED: NO
PRODUCTION_EXPOSURE_AUTHORIZED: NO

GATE_1:
  status: VERIFIED / CHECKPOINTED / PUSHED
  checkpoint: f4ae2c1cd93b7295b1149560039ad989de76cbd7
```

Owner approval locks this contract. It does not authorize implementation,
checkpointing, deployment, production exposure, or any later Stage 10.2 gate.

### 2. Baseline

```yaml
BRANCH: master
BASELINE: f4ae2c1cd93b7295b1149560039ad989de76cbd7

PRESERVED_OWNER_FILES:
  package-lock.json: out of scope
  next-env.d.ts: out of scope
```

### 3. Scope and objective

Gate 2 converts one valid, unexpired Pending Admin Invitation into:

```text
One canonical User(role=admin)
+
One Argon2id Credential
+
Consumed invitation
+
One privileged success audit event
```

The four writes are one atomic Mongo transaction. The result is an activated
Admin identity, not an authenticated Admin session.

Gate 2 includes `/admin/activate`, fragment-token handling, password setup,
`POST /api/admin/activate`, persistent activation rate limiting, atomic Admin
creation, invitation consumption, success audit, and safe activation UX.

### 4. Locked Owner decisions

```yaml
PENDING_MODEL:
  separate_invitation: YES
  pre_activation_user: NONE
  pre_activation_credential: NONE

IDENTITY_COLLISION:
  customer_email: REJECT
  existing_admin_email: REJECT
  customer_promotion: FORBIDDEN

INVITATION_LIFETIME: 24 hours

REISSUE:
  explicit_owner_operation: REQUIRED
  predecessor_invalidated_atomically: YES

PORTAL_SEPARATION:
  customer_login: /account/sign-in
  admin_login: /admin/login

RECOVERY:
  dedicated_admin_recovery: REQUIRED_IN_FUTURE_GATE

ACTIVATION_RATE_LIMIT:
  window: fixed 15 minutes
  token_hmac_limit: 5
  ip_hmac_limit: 10
  count_every_durably_processable_attempt: YES
  storage: MongoDB
  dedicated_secret: REQUIRED
  raw_identifiers_stored: NO
  failure_mode: FAIL_CLOSED
```

The fifth token attempt and tenth IP attempt are allowed. The sixth and
eleventh are denied. These values are locked.

### 5. Activation journey

```text
Gate 1 pending invitation + Brevo message
        ↓
/admin/activate#token=<raw-token>
        ↓
Client reads fragment once and immediately removes it with history.replaceState
        ↓
Token remains in transient memory only
        ↓
Admin enters password + confirmation
        ↓
POST /api/admin/activate
        ↓
Request-boundary security checks
        ↓
Atomic Mongo-backed rate limiter
        ↓
Password validation + Argon2id
        ↓
Atomic activation transaction
        ↓
Generic success state and future Admin sign-in guidance
```

The raw token never enters a query string, SSR HTML, browser storage, logs,
errors, audit metadata, analytics, or third-party requests. Activation never
signs the Admin in automatically.

### 6. Token lifecycle

Persisted invitation states remain `pending`, `invalidated`, and `consumed`.
Expiry is authoritative server logic, not TTL deletion:

```text
expiresAt <= authoritative server time → expired
```

Activation requires an exact SHA-256 token digest match, `status=pending`, no
consumption or invalidation timestamp, and `expiresAt > transactionNow`.
`deliveryStatus` is not authorization authority. TTL is cleanup only.

### 7. Password and identity contract

```yaml
PASSWORD:
  minimum: 12
  maximum: 128
  requires_letter: true

ARGON2ID:
  timeCost: 3
  memoryCost: 65536
  parallelism: 4
```

Password validation is server-side. Confirmation is UI-only. Argon2id hashing
starts only after the limiter grants permission and before the activation
transaction. The normalized email comes only from the invitation. Activation
creates `User(role=admin)` and a Credential with `securityVersion: 0` and
`disabledAt: null`. There is no temporary password, customer promotion, or
account merge.

### 8. Atomic activation transaction

Before the transaction, the request boundary and limiter must pass, the token
and password must validate, the password hash must be calculated, and stable
operation, public User, and audit IDs must be generated once.

Inside one Mongo session and transaction:

1. Calculate a fresh `transactionNow` for the transaction attempt.
2. Read the exact invitation by token hash.
3. Revalidate state and expiry.
4. Conditionally consume the exact `_id`, invitation ID, token hash, pending
   state, null consume/invalidate timestamps, and `expiresAt > transactionNow`.
5. Require `modifiedCount === 1`.
6. Recheck that the normalized email is unused.
7. Insert the canonical Admin User.
8. Insert its Credential.
9. Insert the privileged success audit event.
10. Commit.

Required invariants:

```yaml
user_without_credential: IMPOSSIBLE
credential_without_user: IMPOSSIBLE
consumed_without_identity: IMPOSSIBLE
identity_without_consumption: IMPOSSIBLE
audit_without_success: IMPOSSIBLE
partial_writes: ROLLED_BACK
```

### 9. Concurrency, rollback, and unknown commit results

Conditional consumption permits one activation winner. Activation and reissue
compete on the same pending invitation, so only one may win. Email uniqueness
is checked inside the transaction and enforced finally by the canonical unique
index.

Transient callback retries reuse stable token and operation IDs; their
`transactionNow` is recalculated. For `UnknownTransactionCommitResult`, commit
is retried on the same transaction/session according to supported Mongo driver
semantics. The application must not blindly rerun the callback or open another
write transaction.

If the outcome remains unknown, the response is generically unavailable and
must not claim definitive rollback. Read-only reconciliation may inspect the
exact invitation, expected User, Credential, and audit event. Success is known
only when the complete expected state is consistent. A partial state is an
invariant failure. A client replay of a consumed token creates no second User,
Credential, audit event, or session.

### 10. Persistent atomic rate limiting

Every durably processable activation submission receives one server-generated,
stable attempt ID. In one Mongo transaction the limiter records that attempt,
increments the token-HMAC and IP-HMAC counters for the same fixed window, and
evaluates both post-increment counts.

Required guarantees:

- No allow decision may follow a partial counter write.
- Either exceeded dimension denies the request.
- A limit-denied attempt commits both applicable increments before returning.
- Concurrent requests cannot pass either limit.
- Stable attempt identity prevents internal retry double counting.
- Counter keys are uniquely indexed by dimension, identifier HMAC, and window
  start.
- First-upsert conflicts and write conflicts use bounded transaction retries.
- An aborted transaction leaves no counted attempt.
- Unknown limiter commit results retry commit only on the same transaction; an
  unresolved outcome denies activation and starts neither Argon2id nor the
  activation transaction.
- TTL deletes old records only and never authorizes a request.
- No raw token, IP, email, body, or secret is persisted.

Malformed or missing tokens use an IP-scoped HMAC sentinel rather than a global
key. Infrastructure uncertainty always fails closed. The system must not claim
that a rolled-back infrastructure-failed attempt was counted.

```yaml
RATE_LIMIT_RETRY_REQUIREMENT:
  write_conflict_retries: BOUNDED
  retry_scope: SAME_LOGICAL_ATTEMPT
  stable_attempt_id: REQUIRED
  double_counting: FORBIDDEN
  partial_counter_allow: FORBIDDEN
  concurrent_limit_bypass: FORBIDDEN
  exhausted_or_uncertain_retry: FAIL_CLOSED
```

### 11. Trusted IP and production exposure boundary

Implementation verification, Gate 2 Owner signoff/checkpoint, and production
exposure are separate gates. A successful implementation checkpoint does not
authorize public activation.

The production route remains disabled or fail-closed until all are proven in
the actual deployment environment:

- Render's trusted proxy/header contract and authoritative hop are verified.
- The edge is proven to overwrite attacker-supplied forwarding values.
- Client IP extraction is reliable and never trusts arbitrary
  `X-Forwarded-For`.
- Ambiguous or missing IP provenance is denied.
- A dedicated production HMAC secret is configured server-side.
- Mongo limiter availability and indexes are verified.
- Fail-closed security tests pass.
- A separate explicit production-exposure authorization is granted.

Documentation alone is insufficient evidence. Local tests may inject an
explicit trusted resolver; this never relaxes production policy.

### 12. Privileged audit

Successful activation appends this event inside the activation transaction:

```yaml
actor:
  actorType: system
  actorId: admin-activation
action: admin.invitation.activation_succeeded
target:
  type: admin_invitation
  id: exact invitationId
outcome: succeeded
metadata:
  reason: invitation_consumed
  createdUserId: opaque public userId
```

Audit data never contains tokens, hashes, passwords, URLs, email, IP, bodies,
cookies, or sessions. Failed activation submissions remain rate-limit
accounting rather than attacker-controlled privileged-audit noise.

### 13. Session and authorization

Gate 2 creates no Auth.js session, JWT, cookie, or automatic sign-in. An
existing Customer session remains a Customer session. The new Admin must later
sign in through the separately scoped `/admin/login`. `/admin` continues to
recheck the persisted Admin role server-side.

### 14. Minimum UI/UX

The minimal page provides ATHAR text branding, password and confirmation
fields, visibility control, policy feedback, loading state, accessible
announcements, generic invalid/expired/used and unavailable states, success
state, responsive behavior, and future Admin sign-in guidance.

**Owner-approved success-UI clarification.** Until `/admin/login` is implemented
in its separate gate, this guidance is informational text, not a clickable link
or navigation to an unavailable route. This narrows only the Gate 2 success
presentation; Admin Login remains excluded and activation creates no session.

It provides no sign-up, register-as-Admin, request-access, customer-registration
link, Dashboard preview, token display, or invited-email display.

### 15. Activation API contract

```http
POST /api/admin/activate
Content-Type: application/json
Cache-Control: no-store
Referrer-Policy: no-referrer
```

```ts
{ token: string; password: string }
```

The route is POST-only, same-origin only, uses a strict trusted Origin allowlist
from server-side configuration, emits no permissive CORS headers, requires JSON,
and limits the body to 4096 bytes. Trusted origins must not be constructed from
client-supplied Host or forwarding headers. Missing, null, malformed, spoofed,
or unexpected Origin values are denied. Ambiguous Origin or IP provenance is
denied. Local testing uses an explicit injected allowlist without weakening
production behavior.

Processing order:

1. Enforce method and production-exposure gate.
2. Validate Origin.
3. Read at most the bounded body.
4. Resolve the trusted client IP.
5. Derive token or malformed-sentinel limiter identity.
6. Run the atomic two-dimensional limiter.
7. Return media/JSON validation failures only after applicable accounting.
8. Validate fields, run Argon2id, then run activation.

Unsupported methods, rejected cross-origin traffic, untrusted IP provenance,
and unreadably oversized bodies are early boundary rejections rather than
accepted activation submissions. Changing Content-Type or sending malformed
JSON must not bypass applicable IP/token-sentinel accounting.

Expected safe statuses include `400`, `403`, `405`, `413`, `415`, `429`, and
`503`. Responses remain generic and expose no token state, email, User document,
limit internals, or transaction details. CORS is not authorization.

### 16. Proposed file ledger

Create:

```text
src/admin/admin-activation-contract.ts
src/admin/admin-auth-rate-limit-document.ts
src/server/admin/admin-activation-repository.ts
src/server/admin/admin-activation-service.ts
src/server/admin/admin-auth-rate-limit-store.ts
src/app/admin/activate/page.tsx
src/app/admin/activate/AdminActivationForm.tsx
src/app/admin/activate/admin-activate.module.css
src/app/api/admin/activate/route.ts
tests/stage-10.2-admin-activation.test.ts
tests/stage-10.2-admin-activation-mongo.test.ts
tests/STAGE-10.2-GATE-2.md
```

Modify only as required:

```text
src/admin/privileged-audit-document.ts
src/server/db/collections.ts
src/server/db/indexes.ts
next.config.ts — only if strictly required for route-level headers
```

Review-only boundaries include existing auth/password/credential, invitation,
Gate 1, and Stage 10.1 authorization code and tests. Admin login, recovery,
Dashboard, MFA, Brevo/CLI changes, `package-lock.json`, and `next-env.d.ts` are
out of scope.

### 17. Mandatory test matrix

Required tests cover:

- Request, token, password, audit, Origin, body, HMAC, trusted-IP, and safe
  response unit behavior.
- Valid and invalid activation, replay, exact expiry boundary, collision,
  headers, method, OPTIONS, cross-origin, malformed/non-JSON, oversized body,
  no session, and fail-closed API behavior.
- Mongo atomic success, concurrent activation, activation/reissue races,
  identity collisions, every rollback boundary, transient retry, and fixture
  cleanup.
- Commit acknowledgement loss, repeated commit on the same transaction,
  permanently unknown outcome, read-only reconciliation, consumed-token replay,
  concurrent activation during uncertainty, and exactly one success audit.
- Token attempt 5/6 and IP attempt 10/11 boundaries, either-dimension denial,
  denied-attempt accounting, partial-write rollback, concurrent first upsert,
  concurrency resistance, retry de-duplication, unknown limiter outcome,
  absence of raw identifiers, TTL-only cleanup, and no expensive work before
  limiter allow.
- Browser fragment removal, no browser persistence, accessibility,
  responsiveness, generic states, no automatic session, and unchanged Customer
  session.
- Gate 1 and Stage 10.1 regression suites, TypeScript, affected ESLint, Mongo
  verification only against `athar_stage55_test`, production build, secret scan,
  and Owner browser verification.

No production database, live email, or real Admin identity may be used.

### 18. Acceptance criteria

Isolated Gate 2 implementation verification requires all scope, unit, route
security, Origin/content/body, Mongo transaction, unknown-commit, concurrency,
atomic-rate-limit, partial-write, fail-closed, cleanup, secret-safety, session,
regression, TypeScript, ESLint, production-build, and Owner-browser gates to
pass.

Production exposure additionally requires verified Render proxy behavior,
trusted IP provenance, rejection of arbitrary forwarding headers, production
HMAC secret readiness, production Mongo limiter readiness, deployment
fail-closed tests, and a separate Owner authorization. `DOCUMENTED` alone is
not PASS.

### 19. Explicit exclusions

- Admin Login implementation.
- Admin Forgot/Reset Password.
- Login/recovery rate limiters.
- Dashboard and all operational Admin tools.
- Role-management or invitation-management UI.
- MFA/passkeys.
- Public Admin registration or customer promotion.
- Real Admin provisioning, live Brevo tests, or production Mongo mutation.
- Render configuration and deployment changes.

### 20. Future gate sequencing

```text
Contract documentation review
→ Separate contract checkpoint authorization
→ Separate implementation authorization
→ Gate 2 implementation
→ Focused unit/API/Mongo verification
→ Security and concurrency review
→ Production build and isolated browser verification
→ Gate 2 Owner signoff
→ Separate implementation checkpoint authorization
→ Separate production-readiness verification
→ Separate production-exposure authorization
```

No step authorizes the next automatically.

### 21. Risks and mitigations

| Risk | Contract mitigation |
| --- | --- |
| Fragment leakage | Immediate client removal; no persistence or third parties |
| Argon2 denial of service | Persistent atomic limiter before hashing |
| Partial limiter write | Attempt and both counters in one transaction |
| Concurrent limiter bypass | Unique window keys and transactional increments |
| Retry double counting | Stable server attempt ID and bounded same-attempt retries |
| Concurrent activation | Exact conditional invitation consumption |
| Reissue race | One invitation-state winner |
| Email collision | Transaction check plus canonical unique index |
| Partial Admin identity | All identity writes in one session |
| Unknown activation commit | Same-transaction commit retry and read-only reconciliation |
| Cross-origin abuse | Strict server-configured Origin allowlist |
| Malformed request bypass | Bounded read and applicable accounting before parse response |
| IP spoofing | Production disabled until Render trust is proven |
| Missing Admin login | Gate 2 is not a complete production journey |

### 22. Owner approval checklist

Owner approval confirms:

- Gate 2 is Activation only.
- Login, Recovery, Dashboard, and operational tooling remain excluded.
- Limits remain 5 token / 10 IP / 15 minutes.
- Token and IP accounting is atomic and retry-safe.
- Durable denied attempts count; rolled-back infrastructure failures do not
  falsely claim counting and still fail closed.
- Origin, media type, body, and trusted-IP protections are mandatory.
- Gate 2 checkpoint does not authorize production exposure.
- Unknown commit results cannot create duplicate identity or audit writes.
- No automatic session is created.
- Existing password policy is reused.
- The file ledger and verification matrix are binding.
- No real Admin, live email, or production mutation belongs to Gate 2
  verification.

### 23. Final authorization state

```yaml
GATE_2_GOAL_CONTRACT:
  version: v2
  owner_signoff: APPROVED
  contract_review: PASS
  scope: LOCKED

BASELINE: f4ae2c1cd93b7295b1149560039ad989de76cbd7

LOCKED_OWNER_DECISIONS: UNCHANGED
RATE_LIMIT_NUMBERS: UNCHANGED
GATE_2_SCOPE: UNCHANGED

IMPLEMENTATION_AUTHORIZED: NO
CHECKPOINT_AUTHORIZED: NO
PRODUCTION_EXPOSURE_AUTHORIZED: NO
```

#### v1 to v2 revision ledger

```yaml
C1: atomic token/IP rate-limit consistency
C2: production exposure boundary
C3: Origin/CORS/Content-Type protections
C4: unknown commit result and idempotency
```
