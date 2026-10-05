import type { OrderDocument } from "@/orders/order-document";
import { resolvePublicAppOrigin } from "@/server/payments/public-app-origin";

export type OrderConfirmationEmailLine = {
  productName: string;
  brandName: string;
  fragranceType?: string | null;
  sizeMl: number | null;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  imageUrl?: string;
  imageAlt?: string;
};

export type OrderConfirmationEmail = {
  to: string;
  orderId: string;
  ownerType: OrderDocument["ownerType"];
  currency: string;
  createdAt: Date;
  orderDetailsUrl: string;
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

function formatOrderDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function isHistoricalAmount(value: number | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Uses only a stored snapshot; it never reads the live catalog or generates media. */
function toPublicImageUrl(snapshot: OrderDocument["lines"][number]["imageSnapshot"], origin: string): string | undefined {
  if (!snapshot?.src?.trim()) return undefined;
  const source = snapshot.src.trim();
  try {
    if (source.startsWith("/") && !source.startsWith("//")) return new URL(source, origin).toString();
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function productVariant(line: OrderConfirmationEmailLine): string | undefined {
  const parts = [line.fragranceType?.trim() || undefined, line.sizeMl === null ? undefined : `${line.sizeMl} ml`].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

function addressLines(address: OrderDocument["shippingAddress"] | undefined): string[] {
  if (!address) return [];
  return [`${address.firstName} ${address.lastName}`, [address.addressLine1, address.addressLine2].filter(Boolean).join(", "), `${address.postalCode} ${address.city}`, address.countryCode].filter(Boolean);
}

function historicalSummaryLines(email: OrderConfirmationEmail): Array<{ label: string; amount: string }> {
  const lines: Array<{ label: string; amount: string }> = [];
  if (isHistoricalAmount(email.merchandiseSubtotalMinor)) lines.push({ label: "Merchandise", amount: money(email.merchandiseSubtotalMinor, email.currency) });
  if (isHistoricalAmount(email.shippingAmountMinor)) lines.push({ label: email.shippingMethodLabel ? `Shipping (${email.shippingMethodLabel})` : "Shipping", amount: money(email.shippingAmountMinor, email.currency) });
  if (isHistoricalAmount(email.discountAmountMinor) && email.discountAmountMinor > 0) lines.push({ label: "Discount", amount: `-${money(email.discountAmountMinor, email.currency)}` });
  if (isHistoricalAmount(email.vatIncludedMinor)) lines.push({ label: "VAT included", amount: money(email.vatIncludedMinor, email.currency) });
  return lines;
}

function renderTextLine(line: OrderConfirmationEmailLine, currency: string): string[] {
  const variant = productVariant(line);
  return [line.brandName, line.productName, ...(variant ? [variant] : []), `Qty ${line.quantity}`, money(line.subtotalMinor, currency)];
}

function renderHtmlLine(line: OrderConfirmationEmailLine, currency: string): string {
  const variant = productVariant(line);
  const details = `<p style="margin:0 0 5px;color:#8a7543;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(line.brandName)}</p><p class="product-name" style="margin:0 0 5px;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.18">${escapeHtml(line.productName)}</p>${variant ? `<p class="product-variant" style="margin:0 0 9px;color:#766f66;font-family:Arial,sans-serif;font-size:10px;line-height:1.45;white-space:nowrap">${escapeHtml(variant)}</p>` : ""}<p style="margin:0;color:#4e4942;font-family:Arial,sans-serif;font-size:12px;line-height:1.45">Qty ${line.quantity}</p>`;
  const image = line.imageUrl && line.imageAlt ? `<td class="product-image-cell" width="70" valign="top" style="padding:0 8px 0 0"><img class="product-image" src="${escapeHtml(line.imageUrl)}" width="60" alt="${escapeHtml(line.imageAlt)}" style="display:block;width:60px;height:auto;border:0;outline:none;text-decoration:none" /></td>` : "";
  return `<tr><td style="padding:14px 0;border-top:1px solid #ded6c8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${image}<td valign="top">${details}</td><td class="product-price-cell" width="60" valign="top" align="right" style="padding:0 0 0 4px;color:#191817;font-family:Arial,sans-serif;font-size:12px;font-weight:700;white-space:nowrap">${escapeHtml(money(line.subtotalMinor, currency))}</td></tr></table></td></tr>`;
}

export function buildOrderConfirmationEmail(order: OrderDocument): OrderConfirmationEmail {
  const to = order.contact?.email?.trim().toLowerCase();
  if (!to) throw new Error("Order contact email is required for confirmation email.");
  const origin = resolvePublicAppOrigin();
  const guest = order.ownerType === "guest";
  return {
    to, orderId: order.orderId, ownerType: order.ownerType, currency: order.currency, createdAt: order.createdAt,
    orderDetailsUrl: new URL(guest ? "/orders/lookup" : `/account/orders/${encodeURIComponent(order.orderId)}`, origin).toString(),
    lines: order.lines.map((line) => ({ productName: line.productName, brandName: line.brandName, fragranceType: line.fragranceType, sizeMl: line.sizeMl, quantity: line.quantity, unitPriceMinor: line.priceMinor, subtotalMinor: line.subtotalMinor, imageUrl: toPublicImageUrl(line.imageSnapshot, origin), imageAlt: line.imageSnapshot ? (line.imageSnapshot.alt?.trim() || `${line.brandName} ${line.productName}`) : undefined })),
    totalMinor: order.totalMinor, merchandiseSubtotalMinor: order.merchandiseSubtotalMinor, shippingAmountMinor: order.shippingAmountMinor, discountAmountMinor: order.discountAmountMinor, vatIncludedMinor: order.vatIncludedMinor, shippingMethodLabel: order.shippingMethodLabelSnapshot, shippingAddress: order.shippingAddress,
  };
}

export function renderOrderConfirmationEmail(email: OrderConfirmationEmail): RenderedOrderConfirmationEmail {
  const subjectOrderId = email.orderId.replace(/[\r\n]/g, "");
  const summary = historicalSummaryLines(email);
  const address = addressLines(email.shippingAddress);
  const textContent = ["ATHAR — Haute Parfumerie", "", "Thank you for your order.", `Order ${email.orderId}`, `Placed ${formatOrderDate(email.createdAt)}`, "", "ORDER ITEMS", ...email.lines.flatMap((line) => [...renderTextLine(line, email.currency), ""]), ...(summary.length ? ["ORDER SUMMARY", ...summary.map((line) => `${line.label}: ${line.amount}`), ""] : []), `Total: ${money(email.totalMinor, email.currency)}`, ...(address.length ? ["", "SHIPPING TO", ...address] : []), "", "View order details:", email.orderDetailsUrl, "", "Questions about your order? Reply to this email."].join("\n");
  const summaryRows = `<tr><td colspan="2" style="padding-top:9px;border-top:1px solid #ded6c8"></td></tr>${summary.map((line) => `<tr><td style="padding:5px 0;color:#4e4942;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(line.label)}</td><td align="right" style="padding:5px 0;color:#191817;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(line.amount)}</td></tr>`).join("")}`;
  const addressHtml = address.length ? `<tr><td class="email-padding" style="padding:0 42px"><p style="margin:0;color:#8a7543;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;padding:14px 0 9px;border-bottom:1px solid #ded6c8;text-transform:uppercase">Shipping to</p><p style="margin:10px 0 0;color:#4e4942;font-family:Arial,sans-serif;font-size:13px;line-height:1.65">${address.map(escapeHtml).join("<br />")}</p></td></tr>` : "";
  const wordmark = `<p style="margin:0 -0.18em 0 0;color:#201e1b;font-family:'Cinzel Decorative',Georgia,'Times New Roman',serif;font-size:30px;font-weight:900;letter-spacing:0.18em;line-height:1;-webkit-text-stroke:.5px currentColor">ATHAR</p><p style="margin:8px -0.22em 0 0;color:#766f66;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.22em">HAUTE PARFUMERIE</p>`;
  const footerWordmark = `<p style="margin:0 -0.18em 0 0;color:#f4efe6;font-family:'Cinzel Decorative',Georgia,'Times New Roman',serif;font-size:19px;font-weight:900;letter-spacing:0.18em;line-height:1;-webkit-text-stroke:.4px currentColor">ATHAR</p><p style="margin:7px -0.22em 0 0;color:#cfc4aa;font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.22em">HAUTE PARFUMERIE</p><p style="margin:10px 0 0;color:#cfc4aa;font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.2px">© ${email.createdAt.getUTCFullYear()} ATHAR</p>`;
  const contactNote = `<tr><td class="email-padding" align="center" style="padding:0 20px 32px"><p style="margin:0;color:#625d55;font-family:Arial,sans-serif;font-size:13px;line-height:1.6">Questions about your order?<br /><strong style="color:#191817;font-weight:700">Reply to this email.</strong></p></td></tr>`;
  const htmlContent = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>@media only screen and (max-width:520px){.email-outer{padding:18px 0!important}.email-shell{border-left:0!important;border-right:0!important}.email-padding{padding-left:20px!important;padding-right:20px!important}.product-image-cell{width:96px!important;padding-right:12px!important}.product-image{width:84px!important}.product-price-cell{width:78px!important;padding-left:8px!important;font-size:13px!important}.product-name{font-size:21px!important}.product-variant{font-size:12px!important}.email-title{font-size:31px!important}.email-footer{padding-left:20px!important;padding-right:20px!important}}@media only screen and (max-width:320px){.email-padding{padding-left:14px!important;padding-right:14px!important}.email-outer{padding:10px 0!important}.product-image-cell{width:70px!important;padding-right:8px!important}.product-image{width:60px!important}.product-price-cell{width:60px!important;padding-left:4px!important;font-size:12px!important}.product-name{font-size:18px!important}.product-variant{font-size:10px!important;white-space:nowrap}.email-title{font-size:26px!important}.email-wordmark{width:124px!important}.email-footer-wordmark{width:108px!important}.email-footer{padding-left:14px!important;padding-right:14px!important}}</style></head><body style="margin:0;padding:0;background:#f4efe6"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4efe6"><tr><td class="email-outer" align="center" style="padding:32px 12px"><table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fffdf9;border:1px solid #dfd8cc"><tr><td class="email-padding" style="padding:40px 42px 10px;text-align:center"><p style="margin:0;color:#201e1b;font-family:'Cinzel Decorative','Times New Roman',serif;font-size:30px;font-weight:900;letter-spacing:4px;line-height:1;-webkit-text-stroke:.4px currentColor">ATHAR</p><p style="margin:8px 0 0;color:#766f66;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:2.4px">HAUTE PARFUMERIE</p></td></tr><tr><td class="email-padding" style="padding:34px 42px 10px"><p style="margin:0 0 9px;color:#8a7543;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Order confirmed</p><h1 class="email-title" style="margin:0;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:400;line-height:1.16">Thank you for your order</h1><p style="margin:15px 0 0;color:#625d55;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">We are preparing your ATHAR order with care.</p></td></tr><tr><td class="email-padding" style="padding:24px 42px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #ded6c8;border-bottom:1px solid #ded6c8"><tr><td style="padding:14px 0;color:#191817;font-family:Arial,sans-serif;font-size:13px;font-weight:700">Order ${escapeHtml(email.orderId)}</td><td align="right" style="padding:14px 0;color:#766f66;font-family:Arial,sans-serif;font-size:12px">${escapeHtml(formatOrderDate(email.createdAt))}</td></tr></table></td></tr><tr><td class="email-padding" style="padding:12px 42px 0"><p style="margin:0;color:#8a7543;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Order items</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px">${email.lines.map((line) => renderHtmlLine(line, email.currency)).join("")}</table></td></tr><tr><td class="email-padding" style="padding:27px 42px 0"><p style="margin:0 0 9px;color:#8a7543;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Order summary</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${summaryRows}<tr><td colspan="2" style="padding-top:11px;border-top:1px solid #ded6c8"></td></tr><tr><td style="padding:4px 0;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:20px">Total</td><td align="right" style="padding:4px 0;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700">${escapeHtml(money(email.totalMinor, email.currency))}</td></tr></table></td></tr>${addressHtml}<tr><td class="email-padding" align="center" style="padding:34px 42px 42px"><a href="${escapeHtml(email.orderDetailsUrl)}" style="display:inline-block;background:#191817;color:#ffffff;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;padding:15px 22px;text-decoration:none;text-transform:uppercase">View order details</a></td></tr><tr><td class="email-footer" style="padding:20px 42px;text-align:center;background:#201e1b"><p style="margin:0;color:#f4efe6;font-family:'Cinzel Decorative','Times New Roman',serif;font-size:19px;font-weight:900;letter-spacing:2px;-webkit-text-stroke:.3px currentColor">ATHAR</p><p style="margin:7px 0 0;color:#cfc4aa;font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:2px">HAUTE PARFUMERIE</p></td></tr></table></td></tr></table></body></html>`;
  const brandedHtmlContent = htmlContent
    .replace("<style>", "<style>@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@900&display=swap');")
    .replace(`<p style="margin:0;color:#201e1b;font-family:'Cinzel Decorative','Times New Roman',serif;font-size:30px;font-weight:900;letter-spacing:4px;line-height:1;-webkit-text-stroke:.4px currentColor">ATHAR</p><p style="margin:8px 0 0;color:#766f66;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:2.4px">HAUTE PARFUMERIE</p>`, wordmark)
    .replace(`<p style="margin:0;color:#f4efe6;font-family:'Cinzel Decorative','Times New Roman',serif;font-size:19px;font-weight:900;letter-spacing:2px;-webkit-text-stroke:.3px currentColor">ATHAR</p><p style="margin:7px 0 0;color:#cfc4aa;font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:2px">HAUTE PARFUMERIE</p>`, footerWordmark)
    .replaceAll("42px", "20px")
    .replace('style="padding:34px 20px 10px"', 'style="padding:34px 20px 18px;border-bottom:1px solid #ded6c8"')
    .replace('style="border-top:1px solid #ded6c8;border-bottom:1px solid #ded6c8"', 'style="border-bottom:1px solid #ded6c8"')
    .replace('style="margin-top:10px">', 'style="margin-top:10px;border-bottom:1px solid #ded6c8">')
    .replace(/(<tr><td style="padding:4px 0;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:20px)(">Total<\/td><td align="right" style="padding:4px 0;color:#191817;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700)(">.*?<\/td><\/tr>)/, '$1$2$3<tr><td colspan="2" style="padding-top:10px;border-bottom:1px solid #ded6c8"></td></tr>')
    .replace('<tr><td class="email-footer"', `${contactNote}<tr><td class="email-footer"`)
    .replace("</style>", "@media only screen and (max-width:520px){.product-image-cell{width:70px!important;padding-right:8px!important}.product-image{width:60px!important}.product-price-cell{width:60px!important;padding-left:4px!important;font-size:12px!important}.product-name{font-size:18px!important}.product-variant{font-size:10px!important;white-space:nowrap}}@media only screen and (min-width:521px){.product-image-cell{width:94px!important;padding-right:14px!important}.product-image{width:82px!important}.product-price-cell{width:92px!important;padding-left:14px!important;font-size:14px!important}.product-name{font-size:23px!important}.product-variant{font-size:13px!important}}@media only screen and (max-width:380px){.email-padding{padding-left:14px!important;padding-right:14px!important}.email-outer{padding:10px 0!important}.email-title{font-size:26px!important}.email-wordmark{width:124px!important}.email-footer-wordmark{width:108px!important}.email-footer{padding-left:14px!important;padding-right:14px!important}}</style>");
  return { ...email, subject: `ATHAR order confirmation — ${subjectOrderId}`, textContent, htmlContent: brandedHtmlContent };
}
