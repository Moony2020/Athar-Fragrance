import { ObjectId } from "mongodb";
import { z } from "zod";

import { normalizedEmailSchema } from "@/identity/contracts";
import type { AdminInvitationDocument } from "@/admin/admin-invitation-document";

const invitationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const tokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const adminInvitationDocumentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  invitationId: invitationIdSchema,
  normalizedEmail: normalizedEmailSchema,
  tokenHash: tokenHashSchema,
  status: z.enum(["pending", "invalidated", "consumed"]),
  deliveryStatus: z.enum(["pending", "sent", "failed"]),
  expiresAt: z.date(),
  purgeAt: z.date(),
  consumedAt: z.date().nullable(),
  invalidatedAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict().superRefine((value, context) => {
  if (value.expiresAt.getTime() <= value.createdAt.getTime()) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Invitation expiry must follow creation." });
  }
  if (value.purgeAt.getTime() <= value.expiresAt.getTime()) {
    context.addIssue({ code: "custom", path: ["purgeAt"], message: "Invitation cleanup must follow expiry." });
  }
  if (value.status === "pending" && (value.consumedAt || value.invalidatedAt)) {
    context.addIssue({ code: "custom", path: ["status"], message: "Pending invitation cannot be consumed or invalidated." });
  }
  if (value.status === "invalidated" && !value.invalidatedAt) {
    context.addIssue({ code: "custom", path: ["invalidatedAt"], message: "Invalidated invitation requires a timestamp." });
  }
  if (value.status === "invalidated" && value.consumedAt) {
    context.addIssue({ code: "custom", path: ["consumedAt"], message: "Invalidated invitation cannot also be consumed." });
  }
  if (value.status === "consumed" && !value.consumedAt) {
    context.addIssue({ code: "custom", path: ["consumedAt"], message: "Consumed invitation requires a timestamp." });
  }
  if (value.status === "consumed" && value.invalidatedAt) {
    context.addIssue({ code: "custom", path: ["invalidatedAt"], message: "Consumed invitation cannot also be invalidated." });
  }
  if (value.deliveryStatus === "sent" && !value.deliveredAt) {
    context.addIssue({ code: "custom", path: ["deliveredAt"], message: "Sent invitation requires a delivery timestamp." });
  }
  if (value.deliveryStatus !== "sent" && value.deliveredAt) {
    context.addIssue({ code: "custom", path: ["deliveredAt"], message: "Unsent invitation cannot carry a delivery timestamp." });
  }
});

export function parseAdminInvitationDocument(raw: unknown): AdminInvitationDocument {
  return adminInvitationDocumentSchema.parse(raw);
}
