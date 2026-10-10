import { z } from "zod";

import { passwordSchema } from "@/identity/contracts";

export const adminActivationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
export const adminActivationInputSchema = z.object({ token: adminActivationTokenSchema, password: passwordSchema }).strict();

export const ADMIN_ACTIVATION_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_ACTIVATION_TOKEN_LIMIT = 5;
export const ADMIN_ACTIVATION_IP_LIMIT = 10;
export const ADMIN_ACTIVATION_BODY_LIMIT = 4096;

export type AdminActivationInput = z.infer<typeof adminActivationInputSchema>;
