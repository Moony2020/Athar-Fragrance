import "server-only";

import { createHash } from "node:crypto";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { resolveCheckoutTotals } from "@/checkout/totals";
import { createPaymentAttemptDocument, type PaymentAttemptBinding } from "@/payments/payment-attempt-contract";
import { toPaymentAttemptPublic, type PaymentAttemptPublic } from "@/payments/payment-attempt-document";
import { MongoCheckoutDraftStore } from "@/server/checkout/draft-store";
import { readCurrentCheckout } from "@/server/checkout/read-model";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoInventoryReservationStore } from "@/server/inventory/reservation-store";
import { MongoPaymentAttemptStore } from "./payment-attempt-store";

export type PreparePaymentAttemptResult =
  | { status: "created"; attempt: PaymentAttemptPublic; idempotent: boolean }
  | { status: "blocked" | "expired" | "unavailable" };

function cartFingerprint(lines: Array<{ productSlug: string; variantId: string; quantity: number }>): string {
  return createHash("sha256").update(lines
    .slice()
    .sort((left, right) => left.productSlug.localeCompare(right.productSlug) || left.variantId.localeCompare(right.variantId))
    .map((line) => `${line.productSlug}:${line.variantId}:${line.quantity}`).join("|"))
    .digest("base64url");
}

export function buildPaymentAttemptBinding(input: {
  owner: Awaited<ReturnType<typeof resolveCurrentCheckoutOwner>>;
  checkoutId: string;
  checkout: Awaited<ReturnType<typeof readCurrentCheckout>>;
  draft: Awaited<ReturnType<MongoCheckoutDraftStore["get"]>>;
  reservation: Awaited<ReturnType<MongoInventoryReservationStore["readActiveBinding"]>>;
  now: Date;
}): PaymentAttemptBinding | null {
  if (!input.owner || !input.draft || !input.reservation || input.reservation.expiresAt <= input.now) return null;
  const totals = resolveCheckoutTotals({ checkout: input.checkout, draft: input.draft });
  if (input.checkout.status !== "ready" || totals.status !== "ready" || !input.draft.selectedShippingMethodId) return null;
  const lines = input.checkout.lines.flatMap((line) => line.status === "eligible"
    ? [{ productSlug: line.productSlug, variantId: line.variantId, quantity: line.quantity }]
    : []);
  const fingerprint = cartFingerprint(lines);
  if (lines.length === 0 || input.reservation.cartFingerprint !== fingerprint) return null;
  return {
    owner: input.owner,
    checkoutId: input.checkoutId,
    checkoutRevision: input.draft.revision,
    reservation: { reservationId: input.reservation.reservationId, checkoutId: input.reservation.checkoutId, status: "active", expiresAt: input.reservation.expiresAt },
    cartFingerprint: fingerprint,
    totals,
    shippingMethodId: input.draft.selectedShippingMethodId,
  };
}

/**
 * Server-only Stage 8.1 boundary. It takes no browser totals, reservation,
 * provider, or status input. Provider execution remains explicitly out of scope.
 */
export async function preparePaymentAttempt(rawCheckoutId: unknown, now = new Date()): Promise<PreparePaymentAttemptResult> {
  const checkoutId = checkoutIdSchema.safeParse(rawCheckoutId);
  if (!checkoutId.success) return { status: "blocked" };

  try {
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "blocked" };
    const [checkout, draft, reservation] = await Promise.all([
      readCurrentCheckout(),
      new MongoCheckoutDraftStore().get(owner, checkoutId.data),
      new MongoInventoryReservationStore().readActiveBinding(owner, checkoutId.data, now),
    ]);
    if (!draft) return { status: "expired" };
    const store = new MongoPaymentAttemptStore();
    const binding = buildPaymentAttemptBinding({ owner, checkoutId: checkoutId.data, checkout, draft, reservation, now });
    if (!binding) {
      // A changed Cart, checkout revision, totals, or reservation never keeps a
      // local pre-provider attempt silently usable.
      await store.supersedePending(owner, checkoutId.data, now);
      return reservation?.expiresAt && reservation.expiresAt <= now ? { status: "expired" } : { status: "blocked" };
    }
    const document = createPaymentAttemptDocument(binding, now);
    await store.supersedeIncompatible(owner, checkoutId.data, document.idempotencyKey, now);
    const result = await store.createOrRead(document);
    return { status: "created", attempt: toPaymentAttemptPublic(result.attempt), idempotent: result.idempotent };
  } catch {
    return { status: "unavailable" };
  }
}
