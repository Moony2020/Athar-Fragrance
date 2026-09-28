# Stage 6.2 — Auth.js Credentials Runtime + Email/Password Registration & Sign-In

Baseline: `2a2706429d0ad5231edf903c4d9aff8fdec85df5`

## Implemented

- Auth.js Credentials provider with JWT sessions.
- Email/password registration endpoint and Auth.js sign-in/sign-out handlers.
- Argon2id password hashing and verification.
- Separate `user_credentials` collection with disabled-user state.
- Generic duplicate-registration errors.
- Session `user.id` contains only the public opaque User ID.

## Excluded

OAuth, Google, Apple, Clerk, magic links, required email verification, password
reset, Brevo sending, guest-to-account merge, account/profile UI, Stage 6.3,
and checkout/payment/order work.

## Verification

- Argon2id and Credentials unit tests pass.
- Real Mongo registration/sign-in/disabled-user/duplicate checks pass against
  `athar_stage55_test`.
- Browser E2E passes through Register UI, duplicate generic error, wrong
  password generic error, disabled-user rejection, Sign-in, protected Account,
  public `userId` display, Sign-out, and password policy 12–128 with at least
  one letter.
- Production build passes with `/account` explicitly request-time (`instant =
  false`) and an isolated environment without `.env.local` runtime loading.

Status: **STAGE 6.2 COMPLETE — AUTH.JS CREDENTIALS RUNTIME + EMAIL/PASSWORD
REGISTRATION & SIGN-IN** (local verification only; live production Atlas Auth
is not verified).
