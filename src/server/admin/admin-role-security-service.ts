import "server-only";

import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";

import { parseUserDocument, } from "@/identity/parser";
import type { UserDocument } from "@/identity/documents";
import type { UserCredentialDocument } from "@/identity/credential-documents";
import type { PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import { publicUserIdSchema } from "@/identity/contracts";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";

export class AdminBootstrapError extends Error {
  constructor(message: string) { super(message); this.name = "AdminBootstrapError"; }
}

export type AdminBootstrapResult = "promoted" | "already_admin";
type ServiceDependencies = { database?: () => Promise<Db>; createEventId?: () => string };

function createEventId(): string { return randomBytes(32).toString("base64url"); }

/** The sole Stage 10.1 role mutation: a controlled, server-only first-admin bootstrap. */
export class AdminRoleSecurityService {
  private readonly database: () => Promise<Db>;
  private readonly nextEventId: () => string;

  constructor(dependencies: ServiceDependencies = {}) {
    this.database = dependencies.database ?? getDatabase;
    this.nextEventId = dependencies.createEventId ?? createEventId;
  }

  async bootstrapInitialAdmin(input: { userId: string }): Promise<AdminBootstrapResult> {
    const userId = publicUserIdSchema.parse(input.userId);
    const database = await this.database();
    const session = database.client.startSession();
    let result: AdminBootstrapResult | undefined;
    try {
      await session.withTransaction(async () => {
        const users = database.collection<UserDocument>(databaseCollections.users);
        const credentials = database.collection<UserCredentialDocument>(databaseCollections.userCredentials);
        const events = database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents);
        const targetRaw = await users.findOne({ userId }, { session });
        if (!targetRaw) throw new AdminBootstrapError("Bootstrap target does not exist.");
        const target = parseUserDocument(targetRaw);

        if (target.role === "admin") {
          await events.insertOne(this.bootstrapEvent(userId, "noop"), { session });
          result = "already_admin";
          return;
        }

        const anotherAdmin = await users.findOne({ userId: { $ne: userId }, role: "admin" }, { session, projection: { _id: 1 } });
        if (anotherAdmin) throw new AdminBootstrapError("An Admin already exists.");

        const userWrite = await users.updateOne({ userId }, { $set: { role: "admin", updatedAt: new Date() } }, { session });
        if (userWrite.modifiedCount !== 1) throw new AdminBootstrapError("Bootstrap user role update failed.");
        const credentialWrite = await credentials.updateOne({ userId, disabledAt: null }, { $inc: { securityVersion: 1 }, $set: { updatedAt: new Date() } }, { session });
        if (credentialWrite.modifiedCount !== 1) throw new AdminBootstrapError("Bootstrap credential is unavailable.");
        await events.insertOne(this.bootstrapEvent(userId, "succeeded"), { session });
        result = "promoted";
      });
      if (!result) throw new AdminBootstrapError("Bootstrap did not complete.");
      return result;
    } finally {
      await session.endSession();
    }
  }

  private bootstrapEvent(userId: string, outcome: "succeeded" | "noop"): PrivilegedAuditEventDocument {
    return {
      eventId: this.nextEventId(),
      actor: { actorType: "system", actorId: "admin-bootstrap" },
      action: "admin.bootstrap",
      target: { type: "user", id: userId },
      outcome,
      metadata: { reason: outcome === "succeeded" ? "first_admin_bootstrap" : "already_admin_noop" },
      createdAt: new Date(),
    };
  }
}
