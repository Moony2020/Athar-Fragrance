"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { useActionState, useMemo, useState } from "react";

import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import { prepareStripePaymentAction, type StripePaymentActionState } from "@/server/payments/stripe-actions";
import styles from "./StripePaymentSection.module.css";

const initialState: StripePaymentActionState = { status: "idle" };

export function StripePaymentSection({ draft, publishableKey }: { draft: CheckoutDraftPublic; publishableKey: string | null }) {
  const [state, formAction, pending] = useActionState(prepareStripePaymentAction, initialState);
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);
  if (!publishableKey) return <section className={styles.section} aria-label="Card payment"><p className={styles.status} role="status">Secure card payment is not configured yet.</p></section>;

  if (state.status === "ready") {
    const options: StripeElementsOptions = { clientSecret: state.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#171512", colorText: "#171512", colorBackground: "#fbf8f2", borderRadius: "8px" } } };
    return <section className={styles.section} aria-label="Card payment"><p className={styles.kicker}>SECURE CARD PAYMENT</p><Elements options={options} stripe={stripePromise}><CardConfirmation /></Elements></section>;
  }

  return <section className={styles.section} aria-label="Card payment">
    <p className={styles.kicker}>SECURE CARD PAYMENT</p>
    <form action={formAction} className={styles.form}>
      <input name="checkoutId" type="hidden" value={draft.checkoutId} />
      <button disabled={pending} type="submit">{pending ? "Preparing secure payment…" : "Continue to card payment"}</button>
      <p className={styles.status} role="status">{state.status === "idle" ? "Your card details are handled securely by Stripe." : state.message}</p>
    </form>
  </section>;
}

function CardConfirmation() {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("Enter your card details to submit payment.");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setMessage("Submitting payment securely…");
    const submitted = await elements.submit();
    if (submitted.error) {
      setPending(false);
      setMessage(submitted.error.message ?? "Your payment details need attention.");
      return;
    }
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/checkout` }, redirect: "if_required" });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message ?? "Your payment could not be submitted.");
      return;
    }
    // A browser response is never ATHAR Order or inventory-finalization truth.
    setMessage("Payment submitted. We are waiting for payment confirmation.");
  }

  return <form className={styles.form} onSubmit={submit}>
    <PaymentElement options={{ layout: "tabs" }} />
    <button disabled={pending || !stripe || !elements} type="submit">{pending ? "Submitting payment…" : "Submit payment"}</button>
    <p className={styles.status} role="status">{message}</p>
  </form>;
}
