import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminInvitationRepositoryError, MongoAdminInvitationRepository } from "../src/server/admin/admin-invitation-repository";
import { ADMIN_INVITATION_LIFETIME_MS, AdminProvisioningError, AdminProvisioningService, hashAdminInvitationToken } from "../src/server/admin/admin-provisioning-service";
import { databaseCollections } from "../src/server/db/collections";
import { ensureAdminInvitationIndexes, ensureIdentityIndexes, ensurePrivilegedAuditEventIndexes } from "../src/server/db/indexes";
import { getDatabase } from "../src/server/db/mongodb";
import { MongoCredentialRepository } from "../src/server/identity/credential-repository";
import { MongoUserRepository } from "../src/server/identity/user-repository";

const mongoReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");
type InvitationRepository = Pick<MongoAdminInvitationRepository, "findPendingByNormalizedEmail" | "createPending" | "markDelivery">;

test("Stage 10.2 Gate 1 provisioning is isolated, collision-safe, auditable and reissue-safe", { skip: !mongoReady }, async () => {
  assert.equal(process.env.MONGODB_DB_NAME, "athar_stage55_test");
  const database = await getDatabase();
  await ensureIdentityIndexes();
  await ensurePrivilegedAuditEventIndexes();
  await ensureAdminInvitationIndexes();

  const runId = randomUUID();
  const emails = {
    unused: `stage102-unused-${runId}@example.invalid`,
    customer: `stage102-customer-${runId}@example.invalid`,
    admin: `stage102-admin-${runId}@example.invalid`,
    concurrent: `stage102-concurrent-${runId}@example.invalid`,
    expired: `stage102-expired-${runId}@example.invalid`,
    race: `stage102-race-${runId}@example.invalid`,
    failure: `stage102-failure-${runId}@example.invalid`,
  };
  const emailValues = Object.values(emails);
  const users = new MongoUserRepository(() => Promise.resolve(database));
  const credentials = new MongoCredentialRepository(() => Promise.resolve(database));
  const repository = new MongoAdminInvitationRepository(() => Promise.resolve(database));
  const invitations = database.collection(databaseCollections.adminInvitations);
  const events = database.collection(databaseCollections.privilegedAuditEvents);
  const orderDeliveries = database.collection(databaseCollections.emailDeliveries);
  const sent: Array<{ to: string; activationUrl: string; expiresHours: number }> = [];
  const makeService = (options: {
    emailFail?: boolean;
    now?: () => Date;
    repository?: InvitationRepository;
  } = {}) => new AdminProvisioningService({
    repository: options.repository ?? repository,
    mailer: { async sendAdminInvitation(message) { if (options.emailFail) throw new Error("fixture delivery failure"); sent.push(message); } },
    siteUrl: "https://athar.example",
    now: options.now,
  });

  let customerId: string | undefined;
  let adminId: string | undefined;
  try {
    const deliveryCountBefore = await orderDeliveries.countDocuments({});
    const credentialCountBefore = await database.collection(databaseCollections.userCredentials).countDocuments({});
    const first = await makeService().provision({ email: emails.unused });
    const firstDocument = await repository.findByInvitationId(first.invitationId);
    assert.ok(firstDocument);
    assert.equal(firstDocument.normalizedEmail, emails.unused);
    assert.equal(firstDocument.status, "pending");
    assert.equal(firstDocument.deliveryStatus, "sent");
    assert.equal(firstDocument.expiresAt.getTime() - firstDocument.createdAt.getTime(), ADMIN_INVITATION_LIFETIME_MS);
    assert.match(firstDocument.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal("token" in firstDocument, false);
    assert.equal("activationUrl" in firstDocument, false);
    assert.equal(await database.collection(databaseCollections.users).countDocuments({ normalizedEmail: emails.unused }), 0);
    assert.equal(await database.collection(databaseCollections.userCredentials).countDocuments({}), credentialCountBefore);
    assert.equal(await orderDeliveries.countDocuments({}), deliveryCountBefore);
    assert.equal(sent[0].activationUrl.includes("/admin/activate#token="), true);
    assert.equal(new URL(sent[0].activationUrl).search, "");
    const firstRawToken = new URL(sent[0].activationUrl).hash.slice("#token=".length);
    assert.equal(firstDocument.tokenHash, hashAdminInvitationToken(firstRawToken));
    assert.equal(JSON.stringify(firstDocument).includes(firstRawToken), false);

    const provisionAudit = await events.findOne({ "target.id": first.invitationId });
    assert.deepEqual(provisionAudit?.actor, { actorType: "system", actorId: "admin-provisioning" });
    assert.equal(provisionAudit?.action, "admin.invitation.provisioned");
    const auditText = JSON.stringify(provisionAudit);
    assert.equal(auditText.includes(firstRawToken), false);
    assert.equal(auditText.includes(emails.unused), false);
    assert.equal(auditText.includes("password"), false);
    assert.equal(auditText.includes("https://"), false);

    await assert.rejects(() => makeService().provision({ email: emails.unused }), (error: unknown) => {
      return error instanceof AdminInvitationRepositoryError && error.code === "pending_invitation_exists";
    });
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.unused, status: "pending" }), 1);

    const customer = await users.create({ email: emails.customer });
    customerId = customer.userId;
    await credentials.create({ userId: customer.userId, passwordHash: "stage-10.2-customer-fixture" });
    await assert.rejects(() => makeService().provision({ email: emails.customer }), (error: unknown) => {
      return error instanceof AdminInvitationRepositoryError && error.code === "existing_customer";
    });
    assert.equal((await users.findByUserId(customer.userId))?.role, "customer");
    assert.equal((await credentials.findByUserId(customer.userId))?.securityVersion, 0);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.customer }), 0);

    const admin = await users.create({ email: emails.admin });
    adminId = admin.userId;
    await credentials.create({ userId: admin.userId, passwordHash: "stage-10.2-admin-fixture" });
    await database.collection(databaseCollections.users).updateOne({ userId: admin.userId }, { $set: { role: "admin" } });
    await assert.rejects(() => makeService().provision({ email: emails.admin }), (error: unknown) => {
      return error instanceof AdminInvitationRepositoryError && error.code === "existing_admin";
    });
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.admin }), 0);

    const reissued = await makeService().provision({ email: emails.unused, reissue: true });
    const oldAfterReissue = await repository.findByInvitationId(first.invitationId);
    const successor = await repository.findByInvitationId(reissued.invitationId);
    assert.equal(oldAfterReissue?.status, "invalidated");
    assert.ok(oldAfterReissue?.invalidatedAt);
    assert.equal(successor?.status, "pending");
    assert.notEqual(successor?.tokenHash, firstDocument.tokenHash);
    assert.equal(successor!.expiresAt.getTime() - successor!.createdAt.getTime(), ADMIN_INVITATION_LIFETIME_MS);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.unused, status: "pending" }), 1);
    assert.equal((await events.findOne({ "target.id": reissued.invitationId }))?.action, "admin.invitation.reissued");

    const concurrent = await Promise.allSettled([
      makeService().provision({ email: emails.concurrent }),
      makeService().provision({ email: emails.concurrent }),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.concurrent, status: "pending" }), 1);
    const beforeConcurrentReissue = await invitations.findOne({ normalizedEmail: emails.concurrent, status: "pending" });
    assert.ok(beforeConcurrentReissue);
    let releaseReads = () => {};
    const bothPredecessorsRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    let predecessorReads = 0;
    const compareAndSwapRepository = {
      async findPendingByNormalizedEmail(email: string) {
        const predecessor = await repository.findPendingByNormalizedEmail(email);
        predecessorReads += 1;
        if (predecessorReads === 2) releaseReads();
        await bothPredecessorsRead;
        return predecessor;
      },
      createPending: repository.createPending.bind(repository),
      markDelivery: repository.markDelivery.bind(repository),
    } satisfies InvitationRepository;
    const messagesBeforeConcurrentReissue = sent.length;
    const concurrentReissues = await Promise.allSettled([
      makeService({ repository: compareAndSwapRepository }).provision({ email: emails.concurrent, reissue: true }),
      makeService({ repository: compareAndSwapRepository }).provision({ email: emails.concurrent, reissue: true }),
    ]);
    const reissueWinners = concurrentReissues.filter((result) => result.status === "fulfilled");
    const reissueConflicts = concurrentReissues.filter((result): result is PromiseRejectedResult =>
      result.status === "rejected" && result.reason instanceof AdminInvitationRepositoryError && result.reason.code === "concurrent_invitation_conflict");
    assert.equal(reissueWinners.length, 1);
    assert.equal(reissueConflicts.length, 1);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.concurrent, status: "pending" }), 1);
    assert.equal((await invitations.findOne({ invitationId: beforeConcurrentReissue.invitationId }))?.status, "invalidated");
    const concurrentDocuments = await invitations.find({ normalizedEmail: emails.concurrent }).toArray();
    assert.equal(concurrentDocuments.length, 2);
    const winnerId = (reissueWinners[0] as PromiseFulfilledResult<{ invitationId: string }>).value.invitationId;
    const winnerDocument = concurrentDocuments.find((document) => document.invitationId === winnerId);
    assert.equal(winnerDocument?.status, "pending");
    assert.equal(winnerDocument?.invalidatedAt, null);
    assert.equal(sent.length - messagesBeforeConcurrentReissue, 1);
    const winnerMessage = sent.at(-1)!;
    const winnerRawToken = new URL(winnerMessage.activationUrl).hash.slice("#token=".length);
    assert.equal(winnerDocument?.tokenHash, hashAdminInvitationToken(winnerRawToken));
    assert.equal(JSON.stringify(concurrentDocuments).includes(winnerRawToken), false);
    const concurrentInvitationIds = concurrentDocuments.map((document) => document.invitationId);
    assert.equal(await events.countDocuments({ action: "admin.invitation.reissued", "target.id": { $in: concurrentInvitationIds } }), 1);

    const currentTime = new Date();
    const expiredCreationTime = new Date(currentTime.getTime() - 48 * 60 * 60 * 1000);
    const expired = await makeService({ now: () => expiredCreationTime }).provision({ email: emails.expired });
    const expiredDocument = await repository.findByInvitationId(expired.invitationId);
    assert.ok(expiredDocument);
    assert.equal(expiredDocument.status, "pending");
    assert.equal(expiredDocument.expiresAt.getTime() <= currentTime.getTime(), true);
    assert.equal(expiredDocument.purgeAt.getTime() > currentTime.getTime(), true);
    await assert.rejects(() => makeService().provision({ email: emails.expired }), (error: unknown) =>
      error instanceof AdminInvitationRepositoryError && error.code === "pending_invitation_exists");
    const renewed = await makeService({ now: () => currentTime }).provision({ email: emails.expired, reissue: true });
    assert.equal((await repository.findByInvitationId(expired.invitationId))?.status, "invalidated");
    const renewedDocument = await repository.findByInvitationId(renewed.invitationId);
    assert.equal(renewedDocument?.status, "pending");
    assert.equal(renewedDocument!.expiresAt.getTime() - renewedDocument!.createdAt.getTime(), ADMIN_INVITATION_LIFETIME_MS);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.expired, status: "pending" }), 1);

    const racePredecessor = await makeService().provision({ email: emails.race });
    const messagesBeforeRace = sent.length;
    const provisionReissueRace = await Promise.allSettled([
      makeService().provision({ email: emails.race }),
      makeService().provision({ email: emails.race, reissue: true }),
    ]);
    assert.equal(provisionReissueRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(provisionReissueRace.some((result) => result.status === "rejected" && result.reason instanceof AdminInvitationRepositoryError && result.reason.code === "pending_invitation_exists"), true);
    assert.equal((await repository.findByInvitationId(racePredecessor.invitationId))?.status, "invalidated");
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.race, status: "pending" }), 1);
    assert.equal(await invitations.countDocuments({ normalizedEmail: emails.race }), 2);
    assert.equal(sent.length - messagesBeforeRace, 1);

    await assert.rejects(() => makeService({ emailFail: true }).provision({ email: emails.failure }), (error: unknown) => {
      return error instanceof AdminProvisioningError && error.code === "delivery_failed";
    });
    assert.equal((await invitations.findOne({ normalizedEmail: emails.failure }))?.deliveryStatus, "failed");
    assert.equal(await database.collection(databaseCollections.users).countDocuments({ normalizedEmail: emails.failure }), 0);

    const indexNames = new Set((await invitations.listIndexes().toArray()).map((index) => index.name));
    for (const name of [
      "admin_invitation_id_unique",
      "admin_invitation_token_hash_unique",
      "admin_invitation_pending_email_unique",
      "admin_invitation_email_created",
      "admin_invitation_cleanup_ttl",
    ]) assert.equal(indexNames.has(name), true);

    const generatedTokens = sent.map((message) => new URL(message.activationUrl).hash.slice("#token=".length));
    for (const token of generatedTokens) assert.equal(JSON.stringify(await invitations.find({ normalizedEmail: { $in: emailValues } }).toArray()).includes(token), false);
  } finally {
    const fixtureInvitations = await invitations.find({ normalizedEmail: { $in: emailValues } }, { projection: { invitationId: 1 } }).toArray();
    const invitationIds = fixtureInvitations.map((invitation) => invitation.invitationId);
    await events.deleteMany({ "target.type": "admin_invitation", "target.id": { $in: invitationIds } });
    await invitations.deleteMany({ normalizedEmail: { $in: emailValues } });
    if (customerId || adminId) {
      const userIds = [customerId, adminId].filter((value): value is string => Boolean(value));
      await database.collection(databaseCollections.userCredentials).deleteMany({ userId: { $in: userIds } });
      await database.collection(databaseCollections.users).deleteMany({ userId: { $in: userIds } });
    }
    assert.equal(await invitations.countDocuments({ normalizedEmail: { $in: emailValues } }), 0);
    assert.equal(await events.countDocuments({ "target.type": "admin_invitation", "target.id": { $in: invitationIds } }), 0);
    assert.equal(await database.collection(databaseCollections.users).countDocuments({ normalizedEmail: { $in: emailValues } }), 0);
    const fixtureUserIds = [customerId, adminId].filter((value): value is string => Boolean(value));
    assert.equal(await database.collection(databaseCollections.userCredentials).countDocuments({ userId: { $in: fixtureUserIds } }), 0);
    await database.client.close();
  }
});
