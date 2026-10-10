import assert from "node:assert/strict";
import test from "node:test";

import { adminActivationInputSchema } from "../src/admin/admin-activation-contract";
import { parsePrivilegedAuditEventDocument } from "../src/admin/privileged-audit-document";
import { createAdminActivationPost, OPTIONS } from "../src/app/api/admin/activate/route";
import { AdminActivationService, AdminActivationServiceError } from "../src/server/admin/admin-activation-service";
import { hmacAdminRateLimitIdentifier } from "../src/server/admin/admin-auth-rate-limit-store";
import { isAdminActivationEnabled, isAllowedActivationOrigin, isJsonContentType, readBoundedActivationBody, resolveAdminActivationClientIp } from "../src/server/admin/admin-activation-request-security";
import { AdminTransactionOutcomeUnknownError, runAdminTransaction } from "../src/server/admin/admin-transaction";

const token = "t".repeat(43);
const validInput = { token, password: "GoodSecurePassword123" };

test("activation contract validates strict password input and audit metadata", () => {
  assert.equal(adminActivationInputSchema.safeParse(validInput).success, true);
  assert.equal(adminActivationInputSchema.safeParse({ ...validInput, email: "admin@example.invalid" }).success, false);
  assert.equal(adminActivationInputSchema.safeParse({ token, password: "short" }).success, false);
  assert.throws(() => parsePrivilegedAuditEventDocument({
    eventId: "e".repeat(43), actor: { actorType: "system", actorId: "admin-activation" },
    action: "admin.invitation.activation_succeeded", target: { type: "admin_invitation", id: "i".repeat(43) },
    outcome: "succeeded", metadata: { reason: "invitation_consumed", createdUserId: "u".repeat(43), email: "leak@example.invalid" }, createdAt: new Date(),
  }));
});

test("rate limit HMAC is keyed, dimension-separated, and never equals raw identifiers", () => {
  const secret = "s".repeat(48);
  const tokenKey = hmacAdminRateLimitIdentifier(secret, "token", token);
  const ipKey = hmacAdminRateLimitIdentifier(secret, "ip", "192.0.2.10");
  assert.match(tokenKey, /^[a-f0-9]{64}$/);
  assert.notEqual(tokenKey, ipKey);
  assert.equal(tokenKey.includes(token), false);
  assert.notEqual(hmacAdminRateLimitIdentifier(`${secret}x`, "token", token), tokenKey);
  assert.throws(() => hmacAdminRateLimitIdentifier("short", "token", token));
});

test("activation request guards use exact configured Origin and never trust forwarding headers", async () => {
  const env = { NODE_ENV: "development", ADMIN_ACTIVATION_ENABLED: "1", MONGODB_DB_NAME: "athar_stage55_test", MONGODB_URI: "mongodb://fixture.invalid", ADMIN_ACTIVATION_ALLOWED_ORIGINS: "http://localhost:3000,https://athar.example" };
  assert.equal(isAdminActivationEnabled(env), true);
  assert.equal(isAdminActivationEnabled({ ...env, NODE_ENV: "production" }), false);
  assert.equal(isAdminActivationEnabled({ ...env, MONGODB_DB_NAME: "production" }), false);
  assert.equal(isAllowedActivationOrigin("http://localhost:3000", env), true);
  assert.equal(isAllowedActivationOrigin("http://localhost:3000.evil.example", env), false);
  assert.equal(isAllowedActivationOrigin("null", env), false);
  assert.equal(isAllowedActivationOrigin(null, env), false);
  assert.equal(isAllowedActivationOrigin("http://localhost:3000", { ...env, ADMIN_ACTIVATION_ALLOWED_ORIGINS: "" }), false);
  assert.equal(resolveAdminActivationClientIp({ NODE_ENV: "development", HTTP_X_FORWARDED_FOR: "198.51.100.7" }), "local-development-loopback");
  assert.equal(resolveAdminActivationClientIp({ NODE_ENV: "production" }), null);
  assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
  assert.equal(isJsonContentType("text/plain"), false);
  const tooLarge = new Request("http://localhost/api", { method: "POST", headers: { "content-length": "5000" }, body: "x".repeat(5000) });
  assert.equal((await readBoundedActivationBody(tooLarge)).tooLarge, true);
  const bounded = await readBoundedActivationBody(new Request("http://localhost/api", { method: "POST", body: "{}" }));
  assert.deepEqual(bounded, { text: "{}", tooLarge: false });
});

test("activation service hashes only valid passwords and maps repository failures safely", async () => {
  let hashCalls = 0;
  const received: unknown[] = [];
  const service = new AdminActivationService({
    repository: { async activate(input) { received.push(input); return "activated"; } },
    async hashPassword(password) { hashCalls += 1; return `argon:${password}`; },
    createId: (() => { let id = 0; return () => `id-${++id}-` + "x".repeat(40); })(),
  });
  await assert.rejects(() => service.activate({ token, password: "bad" }), AdminActivationServiceError);
  assert.equal(hashCalls, 0);
  await service.activate(validInput);
  assert.equal(hashCalls, 1);
  const input = received[0] as { token: string; passwordHash: string; userId: string; eventId: string };
  assert.equal(input.token, token);
  assert.equal(input.passwordHash, `argon:${validInput.password}`);
  assert.notEqual(input.userId, input.eventId);
});

test("API counts parseable non-JSON attempts before media rejection and fails closed before activation", async () => {
  const calls: Array<{ token: string | null; clientIp: string; attemptId: string }> = [];
  let activationCalls = 0;
  let activationOperationId = "";
  let rateResult: { allowed: boolean; counted: boolean; outcome: "decided" | "unavailable" } = { allowed: true, counted: true, outcome: "decided" };
  const post = createAdminActivationPost({
    enabled: () => true,
    allowedOrigin: (origin) => origin === "http://localhost:3000",
    resolveClientIp: () => "injected-test-client",
    async recordAttempt(input) { calls.push(input); return rateResult; },
    async activate(_input, operationId) { activationCalls += 1; activationOperationId = operationId; },
  });
  const makeRequest = (body: string, contentType = "application/json", origin: string | null = "http://localhost:3000") => new Request("http://localhost:3000/api/admin/activate", {
    method: "POST", headers: { ...(origin ? { origin } : {}), "content-type": contentType }, body,
  });

  const noOrigin = await post(makeRequest(JSON.stringify(validInput), "application/json", null));
  assert.equal(noOrigin.status, 403);
  assert.equal(calls.length, 0);
  const oversized = await post(new Request("http://localhost:3000/api/admin/activate", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "x".repeat(4097),
  }));
  assert.equal(oversized.status, 413);
  assert.equal(calls.length, 0);
  const wrongMedia = await post(makeRequest(JSON.stringify(validInput), "text/plain"));
  assert.equal(wrongMedia.status, 415);
  assert.equal(calls[0]?.token, token);
  assert.equal(activationCalls, 0);
  const malformed = await post(makeRequest("{", "application/json"));
  assert.equal(malformed.status, 400);
  assert.equal(calls[1]?.token, null);
  const success = await post(makeRequest(JSON.stringify(validInput)));
  assert.equal(success.status, 200);
  assert.equal(activationCalls, 1);
  assert.equal(activationOperationId, calls[2]?.attemptId);
  assert.equal((await OPTIONS()).status, 405);
  const disabledPost = createAdminActivationPost({
    enabled: () => false, allowedOrigin: () => true, resolveClientIp: () => "unused",
    async recordAttempt() { throw new Error("disabled route must not use limiter"); },
    async activate() { throw new Error("disabled route must not activate"); },
  });
  assert.equal((await disabledPost(makeRequest(JSON.stringify(validInput)))).status, 503);
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.equal(success.headers.get("referrer-policy"), "no-referrer");
  assert.equal(success.headers.get("access-control-allow-origin"), null);
  rateResult = { allowed: false, counted: true, outcome: "decided" };
  assert.equal((await post(makeRequest(JSON.stringify(validInput)))).status, 429);
  assert.equal(activationCalls, 1);
  rateResult = { allowed: false, counted: false, outcome: "unavailable" };
  assert.equal((await post(makeRequest(JSON.stringify(validInput)))).status, 503);
  assert.equal(activationCalls, 1);
});

test("bounded transaction helper retries unknown commit on the same session and never replays callback", async () => {
  let callbackCalls = 0;
  let sessionCreations = 0;
  let commitCalls = 0;
  const session = {
    startTransaction() {},
    async commitTransaction() { commitCalls += 1; if (commitCalls === 1) throw { hasErrorLabel: (label: string) => label === "UnknownTransactionCommitResult" }; },
    async abortTransaction() {},
    async endSession() {},
  };
  const database = { client: { startSession() { sessionCreations += 1; return session; } } } as never;
  const result = await runAdminTransaction(database, async () => { callbackCalls += 1; return "ok"; });
  assert.equal(result, "ok");
  assert.equal(callbackCalls, 1);
  assert.equal(sessionCreations, 1);
  assert.equal(commitCalls, 2);
});

test("permanently unknown commit is bounded and reports indeterminate, not rollback", async () => {
  let callbackCalls = 0;
  let commits = 0;
  const session = {
    startTransaction() {},
    async commitTransaction() { commits += 1; throw { hasErrorLabel: (label: string) => label === "UnknownTransactionCommitResult" }; },
    async abortTransaction() {},
    async endSession() {},
  };
  const database = { client: { startSession: () => session } } as never;
  await assert.rejects(() => runAdminTransaction(database, async () => { callbackCalls += 1; return "never claim rollback"; }), AdminTransactionOutcomeUnknownError);
  assert.equal(callbackCalls, 1);
  assert.equal(commits, 3);
});

test("transient callback failures have a bounded retry budget", async () => {
  let callbacks = 0;
  let starts = 0;
  const session = {
    startTransaction() { starts += 1; },
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession() {},
  };
  const database = { client: { startSession: () => session } } as never;
  const result = await runAdminTransaction(database, async () => {
    callbacks += 1;
    if (callbacks < 3) throw { hasErrorLabel: (label: string) => label === "TransientTransactionError" };
    return "committed";
  });
  assert.equal(result, "committed");
  assert.equal(callbacks, 3);
  assert.equal(starts, 3);
});
