# Stage 8.1 — Payment Domain & Durable PaymentAttempt Foundation

Status: **COMPLETE — READY FOR CHECKPOINT** from `957bde6ab7ac80c82096098f75aa7e8f9933e4f0`.

This stage creates a provider-neutral, Mongo-only `payment_attempts` foundation.
It binds an opaque local attempt identifier to the server-derived CommerceOwner,
Checkout revision, compatible active inventory reservation, canonical Cart
fingerprint, selected delivery method, and immutable SEK minor-unit total.

Creation is idempotent for the same server-derived binding. A changed Cart,
Checkout revision, reservation, shipping selection, total, or currency yields a
different binding and prior local attempts are superseded when preparation runs.
The 15-minute reservation remains the authoritative fixed expiry and is never
extended by payment-attempt creation.

No provider request, Stripe/PayPal API call, Payment Element, PaymentIntent,
webhook, canonical Order, payment capture, or browser payment truth is included.
Browser input cannot select a provider, amount, terminal status, or reservation.

## Owner decision

**PAYMENT CAPTURE POLICY — OWNER DECISION REQUIRED BEFORE PROVIDER EXECUTION**

Stage 8.1 deliberately does not choose capture versus authorization. That
decision is required before any provider implementation begins.

## Verification intent

- parser and contract tests prove opaque public identifiers, safe DTO exposure,
  strict document parsing, SEK integer amounts, and tamper rejection;
- Mongo-only integration verifies concurrent duplicate idempotency and
  disposable `athar_stage55_test` cleanup;
- no production in-memory fallback exists.
