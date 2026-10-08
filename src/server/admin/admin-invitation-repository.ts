import "server-only";

import { MongoServerError, type Db } from "mongodb";

import type { AdminInvitationDocument } from "@/admin/admin-invitation-document";
import { parseAdminInvitationDocument } from "@/admin/admin-invitation-parser";
import { parsePrivilegedAuditEventDocument, type PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import type { UserDocument } from "@/identity/documents";
import { parseUserDocument } from "@/identity/parser";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";

export type AdminInvitationRepositoryErrorCode =
  | "existing_customer"
  | "existing_admin"
  | "pending_invitation_exists"
  | "concurrent_invitation_conflict";

export class AdminInvitationRepositoryError extends Error {
  constructor(readonly code: AdminInvitationRepositoryErrorCode) {
    super(code);
    this.name = "AdminInvitationRepositoryError";
  }
}

type CreateInput = {
  invitation: AdminInvitationDocument;
  auditEvent: PrivilegedAuditEventDocument;
  reissue: boolean;
  expectedPredecessorInvitationId?: string;
  now: Date;
};

export class MongoAdminInvitationRepository {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async findPendingByNormalizedEmail(normalizedEmail: string): Promise<AdminInvitationDocument | null> {
    const document = await (await this.database()).collection<AdminInvitationDocument>(databaseCollections.adminInvitations)
      .findOne({ normalizedEmail, status: "pending" });
    return document ? parseAdminInvitationDocument(document) : null;
  }

  async createPending(input: CreateInput): Promise<void> {
    const invitation = parseAdminInvitationDocument(input.invitation);
    const auditEvent = parsePrivilegedAuditEventDocument(input.auditEvent);
    const database = await this.database();
    const session = database.client.startSession();
    try {
      await session.withTransaction(async () => {
        const users = database.collection<UserDocument>(databaseCollections.users);
        const existingUserRaw = await users.findOne(
          { normalizedEmail: invitation.normalizedEmail },
          { session },
        );
        if (existingUserRaw) {
          const existingUser = parseUserDocument(existingUserRaw);
          throw new AdminInvitationRepositoryError(existingUser.role === "admin" ? "existing_admin" : "existing_customer");
        }

        const invitations = database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations);
        if (input.reissue) {
          if (!input.expectedPredecessorInvitationId) {
            throw new AdminInvitationRepositoryError("concurrent_invitation_conflict");
          }
          const invalidation = await invitations.updateOne(
            {
              invitationId: input.expectedPredecessorInvitationId,
              normalizedEmail: invitation.normalizedEmail,
              status: "pending",
            },
            { $set: { status: "invalidated", invalidatedAt: input.now, updatedAt: input.now } },
            { session },
          );
          if (invalidation.modifiedCount !== 1) {
            throw new AdminInvitationRepositoryError("concurrent_invitation_conflict");
          }
        } else {
          const existingPending = await invitations.findOne(
            { normalizedEmail: invitation.normalizedEmail, status: "pending" },
            { session, projection: { _id: 1 } },
          );
          if (existingPending) throw new AdminInvitationRepositoryError("pending_invitation_exists");
        }

        await invitations.insertOne(invitation, { session });
        await database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents)
          .insertOne(auditEvent, { session });
      });
    } catch (error) {
      if (error instanceof AdminInvitationRepositoryError) throw error;
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AdminInvitationRepositoryError(input.reissue ? "concurrent_invitation_conflict" : "pending_invitation_exists");
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async markDelivery(invitationId: string, deliveryStatus: "sent" | "failed", now: Date): Promise<void> {
    const result = await (await this.database()).collection<AdminInvitationDocument>(databaseCollections.adminInvitations).updateOne(
      { invitationId, status: "pending" },
      {
        $set: {
          deliveryStatus,
          deliveredAt: deliveryStatus === "sent" ? now : null,
          updatedAt: now,
        },
      },
    );
    if (result.matchedCount !== 1) throw new Error("Admin invitation delivery state is unavailable.");
  }

  async findByInvitationId(invitationId: string): Promise<AdminInvitationDocument | null> {
    const document = await (await this.database()).collection<AdminInvitationDocument>(databaseCollections.adminInvitations)
      .findOne({ invitationId });
    return document ? parseAdminInvitationDocument(document) : null;
  }
}
