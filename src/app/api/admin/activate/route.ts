import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { adminActivationInputSchema, adminActivationTokenSchema } from "@/admin/admin-activation-contract";
import { MongoAdminAuthRateLimitStore } from "@/server/admin/admin-auth-rate-limit-store";
import { AdminActivationService, AdminActivationServiceError } from "@/server/admin/admin-activation-service";
import { isAdminActivationEnabled, isAllowedActivationOrigin, isJsonContentType, readBoundedActivationBody, resolveAdminActivationClientIp } from "@/server/admin/admin-activation-request-security";
import type { AdminActivationRateLimitResult } from "@/server/admin/admin-auth-rate-limit-store";

const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function response(status: number, body: { status: "success" | "invalid" | "unavailable" }) {
  return NextResponse.json(body, { status, headers: securityHeaders });
}

function readToken(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = (value as Record<string, unknown>).token;
  const parsed = adminActivationTokenSchema.safeParse(token);
  return parsed.success ? parsed.data : null;
}

export async function POST(request: Request) {
  return handleActivationPost(request, {
    enabled: isAdminActivationEnabled,
    allowedOrigin: isAllowedActivationOrigin,
    resolveClientIp: resolveAdminActivationClientIp,
    async recordAttempt(input) { return new MongoAdminAuthRateLimitStore().recordActivationAttempt(input); },
    async activate(input, operationId) { return new AdminActivationService().activate(input, operationId); },
  });
}

type ActivationDependencies = {
  enabled: () => boolean;
  allowedOrigin: (origin: string | null) => boolean;
  resolveClientIp: () => string | null;
  recordAttempt: (input: { token: string | null; clientIp: string; now: Date; attemptId: string }) => Promise<AdminActivationRateLimitResult>;
  activate: (input: unknown, operationId: string) => Promise<void>;
};

export function createAdminActivationPost(dependencies: ActivationDependencies) {
  return (request: Request) => handleActivationPost(request, dependencies);
}

async function handleActivationPost(request: Request, dependencies: ActivationDependencies) {
  if (!dependencies.enabled()) return response(503, { status: "unavailable" });
  if (!dependencies.allowedOrigin(request.headers.get("origin"))) return response(403, { status: "invalid" });

  const body = await readBoundedActivationBody(request);
  if (body.tooLarge) return response(413, { status: "invalid" });
  const clientIp = dependencies.resolveClientIp();
  if (!clientIp) return response(503, { status: "unavailable" });

  let parsedBody: unknown;
  try { parsedBody = JSON.parse(body.text); } catch { parsedBody = null; }
  const token = readToken(parsedBody);
  const operationId = randomBytes(32).toString("base64url");
  let limiter: AdminActivationRateLimitResult;
  try {
    limiter = await dependencies.recordAttempt({ token, clientIp, now: new Date(), attemptId: operationId });
  } catch {
    return response(503, { status: "unavailable" });
  }
  if (limiter.outcome !== "decided" || !limiter.counted) return response(503, { status: "unavailable" });
  if (!limiter.allowed) return response(429, { status: "unavailable" });
  if (!isJsonContentType(request.headers.get("content-type"))) return response(415, { status: "invalid" });
  const input = adminActivationInputSchema.safeParse(parsedBody);
  if (!input.success) return response(400, { status: "invalid" });

  try {
    await dependencies.activate(input.data, operationId);
    return response(200, { status: "success" });
  } catch (error) {
    if (error instanceof AdminActivationServiceError && error.code === "invalid") return response(400, { status: "invalid" });
    return response(503, { status: "unavailable" });
  }
}

export async function OPTIONS() {
  return response(405, { status: "invalid" });
}
