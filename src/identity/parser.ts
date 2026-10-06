import { ObjectId } from "mongodb";
import { z } from "zod";

import { normalizedEmailSchema, publicUserIdSchema } from "./contracts";
import type { UserDocument, UserRole } from "./documents";

const userDocumentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: publicUserIdSchema,
  normalizedEmail: normalizedEmailSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
  // Historical records predate roles. Only the exact persisted literal `admin`
  // grants privilege; all absent, malformed, or unknown values fail closed.
  role: z.unknown().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

export function parseUserDocument(raw: unknown): UserDocument {
  const parsed = userDocumentSchema.parse(raw);
  if (parsed.normalizedEmail !== (raw as { normalizedEmail?: unknown }).normalizedEmail) throw new Error("User email is not normalized.");
  const role: UserRole = parsed.role === "admin" ? "admin" : "customer";
  return { ...parsed, role, displayName: parsed.displayName?.trim() || parsed.normalizedEmail.split("@")[0] };
}
