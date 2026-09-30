const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function parsePublicOrigin(value: string | undefined, production: boolean): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !production && LOCAL_HOSTNAMES.has(url.hostname))) return null;
    if (production && LOCAL_HOSTNAMES.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Resolve the trusted public origin used in provider-facing callbacks. */
export function resolvePublicAppOrigin(env: Record<string, string | undefined> = process.env): string {
  const production = env.NODE_ENV === "production";
  const configured = [env.APP_URL, env.RENDER_EXTERNAL_URL, env.NEXT_PUBLIC_APP_URL];
  for (const candidate of configured) {
    const origin = parsePublicOrigin(candidate, production);
    if (origin) return origin;
  }
  if (!production) return "http://localhost:3000";
  throw new Error("A trusted public app URL is required in production");
}
