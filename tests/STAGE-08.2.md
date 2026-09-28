# Stage 8.2 — Stripe PaymentIntent & Payment Element

Status: **IMPLEMENTED — STRIPE SANDBOX VERIFICATION PENDING** from
`863f3fe0bed7a4be5fbadbc9577c58393d50f45c`.

The owner-approved launch policy is immediate capture: Stripe PaymentIntents
explicitly use `capture_method: "automatic"`. The later PayPal policy is
`intent = CAPTURE`; PayPal is not implemented in this stage.

After the existing server-owned Cart, Checkout, totals and fixed active
reservation gates pass, Stage 8.2 prepares/reuses the compatible durable local
PaymentAttempt and creates/retrieves a card-only Stripe PaymentIntent using its
durable provider-operation idempotency key. The Stripe amount/currency come
only from the immutable local snapshot (`SEK` integer minor units). The local
binding stores only the internal PaymentIntent ID and safe provider observation;
the client secret is transient to the current owner and never persisted or put
in a URL.

Payment Element collects card details directly for Stripe. Browser confirmation
can show only a safe submitted/processing state; it cannot create an ATHAR
Order, consume final inventory, send email, or establish final payment truth.
Webhook-trusted finalization remains a later stage.

## Verification

- focused Stripe contract and Mongo binding tests pass locally;
- Stage 8.1 and Stage 7.4/7.5 regressions pass with disposable
  `athar_stage55_test` cleanup;
- Stripe sandbox and Payment Element browser verification are pending because
  neither required Stripe environment key is configured;
- no live charge is attempted.
