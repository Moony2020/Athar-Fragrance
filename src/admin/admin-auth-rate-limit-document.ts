import { ObjectId } from "mongodb";
import { z } from "zod";

export const adminAuthRateLimitDocumentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  dimension: z.enum(["token", "ip"]),
  identifierHmac: z.string().regex(/^[a-f0-9]{64}$/),
  windowStart: z.date(),
  count: z.number().int().positive(),
  expiresAt: z.date(),
}).strict();

export type AdminAuthRateLimitDocument = z.infer<typeof adminAuthRateLimitDocumentSchema>;

export const adminAuthRateLimitAttemptSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  attemptId: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  tokenHmac: z.string().regex(/^[a-f0-9]{64}$/),
  ipHmac: z.string().regex(/^[a-f0-9]{64}$/),
  allowed: z.boolean(),
  tokenCount: z.number().int().positive(),
  ipCount: z.number().int().positive(),
  createdAt: z.date(),
  expiresAt: z.date(),
}).strict();

export type AdminAuthRateLimitAttemptDocument = z.infer<typeof adminAuthRateLimitAttemptSchema>;
