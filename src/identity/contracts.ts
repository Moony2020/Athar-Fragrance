import { z } from "zod";

export const publicUserIdSchema = z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const emailSchema = z.string().trim().email().max(320);
export const normalizedEmailSchema = emailSchema.transform((value) => value.toLowerCase());

export const customerCreateInputSchema = z.object({
  email: emailSchema,
}).strict();

const passwordInputSchema = z.string().min(12).max(128).refine((value) => /[A-Za-z]/.test(value), {
  message: "Password must contain at least one letter.",
});

export const registrationInputSchema = z.object({
  email: emailSchema,
  password: passwordInputSchema,
}).strict();

export const passwordSchema = passwordInputSchema;

export const userPublicSchema = z.object({
  userId: publicUserIdSchema,
  email: emailSchema,
  displayName: z.string().trim().min(1).max(80),
}).strict();

export const displayNameSchema = z.string().trim().min(1).max(80);

export type CustomerCreateInput = z.input<typeof customerCreateInputSchema>;
export type UserPublic = z.output<typeof userPublicSchema>;

export function normalizeEmail(email: string): string {
  return normalizedEmailSchema.parse(email);
}
