import { ObjectId } from "mongodb";
import { z } from "zod";

import { publicUserIdSchema } from "@/identity/contracts";

const systemBootstrapActor = z.object({ actorType: z.literal("system"), actorId: z.literal("admin-bootstrap") }).strict();
const systemProvisioningActor = z.object({ actorType: z.literal("system"), actorId: z.literal("admin-provisioning") }).strict();
const systemActivationActor = z.object({ actorType: z.literal("system"), actorId: z.literal("admin-activation") }).strict();
const userActor = z.object({ actorType: z.literal("user"), actorId: publicUserIdSchema }).strict();

export const privilegedAuditActorSchema = z.union([userActor, systemBootstrapActor, systemProvisioningActor]);
export type PrivilegedAuditActor = z.infer<typeof privilegedAuditActorSchema>;

const bootstrapMetadataSchema = z.object({ reason: z.enum(["first_admin_bootstrap", "already_admin_noop"]) }).strict();

const sharedEventFields = {
  _id: z.instanceof(ObjectId).optional(),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  createdAt: z.date(),
};

const bootstrapEventSchema = z.object({
  ...sharedEventFields,
  actor: z.union([userActor, systemBootstrapActor]),
  action: z.literal("admin.bootstrap"),
  target: z.object({ type: z.literal("user"), id: publicUserIdSchema }).strict(),
  outcome: z.enum(["succeeded", "noop"]),
  metadata: bootstrapMetadataSchema,
}).strict();

const invitationEventSchema = z.object({
  ...sharedEventFields,
  actor: systemProvisioningActor,
  action: z.enum(["admin.invitation.provisioned", "admin.invitation.reissued"]),
  target: z.object({
    type: z.literal("admin_invitation"),
    id: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  }).strict(),
  outcome: z.literal("succeeded"),
  metadata: z.object({ reason: z.enum(["new_pending_invitation", "explicit_reissue"]) }).strict(),
}).strict();

const activationEventSchema = z.object({
  ...sharedEventFields,
  actor: systemActivationActor,
  action: z.literal("admin.invitation.activation_succeeded"),
  target: z.object({
    type: z.literal("admin_invitation"),
    id: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  }).strict(),
  outcome: z.literal("succeeded"),
  metadata: z.object({
    reason: z.literal("invitation_consumed"),
    createdUserId: publicUserIdSchema,
  }).strict(),
}).strict();

export const privilegedAuditEventSchema = z.discriminatedUnion("action", [bootstrapEventSchema, invitationEventSchema, activationEventSchema]);

export type PrivilegedAuditEventDocument = z.infer<typeof privilegedAuditEventSchema>;

export function parsePrivilegedAuditEventDocument(raw: unknown): PrivilegedAuditEventDocument {
  return privilegedAuditEventSchema.parse(raw);
}
