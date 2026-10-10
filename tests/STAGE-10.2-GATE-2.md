# Stage 10.2 — Gate 2 Activation Verification

This file records the Gate 2 implementation test procedure. It does not
authorize deployment, production exposure, a checkpoint, commit, or push.

## Local Mongo verification

Use a local PowerShell from the repository root. The test refuses any target
other than `athar_stage55_test`; the local `.env.local` values are never printed.

```powershell
node --env-file=.env.local --conditions=react-server --import tsx --test tests/stage-10.2-admin-activation-mongo.test.ts
```

The activation HMAC key must be a dedicated server-side value of at least 32
UTF-8 bytes. Do not reuse `AUTH_SECRET`. The route remains disabled unless
`ADMIN_ACTIVATION_ENABLED=1`, `NODE_ENV=development`, and the configured
database is exactly `athar_stage55_test`; it also requires an exact
`ADMIN_ACTIVATION_ALLOWED_ORIGINS` allowlist. The production environment remains
hard-disabled by this implementation pending the separately authorized Render
proxy/IP provenance gate.

## Owner browser fixture preparation

The local-only fixture helper reuses the Admin invitation repository and
provisioning token/URL rules without invoking the Brevo mailer. It creates one
`@example.invalid` pending invitation in
`athar_stage55_test`, keeps delivery status pending, creates no User or
Credential before activation, and sends no email. Run it only from local
PowerShell in the repository root; do not run
the normal `admin:provision` command for this verification.

```powershell
node --env-file=.env.local --conditions=react-server --import tsx scripts/admin-activation-browser-fixture.ts create
```

Keep its `FIXTURE_ID` for cleanup. Its one-time `LOCAL_ACTIVATION_URL` contains
the raw test token in the fragment: open it locally, but never paste it into a
chat, screenshot, issue, or log. The token is not persisted in the database;
only its hash is. The helper does not start Next or enable the API. Start a
separate development server with temporary shell-scoped settings (stop an old
server on port 3000 first):

```powershell
$env:ADMIN_ACTIVATION_ENABLED = '1'
$env:ADMIN_ACTIVATION_ALLOWED_ORIGINS = 'http://localhost:3000'
$env:ADMIN_ACTIVATION_RATE_LIMIT_HMAC_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev
```

The generated HMAC key is not printed; it is distinct from `AUTH_SECRET` and
exists only in this shell and its development-server child. Close that shell
after verification. Do not edit `.env.local` or reuse `AUTH_SECRET`.

After Owner browser verification, clean only that fixture by its ID:

```powershell
$fixtureId = Read-Host "Enter FIXTURE_ID"
node --env-file=.env.local --conditions=react-server --import tsx scripts/admin-activation-browser-fixture.ts cleanup $fixtureId
```

Cleanup removes only the matching test invitation, its activation User and
Credential if present, and its matching test audit events. Rate-limit receipts
and counters remain TTL-managed, as required by the limiter contract. No
fixture is created merely by documenting these commands.

## Explicit index setup

Activation indexes are explicit operational setup, never created by a request.
For the isolated local verification database only:

```powershell
node --env-file=.env.local --conditions=react-server --import tsx --input-type=module -e "const { runEnsureAdminActivationIndexes } = await import('./scripts/ensure-admin-activation-indexes.ts'); process.exitCode = await runEnsureAdminActivationIndexes();"
```

This command refuses to run unless `MONGODB_DB_NAME` is exactly
`athar_stage55_test`. Production index setup/exposure is not authorized here.

## Security boundaries implemented

- The activation page reads the token from the URL fragment and removes the
  fragment before rendering the form; it does not persist the token.
- The API accepts only same-origin requests from a strict configured allowlist,
  caps request bodies, and emits no CORS permissions.
- Production is denied regardless of environment flags. No forwarded header is
  trusted for client-IP identification; local development uses one conservative
  synthetic loopback bucket only.
- Persistent token/IP counters and stable-attempt receipts commit atomically.
- Admin identity, credential, consumed invitation, and success audit commit in
  one Mongo transaction. A session is not created.

## Verification evidence

The following execution results were reported by the Owner from local
PowerShell/browser verification. They are not claimed as new Codex reruns:

- After the success-UI correction: Playwright activation UI 1/1 PASS;
  TypeScript PASS; ESLint PASS with 0 errors and 2 known unrelated
  `CartPage.tsx` warnings; production build PASS with 38/38 static pages.
- After the correction: Gate 1 and Stage 10.1 non-Mongo regression files
  below passed 11/11, with 0 failures and 0 skips.
- Before the correction, with no activation security/runtime path change in
  the correction: Gate 2 focused tests 8/8 PASS and Gate 2 Mongo integration
  2/2 PASS against `athar_stage55_test`.
- Owner browser activation, URL fragment removal, fixture cleanup, no
  automatic Admin session, and independent password visibility controls:
  PASS as previously observed.
- Earlier `git diff --check`: PASS. The current corrected diff is checked
  separately in the final review.

The historical dedicated Stage 10.1 Mongo test passed 1/1 against
`athar_stage55_test`. It was **not rerun** for this Gate 2 correction and is
not a fresh Gate 2 PASS. The Gate 2 Mongo 2/2 result above is separate.

## Required non-Mongo regression mapping

The Gate 2 focused 8/8 result covers the Gate 2 activation tests, not by
itself the Gate 1 and Stage 10.1 regression suites required by the Goal
Contract. The existing non-Mongo regression files are
`tests/stage-10.2-admin-provisioning.test.ts` (Gate 1) and
`tests/stage-10.1-admin-authorization.test.ts` (Stage 10.1). The Owner ran
both after the correction without the separate dedicated-Mongo files:

```powershell
node --conditions=react-server --import tsx --test tests/stage-10.2-admin-provisioning.test.ts tests/stage-10.1-admin-authorization.test.ts
```

Owner-reported result: **11/11 PASS**, 0 failed, 0 skipped. This does not
replace the historical Stage 10.1 dedicated Mongo evidence or the separate
Gate 2 Mongo evidence.

Gate 2 Final Recheck: PASS. Owner Signoff: APPROVED. These decisions do not
authorize staging, an implementation checkpoint, commit, push, or production
exposure. Gate 2 is not yet checkpointed or closed; Admin Login and Recovery
remain unimplemented and unauthorized later-gate work.
