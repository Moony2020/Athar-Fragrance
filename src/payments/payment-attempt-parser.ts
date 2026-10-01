import { ObjectId } from "mongodb";
import { z } from "zod";

import { commerceOwnerSchema } from "@/commerce/durable-contracts";
import { checkoutIdSchema } from "@/checkout/contact-address";
import type { PaymentAttemptDocument } from "./payment-attempt-document";

const opaqueId = z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);
const fingerprint = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const paymentAttemptDocumentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  paymentAttemptId: opaqueId,
  ownerType: z.enum(["guest", "user"]),
  ownerId: z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  checkoutId: checkoutIdSchema,
  checkoutRevision: z.number().int().positive(),
  reservationId: opaqueId,
  reservationExpiresAt: z.date(),
  cartFingerprint: fingerprint,
  amountMinor: z.number().int().nonnegative().safe(),
  currency: z.literal("SEK"),
  shippingMethodId: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  merchandiseSubtotalMinor: z.number().int().nonnegative().safe().optional(),
  shippingAmountMinor: z.number().int().nonnegative().safe().optional(),
  discountAmountMinor: z.number().int().nonnegative().safe().optional(),
  vatIncludedMinor: z.number().int().nonnegative().safe().optional(),
  grandTotalMinor: z.number().int().nonnegative().safe().optional(),
  shippingMethodLabelSnapshot: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: fingerprint,
  providerRequestKey: opaqueId,
  provider: z.enum(["stripe", "paypal"]).nullable(),
  providerExternalId: z.string().min(3).max(255).regex(/^[A-Za-z0-9_]+$/).optional(),
  providerStatus: z.enum(["requires_payment_method", "requires_action", "processing", "succeeded", "canceled", "open", "complete", "expired", "CREATED", "PAYER_ACTION_REQUIRED", "APPROVED", "COMPLETED", "VOIDED"]).optional(),
  status: z.enum(["local_created", "provider_waiting", "customer_action_required", "processing", "succeeded", "failed", "cancelled", "superseded"]),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict().superRefine((document, context) => {
  const financialFields = [document.merchandiseSubtotalMinor, document.shippingAmountMinor, document.discountAmountMinor, document.vatIncludedMinor, document.grandTotalMinor, document.shippingMethodLabelSnapshot];
  const present = financialFields.filter((value) => value !== undefined).length;
  if (present !== 0 && present !== financialFields.length) context.addIssue({ code: "custom", message: "Payment attempts require a complete financial snapshot or no legacy snapshot.", path: ["grandTotalMinor"] });
  if (present === financialFields.length) {
    if (document.grandTotalMinor !== document.amountMinor) context.addIssue({ code: "custom", message: "Payment attempt snapshot total must equal amountMinor.", path: ["grandTotalMinor"] });
    if (document.grandTotalMinor !== undefined && document.merchandiseSubtotalMinor !== undefined && document.shippingAmountMinor !== undefined && document.discountAmountMinor !== undefined && document.grandTotalMinor !== document.merchandiseSubtotalMinor - document.discountAmountMinor + document.shippingAmountMinor) {
      context.addIssue({ code: "custom", message: "Payment attempt snapshot totals are inconsistent.", path: ["grandTotalMinor"] });
    }
  }
  if (document.provider === "stripe" && !document.providerExternalId) {
    context.addIssue({ code: "custom", message: "Stripe payment attempts require an external ID.", path: ["providerExternalId"] });
  }
  if (document.provider === "paypal" && !document.providerExternalId) {
    context.addIssue({ code: "custom", message: "PayPal payment attempts require an external ID.", path: ["providerExternalId"] });
  }
  if (document.provider === null && (document.providerExternalId || document.providerStatus)) {
    context.addIssue({ code: "custom", message: "Unbound payment attempts cannot contain provider state.", path: ["provider"] });
  }
});

export function parsePaymentAttemptDocument(raw: unknown): PaymentAttemptDocument {
  const document = paymentAttemptDocumentSchema.parse(raw);
  commerceOwnerSchema.parse({ ownerType: document.ownerType, ownerId: document.ownerId });
  return document;
}
