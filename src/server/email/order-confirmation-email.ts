import type { OrderDocument } from "@/orders/order-document";

export type OrderConfirmationEmailLine = {
  productName: string;
  brandName: string;
  sizeMl: number | null;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
};

export type OrderConfirmationEmail = {
  to: string;
  orderId: string;
  provider: OrderDocument["provider"];
  currency: string;
  lines: OrderConfirmationEmailLine[];
  totalMinor: number;
  merchandiseSubtotalMinor?: number;
  shippingAmountMinor?: number;
  discountAmountMinor?: number;
  vatIncludedMinor?: number;
  shippingMethodLabel?: string;
  shippingAddress?: OrderDocument["shippingAddress"];
};

export type RenderedOrderConfirmationEmail = OrderConfirmationEmail & {
  subject: string;
  textContent: string;
  htmlContent: string;
};

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(minor / 100);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function buildOrderConfirmationEmail(order: OrderDocument): OrderConfirmationEmail {
  const to = order.contact?.email?.trim().toLowerCase();
  if (!to) throw new Error("Order contact email is required for confirmation email.");
  return {
    to, orderId: order.orderId, provider: order.provider, currency: order.currency,
    lines: order.lines.map((line) => ({ productName: line.productName, brandName: line.brandName, sizeMl: line.sizeMl, quantity: line.quantity, unitPriceMinor: line.priceMinor, subtotalMinor: line.subtotalMinor })),
    totalMinor: order.totalMinor, merchandiseSubtotalMinor: order.merchandiseSubtotalMinor,
    shippingAmountMinor: order.shippingAmountMinor, discountAmountMinor: order.discountAmountMinor,
    vatIncludedMinor: order.vatIncludedMinor, shippingMethodLabel: order.shippingMethodLabelSnapshot,
    shippingAddress: order.shippingAddress,
  };
}

export function renderOrderConfirmationEmail(email: OrderConfirmationEmail): RenderedOrderConfirmationEmail {
  const subjectOrderId = email.orderId.replace(/[\r\n]/g, "");
  const itemLines = email.lines.map((line) => `${line.productName} — ${line.quantity} × ${money(line.unitPriceMinor, email.currency)} = ${money(line.subtotalMinor, email.currency)}`);
  const breakdown = email.merchandiseSubtotalMinor === undefined ? [] : [
    `Merchandise: ${money(email.merchandiseSubtotalMinor, email.currency)}`,
    `Shipping${email.shippingMethodLabel ? ` (${email.shippingMethodLabel})` : ""}: ${money(email.shippingAmountMinor ?? 0, email.currency)}`,
    ...(email.discountAmountMinor && email.discountAmountMinor > 0 ? [`Discount: -${money(email.discountAmountMinor, email.currency)}`] : []),
    `VAT included: ${money(email.vatIncludedMinor ?? 0, email.currency)}`,
  ];
  const textContent = ["Thank you for choosing ATHAR.", `Order ${email.orderId}`, "", ...itemLines, "", ...breakdown, `Total: ${money(email.totalMinor, email.currency)}`].filter(Boolean).join("\n");
  const htmlItems = email.lines.map((line) => `<li><strong>${escapeHtml(line.productName)}</strong> — ${line.quantity} × ${escapeHtml(money(line.unitPriceMinor, email.currency))} = ${escapeHtml(money(line.subtotalMinor, email.currency))}</li>`).join("");
  const htmlBreakdown = breakdown.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const htmlContent = `<main style="font-family:Arial,sans-serif;color:#191817"><h1>Thank you for choosing ATHAR</h1><p>Order <strong>${escapeHtml(email.orderId)}</strong></p><ul>${htmlItems}</ul>${htmlBreakdown ? `<ul>${htmlBreakdown}</ul>` : ""}<p><strong>Total: ${escapeHtml(money(email.totalMinor, email.currency))}</strong></p></main>`;
  return { ...email, subject: `ATHAR order confirmation — ${subjectOrderId}`, textContent, htmlContent };
}
