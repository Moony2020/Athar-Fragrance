import { randomBytes, randomUUID } from "node:crypto";

export const ORDER_CONFIRMATION_MESSAGE_TYPE = "order_confirmation" as const;
export type EmailDeliveryStatus = "pending" | "sending" | "provider_accepted" | "delivered" | "retryable_failure" | "permanent_failure" | "ambiguous";
export type EmailDelivery = {
  deliveryId: string;
  orderId: string;
  messageType: typeof ORDER_CONFIRMATION_MESSAGE_TYPE;
  recipientEmail: string;
  provider: "brevo";
  idempotencyKey: string;
  status: EmailDeliveryStatus;
  attemptCount: number;
  providerMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
  nextAttemptAt?: Date;
  leaseId?: string;
  leaseExpiresAt?: Date;
  lastErrorClass?: "temporary" | "permanent" | "ambiguous";
};

export function newEmailDelivery(orderId: string, recipientEmail: string, now = new Date()): EmailDelivery {
  return { deliveryId: `ED-${randomBytes(12).toString("base64url")}`, orderId, messageType: ORDER_CONFIRMATION_MESSAGE_TYPE, recipientEmail, provider: "brevo", idempotencyKey: randomUUID(), status: "pending", attemptCount: 0, createdAt: now, updatedAt: now };
}

export function canTransitionEmailDelivery(from: EmailDeliveryStatus, to: EmailDeliveryStatus): boolean {
  if (from === to) return true;
  if (from === "delivered" || from === "permanent_failure") return false;
  if (from === "pending") return to === "sending";
  if (from === "sending") return ["provider_accepted", "retryable_failure", "permanent_failure", "ambiguous"].includes(to);
  if (from === "provider_accepted") return to === "delivered" || to === "ambiguous";
  if (from === "retryable_failure") return to === "sending" || to === "permanent_failure";
  if (from === "ambiguous") return to === "sending" || to === "permanent_failure";
  return false;
}

export function nextRetryAt(attemptCount: number, now = new Date()): Date {
  const delayMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(now.getTime() + delayMs);
}
