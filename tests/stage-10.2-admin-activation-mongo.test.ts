import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { MongoServerError } from "mongodb";

import { ADMIN_ACTIVATION_WINDOW_MS } from "../src/admin/admin-activation-contract";
import type { AdminInvitationDocument } from "../src/admin/admin-invitation-document";
import { parseAdminInvitationDocument } from "../src/admin/admin-invitation-parser";
import { databaseCollections } from "../src/server/db/collections";
import { ensureAdminActivationIndexes, ensureAdminInvitationIndexes, ensureIdentityIndexes, ensurePrivilegedAuditEventIndexes } from "../src/server/db/indexes";
import { AdminActivationRepositoryError, MongoAdminActivationRepository } from "../src/server/admin/admin-activation-repository";
import { MongoAdminAuthRateLimitStore, hmacAdminRateLimitIdentifier, type AdminActivationRateLimitResult } from "../src/server/admin/admin-auth-rate-limit-store";
import { hashAdminInvitationToken, ADMIN_INVITATION_LIFETIME_MS } from "../src/server/admin/admin-provisioning-service";
import { MongoAdminInvitationRepository } from "../src/server/admin/admin-invitation-repository";
import { AdminProvisioningService } from "../src/server/admin/admin-provisioning-service";
import { getDatabase } from "../src/server/db/mongodb";
import { AdminTransactionOutcomeUnknownError, runAdminTransaction } from "../src/server/admin/admin-transaction";

const mongoConfigured = Boolean(process.env.MONGODB_URI);
const opaqueId = () => randomBytes(32).toString("base64url");

test("Stage 10.2 Gate 2 activation is atomic, one-time, collision-safe and auditable", { skip: !mongoConfigured }, async () => {
  assert.equal(process.env.MONGODB_DB_NAME, "athar_stage55_test", "refusing all non-test databases");
  const database = await getDatabase();
  try {
    await Promise.all([ensureIdentityIndexes(), ensurePrivilegedAuditEventIndexes(), ensureAdminInvitationIndexes(), ensureAdminActivationIndexes()]);
  } catch (error) {
    await database.client.close();
    throw error;
  }
  const runId = randomUUID();
  const emails = {
    valid: `stage102-activate-${runId}@example.invalid`,
    expired: `stage102-expired-${runId}@example.invalid`,
    collision: `stage102-collision-${runId}@example.invalid`,
    concurrent: `stage102-race-${runId}@example.invalid`,
    reissue: `stage102-reissue-${runId}@example.invalid`,
    rollback: `stage102-rollback-${runId}@example.invalid`,
    uncertain: `stage102-uncertain-${runId}@example.invalid`,
  };
  const invitations = database.collection<AdminInvitationDocument>(databaseCollections.adminInvitations);
  const users = database.collection(databaseCollections.users);
  const credentials = database.collection(databaseCollections.userCredentials);
  const events = database.collection(databaseCollections.privilegedAuditEvents);
  const limiterCounters = database.collection(databaseCollections.adminAuthRateLimits);
  const limiterAttempts = database.collection(databaseCollections.adminAuthRateLimitAttempts);
  const repo = new MongoAdminActivationRepository(() => Promise.resolve(database));
  const invitationIds: string[] = [];
  const eventIds: string[] = [];
  const userIds: string[] = [];
  const rawTokens: string[] = [];
  const fixtureAttemptIds: string[] = [];
  const ipBoundaryAttemptIds: string[] = [];
  const identifierHmacs = new Set<string>();
  const rateSecret = `fixture-${randomBytes(32).toString("hex")}`;

  async function makeInvitation(email: string, token = opaqueId(), options: { expiresAt?: Date; invitationId?: string } = {}) {
    const now = new Date();
    const expiresAt = options.expiresAt ?? new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS);
    const invitationId = options.invitationId ?? opaqueId();
    const value = parseAdminInvitationDocument({
      invitationId, normalizedEmail: email, tokenHash: hashAdminInvitationToken(token), status: "pending", deliveryStatus: "pending",
      expiresAt, purgeAt: new Date(Math.max(expiresAt.getTime(), now.getTime()) + 30 * 24 * 60 * 60 * 1000),
      consumedAt: null, invalidatedAt: null, deliveredAt: null, createdAt: now, updatedAt: now,
    });
    await invitations.insertOne(value);
    invitationIds.push(invitationId);
    rawTokens.push(token);
    return { value, token };
  }

  try {
    const valid = await makeInvitation(emails.valid);
    const invalidToken = await repo.activate({ token: opaqueId(), passwordHash: "fixture-hash" }).then(() => false, (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "invalid");
    assert.equal(invalidToken, true);
    const activatedUserId = opaqueId();
    const activatedEventId = opaqueId();
    userIds.push(activatedUserId);
    eventIds.push(activatedEventId);
    await repo.activate({ token: valid.token, passwordHash: "fixture-argon2id-hash", userId: activatedUserId, eventId: activatedEventId });
    assert.equal((await users.findOne({ userId: activatedUserId }))?.role, "admin");
    assert.equal(await credentials.countDocuments({ userId: activatedUserId, disabledAt: null, securityVersion: 0 }), 1);
    const consumed = await invitations.findOne({ invitationId: valid.value.invitationId });
    assert.equal(consumed?.status, "consumed");
    assert.ok(consumed?.consumedAt);
    const activationAudit = await events.findOne({ eventId: activatedEventId });
    assert.deepEqual(activationAudit?.actor, { actorType: "system", actorId: "admin-activation" });
    assert.equal(activationAudit?.action, "admin.invitation.activation_succeeded");
    assert.deepEqual(activationAudit?.metadata, { reason: "invitation_consumed", createdUserId: activatedUserId });
    assert.equal(JSON.stringify(activationAudit).includes(valid.token), false);
    assert.equal(JSON.stringify(activationAudit).includes(emails.valid), false);
    await assert.rejects(() => repo.activate({ token: valid.token, passwordHash: "fixture-hash" }),
      (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "invalid");
    assert.equal(await users.countDocuments({ normalizedEmail: emails.valid }), 1);
    assert.equal(await events.countDocuments({ "target.id": valid.value.invitationId, action: "admin.invitation.activation_succeeded" }), 1);

    const exactExpiry = new Date(Date.now() + 30_000);
    const exactExpiryRepo = new MongoAdminActivationRepository(() => Promise.resolve(database), () => exactExpiry);
    const expired = await makeInvitation(emails.expired, opaqueId(), { expiresAt: exactExpiry });
    await assert.rejects(() => exactExpiryRepo.activate({ token: expired.token, passwordHash: "fixture-hash" }),
      (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "invalid");
    assert.equal((await invitations.findOne({ invitationId: expired.value.invitationId }))?.status, "pending");

    const collision = await makeInvitation(emails.collision);
    const collisionUserId = opaqueId(); userIds.push(collisionUserId);
    await users.insertOne({ userId: collisionUserId, normalizedEmail: emails.collision, role: "customer", createdAt: new Date(), updatedAt: new Date() });
    await assert.rejects(() => repo.activate({ token: collision.token, passwordHash: "fixture-hash" }),
      (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "invalid");
    assert.equal(await users.countDocuments({ normalizedEmail: emails.collision }), 1);
    assert.equal((await invitations.findOne({ invitationId: collision.value.invitationId }))?.status, "pending");

    const rollback = await makeInvitation(emails.rollback);
    const duplicateEventId = opaqueId();
    eventIds.push(duplicateEventId);
    await events.insertOne({ eventId: duplicateEventId, actor: { actorType: "system", actorId: "admin-provisioning" }, action: "admin.invitation.provisioned", target: { type: "admin_invitation", id: opaqueId() }, outcome: "succeeded", metadata: { reason: "new_pending_invitation" }, createdAt: new Date() });
    const rollbackUserId = opaqueId();
    userIds.push(rollbackUserId);
    await assert.rejects(() => repo.activate({ token: rollback.token, passwordHash: "fixture-hash", userId: rollbackUserId, eventId: duplicateEventId }));
    assert.equal((await invitations.findOne({ invitationId: rollback.value.invitationId }))?.status, "pending");
    assert.equal(await users.countDocuments({ userId: rollbackUserId }), 0);
    assert.equal(await credentials.countDocuments({ userId: rollbackUserId }), 0);

    const unknownCommitted = await makeInvitation(emails.uncertain);
    const unknownUserId = opaqueId();
    const unknownEventId = opaqueId();
    userIds.push(unknownUserId); eventIds.push(unknownEventId);
    let committedThenLostAckCalls = 0;
    const commitAckLost = new MongoAdminActivationRepository(() => Promise.resolve(database), () => new Date(), async (db, work) => {
      await runAdminTransaction(db, work);
      committedThenLostAckCalls += 1;
      throw new AdminTransactionOutcomeUnknownError();
    });
    await commitAckLost.activate({ token: unknownCommitted.token, passwordHash: "fixture-hash", userId: unknownUserId, eventId: unknownEventId });
    assert.equal(committedThenLostAckCalls, 1);
    assert.equal(await users.countDocuments({ userId: unknownUserId }), 1);
    assert.equal(await events.countDocuments({ eventId: unknownEventId }), 1);
    assert.equal(await credentials.countDocuments({ userId: unknownUserId }), 1);
    await assert.rejects(() => repo.activate({ token: unknownCommitted.token, passwordHash: "fixture-hash" }),
      (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "invalid");

    const unknownAborted = await makeInvitation(emails.uncertain.replace("uncertain", "uncertain-aborted"));
    const unknownAbortUserId = opaqueId();
    userIds.push(unknownAbortUserId);
    const abortedThenUnknown = new MongoAdminActivationRepository(() => Promise.resolve(database), () => new Date(), async (db, work) => {
      const session = db.client.startSession();
      try { session.startTransaction(); await work(session); await session.abortTransaction(); }
      finally { await session.endSession(); }
      throw new AdminTransactionOutcomeUnknownError();
    });
    await assert.rejects(() => abortedThenUnknown.activate({ token: unknownAborted.token, passwordHash: "fixture-hash", userId: unknownAbortUserId, eventId: opaqueId() }),
      (error: unknown) => error instanceof AdminActivationRepositoryError && error.code === "unavailable");
    assert.equal(await users.countDocuments({ userId: unknownAbortUserId }), 0);
    assert.equal((await invitations.findOne({ invitationId: unknownAborted.value.invitationId }))?.status, "pending");

    const concurrent = await makeInvitation(emails.concurrent);
    const concurrentUserIds = [opaqueId(), opaqueId()];
    const concurrentEvents = [opaqueId(), opaqueId()];
    userIds.push(...concurrentUserIds);
    eventIds.push(...concurrentEvents);
    const concurrentResult = await Promise.allSettled(concurrentUserIds.map((userId, index) => repo.activate({
      token: concurrent.token, passwordHash: "fixture-hash", userId, eventId: concurrentEvents[index],
    })));
    assert.equal(concurrentResult.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await users.countDocuments({ normalizedEmail: emails.concurrent }), 1);
    assert.equal(await events.countDocuments({ "target.id": concurrent.value.invitationId, action: "admin.invitation.activation_succeeded" }), 1);

    const race = await makeInvitation(emails.reissue);
    const raceEventId = opaqueId();
    eventIds.push(raceEventId);
    const invitationRepository = new MongoAdminInvitationRepository(() => Promise.resolve(database));
    const provisioning = new AdminProvisioningService({
      repository: invitationRepository,
      mailer: { async sendAdminInvitation() {} },
      siteUrl: "https://athar.example",
    });
    const raceUserId = opaqueId(); userIds.push(raceUserId);
    const raceResult = await Promise.allSettled([
      repo.activate({ token: race.token, passwordHash: "fixture-hash", userId: raceUserId, eventId: raceEventId }),
      provisioning.provision({ email: emails.reissue, reissue: true }),
    ]);
    assert.equal(raceResult.filter((result) => result.status === "fulfilled").length, 1);
    const raceDocs = await invitations.find({ normalizedEmail: emails.reissue }).toArray();
    const originalRaceInvitation = raceDocs.find((doc) => doc.invitationId === race.value.invitationId);
    assert.ok(originalRaceInvitation);
    if (raceResult[0].status === "fulfilled") {
      assert.equal(raceDocs.length, 1);
      assert.equal(originalRaceInvitation.status, "consumed");
      assert.equal(raceDocs.filter((doc) => doc.status === "pending").length, 0);
      assert.equal(await users.countDocuments({ userId: raceUserId, normalizedEmail: emails.reissue, role: "admin" }), 1);
      assert.equal(await credentials.countDocuments({ userId: raceUserId }), 1);
      assert.equal(await events.countDocuments({ eventId: raceEventId, action: "admin.invitation.activation_succeeded" }), 1);
    } else {
      assert.equal(raceResult[1].status, "fulfilled");
      assert.equal(raceDocs.length, 2);
      assert.equal(originalRaceInvitation.status, "invalidated");
      assert.equal(raceDocs.filter((doc) => doc.status === "pending").length, 1);
      assert.equal(await users.countDocuments({ normalizedEmail: emails.reissue }), 0);
      assert.equal(await credentials.countDocuments({ userId: raceUserId }), 0);
      assert.equal(await events.countDocuments({ eventId: raceEventId }), 0);
    }
    invitationIds.push(...raceDocs.map((doc) => doc.invitationId));

    const rateNow = new Date();
    const rateWindowStart = new Date(Math.floor(rateNow.getTime() / ADMIN_ACTIVATION_WINDOW_MS) * ADMIN_ACTIVATION_WINDOW_MS);
    const retryAttemptId = opaqueId(); fixtureAttemptIds.push(retryAttemptId);
    const retryWriteToken = `retry-write-${"x".repeat(30)}`;
    const retryWriteIp = "fixture-write-conflict-ip";
    identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "token", retryWriteToken));
    identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "ip", retryWriteIp));
    let forcedUpsertConflictCalls = 0;
    const conflictSafeLimiter = new MongoAdminAuthRateLimitStore(() => Promise.resolve(database), rateSecret, async (db, work) => {
      forcedUpsertConflictCalls += 1;
      if (forcedUpsertConflictCalls === 1) throw new MongoServerError({ message: "controlled first-upsert conflict", code: 11000 });
      return runAdminTransaction(db, work);
    });
    const retriedAttempt = await conflictSafeLimiter.recordActivationAttempt({ token: retryWriteToken, clientIp: retryWriteIp, now: rateNow, attemptId: retryAttemptId });
    assert.equal(retriedAttempt.allowed, true);
    assert.equal(retriedAttempt.counted, true);
    assert.equal(forcedUpsertConflictCalls, 2);
    const retryTokenCounter = await limiterCounters.findOne({ dimension: "token", identifierHmac: hmacAdminRateLimitIdentifier(rateSecret, "token", retryWriteToken) });
    assert.equal(retryTokenCounter?.count, 1);

    const rollbackToken = `rollback-counter-${"x".repeat(24)}`;
    const rollbackIp = "fixture-partial-counter-ip";
    const rollbackAttemptId = opaqueId(); fixtureAttemptIds.push(rollbackAttemptId);
    const rollbackTokenHmac = hmacAdminRateLimitIdentifier(rateSecret, "token", rollbackToken);
    const rollbackIpHmac = hmacAdminRateLimitIdentifier(rateSecret, "ip", rollbackIp);
    identifierHmacs.add(rollbackTokenHmac); identifierHmacs.add(rollbackIpHmac);
    const failingLimiter = new MongoAdminAuthRateLimitStore(() => Promise.resolve(database), rateSecret, runAdminTransaction, async () => {
      throw new Error("controlled failure after first counter write");
    });
    const partialWriteResult = await failingLimiter.recordActivationAttempt({ token: rollbackToken, clientIp: rollbackIp, now: rateNow, attemptId: rollbackAttemptId });
    assert.deepEqual(partialWriteResult, { allowed: false, counted: false, outcome: "unavailable" });
    assert.equal(await limiterCounters.countDocuments({ identifierHmac: { $in: [rollbackTokenHmac, rollbackIpHmac] }, windowStart: rateWindowStart }), 0);
    assert.equal(await limiterAttempts.countDocuments({ attemptId: rollbackAttemptId }), 0);

    const exhaustedAttemptId = opaqueId(); fixtureAttemptIds.push(exhaustedAttemptId);
    let exhaustedRetries = 0;
    const exhaustedLimiter = new MongoAdminAuthRateLimitStore(() => Promise.resolve(database), rateSecret, async () => {
      exhaustedRetries += 1;
      throw new MongoServerError({ message: "controlled duplicate-key conflict", code: 11000 });
    });
    const exhaustedResult = await exhaustedLimiter.recordActivationAttempt({ token: `exhausted-${"x".repeat(32)}`, clientIp: "fixture-exhausted-ip", now: rateNow, attemptId: exhaustedAttemptId });
    assert.deepEqual(exhaustedResult, { allowed: false, counted: false, outcome: "unavailable" });
    assert.equal(exhaustedRetries, 3);
    assert.equal(await limiterAttempts.countDocuments({ attemptId: exhaustedAttemptId }), 0);

    const limiter = new MongoAdminAuthRateLimitStore(() => Promise.resolve(database), rateSecret);
    const ipBoundary: AdminActivationRateLimitResult[] = [];
    for (let index = 0; index < 11; index += 1) {
      const attemptId = opaqueId(); fixtureAttemptIds.push(attemptId); ipBoundaryAttemptIds.push(attemptId);
      const thisToken = `token-ip-${index}-${"x".repeat(32)}`;
      identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "token", thisToken));
      identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "ip", "fixture-same-ip"));
      ipBoundary.push(await limiter.recordActivationAttempt({ token: thisToken, clientIp: "fixture-same-ip", now: rateNow, attemptId }));
    }
    assert.equal(ipBoundary.filter((result) => result.allowed).length, 10);
    assert.equal(ipBoundary[10].allowed, false);
    assert.equal(ipBoundary[10].counted, true);
    assert.equal(await limiterAttempts.countDocuments({ attemptId: { $in: ipBoundaryAttemptIds } }), 11);
    assert.equal((await limiterCounters.findOne({ dimension: "ip", identifierHmac: hmacAdminRateLimitIdentifier(rateSecret, "ip", "fixture-same-ip"), windowStart: rateWindowStart }))?.count, 11);

    const tokenBoundaryToken = `token-boundary-${"x".repeat(30)}`;
    const tokenBoundary: AdminActivationRateLimitResult[] = [];
    for (let index = 0; index < 6; index += 1) {
      const attemptId = opaqueId(); fixtureAttemptIds.push(attemptId);
      identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "token", tokenBoundaryToken));
      identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "ip", `fixture-ip-${index}`));
      tokenBoundary.push(await limiter.recordActivationAttempt({ token: tokenBoundaryToken, clientIp: `fixture-ip-${index}`, now: rateNow, attemptId }));
    }
    assert.equal(tokenBoundary.filter((result) => result.allowed).length, 5);
    assert.equal(tokenBoundary[5].allowed, false);
    assert.equal(tokenBoundary[5].counted, true);
    assert.equal((await limiterCounters.findOne({ dimension: "token", identifierHmac: hmacAdminRateLimitIdentifier(rateSecret, "token", tokenBoundaryToken), windowStart: rateWindowStart }))?.count, 6);

    const retryId = opaqueId();
    fixtureAttemptIds.push(retryId);
    const retryToken = `stable-retry-${"x".repeat(30)}`;
    const retryIp = "fixture-stable-ip";
    identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "token", retryToken));
    identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "ip", retryIp));
    const retryFirst = await limiter.recordActivationAttempt({ token: retryToken, clientIp: retryIp, now: rateNow, attemptId: retryId });
    const retrySecond = await limiter.recordActivationAttempt({ token: retryToken, clientIp: retryIp, now: rateNow, attemptId: retryId });
    assert.deepEqual(retrySecond, retryFirst);
    assert.equal(await limiterAttempts.countDocuments({ attemptId: retryId }), 1);

    const unknownAttemptId = opaqueId(); fixtureAttemptIds.push(unknownAttemptId);
    const unknownLimiter = new MongoAdminAuthRateLimitStore(() => Promise.resolve(database), rateSecret, async () => {
      throw new AdminTransactionOutcomeUnknownError();
    });
    const unknownLimitResult = await unknownLimiter.recordActivationAttempt({ token: `unknown-${"x".repeat(32)}`, clientIp: "fixture-unknown-ip", now: new Date(), attemptId: unknownAttemptId });
    assert.deepEqual(unknownLimitResult, { allowed: false, counted: false, outcome: "unavailable" });
    const serializedLimiterData = JSON.stringify(await limiterCounters.find({ identifierHmac: { $in: [...identifierHmacs] } }).toArray()) + JSON.stringify(await limiterAttempts.find({ attemptId: { $in: fixtureAttemptIds } }).toArray());
    assert.equal(serializedLimiterData.includes("fixture-same-ip"), false);
    assert.equal(serializedLimiterData.includes(tokenBoundaryToken), false);
    assert.equal(rawTokens.every((raw) => !serializedLimiterData.includes(raw)), true);
    const indexNames = new Set((await limiterCounters.listIndexes().toArray()).map((index) => index.name));
    assert.equal(indexNames.has("admin_auth_rate_limit_window_unique"), true);
    assert.equal(indexNames.has("admin_auth_rate_limit_expiry_ttl"), true);
    const attemptIndexNames = new Set((await limiterAttempts.listIndexes().toArray()).map((index) => index.name));
    assert.equal(attemptIndexNames.has("admin_auth_rate_limit_attempt_unique"), true);

    const concurrentWindow = rateNow;
    const concurrentIp = "fixture-concurrent-first-upsert";
    identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "ip", concurrentIp));
    const parallel = await Promise.all(Array.from({ length: 16 }, (_, index) => {
      const attemptId = opaqueId(); fixtureAttemptIds.push(attemptId);
      const concurrentToken = `parallel-${index}-${"x".repeat(32)}`;
      identifierHmacs.add(hmacAdminRateLimitIdentifier(rateSecret, "token", concurrentToken));
      return limiter.recordActivationAttempt({ token: concurrentToken, clientIp: concurrentIp, now: concurrentWindow, attemptId });
    }));
    assert.ok(parallel.filter((result) => result.allowed).length <= 10, "concurrent requests must never bypass the IP limit");
    assert.equal(await limiterCounters.findOne({ dimension: "ip", identifierHmac: hmacAdminRateLimitIdentifier(rateSecret, "ip", concurrentIp), windowStart: rateWindowStart }).then((doc) => doc?.count ?? 0) <= 16, true);
  } finally {
    const fixtureInvitations = await invitations.find({ normalizedEmail: { $in: Object.values(emails) } }, { projection: { invitationId: 1 } }).toArray();
    const allInvitationIds = [...new Set([...invitationIds, ...fixtureInvitations.map((doc) => doc.invitationId)])];
    try {
      await events.deleteMany({ $or: [{ eventId: { $in: eventIds } }, { "target.id": { $in: allInvitationIds } }] });
      await invitations.deleteMany({ $or: [{ invitationId: { $in: allInvitationIds } }, { normalizedEmail: { $in: Object.values(emails) } }] });
      await credentials.deleteMany({ userId: { $in: userIds } });
      await users.deleteMany({ $or: [{ userId: { $in: userIds } }, { normalizedEmail: { $in: Object.values(emails) } }] });
      await limiterAttempts.deleteMany({ attemptId: { $in: fixtureAttemptIds } });
      await limiterCounters.deleteMany({ identifierHmac: { $in: [...identifierHmacs] } });
    } finally { await database.client.close(); }
  }
});

test("transaction helper never creates another session for callback retry after unknown commit", async () => {
  let starts = 0;
  let callbacks = 0;
  const session = {
    startTransaction() { starts += 1; },
    async commitTransaction() { throw { hasErrorLabel: (label: string) => label === "UnknownTransactionCommitResult" }; },
    async abortTransaction() {},
    async endSession() {},
  };
  const database = { client: { startSession: () => session } } as never;
  await assert.rejects(() => runAdminTransaction(database, async () => { callbacks += 1; return undefined; }));
  assert.equal(starts, 1);
  assert.equal(callbacks, 1);
});
