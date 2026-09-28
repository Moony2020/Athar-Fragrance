import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { readCurrentCheckout } from "@/server/checkout/read-model";
import { readCurrentCheckoutDraft } from "@/server/checkout/current-draft";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { Button } from "@/components/ui/Button/Button";
import { CheckoutDetailsForm } from "@/components/checkout/CheckoutDetailsForm";
import { ShippingMethodForm } from "@/components/checkout/ShippingMethodForm";
import { resolveSelectedShippingMethod, resolveShippingAvailability } from "@/checkout/shipping";
import { resolveCheckoutTotals } from "@/checkout/totals";
import { formatMoneyMinor, formatMoneyMinorExact } from "@/lib/money";
import styles from "./CheckoutPage.module.css";

export const metadata: Metadata = { title: "Checkout | ATHAR", robots: { index: false, follow: false } };

export default function CheckoutRoute() {
  return <Suspense fallback={<section aria-label="Checkout" className={styles.loading}>Preparing your bag…</section>}><CheckoutShell /></Suspense>;
}

async function CheckoutShell() {
  await io();
  return <CatalogShell><Container><CheckoutContents /></Container></CatalogShell>;
}

async function CheckoutContents() {
  const checkout = await readCurrentCheckout();

  if (checkout.blockReasons.includes("CART_UNAVAILABLE")) {
    return <section aria-labelledby="checkout-title" className={styles.state}><h1 id="checkout-title">Checkout</h1><p role="status">We can’t read your bag right now. Please try again shortly.</p><Link href="/cart">Return to your bag</Link></section>;
  }

  if (checkout.blockReasons.includes("EMPTY_CART")) {
    return <section aria-labelledby="checkout-title" className={styles.state}><h1 id="checkout-title">Your bag is empty</h1><p>Add a fragrance to your bag before starting checkout.</p><div className={styles.actions}><Button className={styles.actionLink} href="/shop">Explore fragrances</Button></div></section>;
  }

  const checkoutDraft = checkout.status === "ready"
    ? await readCurrentCheckoutDraft()
    : { status: "unavailable" as const };
  const shipping = checkout.status === "ready" && checkoutDraft.status === "ready"
    ? resolveShippingAvailability({ shippingAddress: checkoutDraft.draft.shippingAddress, eligibleSubtotalMinor: checkout.eligibleSubtotalMinor, currency: checkout.currency ?? undefined })
    : undefined;
  const selectedShipping = shipping && checkoutDraft.status === "ready"
    ? resolveSelectedShippingMethod({ selectedShippingMethodId: checkoutDraft.draft.selectedShippingMethodId, shippingAddress: checkoutDraft.draft.shippingAddress, eligibleSubtotalMinor: checkout.eligibleSubtotalMinor, currency: checkout.currency ?? undefined })
    : undefined;
  const totals = checkout.status === "ready" && checkoutDraft.status === "ready"
    ? resolveCheckoutTotals({ checkout, draft: checkoutDraft.draft })
    : { status: "blocked" as const, reason: "CHECKOUT_NOT_READY" as const };

  return <section aria-labelledby="checkout-title" className={styles.page}>
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/cart">Your bag</Link><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav>
    <header className={styles.heading}><div><h1 id="checkout-title">Review your bag</h1></div><Link href="/cart">Edit bag</Link></header>
    <div className={styles.layout}>
      <section aria-label="Checkout items" className={styles.items}>
        {checkout.lines.map((line) => <article className={styles.line} data-status={line.status} key={`${line.productSlug}:${line.variantId}`}>
          <div><p className={styles.brand}>{line.brandName ?? "ATHAR"}</p><h2>{line.productName ?? "Unavailable fragrance"}</h2><p>{line.sizeMl ? `${line.sizeMl} ml` : "Size unavailable"} · Quantity {line.quantity}</p></div>
          {line.status === "eligible" ? <strong>{formatMoneyMinor(line.subtotalMinor, line.currency)}</strong> : <p className={styles.attention} role="status">This item needs review and is not included as an eligible checkout item.</p>}
        </article>)}
        {checkout.status === "ready" && checkoutDraft.status === "ready"
          ? <><CheckoutDetailsForm draft={checkoutDraft.draft} email={checkoutDraft.email} />
            {shipping?.status === "available" ? <ShippingMethodForm draft={checkoutDraft.draft} methods={shipping.methods} /> : null}
            {shipping?.status === "unsupported-country" ? <p className={styles.blocked} role="status">Shipping is not available to this country yet.</p> : null}
            {shipping?.status === "currency-mismatch" ? <p className={styles.blocked} role="status">Delivery is unavailable because your bag currency cannot be matched.</p> : null}
            {shipping?.status === "needs-address" ? <p className={styles.ready} role="status">Save your shipping address to see delivery options.</p> : null}
          </>
          : checkout.status === "ready"
            ? <p className={styles.blocked} role="status">Contact and shipping details can’t be loaded right now. Please try again shortly.</p>
            : null}
      </section>
      <aside aria-label="Checkout summary" className={styles.summary}>
        <p className={styles.kicker}>CURRENT CART TOTAL</p>
        {totals.status === "ready"
          ? <>
            <div><span>Subtotal</span><strong>{formatMoneyMinor(totals.merchandiseSubtotal, totals.currency)}</strong></div>
            <div><span>Shipping</span><strong>{totals.shippingTotal === 0 ? "Free" : formatMoneyMinor(totals.shippingTotal, totals.currency)}</strong></div>
            <div><span>VAT included ({totals.vatRatePercent}%)</span><strong>{formatMoneyMinorExact(totals.vatTotal, totals.currency)}</strong></div>
            <div className={styles.grandTotal}><span>Total</span><strong>{formatMoneyMinor(totals.grandTotal, totals.currency)}</strong></div>
          </>
          : <>
            <div><span>Subtotal</span><strong>{checkout.currency ? formatMoneyMinor(checkout.eligibleSubtotalMinor, checkout.currency) : "Unavailable"}</strong></div>
            {selectedShipping ? <div><span>Shipping</span><strong>{selectedShipping.isFree ? "Free" : formatMoneyMinor(selectedShipping.shippingAmountMinor, selectedShipping.currency)}</strong></div> : null}
            {checkout.status === "ready" && totals.reason === "SHIPPING_SELECTION_REQUIRED" ? <p className={styles.totalNotice} role="status">Choose an available delivery method to calculate your final total.</p> : null}
          </>}
        {checkout.blockReasons.length > 0 ? <div className={styles.blocked} role="status"><strong>Checkout can’t continue yet.</strong><span>{checkout.blockReasons.includes("MIXED_CURRENCIES") ? "Items use different currencies and can’t be combined." : "Review or update the items in your bag before continuing."}</span></div> : <div className={styles.ready} role="status"><strong>Your bag is eligible for checkout.</strong><span>Add your contact and shipping address to save these details.</span></div>}
        <p className={styles.disclaimer}>Prices and delivery are VAT-inclusive. Totals are calculated from your current bag, address, and delivery selection. Discounts, inventory reservation, payment, and order creation are not part of this step.</p>
        <Link className={styles.return} href="/cart">Return to your bag</Link>
      </aside>
    </div>
  </section>;
}
