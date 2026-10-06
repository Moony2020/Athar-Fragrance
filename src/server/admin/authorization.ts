import "server-only";

import { MongoUserRepository } from "@/server/identity/user-repository";

export type AdminAuthorization =
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; userId: string }
  | { kind: "authorized"; userId: string };

export type AdminAuthorizationSession = { user?: { id?: string } } | null;

/**
 * The credential/securityVersion/disabled checks run in Auth.js first.
 * This boundary then re-reads the canonical User role; no JWT or client value
 * is an authorization source.
 */
export async function resolveAdminAuthorization(
  session: AdminAuthorizationSession,
  users: Pick<MongoUserRepository, "findByUserId"> = new MongoUserRepository(),
): Promise<AdminAuthorization> {
  const userId = session?.user?.id;
  if (!userId) return { kind: "unauthenticated" };

  const user = await users.findByUserId(userId);
  return user?.role === "admin" ? { kind: "authorized", userId } : { kind: "forbidden", userId };
}
