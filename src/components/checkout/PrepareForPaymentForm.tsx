"use client";

import { useActionState } from "react";

import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import { prepareCheckoutForPaymentAction, type PrepareForPaymentState } from "@/server/checkout/actions";
import styles from "./CheckoutDetailsForm.module.css";

const initialState: PrepareForPaymentState = { status: "idle" };

/** Reservation remains the truthful boundary before the later card-only step. */
export function PrepareForPaymentForm({ draft }: { draft: CheckoutDraftPublic }) {
  const [state, formAction, pending] = useActionState(prepareCheckoutForPaymentAction, initialState);
  return (
    <form action={formAction} className={styles.form}>
      <input name="checkoutId" type="hidden" value={draft.checkoutId} />
      <button disabled={pending || state.status === "reserved"} type="submit">
        {pending ? "Preparing your items…" : state.status === "reserved" ? "Items reserved" : "Prepare for payment"}
      </button>
      <p className={styles.helper} role="status">
        {state.message ?? "Items are reserved for 15 minutes only after this step. Secure card payment becomes available after reservation."}
      </p>
    </form>
  );
}
