import Link from "next/link";

import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import styles from "./ConfirmationPage.module.css";

export default async function CheckoutConfirmationPage({ searchParams }: { searchParams: Promise<{ provider?: string; state?: string }> }) {
  const { provider, state } = await searchParams;
  const successful = state === "success" && (provider === "stripe" || provider === "paypal");
  return <CatalogShell><Container><main className={styles.page}>
    <section aria-labelledby="payment-confirmation-title" className={styles.card}>
      {successful ? <><div aria-hidden="true" className={styles.sparkles}><i /><i /><i /><i /></div><div aria-hidden="true" className={styles.confirmationMark}><svg viewBox="0 0 52 52"><path d="M14 27.5 22 35l16-18" /></svg></div></> : <div aria-hidden="true" className={styles.errorMark}>!</div>}
      <p className={styles.kicker}>{successful ? "PAYMENT CONFIRMED" : "PAYMENT NEEDS ATTENTION"}</p>
      <h1 id="payment-confirmation-title">{successful ? "Thank you for choosing ATHAR" : "We couldn’t confirm your payment"}</h1>
      <p className={styles.lede}>{successful ? "Your payment has been verified securely with the provider." : "No payment has been confirmed. Return to checkout to review your payment method."}</p>
      {successful ? <div className={styles.provider}><span>Paid securely with</span><strong>{provider === "paypal" ? "PayPal" : "Stripe"}</strong><span className={styles.dot} aria-hidden="true" /></div> : null}
      <div className={styles.actions}><Link className={styles.primary} href={successful ? "/" : "/checkout"}>{successful ? "Continue shopping" : "Return to checkout"}</Link>{successful ? <Link className={styles.secondary} href="/account">View your account</Link> : null}</div>
    </section>
  </main></Container></CatalogShell>;
}
