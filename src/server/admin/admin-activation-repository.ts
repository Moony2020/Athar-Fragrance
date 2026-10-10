import "server-only";

import { randomBytes } from "node:crypto";
import { MongoServerError, type Db } from "mongodb";
import type { ClientSession } from "mongodb";

import type { AdminInvitationDocument } from "@/admin/admin-invitation-document";
import { parseAdminInvitationDocument } from "@/admin/admin-invitation-parser";
import { parsePrivilegedAuditEventDocument, type PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import type { UserCredentialDocument } from "@/identity/credential-documents";
import { parseUserCredentialDocument } from "@/identity/credential-parser";
import type { UserDocument } from "@/identity/documents";
import { displayNameSchema } from "@/identity/contracts";
import { parseUserDocument } from "@/identity/parser";
import { hashAdminInvitationToken } from "@/server/admin/admin-provisioning-service";
import { AdminTransactionOutcomeUnknownError, runAdminTransaction } from "@/server/admin/admin-transaction";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";

export type AdminActivationResult = "activated";
export type AdminActivationErrorCode = "invalid" | "unavailable" | "invariant_failure";
export class AdminActivationRepositoryError extends Error {
  constructor(readonly code: AdminActivationErrorCode) { super(code); this.name = "AdminActivationRepositoryError"; }
}

function opaqueId(): string { return randomBytes(32).toString("base64url"); }
function isDuplicateKey(error: unknown): boolean { return error instanceof MongoServerError && error.code === 11000; }

async function hasRequiredActivationIndexes(database: Db): Promise<boolean> {
  const [users, credentials, invitations, audit] = await Promise.all([
    database.collection(databaseCollections.users).listIndexes().toArray(),
    database.collection(databaseCollections.userCredentials).listIndexes().toArray(),
    database.collection(databaseCollections.adminInvitations).listIndexes().toArray(),
    database.collection(databaseCollections.privilegedAuditEvents).listIndexes().toArray(),
  ]);
  const uniqueIndex = (indexes: Array<{ name?: string; unique?: boolean; key?: Record<string, unknown> }>, name: string, key: string) =>
    indexes.some((index) => index.name === name && index.unique === true &&
      index.key && Object.keys(index.key).length === 1 && index.key[key] === 1);
  return uniqueIndex(users, "users_email_unique", "normalizedEmail") && uniqueIndex(users, "users_public_id_unique", "userId") &&
    uniqueIndex(credentials, "credentials_user_unique", "userId") &&
    uniqueIndex(invitations, "admin_invitation_token_hash_unique", "tokenHash") &&
    uniqueIndex(audit, "privileged_audit_event_id_unique", "eventId");
}

type ActivateInput = { token: string; passwordHash: string; userId?: string; eventId?: string };

export class MongoAdminActivationRepository {
  constructor(
    private readonly database: () => Promise<Db> = getDatabase,
    private readonly now: () => Date = () => new Date(),
    private readonly transaction: <T>(database: Db, work: (session: ClientSession) => Promise<T>) => Promise<T> = runAdminTransaction,
  ) {}

  async activate(input: ActivateInput): Promise<AdminActivationResult> {
    const database = await this.database();
    try {
      if (!await hasRequiredActivationIndexes(database)) throw new AdminActivationRepositoryError("unavailable");
    } catch (error) {
      if (error instanceof AdminActivationRepositoryError) throw error;
      throw new AdminActivationRepositoryError("unavailable");
    }
    const userId = input.userId ?? opaqueId();
    const eventId = input.eventId ?? opaqueId();
    const tokenHash = hashAdminInvitationToken(input.token);
    let invitationId: string | undefined;
    let normalizedEmail: string | undefined;

    try {
      await this.transaction(database, async (session) => {
        const invitations = database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations);
        const rawInvitation = await invitations.findOne({ tokenHash }, { session });
        if (!rawInvitation) throw new AdminActivationRepositoryError("invalid");
        const invitation = parseAdminInvitationDocument(rawInvitation);
        invitationId = invitation.invitationId;
        normalizedEmail = invitation.normalizedEmail;
        const transactionNow = this.now();
        if (invitation.status !== "pending" || invitation.consumedAt || invitation.invalidatedAt || invitation.expiresAt <= transactionNow) {
          throw new AdminActivationRepositoryError("invalid");
        }

        const consumed = await invitations.updateOne({
          _id: invitation._id,
          invitationId: invitation.invitationId,
          tokenHash,
          status: "pending",
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { $gt: transactionNow },
        }, { $set: { status: "consumed", consumedAt: transactionNow, updatedAt: transactionNow } }, { session });
        if (consumed.modifiedCount !== 1) throw new AdminActivationRepositoryError("invalid");

        const users = database.collection<UserDocument>(databaseCollections.users);
        if (await users.findOne({ normalizedEmail: invitation.normalizedEmail }, { session, projection: { _id: 1 } })) {
          throw new AdminActivationRepositoryError("invalid");
        }
        const user = parseUserDocument({
          userId,
          normalizedEmail: invitation.normalizedEmail,
          displayName: displayNameSchema.parse(invitation.normalizedEmail.split("@")[0]),
          role: "admin",
          createdAt: transactionNow,
          updatedAt: transactionNow,
        });
        const credential: UserCredentialDocument = parseUserCredentialDocument({
          userId, passwordHash: input.passwordHash, disabledAt: null, securityVersion: 0,
          createdAt: transactionNow, updatedAt: transactionNow,
        });
        const auditEvent: PrivilegedAuditEventDocument = parsePrivilegedAuditEventDocument({
          eventId,
          actor: { actorType: "system", actorId: "admin-activation" },
          action: "admin.invitation.activation_succeeded",
          target: { type: "admin_invitation", id: invitation.invitationId },
          outcome: "succeeded",
          metadata: { reason: "invitation_consumed", createdUserId: user.userId },
          createdAt: transactionNow,
        });
        await users.insertOne(user, { session });
        await database.collection<UserCredentialDocument>(databaseCollections.userCredentials).insertOne(credential, { session });
        await database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents).insertOne(auditEvent, { session });
      });
      return "activated";
    } catch (error) {
      if (error instanceof AdminActivationRepositoryError) throw error;
      if (isDuplicateKey(error)) throw new AdminActivationRepositoryError("invalid");
      if (error instanceof AdminTransactionOutcomeUnknownError) {
        const reconciliation = await this.reconcile(database, { invitationId, tokenHash, normalizedEmail, userId, eventId }).catch(() => "unresolved" as const);
        if (reconciliation === "committed") return "activated";
        if (reconciliation === "inconsistent") throw new AdminActivationRepositoryError("invariant_failure");
        throw new AdminActivationRepositoryError("unavailable");
      }
      throw new AdminActivationRepositoryError("unavailable");
    }
  }

  private async reconcile(database: Db, input: { invitationId?: string; tokenHash: string; normalizedEmail?: string; userId: string; eventId: string }): Promise<"committed" | "absent" | "inconsistent" | "unresolved"> {
    if (!input.invitationId || !input.normalizedEmail) return "unresolved";
    const [invitation, user, credential, audit] = await runAdminTransaction(database, async (session) => {
      // MongoDB does not support parallel operations on one transaction/session.
      const invitation = await database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations)
        .findOne({ invitationId: input.invitationId, tokenHash: input.tokenHash }, { session });
      const user = await database.collection<UserDocument>(databaseCollections.users)
        .findOne({ userId: input.userId, normalizedEmail: input.normalizedEmail }, { session });
      const credential = await database.collection<UserCredentialDocument>(databaseCollections.userCredentials)
        .findOne({ userId: input.userId }, { session });
      const audit = await database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents)
        .findOne({ eventId: input.eventId }, { session });
      return [invitation, user, credential, audit] as const;
    });
    if (!invitation) return "unresolved";
    if (!user && !credential && !audit) {
      return invitation.status === "pending" && !invitation.consumedAt && !invitation.invalidatedAt ? "absent" : "inconsistent";
    }
    if (!user || !credential || !audit) return "inconsistent";
    const parsedInvitation = parseAdminInvitationDocument(invitation);
    const parsedUser = parseUserDocument(user);
    parseUserCredentialDocument(credential);
    const parsedAudit = parsePrivilegedAuditEventDocument(audit);
    const complete = parsedInvitation.status === "consumed" && Boolean(parsedInvitation.consumedAt) &&
      parsedUser.role === "admin" && parsedUser.userId === input.userId &&
      parsedAudit.action === "admin.invitation.activation_succeeded" &&
      parsedAudit.target.id === input.invitationId && parsedAudit.metadata.createdUserId === input.userId;
    return complete ? "committed" : "inconsistent";
  }
}
