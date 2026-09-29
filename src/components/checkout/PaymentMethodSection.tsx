"use client";

import { useActionState, useEffect } from "react";

import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import { prepareStripePaymentAction, type StripePaymentActionState } from "@/server/payments/stripe-actions";
import { preparePayPalPaymentAction, type PayPalPaymentActionState } from "@/server/payments/paypal-actions";
import styles from "./PaymentMethodSection.module.css";

const initialState: StripePaymentActionState = { status: "idle" };
const initialPayPalState: PayPalPaymentActionState = { status: "idle" };

export function PaymentMethodSection({ draft, paypalEnabled }: { draft: CheckoutDraftPublic; paypalEnabled: boolean }) {
  const [stripeState, stripeAction, stripePending] = useActionState(prepareStripePaymentAction, initialState);
  const [paypalState, paypalAction, paypalPending] = useActionState(preparePayPalPaymentAction, initialPayPalState);

  useEffect(() => {
    if (stripeState.status === "ready") window.location.assign(stripeState.url);
  }, [stripeState]);
  useEffect(() => {
    if (paypalState.status === "ready") window.location.assign(paypalState.url);
  }, [paypalState]);

  return (
    <section aria-labelledby="payment-method-title" className={styles.section}>
      <div className={styles.heading}>
        <p className={styles.kicker}>SECURE CHECKOUT</p>
        <h2 id="payment-method-title">Payment method</h2>
        <p>Choose your preferred payment provider. You will be redirected to complete your payment securely.</p>
      </div>

      <div className={styles.methods}>
        {/* Stripe Option */}
        <div className={styles.method}>
          <form action={stripeAction}>
            <input name="checkoutId" type="hidden" value={draft.checkoutId} />
            <button
              aria-label="Pay securely with Card via Stripe"
              className={`${styles.paymentButton} ${styles.stripeBtn}`}
              disabled={stripePending}
              type="submit"
            >
              <div className={styles.stripeContent}>
                <div className={styles.cardLogosGroup} aria-hidden="true">
                  {/* Visa Badge */}
                  <div className={styles.cardBadge}>
                    <span className={styles.visaText}>VISA</span>
                  </div>
                  {/* Mastercard Badge */}
                  <div className={styles.cardBadge}>
                    <svg className={styles.mcSvg} viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="11" cy="10" r="9" fill="#EB001B"/>
                      <circle cx="21" cy="10" r="9" fill="#F79E1B"/>
                      <path d="M16 3.6C18 5.3 19.3 7.8 19.3 10C19.3 12.2 18 14.7 16 16.4C14 14.7 12.7 12.2 12.7 10C12.7 7.8 14 5.3 16 3.6Z" fill="#FF5F00"/>
                    </svg>
                  </div>
                </div>

                <span className={styles.stripeDivider} aria-hidden="true" />

                {/* Stripe Wordmark */}
                <span className={styles.stripeText}>stripe</span>
              </div>
            </button>
          </form>
          <p className={styles.methodHint}>Credit / Debit Cards, Apple Pay & Google Pay</p>
        </div>

        {/* PayPal Option */}
        <div className={styles.method}>
          <form action={paypalAction}>
            <input name="checkoutId" type="hidden" value={draft.checkoutId} />
            <button
              aria-label="Pay securely with PayPal"
              className={`${styles.paymentButton} ${styles.paypalBtn}`}
              disabled={!paypalEnabled || paypalPending}
              type="submit"
              title={paypalEnabled ? "Pay with PayPal" : "PayPal is not configured yet"}
            >
              <div className={styles.paypalContent}>
                {/* PayPal Double P Icon */}
                <svg className={styles.paypalIcon} viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3.8 0h9.2c3.7 0 6.6 2.8 6.4 6.5-.4 4.3-3.8 7.5-8.1 7.5H7.1L5.3 24.2C5.2 24.7 4.7 25 4.2 25H0.6C0 25-.3 24.4-.2 23.9L4 1.1C4.1.5 4.6 0 5.2 0h-1.4z" fill="#003087"/>
                  <path d="M8.5 7.2h6.5c3.2 0 5.8 2.4 5.6 5.6-.4 3.7-3.4 6.5-7.1 6.5H9.7l-1.3 6.9c-.1.4-.4.8-.9.8H4.6c-.5 0-.8-.5-.7-1l2.9-15.3c.1-.5.6-.9 1.1-.9h.6v-2.6z" fill="#0079C1"/>
                  <path d="M9.7 19.3l.9-4.6c.3-.1.6-.2 1-.2 3.7 0 6.7-2.8 7.1-6.5.1-.9 0-1.7-.3-2.4-1.2 3.8-4.5 6.7-8.7 6.7z" fill="#00457C"/>
                </svg>
                {/* PayPal Text */}
                <div className={styles.paypalTextWrap}>
                  <span className={styles.paypalTextPay}>Pay</span>
                  <span className={styles.paypalTextPal}>Pal</span>
                </div>
              </div>
            </button>
          </form>
          <p className={styles.methodHint}>
            {paypalEnabled ? "Pay with PayPal balance or linked cards" : "PayPal is temporarily unavailable"}
          </p>
        </div>
      </div>

      <div className={styles.securityBadge}>
        <svg className={styles.securityIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>256-bit SSL encrypted & authenticated payment</span>
      </div>

      <p className={styles.status} role={stripeState.status === "idle" && paypalState.status === "idle" ? undefined : "status"}>
        {stripePending ? "Opening Stripe Checkout…" : paypalPending ? "Opening PayPal…" : stripeState.status !== "idle" && "message" in stripeState ? stripeState.message : paypalState.status !== "idle" && "message" in paypalState ? paypalState.message : null}
      </p>
    </section>
  );
}
