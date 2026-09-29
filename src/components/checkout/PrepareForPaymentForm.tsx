"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import { Button } from "@/components/ui/Button/Button";
import { prepareCheckoutForPaymentAction, type PrepareForPaymentState } from "@/server/checkout/actions";
import styles from "./CheckoutDetailsForm.module.css";

const initialState: PrepareForPaymentState = { status: "idle" };

/** Reservation remains the truthful boundary before the later card-only step. */
export function PrepareForPaymentForm({ draft, variant = "panel" }: { draft: CheckoutDraftPublic; variant?: "panel" | "summary" }) {
  const [state, formAction, pending] = useActionState(prepareCheckoutForPaymentAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "reserved") router.refresh();
  }, [router, state.status]);

  const form = (
    <form action={formAction} className={styles.form}>
      <input name="checkoutId" type="hidden" value={draft.checkoutId} />
      <Button disabled={pending || state.status === "reserved"} type="submit">
        {pending ? "Opening secure payment…" : state.status === "reserved" ? "Opening secure payment…" : "Continue to payment"}
      </Button>
      {state.message ? <p className={state.status === "reserved" ? styles.success : styles.formMessage} role={state.status === "reserved" ? "status" : "alert"}>{state.message}</p> : null}
    </form>
  );

  if (variant === "summary") return form;

  return (
    <section aria-labelledby="secure-payment-title" className={styles.panel}>
      <div className={styles.heading}>
        <p className={styles.kicker}>PAYMENT</p>
        <h2 id="secure-payment-title">Continue to secure payment</h2>
        <p>Your items will be held for 15 minutes while you complete card payment.</p>
      </div>
      {form}
    </section>
  );
}
