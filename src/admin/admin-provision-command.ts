import { normalizeEmail } from "@/identity/contracts";

export type AdminProvisionCommand = { email: string; reissue: boolean };

export function parseAdminProvisionCommand(argumentsList: string[]): AdminProvisionCommand {
  let email: string | undefined;
  let reissue = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--email") {
      if (email !== undefined || index + 1 >= argumentsList.length) throw new Error("Invalid Admin provisioning arguments.");
      email = normalizeEmail(argumentsList[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--reissue") {
      if (reissue) throw new Error("Invalid Admin provisioning arguments.");
      reissue = true;
      continue;
    }
    throw new Error("Invalid Admin provisioning arguments.");
  }

  if (!email) throw new Error("Usage: npm run admin:provision -- --email <admin-email> [--reissue]");
  return { email, reissue };
}
