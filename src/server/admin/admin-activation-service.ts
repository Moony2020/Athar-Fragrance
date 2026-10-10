import "server-only";

import { randomBytes } from "node:crypto";

import { adminActivationInputSchema } from "@/admin/admin-activation-contract";
import { AdminActivationRepositoryError, MongoAdminActivationRepository } from "@/server/admin/admin-activation-repository";
import { hashPassword } from "@/server/auth/passwords";

export type AdminActivationServiceErrorCode = "invalid" | "unavailable" | "invariant_failure";
export class AdminActivationServiceError extends Error {
  constructor(readonly code: AdminActivationServiceErrorCode) { super(code); this.name = "AdminActivationServiceError"; }
}

type Dependencies = {
  repository?: Pick<MongoAdminActivationRepository, "activate">;
  hashPassword?: typeof hashPassword;
  createId?: () => string;
};

export class AdminActivationService {
  private readonly repository: Pick<MongoAdminActivationRepository, "activate">;
  private readonly hash: typeof hashPassword;
  private readonly createId: () => string;

  constructor(dependencies: Dependencies = {}) {
    this.repository = dependencies.repository ?? new MongoAdminActivationRepository();
    this.hash = dependencies.hashPassword ?? hashPassword;
    this.createId = dependencies.createId ?? (() => randomBytes(32).toString("base64url"));
  }

  async activate(input: unknown, operationId?: string): Promise<void> {
    const parsed = adminActivationInputSchema.safeParse(input);
    if (!parsed.success) throw new AdminActivationServiceError("invalid");
    try {
      const passwordHash = await this.hash(parsed.data.password);
      await this.repository.activate({
        token: parsed.data.token,
        passwordHash,
        userId: this.createId(),
        // The stable request operation ID is also the unique success-audit event ID.
        eventId: operationId ?? this.createId(),
      });
    } catch (error) {
      if (error instanceof AdminActivationRepositoryError) throw new AdminActivationServiceError(error.code);
      throw new AdminActivationServiceError("unavailable");
    }
  }
}
