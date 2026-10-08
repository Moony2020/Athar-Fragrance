# Stage 10.2 Gate 1 — Pending Admin Invitation & Controlled Provisioning

Gate 1 implements only the pending invitation and Owner-controlled provisioning
foundation. It does not implement activation, Admin credentials, Admin login,
Admin recovery, or Admin authentication rate limiting.

The dedicated automated checks cover the separate invitation persistence model,
24-hour expiry, SHA-256 token digest boundary, fragment-only activation URL,
existing identity collision rejection, explicit atomic reissue, concurrency,
fixed privileged audit actor/actions, Admin-purpose mail boundary, strict CLI
arguments, delivery failure semantics, required indexes, and fixture cleanup.
The concurrency coverage binds competing reissues to one immutable predecessor
and requires one winner plus one safe conflict. It also covers an expired
pending record before TTL cleanup, explicit expired-invitation reissue, normal
provision racing with reissue, mutually exclusive lifecycle timestamps, and
the injected CLI runner's failure boundary before Mongo or Brevo initialization.

Mongo verification is valid only against `athar_stage55_test` with disposable
`example.invalid` fixtures. No real Admin identity or live email is part of this
gate.
