import "server-only";

import { BrevoOrderConfirmationMailer, type OrderConfirmationMailer } from "@/server/auth/brevo-mailer";
import { isOrderConfirmationTestMailerEnabled, TestOrderConfirmationMailer } from "@/server/email/test-order-confirmation-mailer";

export function createOrderConfirmationMailer(): OrderConfirmationMailer {
  return isOrderConfirmationTestMailerEnabled() ? new TestOrderConfirmationMailer() : new BrevoOrderConfirmationMailer();
}

export function isOrderEmailDispatchEnabled(): boolean {
  return process.env.ATHAR_ORDER_EMAIL_DISPATCH_ENABLED === "1";
}
