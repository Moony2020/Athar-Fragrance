# Stage 7.4 — Totals, VAT & Discount Contract

## Goal contract

Checkout exposes a single server-authoritative, integer-minor-unit totals read
model. It derives the current Cart merchandise subtotal, the current eligible
Stage 7.3 shipping amount, an explicitly empty production discount boundary,
the included Swedish VAT amount, and the final customer total. Derived totals
are never persisted in a Checkout draft and browser-supplied totals have no
authority.

## Owner-approved policy

- Current market and currency: Sweden (`SE`) / `SEK`.
- Customer product prices and the charged `5900` shipping amount are
  VAT-inclusive.
- Current checkout VAT rate: 25%. VAT is extracted using integer half-up
  arithmetic; it is never added on top of displayed customer prices.
- No production coupon, promotion, or discount policy is active. The public
  contract returns `discountTotal: 0` and no applied discounts.
- The existing free-shipping threshold remains based on the pre-discount
  merchandise subtotal until a separately approved discount policy defines a
  different ordering.

## Verification ledger

- Focused domain tests: implemented; must cover integer money, 25% included
  VAT, threshold boundaries, no double VAT, empty production discount state,
  stale/invalid shipping selection, currency mismatch, and ignored browser
  totals.
- Browser E2E: implemented for guest and authenticated owners using only
  `athar_stage55_test` and the fixture runtime. It must prove below- and
  above-threshold totals, server recomputation, and disposable-fixture cleanup.
- Final evidence (2026-09-28): focused unit/regression/Mongo coverage passed
  19/19; isolated guest and
  authenticated Browser E2E passed 2/2 and cleaned all disposable fixtures;
  isolated TypeScript and Webpack production build passed. Stage status:
  **COMPLETE — READY FOR CHECKPOINT**. No payment, Order, inventory
  reservation, coupon campaign, invoice, or provider behavior is in scope.
