# Stage 7.3 — Shipping Methods / Delivery Selection

## Owner-approved launch policy

- Market and shipping-address country: Sweden (`SE`) only.
- Currency: `SEK`.
- Customer-visible method: `postnord-service-point-se` (`PostNord`).
- Charge: `5900` minor units below eligible merchandise subtotal `69900`;
  `0` at or above the threshold.
- No delivery-time claim.

## Verification contract

All Mongo fixture writes target `athar_stage55_test` only. Tests must cover
the threshold boundaries, country/currency rejection, server-derived method
amount, owner isolation, CAS, reload persistence, invalidation after a
non-SE address, expired drafts, ineligible Carts, tampered inputs, no PII in
URLs/logs, guest/authenticated flows, and cleanup.

## Operational boundary

PostNord merchant/service configuration and perfume dangerous-goods or
limited-quantity acceptance are **NOT YET VERIFIED — REQUIRED BEFORE
PRODUCTION SHIPPING GO-LIVE**. Stage 7.3 has no carrier API, label, EDI,
fulfillment, tax, discount, payment, or order implementation.

## Final verification evidence (2026-09-28)

- Dedicated Mongo writes used `athar_stage55_test` only. The focused
  domain/Mongo/fixture/capability suite passed 7/7, including strict
  Sweden-only availability, the `69900` threshold, selection-only draft
  persistence, owner isolation, and fixture-runtime isolation.
- Isolated Browser E2E passed 2/2: authenticated checkout established a real
  Credentials session, prefills canonical account email without User mutation,
  derives PostNord `5900` below the threshold and `0` at/above it, persists on
  reload, rejects tampered method input, ignores a submitted price field,
  invalidates non-SE delivery, and cleans disposable records; the affected
  guest flow also passed.
- The low-price fictional record (`59900`) exists only while
  `CATALOG_FIXTURE_RUNTIME=1` outside production. It is deliberately outside
  the catalog seed dataset and cannot become a production seed record.
- The isolated Stage-7.3-only TypeScript check and Webpack production build
  passed. Native Turbopack build attribution remains blocked before source
  evaluation by this workstation's worktree `node_modules` Junction; no
  production setting was changed to work around it.
