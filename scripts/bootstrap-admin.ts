import { ensurePrivilegedAuditEventIndexes } from "../src/server/db/indexes";
import { AdminRoleSecurityService } from "../src/server/admin/admin-role-security-service";

function readUserId(argumentsList: string[]): string {
  const index = argumentsList.indexOf("--user-id");
  const userId = index >= 0 ? argumentsList[index + 1] : undefined;
  if (!userId || index !== argumentsList.length - 2) throw new Error("Usage: npm run admin:bootstrap -- --user-id <public-user-id>");
  return userId;
}

async function main(): Promise<void> {
  const userId = readUserId(process.argv.slice(2));
  await ensurePrivilegedAuditEventIndexes();
  const result = await new AdminRoleSecurityService().bootstrapInitialAdmin({ userId });
  console.log(result === "promoted" ? "Admin bootstrap completed." : "Target is already an Admin; no privilege change was made.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin bootstrap failed.");
  process.exitCode = 1;
});
