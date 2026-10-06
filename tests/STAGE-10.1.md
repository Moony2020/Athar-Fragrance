# Stage 10.1 — Admin Identity & Server-Side Authorization Foundation

## Scope

Canonical `customer | admin` role compatibility, persisted-role authorization,
controlled first-Admin bootstrap, security-version revocation, append-only
privileged audit persistence, and the minimal protected `/admin` shell. No
dashboard, operational Admin tools, or account-disable mutation is included.

## Focused local verification

```text
node --conditions=react-server --import tsx --test tests/stage-10.1-admin-authorization.test.ts tests/stage-10.1-admin-authorization-mongo.test.ts tests/stage-06.1-domain.test.ts tests/stage-06.2-auth.test.ts tests/stage-06.5-auth.test.ts
```

Non-Mongo result in the Codex process: 17 passed, 0 failed, 1 skipped. The
skip is the existing Stage 6.5 dedicated-Mongo test because that process has no
usable Mongo connectivity; no database was contacted by that skipped test.

## Dedicated Mongo verification — PASS

Real local PowerShell execution ran the dedicated Stage 10.1 Mongo transaction
test against `athar_stage55_test`: 1 passed, 0 failed. It verified transactional
bootstrap, customer-to-Admin role change, `securityVersion` increment,
privileged audit event, fixed `system/admin-bootstrap` actor, idempotent retry,
nonexistent-target handling, rollback atomicity, audit index, secret safety,
and fixture cleanup.

## Owner `/admin` verification — PASS

- Unauthenticated access follows the sign-in flow.
- An authenticated customer receives safe Access Denied.
- A fresh session for the temporary local/test-only Admin fixture renders the
  protected Admin shell.
- No privileged-data leakage was observed.

The fixture exists only in `athar_stage55_test`; it is not a real/live Admin
identity. No Render/live/production Admin account was created or promoted.

## Production build — PASS

Real local PowerShell execution of `npm run build` on Next.js 16.3.8 passed:
compiled successfully, TypeScript passed, static generation completed 36/36,
and `/admin` is present in the production route graph.

## Stage boundary

Stage 10.2 Admin Provisioning, Activation & Dedicated Admin Login remains out
of scope and is not implemented here.
