# Stage 6.5 — Account Security & Password Recovery

## Status

**STAGE 6.5 COMPLETE — ACCOUNT SECURITY & PASSWORD RECOVERY**

Baseline: `87b9993d9d0a6bb76d6eb88b3909f90591750ff0`.

## Implemented

- `/account/forgot-password` and `/account/reset-password` UI plus
  `/api/auth/forgot-password` and `/api/auth/reset-password` handlers.
- Generic account-independent forgot response; disabled/nonexistent accounts
  are not eligible for token creation.
- 32-byte cryptographic token, 30-minute expiry, SHA-256 hash-only storage,
  per-user replacement, one-time transactional consume, sibling-token cleanup.
- Explicit idempotent unique `userId`/`tokenHash` indexes and expiry TTL index
  through `ensurePasswordResetIndexes()`.
- Existing 12–128 password policy with at least one letter, Argon2id
  `m=65536,t=3,p=4`, and private
  credential security-version increment to invalidate old Auth.js JWT sessions.
- Server-only Brevo REST adapter; no raw token, URL, provider key, or password
  is logged. `.env.example` documents variables without secrets.
- Local E2E can explicitly enable a non-production-only in-memory test mailer;
  its captured reset link requires a per-run secret header. Production always
  selects Brevo.

## Final closure evidence — 2026-09-25

- Fixed the confirmed Forgot Password route input-shape bug: after strict
  validation, the service now receives `parsed.data.email` as a string. A
  focused regression verifies the valid value and confirms malformed input
  retains the generic response without calling the service.
- Browser E2E passed: active test account → generic Forgot Password response →
  exactly one protected test-mail capture → Reset Password → old password
  rejected/new password accepted → previous session invalidated → reused token
  rejected. Unknown and disabled accounts retain the same generic response and
  produce no mail. Token expiry and replacement invalidation were also covered.
- Post-E2E cleanup audit on `athar_stage55_test`: **0** disposable Stage 6.5
  users, **0** matching credentials, and **0** matching reset-token documents.
- Stage 6.5 focused auth/Mongo tests: **8 passed, 0 failed, 0 skipped**.
  Prior-stage domain/auth regression: **36 passed, 1 skipped, 0 failed**; the
  skipped live reset transaction was run separately. Live Mongo regressions for
  Stages 6.1, 6.2, and 6.4 each passed (one test per stage) against the same
  dedicated database.
- Full TypeScript passed. Full ESLint passed with one existing warning in
  `SignInForm.tsx` (`window.location.assign`). `git diff --check` passed.
- After the production route fix, clean baseline `87b9993` and baseline plus
  Stage-6.5-owned production files both passed isolated Turbopack production
  builds. The existing current-tree build attribution remains external to this
  stage: preserved Owner Header/Wishlist cookie-backed runtime access affects
  `/_not-found`; it was not changed here.
- `LIVE BREVO DELIVERY — NOT YET VERIFIED`; no live email was sent and this is
  not a Stage 6.5 closure blocker. Stage 6.6 has not started. No commit or push.

## Evidence

- Stage 6.5 focused auth tests: **5 passed, 0 failed** against the exact test database. The live
  test verified strict parsing, generic responses, password policy/hash,
  reset-index names, hash-only token persistence, concurrent one-time token
  consumption, Argon2id credential update, and `securityVersion` increment.
  Its disposable Mongo fixtures were removed in `finally` and the client closed.
- The live test initially exposed an inverted assertion that expected a just-
  inserted hash-only token not to exist. It now verifies the stored hash and
  absence of a raw `token` field. The `finally` block also closes the shared
  database client to prevent a hanging test process.
- TypeScript: passed; full ESLint: passed with one pre-existing warning in
  `SignInForm.tsx` (use of `window.location.assign`).
- Stage 5.1–5.5 and Stage 6.1–6.5 domain/auth focused regression: **33 passed,
  1 skipped**, 0 failed. The skipped test is the live Mongo reset transaction.
- Mongo readiness: `.env.local` was loaded by Next's environment loader;
  `MONGODB_URI` is present, `MONGODB_DB_NAME` is exactly
  `athar_stage55_test`, and persistence mode is `mongo`. No URI or secret was
  printed. The earlier TLS failures followed a network change: the owner moved
  from mobile hotspot to hotel Wi-Fi while Atlas showed the active IP was not
  on its IP Access List. After addressing the active network IP, the owner
  reported two consecutive `MONGO_PING: PASS` results on hotel Wi-Fi. This
  supports a network/IP allow-list explanation, not an application TLS
  regression. URI and TLS settings were not changed.
- TLS path isolation (2026-09-23): Node `v24.19.0`, bundled OpenSSL
  `3.5.7`, Windows `10.0.26220.0`, MongoDB Node driver `7.6.0`. Explicit
  hostname SNI and no-SNI probes were run for each SRV host at both TLS 1.2 and
  TLS 1.3. All 12 combinations returned
  `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`; no peer certificate was received.

  | Atlas SRV host | SNI + TLS 1.2/1.3 | No SNI + TLS 1.2/1.3 | Certificate |
  | --- | --- | --- | --- |
  | `ac-rslqdld-shard-00-00.axbnmlm.mongodb.net` | Same TLS alert | Same TLS alert | None received |
  | `ac-rslqdld-shard-00-01.axbnmlm.mongodb.net` | Same TLS alert | Same TLS alert | None received |
  | `ac-rslqdld-shard-00-02.axbnmlm.mongodb.net` | Same TLS alert | Same TLS alert | None received |

  Node direct TLS and MongoDB driver 7.6.0 ping both fail with the same root
  TLS alert. `mongosh` and OpenSSL CLI are not installed, so those clients were
  not run. No HTTP(S)/ALL proxy, WinINET proxy, WinHTTP proxy, VPN connection,
  `NODE_EXTRA_CA_CERTS`, or SSL CA override was detected. Defender status was
  unavailable; no protection was disabled. The driver is not evidently stale:
  MongoDB's current Node driver docs list 7.6 as the current release line and
  document 7.6 upgrade notes ([release notes](https://www.mongodb.com/docs/drivers/node/current/reference/release-notes/),
  [upgrade guide](https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/)).
  These historical failures are superseded for this verification run by the
  later successful pings after the network/IP-list change.
- Atlas control plane: read-only MCP access is disabled for the organization,
  so cluster state and IP Access List could not be checked directly. The owner
  supplied a screenshot showing the current IP was not added and only
  `84.219.76.1/32` active. The owner later reported two consecutive successful
  pings on hotel Wi-Fi after addressing the active network IP; these are owner-
  reported, not agent-run, results.
- Earlier Browser E2E attempts did not capture a test-mail message. The final
  investigation found that the route passed the parsed object where the service
  expected its email string. That defect was fixed and the complete E2E flow is
  now verified as recorded above. Earlier cleanup checks also found no
  disposable fixtures.
  Live Brevo delivery is **NOT YET VERIFIED**; provider credentials and an
  approved recipient are unavailable. No live email was sent.
- Full TypeScript passed. Full ESLint completed with 0 errors and one
  pre-existing warning in `SignInForm.tsx` (`window.location.assign`).
  `git diff --check` passed.
- Isolated build attribution (same isolated env, no `.env.local` secrets):
  clean baseline `87b9993` **PASS**; baseline + Stage-6.5-owned changes
  **PASS**; current working tree **FAIL** at `/_not-found` with uncached/runtime
  data. Current failure is attributable to the preserved Owner Header/Wishlist
  change: `Header` awaits cookie/session-backed `readCurrentCommerceWishlist()`
  outside a `<Suspense>` boundary. The Stage-6.5 reset page was corrected to
  await `searchParams` inside a Suspense-wrapped child, so it no longer blocks
  the Stage-only build. The local untracked `account.module.css` was included
  only as an existing build dependency in the temporary Stage-only snapshot; it
  was not changed or classified as Stage 6.5.
- The earlier 33-test regression run is historical and superseded by the final
  36-pass regression and separate live Mongo checks above. Full TypeScript and
  ESLint were rerun after the route fix. Live Brevo delivery remains **NOT YET
  VERIFIED** and is not a closure blocker.

## Scope boundary

Stage 6.6 has not started. No commit or push was performed. Mongo tests are
guarded to the dedicated `athar_stage55_test` database only. Owner/local files,
`debug.log`, `.env.local`, and cache/attachment directories remain preserved.
