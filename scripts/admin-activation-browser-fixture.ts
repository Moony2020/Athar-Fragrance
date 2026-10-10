/** Local-only browser fixture. Never use for real Admin provisioning. */
import { randomBytes, randomUUID } from "node:crypto";

import type { AdminInvitationDocument } from "../src/admin/admin-invitation-document";
import { parseAdminInvitationDocument } from "../src/admin/admin-invitation-parser";
import type { PrivilegedAuditEventDocument } from "../src/admin/privileged-audit-document";
import { parsePrivilegedAuditEventDocument } from "../src/admin/privileged-audit-document";
import type { UserDocument } from "../src/identity/documents";
import { MongoAdminInvitationRepository } from "../src/server/admin/admin-invitation-repository";
import { ADMIN_INVITATION_LIFETIME_MS, buildAdminActivationUrl, hashAdminInvitationToken } from "../src/server/admin/admin-provisioning-service";
import { databaseCollections } from "../src/server/db/collections";
import { getDatabase } from "../src/server/db/mongodb";

const fixtureEmail = /^stage102-browser-[0-9a-f-]{36}@example\.invalid$/;
const fixtureId = /^[A-Za-z0-9_-]{32,128}$/;

function assertLocalTestBoundary(): void {
  if (process.env.NODE_ENV === "production" ||
      process.env.MONGODB_DB_NAME !== "athar_stage55_test" ||
      !process.env.MONGODB_URI) {
    throw new Error("Refusing browser fixture outside the local test database.");
  }
}

async function createFixture(): Promise<void> {
  const email = `stage102-browser-${randomUUID()}@example.invalid`;
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const invitationId = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS);
  const invitation = parseAdminInvitationDocument({
    invitationId,
    normalizedEmail: email,
    tokenHash: hashAdminInvitationToken(token),
    status: "pending",
    deliveryStatus: "pending",
    expiresAt,
    purgeAt: new Date(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    consumedAt: null,
    invalidatedAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const auditEvent = parsePrivilegedAuditEventDocument({
    eventId: randomBytes(32).toString("base64url"),
    actor: { actorType: "system", actorId: "admin-provisioning" },
    action: "admin.invitation.provisioned",
    target: { type: "admin_invitation", id: invitationId },
    outcome: "succeeded",
    metadata: { reason: "new_pending_invitation" },
    createdAt: now,
  });
  await new MongoAdminInvitationRepository().createPending({
    invitation,
    auditEvent,
    reissue: false,
    now,
  });
  console.log(`FIXTURE_ID: ${invitationId}`);
  console.log(`FIXTURE_EMAIL: ${email}`);
  // One-time, owner-facing CLI output only; never log or share this test URL.
  console.log(`LOCAL_ACTIVATION_URL: ${buildAdminActivationUrl("http://localhost:3000", token)}`);
  console.log("MAIL_SENT: NO");
}

async function cleanFixture(invitationId: string): Promise<void> {
  if (!fixtureId.test(invitationId)) throw new Error("Invalid fixture ID.");
  const database = await getDatabase();
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const invitations = database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations);
      const invitation = await invitations.findOne({ invitationId }, { session });
      if (!invitation || !fixtureEmail.test(invitation.normalizedEmail)) {
        throw new Error("Fixture not found or does not belong to this browser test.");
      }
      const events = database.collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents);
      const relatedEvents = await events.find({ "target.type": "admin_invitation", "target.id": invitationId }, { session }).toArray();
      if (relatedEvents.length < 1 || relatedEvents.some((event) =>
        event.action !== "admin.invitation.provisioned" && event.action !== "admin.invitation.activation_succeeded")) {
        throw new Error("Unexpected audit history; refusing fixture cleanup.");
      }
      const activationEvents = relatedEvents.filter((event) => event.action === "admin.invitation.activation_succeeded");
      const users = database.collection<UserDocument>(databaseCollections.users);
      const user = await users.findOne({ normalizedEmail: invitation.normalizedEmail }, { session });
      if (user) {
        if (invitation.status !== "consumed" || user.role !== "admin" || activationEvents.length !== 1 ||
            activationEvents[0].metadata.createdUserId !== user.userId) {
          throw new Error("Identity does not match the activated fixture; refusing cleanup.");
        }
        const credential = await database.collection(databaseCollections.userCredentials).findOne({ userId: user.userId }, { session });
        if (!credential) throw new Error("Fixture credential is missing; refusing cleanup.");
        await database.collection(databaseCollections.userCredentials).deleteOne({ userId: user.userId }, { session });
        await users.deleteOne({ userId: user.userId, normalizedEmail: invitation.normalizedEmail }, { session });
      } else if (activationEvents.length !== 0 || invitation.status === "consumed") {
        throw new Error("Fixture state is inconsistent; refusing cleanup.");
      }
      await events.deleteMany({ "target.type": "admin_invitation", "target.id": invitationId }, { session });
      await invitations.deleteOne({ invitationId, normalizedEmail: invitation.normalizedEmail }, { session });
    });
    console.log("BROWSER_FIXTURE_CLEANED: YES");
    console.log("RATE_LIMIT_RECORDS: TTL-managed; not altered");
  } finally {
    await session.endSession();
  }
}

async function main(): Promise<void> {
  assertLocalTestBoundary();
  const [operation, invitationId, extra] = process.argv.slice(2);
  if (extra || (operation !== "create" && operation !== "cleanup") ||
      (operation === "create" && invitationId) || (operation === "cleanup" && !invitationId)) {
    throw new Error("Usage: admin-activation-browser-fixture.ts create | cleanup <FIXTURE_ID>");
  }
  const database = await getDatabase();
  try {
    if (operation === "create") await createFixture();
    else await cleanFixture(invitationId!);
  } finally {
    await database.client.close();
  }
}

main().catch(() => {
  console.error("Local browser fixture operation failed. Do not retry blindly if a fixture was already created.");
  process.exitCode = 1;
});
