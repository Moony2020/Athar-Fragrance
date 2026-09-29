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
              title="Pay with card via Stripe"
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
                <span className={styles.payWithText}>Pay with</span>
                <span className={styles.paypalBrand}>
                  {/* Official PayPal Double-P Vector Emblem with proper layering */}
                  <svg className={styles.paypalEmblem} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M34.2 15.6h25.4c12.7 0 22.8 8.8 21.4 22.2-1.7 15.2-13.8 26.6-29 26.6H40.2l-5.1 32.5c-.3 1.9-1.9 3.3-3.8 3.3H16.8c-2.3 0-4-2.1-3.6-4.4L29.6 19.3c.4-2.1 2.2-3.7 4.6-3.7z" fill="#003087"/>
                    <path d="M49.6 37.9h21.8c11 0 19.7 7.7 18.5 19.3-1.5 13.2-11.9 23-25.1 23H52.9l-4.5 28.3c-.3 1.9-1.9 3.3-3.8 3.3H30c-2.3 0-4-2.1-3.6-4.4l11.2-70.8c.4-2.1 2.2-3.7 4.6-3.7h7.4z" fill="#0079C1"/>
                    <path d="M40.2 64.4l5.1-32.5h11.8c12.7 0 22.8 8.8 21.4 22.2-.6 5.5-3.3 10.3-7.5 13.9-3.2-2.7-7.4-4.3-12-4.3H49.6l-5.1 32.5c-.3 1.9-1.9 3.3-3.8 3.3H30l4.7-29.6c1.5-.7 3.3-1.4 5.5-1.5z" fill="#002069"/>
                  </svg>
                  <span className={styles.paypalWordmark}>
                    <span className={styles.payBlue}>Pay</span>
                    <span className={styles.palCyan}>Pal</span>
                  </span>
                </span>
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
