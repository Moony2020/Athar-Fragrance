import assert from "node:assert/strict";
import test from "node:test";

import { parseAdminInvitationDocument } from "../src/admin/admin-invitation-parser";
import { parseAdminProvisionCommand } from "../src/admin/admin-provision-command";
import { parsePrivilegedAuditEventDocument } from "../src/admin/privileged-audit-document";
import {
  ADMIN_INVITATION_LIFETIME_MS,
  AdminProvisioningError,
  AdminProvisioningService,
  buildAdminActivationUrl,
  hashAdminInvitationToken,
} from "../src/server/admin/admin-provisioning-service";
import { runAdminProvisionCli } from "../scripts/provision-admin";

const now = new Date("2026-10-07T00:00:00.000Z");
const rawToken = "r".repeat(43);
const invitationId = "i".repeat(43);
const eventId = "e".repeat(43);

test("Admin invitation parser is strict and enforces authoritative state", () => {
  const invitation = parseAdminInvitationDocument({
    invitationId,
    normalizedEmail: "admin@example.invalid",
    tokenHash: "a".repeat(64),
    status: "pending",
    deliveryStatus: "pending",
    expiresAt: new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS),
    purgeAt: new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS + 1),
    consumedAt: null,
    invalidatedAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(invitation.status, "pending");
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, rawToken }));
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, status: "invalidated" }));
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, purgeAt: invitation.expiresAt }));
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, expiresAt: invitation.createdAt }));

  const invalidated = parseAdminInvitationDocument({
    ...invitation,
    status: "invalidated",
    invalidatedAt: new Date(now.getTime() + 1),
  });
  assert.equal(invalidated.consumedAt, null);
  assert.throws(() => parseAdminInvitationDocument({ ...invalidated, consumedAt: new Date(now.getTime() + 2) }));

  const consumed = parseAdminInvitationDocument({
    ...invitation,
    status: "consumed",
    consumedAt: new Date(now.getTime() + 1),
  });
  assert.equal(consumed.invalidatedAt, null);
  assert.throws(() => parseAdminInvitationDocument({ ...consumed, invalidatedAt: new Date(now.getTime() + 2) }));

  const sent = parseAdminInvitationDocument({ ...invitation, deliveryStatus: "sent", deliveredAt: new Date(now.getTime() + 1) });
  assert.ok(sent.deliveredAt);
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, deliveryStatus: "sent" }));
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, deliveryStatus: "failed", deliveredAt: new Date(now.getTime() + 1) }));
  assert.throws(() => parseAdminInvitationDocument({ ...invitation, deliveryStatus: "pending", deliveredAt: new Date(now.getTime() + 1) }));
});

test("token hashing and activation URL keep the token in the fragment only", () => {
  const digest = hashAdminInvitationToken(rawToken);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest.includes(rawToken), false);
  const activationUrl = buildAdminActivationUrl("https://athar.example/store", rawToken);
  const parsed = new URL(activationUrl);
  assert.equal(parsed.pathname, "/admin/activate");
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, `#token=${rawToken}`);
  assert.equal(parsed.origin, "https://athar.example");
  assert.throws(() => buildAdminActivationUrl("javascript:alert(1)", rawToken), AdminProvisioningError);
});

test("provisioning persists only a digest, writes safe audit, and sends through the Admin mail boundary", async () => {
  const creates: unknown[] = [];
  const delivery: unknown[] = [];
  const messages: unknown[] = [];
  const service = new AdminProvisioningService({
    repository: {
      async findPendingByNormalizedEmail() { return null; },
      async createPending(value) { creates.push(value); },
      async markDelivery(...value) { delivery.push(value); },
    },
    mailer: { async sendAdminInvitation(value) { messages.push(value); } },
    siteUrl: "https://athar.example",
    now: () => now,
    createToken: () => rawToken,
    createInvitationId: () => invitationId,
    createEventId: () => eventId,
  });
  const result = await service.provision({ email: " ADMIN@Example.Invalid " });
  assert.deepEqual(result, { invitationId, reissued: false });
  assert.equal(creates.length, 1);
  const serializedCreate = JSON.stringify(creates[0]);
  assert.equal(serializedCreate.includes(rawToken), false);
  assert.equal(serializedCreate.includes("admin@example.invalid"), true);
  assert.equal(serializedCreate.includes("admin-provisioning"), true);
  assert.equal(serializedCreate.includes("admin.invitation.provisioned"), true);
  assert.equal(serializedCreate.includes("password"), false);
  assert.equal(serializedCreate.includes("https://"), false);
  const created = creates[0] as { invitation: { expiresAt: Date; createdAt: Date; tokenHash: string } };
  assert.equal(created.invitation.expiresAt.getTime() - created.invitation.createdAt.getTime(), ADMIN_INVITATION_LIFETIME_MS);
  assert.equal(created.invitation.tokenHash, hashAdminInvitationToken(rawToken));
  assert.deepEqual(messages, [{ to: "admin@example.invalid", activationUrl: `https://athar.example/admin/activate#token=${rawToken}`, expiresHours: 24 }]);
  assert.deepEqual(delivery, [[invitationId, "sent", now]]);
});

test("explicit reissue changes only the action/reason contract", async () => {
  let createInput: Record<string, unknown> | undefined;
  const service = new AdminProvisioningService({
    repository: {
      async findPendingByNormalizedEmail() {
        return parseAdminInvitationDocument({
          invitationId: "p".repeat(43), normalizedEmail: "admin@example.invalid", tokenHash: "b".repeat(64),
          status: "pending", deliveryStatus: "sent", expiresAt: new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS),
          purgeAt: new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS + 1), consumedAt: null, invalidatedAt: null,
          deliveredAt: now, createdAt: now, updatedAt: now,
        });
      },
      async createPending(value) { createInput = value as unknown as Record<string, unknown>; },
      async markDelivery() {},
    },
    mailer: { async sendAdminInvitation() {} },
    siteUrl: "https://athar.example",
    now: () => now,
    createToken: () => rawToken,
    createInvitationId: () => invitationId,
    createEventId: () => eventId,
  });
  assert.deepEqual(await service.provision({ email: "admin@example.invalid", reissue: true }), { invitationId, reissued: true });
  assert.equal(createInput?.reissue, true);
  assert.equal((createInput?.auditEvent as { action: string }).action, "admin.invitation.reissued");
  assert.deepEqual((createInput?.auditEvent as { metadata: unknown }).metadata, { reason: "explicit_reissue" });
});

test("delivery failure is explicit and never reports provisioning success", async () => {
  const deliveryStates: string[] = [];
  const service = new AdminProvisioningService({
    repository: {
      async findPendingByNormalizedEmail() { return null; },
      async createPending() {},
      async markDelivery(_id, state) { deliveryStates.push(state); },
    },
    mailer: { async sendAdminInvitation() { throw new Error("provider unavailable"); } },
    siteUrl: "https://athar.example",
    now: () => now,
    createToken: () => rawToken,
    createInvitationId: () => invitationId,
    createEventId: () => eventId,
  });
  await assert.rejects(() => service.provision({ email: "admin@example.invalid" }), (error: unknown) => {
    return error instanceof AdminProvisioningError && error.code === "delivery_failed";
  });
  assert.deepEqual(deliveryStates, ["failed"]);
});

test("CLI parser accepts only the approved password-free shapes", () => {
  assert.deepEqual(parseAdminProvisionCommand(["--email", "Admin@Example.Invalid"]), { email: "admin@example.invalid", reissue: false });
  assert.deepEqual(parseAdminProvisionCommand(["--reissue", "--email", "admin@example.invalid"]), { email: "admin@example.invalid", reissue: true });
  for (const unsafe of [
    [],
    ["--email", "admin@example.invalid", "--password", "not-allowed"],
    ["--email", "admin@example.invalid", "--reissue", "--reissue"],
    ["--unknown"],
  ]) assert.throws(() => parseAdminProvisionCommand(unsafe));
});

test("CLI runner rejects unsafe arguments before Mongo or Brevo initialization and emits safe output", async () => {
  const unsafeArguments = [
    [],
    ["--email", "admin@example.invalid", "--password", "super-secret-password"],
    ["--unknown"],
    ["--email", "first@example.invalid", "--email", "second@example.invalid"],
    ["--email", "admin@example.invalid", "--reissue", "--reissue"],
    ["--email", "malformed-email"],
  ];

  for (const argumentsList of unsafeArguments) {
    let indexCalls = 0;
    let provisionCalls = 0;
    const output: string[] = [];
    const exitCode = await runAdminProvisionCli(argumentsList, {
      async ensureIndexes() { indexCalls += 1; },
      async provision() { provisionCalls += 1; return { reissued: false }; },
      stdout(message) { output.push(message); },
      stderr(message) { output.push(message); },
    });
    const rendered = output.join("\n");
    assert.equal(exitCode, 1);
    assert.equal(indexCalls, 0);
    assert.equal(provisionCalls, 0);
    assert.equal(rendered.includes("super-secret-password"), false);
    assert.equal(rendered.includes("#token="), false);
    assert.equal(rendered.includes("/admin/activate"), false);
    assert.equal(rendered.toLowerCase().includes("mongodb"), false);
    assert.equal(rendered.toLowerCase().includes("brevo"), false);
  }
});

test("audit schema accepts only the fixed provisioning actor and allow-listed metadata", () => {
  const event = parsePrivilegedAuditEventDocument({
    eventId,
    actor: { actorType: "system", actorId: "admin-provisioning" },
    action: "admin.invitation.provisioned",
    target: { type: "admin_invitation", id: invitationId },
    outcome: "succeeded",
    metadata: { reason: "new_pending_invitation" },
    createdAt: now,
  });
  assert.equal(event.action, "admin.invitation.provisioned");
  assert.throws(() => parsePrivilegedAuditEventDocument({ ...event, actor: { actorType: "system", actorId: "admin-bootstrap" } }));
  assert.throws(() => parsePrivilegedAuditEventDocument({ ...event, metadata: { reason: "new_pending_invitation", email: "admin@example.invalid" } }));
  assert.throws(() => parsePrivilegedAuditEventDocument({ ...event, tokenHash: "a".repeat(64) }));
});
