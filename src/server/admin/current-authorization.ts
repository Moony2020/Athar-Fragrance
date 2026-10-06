import "server-only";

import { auth } from "@/auth";
import { resolveAdminAuthorization, type AdminAuthorization } from "@/server/admin/authorization";

/** Runtime composition point: Auth.js validates the session before the role read. */
export async function resolveCurrentAdminAuthorization(): Promise<AdminAuthorization> {
  return resolveAdminAuthorization(await auth());
}
