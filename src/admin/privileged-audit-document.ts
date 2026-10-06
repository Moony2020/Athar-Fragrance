import { ObjectId } from "mongodb";
import { z } from "zod";

import { publicUserIdSchema } from "@/identity/contracts";

const systemBootstrapActor = z.object({ actorType: z.literal("system"), actorId: z.literal("admin-bootstrap") }).strict();
const userActor = z.object({ actorType: z.literal("user"), actorId: publicUserIdSchema }).strict();

export const privilegedAuditActorSchema = z.discriminatedUnion("actorType", [userActor, systemBootstrapActor]);
export type PrivilegedAuditActor = z.infer<typeof privilegedAuditActorSchema>;

const bootstrapMetadataSchema = z.object({ reason: z.enum(["first_admin_bootstrap", "already_admin_noop"]) }).strict();

export const privilegedAuditEventSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  actor: privilegedAuditActorSchema,
  action: z.literal("admin.bootstrap"),
  target: z.object({ type: z.literal("user"), id: publicUserIdSchema }).strict(),
  outcome: z.enum(["succeeded", "noop"]),
  metadata: bootstrapMetadataSchema,
  createdAt: z.date(),
}).strict();

export type PrivilegedAuditEventDocument = z.infer<typeof privilegedAuditEventSchema>;

export function parsePrivilegedAuditEventDocument(raw: unknown): PrivilegedAuditEventDocument {
  return privilegedAuditEventSchema.parse(raw);
}
