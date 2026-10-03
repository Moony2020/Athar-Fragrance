import Image from "next/image";

import { formatMoneyMinor } from "@/lib/money";
import type { CustomerOrderReadModel } from "@/orders/customer-order-read-model";
import styles from "./CustomerOrderDetails.module.css";

export function CustomerOrderDetails({ order }: { order: CustomerOrderReadModel }) {
  const financial = order.totals.financialSnapshot;
  return <article className={styles.card}>
    <header className={styles.header}>
      <p className={styles.kicker}>ORDER DETAILS</p>
      <h1>{order.orderId}</h1>
      <p className={styles.muted}>Placed {order.createdAt.toLocaleDateString("en-SE")}</p>
      <dl className={styles.statuses}>
        <div><dt>Payment</dt><dd>{order.paymentStatus}</dd></div><div><dt>Fulfilment</dt><dd>{order.fulfillmentStatus}</dd></div>
      </dl>
    </header>
    <section aria-labelledby="order-items-heading"><h2 id="order-items-heading">Order items</h2>
      <ul className={styles.lines}>{order.lines.map((line) => <li key={`${line.productSlug}:${line.variantId}`}>
        {line.imageSnapshot ? <div className={styles.lineImage}><Image alt={line.imageSnapshot.alt} height={112} sizes="5rem" src={line.imageSnapshot.src} width={90} /></div> : null}
        <div className={styles.lineInformation}><strong>{line.productName}</strong><span>{[line.brandName, line.sizeMl ? `${line.sizeMl} ml` : null].filter(Boolean).join(" · ")}</span></div>
        <div className={styles.lineNumbers}><span>Qty {line.quantity}</span><strong>{formatMoneyMinor(line.subtotalMinor, line.currency)}</strong></div>
      </li>)}</ul>
    </section>
    <section aria-labelledby="order-summary-heading" className={styles.summary}><h2 id="order-summary-heading">Order summary</h2>
      {financial ? <dl>
        <div><dt>Merchandise</dt><dd>{formatMoneyMinor(financial.merchandiseSubtotalMinor, order.totals.currency)}</dd></div>
        <div><dt>Shipping{financial.shippingMethodLabelSnapshot ? ` (${financial.shippingMethodLabelSnapshot})` : ""}</dt><dd>{formatMoneyMinor(financial.shippingAmountMinor, order.totals.currency)}</dd></div>
        {financial.discountAmountMinor > 0 ? <div><dt>Discount</dt><dd>-{formatMoneyMinor(financial.discountAmountMinor, order.totals.currency)}</dd></div> : null}
        <div><dt>VAT included</dt><dd>{formatMoneyMinor(financial.vatIncludedMinor, order.totals.currency)}</dd></div>
        <div className={styles.total}><dt>Total</dt><dd>{formatMoneyMinor(financial.grandTotalMinor, order.totals.currency)}</dd></div>
      </dl> : <dl><div className={styles.total}><dt>Total</dt><dd>{formatMoneyMinor(order.totals.totalMinor, order.totals.currency)}</dd></div></dl>}
    </section>
    {order.shippingAddress ? <section aria-labelledby="delivery-address-heading" className={styles.address}><h2 id="delivery-address-heading">Delivery address</h2>
      <address>{order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />{order.shippingAddress.addressLine1}{order.shippingAddress.addressLine2 ? <><br />{order.shippingAddress.addressLine2}</> : null}<br />{order.shippingAddress.postalCode} {order.shippingAddress.city}<br />{order.shippingAddress.countryCode}</address>
    </section> : null}
  </article>;
}
