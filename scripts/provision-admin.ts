import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseAdminProvisionCommand, type AdminProvisionCommand } from "../src/admin/admin-provision-command";
import { AdminInvitationRepositoryError } from "../src/server/admin/admin-invitation-repository";
import { AdminProvisioningError, AdminProvisioningService } from "../src/server/admin/admin-provisioning-service";
import { ensureAdminInvitationIndexes, ensurePrivilegedAuditEventIndexes } from "../src/server/db/indexes";

function safeErrorMessage(error: unknown): string {
  if (error instanceof AdminInvitationRepositoryError) {
    if (error.code === "pending_invitation_exists") return "A pending Admin invitation already exists. Use --reissue to replace it.";
    if (error.code === "existing_customer" || error.code === "existing_admin") return "Admin provisioning was rejected because the identity is already in use.";
    return "Admin provisioning conflicted with another operation. Retry explicitly.";
  }
  if (error instanceof AdminProvisioningError) {
    if (error.code === "invalid_origin") return "Admin provisioning is not configured with a valid application origin.";
    return "The invitation was created, but delivery was not confirmed. Use --reissue before retrying.";
  }
  return "Admin provisioning failed safely.";
}

type CliDependencies = {
  ensureIndexes?: () => Promise<void>;
  provision?: (command: AdminProvisionCommand) => Promise<{ reissued: boolean }>;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

export async function runAdminProvisionCli(argumentsList: string[], dependencies: CliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? console.log;
  const stderr = dependencies.stderr ?? console.error;
  try {
    const command = parseAdminProvisionCommand(argumentsList);
    await (dependencies.ensureIndexes ?? (async () => {
      await Promise.all([ensureAdminInvitationIndexes(), ensurePrivilegedAuditEventIndexes()]);
    }))();
    const result = await (dependencies.provision ?? ((value) => new AdminProvisioningService().provision(value)))(command);
    stdout(result.reissued ? "Admin invitation reissued and sent." : "Admin invitation created and sent.");
    return 0;
  } catch (error) {
    stderr(safeErrorMessage(error));
    return 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  void runAdminProvisionCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
