import type { Metadata } from "next";
import { io } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { readCurrentCheckout } from "@/server/checkout/read-model";
import { readCurrentCheckoutDraft } from "@/server/checkout/current-draft";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { Button } from "@/components/ui/Button/Button";
import { CheckoutDetailsForm } from "@/components/checkout/CheckoutDetailsForm";
import { ShippingMethodForm } from "@/components/checkout/ShippingMethodForm";
import { PrepareForPaymentForm } from "@/components/checkout/PrepareForPaymentForm";
import { PaymentMethodSection } from "@/components/checkout/PaymentMethodSection";
import { resolveSelectedShippingMethod, resolveShippingAvailability } from "@/checkout/shipping";
import { resolveCheckoutTotals } from "@/checkout/totals";
import { formatMoneyMinor, formatMoneyMinorExact } from "@/lib/money";
import { resolveCurrentCheckoutOwner } from "@/server/checkout/current-draft";
import { MongoInventoryReservationStore } from "@/server/inventory/reservation-store";
import styles from "./CheckoutPage.module.css";

export const metadata: Metadata = { title: "Checkout | ATHAR", robots: { index: false, follow: false } };

export default function CheckoutRoute() {
  return <CatalogShell><Container><Suspense fallback={<CheckoutLoadingState />}><CheckoutContents /></Suspense></Container></CatalogShell>;
}

function CheckoutLoadingState() {
  return <section aria-busy="true" aria-label="Loading checkout" className={styles.loading} role="status"><span>Loading checkout…</span></section>;
}

async function CheckoutContents() {
  await io();
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
  const owner = checkout.status === "ready" && checkoutDraft.status === "ready" ? await resolveCurrentCheckoutOwner() : null;
  const reservation = owner && checkoutDraft.status === "ready"
    ? await new MongoInventoryReservationStore().readActive(owner, checkoutDraft.draft.checkoutId)
    : null;

  const isAddressFilled = Boolean(checkoutDraft.status === "ready" && checkoutDraft.draft.shippingAddress?.addressLine1);
  const isShippingSelected = Boolean(checkoutDraft.status === "ready" && checkoutDraft.draft.selectedShippingMethodId);

  let currentStep = 1;
  if (reservation || (totals.status === "ready" && isShippingSelected)) {
    currentStep = 3;
  } else if (isAddressFilled) {
    currentStep = 2;
  } else {
    currentStep = 1;
  }

  return <section aria-labelledby="checkout-title" className={styles.page}>
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/shop">Shop</Link><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav>
    <header className={styles.heading}><div><h1 id="checkout-title">Checkout</h1><p>Complete your order securely.</p></div></header>
    <nav aria-label="Checkout progress" className={styles.progress}>
      <a className={`${styles.progressStep} ${currentStep === 1 ? styles.progressActive : currentStep > 1 ? styles.progressCompleted : ""}`} href="#contact-information-title">
        <b>{currentStep > 1 ? "✓" : "1"}</b>Information
      </a>
      <a className={`${styles.progressStep} ${currentStep === 2 ? styles.progressActive : currentStep > 2 ? styles.progressCompleted : ""}`} href="#delivery-title">
        <b>{currentStep > 2 ? "✓" : "2"}</b>Delivery
      </a>
      <a className={`${styles.progressStep} ${currentStep === 3 ? styles.progressActive : currentStep > 3 ? styles.progressCompleted : ""}`} href="#payment-method-title">
        <b>{currentStep > 3 ? "✓" : "3"}</b>Payment
      </a>
      <span className={`${styles.progressStep} ${currentStep === 4 ? styles.progressActive : ""}`}>
        <b>4</b>Review
      </span>
    </nav>
    <div className={styles.layout}>
      <section aria-label="Checkout information" className={styles.items}>
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
        {(() => {
          const totalQuantity = checkout.lines.reduce((sum, line) => sum + line.quantity, 0);
          return (
            <>
              <header className={styles.summaryHeading}>
                <h2>Order summary <span>({totalQuantity} {totalQuantity === 1 ? "item" : "items"})</span></h2>
                <Link href="/cart">Edit bag</Link>
              </header>
              <div className={styles.summaryItems}>
                {checkout.lines.map((line, index) => (
                  <article className={styles.summaryItem} data-status={line.status} key={`${line.productSlug}:${line.variantId}`}>
                    <div className={styles.summaryMediaWrapper}>
                      {line.media ? (
                        <Link aria-label={`View ${line.productName ?? "fragrance"}`} className={styles.summaryMedia} href={`/products/${line.productSlug}`}>
                          <Image alt={line.media.alt} fill loading={index === 0 ? "eager" : "lazy"} sizes="4.5rem" src={line.media.src} />
                        </Link>
                      ) : (
                        <div aria-label="Product media unavailable" className={styles.summaryPlaceholder} role="img">ATHAR</div>
                      )}
                      {line.quantity > 1 ? <span className={styles.quantityBadge}>{line.quantity}</span> : null}
                    </div>
                    <div className={styles.summaryProduct}>
                      <p>{line.brandName ?? "ATHAR"}</p>
                      <h3>{line.productName ?? "Unavailable fragrance"}</h3>
                      <span>
                        {line.fragranceType ? `${line.fragranceType} · ` : ""}
                        {line.sizeMl ? `${line.sizeMl} ml` : "Size unavailable"}
                      </span>
                    </div>
                    <div className={styles.summaryPriceCol}>
                      <strong>{line.status === "eligible" ? formatMoneyMinor(line.subtotalMinor, line.currency) : "Review"}</strong>
                      {line.status === "eligible" && line.quantity > 1 ? (
                        <small className={styles.unitPrice}>{formatMoneyMinor(line.priceMinor, line.currency)} each</small>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          );
        })()}
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
        {checkout.blockReasons.length > 0 ? <div className={styles.blocked} role="status"><strong>Checkout can’t continue yet.</strong><span>{checkout.blockReasons.includes("MIXED_CURRENCIES") ? "Items use different currencies and can’t be combined." : "Review or update the items in your bag before continuing."}</span></div> : <div className={styles.ready} role="status"><strong>Your bag is eligible for checkout.</strong><span>{totals.status === "ready" ? "Delivery is selected. Continue to payment when you’re ready." : "Add your contact and shipping address to save these details."}</span></div>}
        <p className={styles.disclaimer}>Prices and delivery are VAT-inclusive. Your items are reserved only while you move to secure payment. An order is created only after payment confirmation.</p>
        {checkoutDraft.status === "ready" && totals.status === "ready" && !reservation ? <PrepareForPaymentForm draft={checkoutDraft.draft} variant="summary" /> : null}
        {checkoutDraft.status === "ready" && reservation ? <PaymentMethodSection draft={checkoutDraft.draft} paypalEnabled={Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim())} /> : null}
      </aside>
    </div>
  </section>;
}
