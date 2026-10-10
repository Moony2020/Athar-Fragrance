import "server-only";

import { ADMIN_ACTIVATION_BODY_LIMIT } from "@/admin/admin-activation-contract";

export type ActivationRequestBoundary = { allowed: boolean; status: 403 | 413 | 503; reason: "origin" | "ip" | "too_large" | "unconfigured" };

export function isAdminActivationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === "development" && environment.ADMIN_ACTIVATION_ENABLED === "1" &&
    environment.MONGODB_DB_NAME === "athar_stage55_test" && Boolean(environment.MONGODB_URI);
}

export function isAllowedActivationOrigin(origin: string | null, environment: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin || origin === "null") return false;
  const configured = environment.ADMIN_ACTIVATION_ALLOWED_ORIGINS;
  if (!configured) return false;
  const origins = configured.split(",").map((value) => value.trim()).filter(Boolean);
  if (!origins.length) return false;
  let candidate: URL;
  try { candidate = new URL(origin); } catch { return false; }
  if (candidate.origin !== origin || !/^https?:$/.test(candidate.protocol) || candidate.username || candidate.password || candidate.pathname !== "/" || candidate.search || candidate.hash) return false;
  return origins.some((value) => value === candidate.origin);
}

/** No forwarded header is trusted. A loopback-only synthetic key is for local development only. */
export function resolveAdminActivationClientIp(environment: NodeJS.ProcessEnv = process.env): string | null {
  return environment.NODE_ENV === "development" ? "local-development-loopback" : null;
}

export async function readBoundedActivationBody(request: Request): Promise<{ text: string; tooLarge: false } | { text: ""; tooLarge: true }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ADMIN_ACTIVATION_BODY_LIMIT) {
    await request.body?.cancel().catch(() => undefined);
    return { text: "", tooLarge: true };
  }
  if (!request.body) return { text: "", tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ADMIN_ACTIVATION_BODY_LIMIT) {
        await reader.cancel().catch(() => undefined);
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { text: "", tooLarge: false };
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(joined), tooLarge: false };
}

export function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType && /^application\/json(?:\s*;|\s*$)/i.test(contentType.trim()));
}
