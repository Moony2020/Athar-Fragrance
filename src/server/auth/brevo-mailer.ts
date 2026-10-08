import "server-only";

import type { RenderedOrderConfirmationEmail } from "@/server/email/order-confirmation-email";

type ResetEmail = { to: string; resetUrl: string; expiresMinutes: number };
export type AdminInvitationEmail = { to: string; activationUrl: string; expiresHours: number };

export interface PasswordResetMailer {
  sendPasswordReset(message: ResetEmail): Promise<void>;
}

export interface AdminInvitationMailer {
  sendAdminInvitation(message: AdminInvitationEmail): Promise<void>;
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim());
}

export class BrevoTemporaryError extends Error { constructor(message = "Brevo temporary delivery failure.") { super(message); this.name = "BrevoTemporaryError"; } }
export class BrevoPermanentError extends Error { constructor(message = "Brevo permanent delivery failure.") { super(message); this.name = "BrevoPermanentError"; } }
export class BrevoAmbiguousError extends Error { constructor(message = "Brevo acceptance is ambiguous.") { super(message); this.name = "BrevoAmbiguousError"; } }

async function sendBrevoMessage(message: { to: string; subject: string; textContent: string; htmlContent: string }, context?: { deliveryId: string; idempotencyKey: string }): Promise<{ providerMessageId?: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "ATHAR";
  if (!apiKey || !senderEmail) throw new BrevoPermanentError("Transactional email is not configured.");
  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "content-type": "application/json", "api-key": apiKey }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ email: message.to }], subject: message.subject, textContent: message.textContent, htmlContent: message.htmlContent, ...(context ? { tags: [`athar_delivery:${context.deliveryId}`] } : {}) }),
    });
  } catch (error) {
    throw new BrevoAmbiguousError(error instanceof Error ? error.message : undefined);
  }
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new BrevoTemporaryError();
    throw new BrevoPermanentError();
  }
  const body = await response.json().catch(() => null) as { messageId?: unknown } | null;
  return typeof body?.messageId === "string" ? { providerMessageId: body.messageId } : {};
}

export interface OrderConfirmationMailer {
  sendOrderConfirmation(message: RenderedOrderConfirmationEmail, context?: { deliveryId: string; idempotencyKey: string }): Promise<{ providerMessageId?: string }>;
}

export class BrevoOrderConfirmationMailer implements OrderConfirmationMailer {
  async sendOrderConfirmation(message: RenderedOrderConfirmationEmail, context?: { deliveryId: string; idempotencyKey: string }): Promise<{ providerMessageId?: string }> {
    return sendBrevoMessage(message, context);
  }
}

export class BrevoPasswordResetMailer implements PasswordResetMailer {
  async sendPasswordReset(message: ResetEmail): Promise<void> {
    await sendBrevoMessage({ to: message.to, subject: "Reset your ATHAR password", textContent: `We received a request to reset your ATHAR password. Use this link within ${message.expiresMinutes} minutes: ${message.resetUrl}\n\nIf you did not request this, you can ignore this email.`, htmlContent: `<main style="font-family:Arial,sans-serif;color:#191817"><h1>Reset your ATHAR password</h1><p>Use the button below within ${message.expiresMinutes} minutes to choose a new password.</p><p><a href="${message.resetUrl}" style="display:inline-block;padding:14px 22px;background:#191817;color:#fff;text-decoration:none">Reset password</a></p><p>If you did not request this, ignore this email. Your password will not change.</p></main>` });
  }
}

export class BrevoAdminInvitationMailer implements AdminInvitationMailer {
  async sendAdminInvitation(message: AdminInvitationEmail): Promise<void> {
    await sendBrevoMessage({
      to: message.to,
      subject: "Activate your ATHAR Admin account",
      textContent: `You have been invited to the ATHAR Admin Platform. Use this link within ${message.expiresHours} hours to choose your password: ${message.activationUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`,
      htmlContent: `<main style="font-family:Arial,sans-serif;color:#191817"><h1>Activate your ATHAR Admin account</h1><p>Use the button below within ${message.expiresHours} hours to choose your password.</p><p><a href="${message.activationUrl}" style="display:inline-block;padding:14px 22px;background:#191817;color:#fff;text-decoration:none">Activate Admin account</a></p><p>If you were not expecting this invitation, ignore this email.</p></main>`,
    });
  }
}
