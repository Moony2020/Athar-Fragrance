import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { auth } from "@/auth";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoOrderStore } from "@/server/orders/order-store";
import { confirmationOrderCookieName } from "@/server/orders/confirmation-order-cookie";
import styles from "./ConfirmationPage.module.css";
import { getConfirmationActions } from "./confirmation-actions";

// The provider return URL intentionally carries dynamic search parameters.
export const instant = false;

export default async function CheckoutConfirmationPage({ searchParams }: { searchParams: Promise<{ provider?: string; state?: string }> }) {
  await connection();
  const { provider, state } = await searchParams;
  const successful = state === "success" && (provider === "stripe" || provider === "paypal");
  const session = await auth();
  const actions = getConfirmationActions(Boolean(session?.user?.id), successful);
  const orderCookie = successful ? (await cookies()).get(confirmationOrderCookieName)?.value : null;
  const owner = successful && orderCookie ? await resolveCurrentCheckoutOwner() : null;
  const order = owner && orderCookie ? await new MongoOrderStore().findForOwnerByOrderId(owner, orderCookie) : null;
  return <CatalogShell><Container><main className={styles.page}>
    <section aria-labelledby="payment-confirmation-title" className={styles.card}>
      {successful ? <><div aria-hidden="true" className={styles.sparkles}><i /><i /><i /><i /></div><div aria-hidden="true" className={styles.confirmationMark}><svg viewBox="0 0 52 52"><path d="M14 27.5 22 35l16-18" /></svg></div></> : <div aria-hidden="true" className={styles.errorMark}>!</div>}
      <p className={styles.kicker}>{successful ? "PAYMENT CONFIRMED" : "PAYMENT NEEDS ATTENTION"}</p>
      <h1 id="payment-confirmation-title">{successful ? "Thank you for choosing ATHAR" : "We couldn’t confirm your payment"}</h1>
      <p className={styles.lede}>{successful ? "Your payment has been verified securely with the provider." : "No payment has been confirmed. Return to checkout to review your payment method."}</p>
      {successful ? <div className={styles.provider}><span>Paid securely with</span><strong>{provider === "paypal" ? "PayPal" : "Stripe"}</strong><span className={styles.dot} aria-hidden="true" /></div> : null}
      {successful && order ? <p className={styles.orderReference}>Order number: {order.orderId}</p> : null}
      {successful && !session?.user?.id ? <p className={styles.guestNote}>Use your order number and checkout email to view your order details.</p> : null}
      <div className={styles.actions}>{actions.map((action) => <Link className={action.kind === "primary" ? styles.primary : styles.secondary} href={action.href} key={action.label}>{action.label}</Link>)}</div>
    </section>
  </main></Container></CatalogShell>;
}
