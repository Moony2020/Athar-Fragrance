import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { AdminInvitationDocument } from "@/admin/admin-invitation-document";
import { parseAdminInvitationDocument } from "@/admin/admin-invitation-parser";
import type { PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import { normalizeEmail } from "@/identity/contracts";
import { BrevoAdminInvitationMailer, type AdminInvitationMailer } from "@/server/auth/brevo-mailer";
import { AdminInvitationRepositoryError, MongoAdminInvitationRepository } from "@/server/admin/admin-invitation-repository";

export const ADMIN_INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ADMIN_INVITATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type AdminProvisioningErrorCode = "invalid_origin" | "delivery_failed";

export class AdminProvisioningError extends Error {
  constructor(readonly code: AdminProvisioningErrorCode) {
    super(code);
    this.name = "AdminProvisioningError";
  }
}

type Repository = Pick<MongoAdminInvitationRepository, "createPending" | "findPendingByNormalizedEmail" | "markDelivery">;
type Dependencies = {
  repository?: Repository;
  mailer?: AdminInvitationMailer;
  siteUrl?: string;
  now?: () => Date;
  createToken?: () => string;
  createInvitationId?: () => string;
  createEventId?: () => string;
};

export type AdminProvisioningResult = { invitationId: string; reissued: boolean };

export function hashAdminInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildAdminActivationUrl(siteUrl: string | undefined, token: string): string {
  let root: URL;
  try {
    root = new URL(siteUrl || "");
  } catch {
    throw new AdminProvisioningError("invalid_origin");
  }
  if (!/^https?:$/.test(root.protocol) || root.username || root.password) {
    throw new AdminProvisioningError("invalid_origin");
  }
  const activationUrl = new URL("/admin/activate", root.origin);
  activationUrl.hash = `token=${token}`;
  return activationUrl.toString();
}

function opaqueId(): string {
  return randomBytes(32).toString("base64url");
}

export class AdminProvisioningService {
  private readonly repository: Repository;
  private readonly mailer: AdminInvitationMailer;
  private readonly siteUrl: string | undefined;
  private readonly now: () => Date;
  private readonly createToken: () => string;
  private readonly createInvitationId: () => string;
  private readonly createEventId: () => string;

  constructor(dependencies: Dependencies = {}) {
    this.repository = dependencies.repository ?? new MongoAdminInvitationRepository();
    this.mailer = dependencies.mailer ?? new BrevoAdminInvitationMailer();
    this.siteUrl = dependencies.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL;
    this.now = dependencies.now ?? (() => new Date());
    this.createToken = dependencies.createToken ?? opaqueId;
    this.createInvitationId = dependencies.createInvitationId ?? opaqueId;
    this.createEventId = dependencies.createEventId ?? opaqueId;
  }

  async provision(input: { email: string; reissue?: boolean }): Promise<AdminProvisioningResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const reissue = input.reissue === true;
    const expectedPredecessor = reissue
      ? await this.repository.findPendingByNormalizedEmail(normalizedEmail)
      : null;
    if (reissue && !expectedPredecessor) {
      throw new AdminInvitationRepositoryError("concurrent_invitation_conflict");
    }
    const now = this.now();
    const rawToken = this.createToken();
    const activationUrl = buildAdminActivationUrl(this.siteUrl, rawToken);
    const invitationId = this.createInvitationId();
    const expiresAt = new Date(now.getTime() + ADMIN_INVITATION_LIFETIME_MS);
    const invitation: AdminInvitationDocument = parseAdminInvitationDocument({
      invitationId,
      normalizedEmail,
      tokenHash: hashAdminInvitationToken(rawToken),
      status: "pending",
      deliveryStatus: "pending",
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + ADMIN_INVITATION_RETENTION_MS),
      consumedAt: null,
      invalidatedAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const auditEvent: PrivilegedAuditEventDocument = {
      eventId: this.createEventId(),
      actor: { actorType: "system", actorId: "admin-provisioning" },
      action: reissue ? "admin.invitation.reissued" : "admin.invitation.provisioned",
      target: { type: "admin_invitation", id: invitationId },
      outcome: "succeeded",
      metadata: { reason: reissue ? "explicit_reissue" : "new_pending_invitation" },
      createdAt: now,
    };

    await this.repository.createPending({
      invitation,
      auditEvent,
      reissue,
      expectedPredecessorInvitationId: expectedPredecessor?.invitationId,
      now,
    });
    try {
      await this.mailer.sendAdminInvitation({ to: normalizedEmail, activationUrl, expiresHours: 24 });
      await this.repository.markDelivery(invitationId, "sent", this.now());
    } catch {
      await this.repository.markDelivery(invitationId, "failed", this.now()).catch(() => undefined);
      throw new AdminProvisioningError("delivery_failed");
    }
    return { invitationId, reissued: reissue };
  }
}
