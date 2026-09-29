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
                  <svg className={styles.cardLogo} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="36" height="24" rx="4" fill="#FFFFFF"/>
                    <path d="M14.5 16.5L16.2 6.5H18.8L17.1 16.5H14.5ZM23.8 6.7C23.3 6.5 22.4 6.3 21.4 6.3C18.8 6.3 17 7.7 17 9.7C17 11.2 18.3 12 19.3 12.5C20.3 13 20.7 13.3 20.7 13.8C20.7 14.5 19.8 14.8 19 14.8C18 14.8 17.4 14.6 16.6 14.2L16.2 16.1C16.9 16.4 18 16.7 19.1 16.7C21.9 16.7 23.6 15.3 23.6 13.2C23.6 11.4 22.3 10.7 21.2 10.1C20.4 9.7 20 9.4 20 8.9C20 8.4 20.6 8 21.5 8C22.2 8 22.8 8.1 23.3 8.4L23.8 6.7ZM28.5 16.5H30.8L28.9 6.5H26.8C26.3 6.5 25.9 6.8 25.7 7.2L22 16.5H24.7L25.2 15H28.2L28.5 16.5ZM25.9 13.2L27.1 9.7L27.8 13.2H25.9ZM12.7 6.5L10.2 13.3L9.9 11.8C9.5 10.3 8.1 8.8 6.6 8L8.9 16.5H11.6L15.6 6.5H12.7Z" fill="#1434CB"/>
                  </svg>
                  {/* Mastercard Badge */}
                  <svg className={styles.cardLogo} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="36" height="24" rx="4" fill="#FFFFFF"/>
                    <circle cx="14" cy="12" r="6" fill="#EB001B"/>
                    <circle cx="22" cy="12" r="6" fill="#F79E1B"/>
                    <path d="M18 7.8C19.3 8.8 20.1 10.3 20.1 12C20.1 13.7 19.3 15.2 18 16.2C16.7 15.2 15.9 13.7 15.9 12C15.9 10.3 16.7 8.8 18 7.8Z" fill="#FF5F00"/>
                  </svg>
                </div>
                
                <span className={styles.stripeDivider} aria-hidden="true" />
                
                {/* Stripe Wordmark */}
                <svg className={styles.stripeLogo} viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
                  <path d="M59.6 12.8c0-4.6-2.3-7.5-6.5-7.5-4.3 0-6.9 3.2-6.9 7.4 0 5 3.1 7.4 7.5 7.4 2.2 0 3.8-.5 5-1.2v-3.2c-1.2.7-2.6 1.1-4.4 1.1-1.8 0-3.3-.7-3.5-2.6h8.7c.1-.5.1-1 .1-1.4zm-8.8-1.5c0-1.8 1.1-2.6 2.3-2.6 1.2 0 2.2.8 2.2 2.6h-4.5zm-5.8-5.7c-1.3 0-2.3.6-2.9 1.4V5.6H38v19.1h4.2v-5.2c.6.7 1.6 1.3 2.9 1.3 2.7 0 5.4-2.2 5.4-7.5 0-5.1-2.7-7.7-5.5-7.7zm-1.2 11.8c-1.4 0-2.3-1-2.3-2.6v-3.8c.6-.8 1.5-1.2 2.3-1.2 1.8 0 2.9 1.6 2.9 3.8 0 2.3-1.1 3.8-2.9 3.8zm-11.6-14v3.4h2.5v3.3h-2.5v6.5c0 1.2.9 1.6 2 1.6.8 0 1.4-.1 1.7-.3v3.3c-.6.3-1.6.5-2.7.5-3.3 0-5.2-1.6-5.2-5v-6.6h-2.1V9.1h2.1V6.1l4.2-2.7zm-9.3 14.5c0-.9.8-1.5 2-1.5 1.5 0 3.3.6 4.6 1.4V14c-1.3-.6-3-1.1-4.7-1.1-3.6 0-6 1.9-6 5.2 0 5.1 7 4.3 7 6.5 0 1-.9 1.6-2.2 1.6-1.7 0-3.8-.8-5.3-1.8v3.4c1.6.8 3.5 1.3 5.3 1.3 3.8 0 6.4-1.9 6.4-5.3 0-5.4-7.1-4.5-7.1-6.7zM9.5 2.1L5.3 4.8V2.1H1.1v23.2h4.2v-8.2l4.2-2.7V2.1zm-8.4 7h4.2v16.2H1.1V9.1z" fill="white"/>
                </svg>
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
                {/* PayPal Logo */}
                <svg className={styles.paypalLogo} viewBox="0 0 100 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PayPal">
                  <path d="M10.8 2.2H4.1C3.5 2.2 3 2.7 2.9 3.3L0.1 21C0 21.5 0.4 21.9 0.9 21.9H4.6C5.2 21.9 5.7 21.4 5.8 20.8L6.7 15.3C6.8 14.7 7.3 14.2 7.9 14.2H10C14 14.2 16.5 12.2 17.1 8.3C17.4 6.4 16.9 4.9 15.7 3.8C14.5 2.7 12.7 2.2 10.8 2.2Z" fill="#003087"/>
                  <path d="M14.6 7.6C14.2 10.1 12.4 11.5 9.7 11.5H8C7.5 11.5 7.1 11.9 7 12.4L6.1 18.2C6 18.6 6.3 19 6.7 19H9.4C9.9 19 10.3 18.6 10.4 18.1L11.1 13.8C11.2 13.3 11.6 12.9 12.1 12.9H12.8C15.8 12.9 17.7 11.4 18.2 8.4C18.4 6.9 18.1 5.8 17.2 4.9C16.8 6.1 15.8 7.1 14.6 7.6Z" fill="#0079C1"/>
                  <path d="M28.4 6.4h-4.3c-.4 0-.8.3-.9.7l-2.4 15.4c-.1.4.2.8.6.8h2.6c.4 0 .7-.3.8-.7l.7-4.4c.1-.4.4-.7.8-.7h1.9c3.7 0 6-1.8 6.6-5.4.3-1.8-.1-3.1-1-4-1.1-1.1-2.9-1.7-4.8-1.7zm.7 5.5c-.3 2.1-1.7 3.2-3.6 3.2h-1.2l.9-5.9c0-.2.2-.4.4-.4h.8c1.2 0 2.1.3 2.5.9.3.5.4 1.3.2 2.2z" fill="#003087"/>
                  <path d="M43.7 12.6h-2.6c-.3 0-.6.2-.7.5l-.1.7c-.7-.9-1.9-1.3-3.2-1.3-3 0-5.6 2.3-6.1 5.6-.3 1.7 0 3.2.9 4.3 1 1 2.2 1.4 3.7 1.4 2.6 0 4.1-1.7 4.1-1.7l-.1.7c-.1.4.2.8.6.8h2.4c.4 0 .7-.3.8-.7l1.7-10.7c.1-.4-.2-.8-.6-.8zm-3.5 5.5c-.3 1.7-1.6 2.9-3.3 2.9-1 0-1.7-.3-2.2-.9-.5-.6-.6-1.3-.4-2.1.3-1.7 1.6-2.9 3.3-2.9.9 0 1.7.3 2.2.9.5.5.6 1.3.4 2.1z" fill="#003087"/>
                  <path d="M55.8 12.6l-3.2 11.2c-.3 1-.7 1.7-1.4 2.2-.7.5-1.6.7-2.6.7h-2.1c-.4 0-.7-.3-.6-.7.1-.6.7-.6.7-.6 1 0 1.6-.3 1.9-.9l.3-.8-3.4-11.1c-.1-.4.2-.8.6-.8h2.7c.3 0 .6.2.7.6l1.8 6.7 3.7-6.7c.2-.4.6-.6.9-.6h2.7c.4 0 .6.4.4.8z" fill="#003087"/>
                  <path d="M68.5 6.4h-4.3c-.4 0-.8.3-.9.7l-2.4 15.4c-.1.4.2.8.6.8h2.8c.4 0 .7-.3.8-.7l.7-4.4c.1-.4.4-.7.8-.7h1.9c3.7 0 6-1.8 6.6-5.4.3-1.8-.1-3.1-1-4-1.1-1.1-2.9-1.7-4.8-1.7zm.7 5.5c-.3 2.1-1.7 3.2-3.6 3.2h-1.2l.9-5.9c0-.2.2-.4.4-.4h.8c1.2 0 2.1.3 2.5.9.3.5.4 1.3.2 2.2z" fill="#0079C1"/>
                  <path d="M83.8 12.6h-2.6c-.3 0-.6.2-.7.5l-.1.7c-.7-.9-1.9-1.3-3.2-1.3-3 0-5.6 2.3-6.1 5.6-.3 1.7 0 3.2.9 4.3 1 1 2.2 1.4 3.7 1.4 2.6 0 4.1-1.7 4.1-1.7l-.1.7c-.1.4.2.8.6.8h2.4c.4 0 .7-.3.8-.7l1.7-10.7c.1-.4-.2-.8-.6-.8zm-3.5 5.5c-.3 1.7-1.6 2.9-3.3 2.9-1 0-1.7-.3-2.2-.9-.5-.6-.6-1.3-.4-2.1.3-1.7 1.6-2.9 3.3-2.9.9 0 1.7.3 2.2.9.5.5.6 1.3.4 2.1z" fill="#0079C1"/>
                  <path d="M90.3 6.4l-2.4 15.4c-.1.4.2.8.6.8h2.4c.4 0 .7-.3.8-.7l2.4-15.5H91c-.4 0-.6 0-.7 0z" fill="#0079C1"/>
                </svg>
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
